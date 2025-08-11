from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import cv2
import numpy as np
from segment_anything import sam_model_registry, SamPredictor
import json
import base64
from PIL import Image
import io
# from scipy import ndimage  # 移除scipy依赖

app = Flask(__name__)
CORS(app)  # 允许跨域请求

class SAMAPIServer:
    def __init__(self, checkpoint_path="sam_vit_b_01ec64.pth"):
        """初始化SAM API服务器"""
        print("Loading SAM model...")
        self.sam = sam_model_registry["vit_b"](checkpoint=checkpoint_path)
        self.predictor = SamPredictor(self.sam)
        self.current_image = None
        print("SAM model loaded successfully!")
        
    def set_image(self, image_path):
        """设置图像"""
        try:
            image = cv2.imread(image_path)
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            self.predictor.set_image(image_rgb)
            self.current_image = image_rgb
            return True, "Image set successfully"
        except Exception as e:
            return False, str(e)
    
    def predict(self, points=None, boxes=None, point_labels=None):
        """使用SAM进行预测"""
        try:
            if self.current_image is None:
                return False, "No image set", None
            
            # 暂时禁用色块增强，使用基本SAM功能
            input_points = np.array(points) if points else None
            input_labels = np.array(point_labels) if point_labels else None
            
            input_boxes = np.array(boxes) if boxes else None
            
            # SAM预测 - 使用优化参数获得更精确边界
            print(f"SAM预测输入:")
            print(f"   点坐标: {input_points}")
            print(f"   点标签: {input_labels}")
            print(f"   图像形状: {self.current_image.shape}")
            
            masks, scores, logits = self.predictor.predict(
                point_coords=input_points,
                point_labels=input_labels,
                box=input_boxes,
                multimask_output=True,  # 生成多个候选掩码以选择最佳
                return_logits=True      # 返回logits以便进一步处理
            )
            
            print(f"SAM预测输出:")
            print(f"   掩码数量: {len(masks)}")
            print(f"   掩码形状: {masks[0].shape if len(masks) > 0 else 'None'}")
            print(f"   置信度分数: {scores}")
            print(f"   最高分数索引: {np.argmax(scores)}")
            
            # 确保掩码是布尔类型
            masks = masks > 0
            
            # 返回所有掩码选项（参考官方演示）
            mask_data = []
            best_idx = np.argmax(scores)
            
            for i, (mask, score) in enumerate(zip(masks, scores)):
                # 边界精确化处理
                refined_mask = self.refine_mask_boundaries(mask)
                
                # 确保所有数值都是Python原生类型，避免JSON序列化错误
                mask_array = (refined_mask * 255).astype(np.uint8)  # 转换为0-255范围
                mask_data.append({
                    "mask": mask_array.tolist(),
                    "score": float(score),
                    "is_best": bool(i == best_idx),  # 显式转换为Python bool
                    "area": int(np.sum(refined_mask > 0))  # 计算真实面积
                })
            
            # 选择最佳掩码（使用精确化后的掩码）
            best_mask = self.refine_mask_boundaries(masks[best_idx])
            best_score = scores[best_idx]
            
            return True, "Prediction successful", {
                "masks": mask_data,
                "best_mask": (best_mask * 255).astype(np.uint8).tolist(),  # 转换为0-255范围
                "best_score": float(best_score),
                "shape": [int(best_mask.shape[0]), int(best_mask.shape[1])],  # 确保shape也是原生int
                "num_masks": int(len(masks))
            }
            
        except Exception as e:
            return False, str(e), None
    
    def refine_mask_boundaries(self, mask):
        """最小化掩码处理，保持原始SAM精度"""
        try:
            # 首先检查掩码是否有效
            if mask is None or mask.size == 0 or not np.any(mask):
                print("警告: 掩码为空或无效，返回原始掩码")
                return mask
            
            # 确保掩码是bool类型
            bool_mask = mask.astype(bool)
            original_area = np.sum(bool_mask)
            
            print(f"掩码精化前面积: {original_area} 像素")
            
            # 最小化处理：只移除单像素噪点
            if original_area > 100:  # 只对足够大的掩码进行清理
                # 使用最小的kernel只移除孤立像素
                kernel = np.ones((2,2), np.uint8)
                uint8_mask = bool_mask.astype(np.uint8) * 255
                
                # 很轻微的开运算，只移除明显的噪点
                cleaned_mask = cv2.morphologyEx(uint8_mask, cv2.MORPH_OPEN, kernel, iterations=1)
                refined_bool = (cleaned_mask > 0).astype(bool)
                
                refined_area = np.sum(refined_bool)
                
                # 只接受面积变化很小的结果
                if refined_area > original_area * 0.8 and refined_area < original_area * 1.2:
                    print(f"掩码精化后面积: {refined_area} 像素 (变化: {((refined_area/original_area)-1)*100:.1f}%)")
                    return refined_bool
                else:
                    print(f"掩码处理后面积变化过大，保持原始掩码")
                    return bool_mask
            else:
                print(f"掩码面积较小，跳过精化处理")
                return bool_mask
            
        except Exception as e:
            # 如果精确化失败，返回原始掩码
            print(f"边界精确化失败: {e}")
            return mask.astype(bool) if hasattr(mask, 'astype') else mask
    
    def enhance_points_with_color_analysis(self, points, point_labels):
        """基于颜色分析增强点击点（参考官方演示的预处理）"""
        try:
            if not points:
                return points, point_labels
            
            enhanced_points = []
            enhanced_labels = []
            
            # 获取图像的BGR格式用于OpenCV处理
            image_bgr = cv2.cvtColor(self.current_image, cv2.COLOR_RGB2BGR)
            h, w = image_bgr.shape[:2]
            
            for i, (point, label) in enumerate(zip(points, point_labels or [1] * len(points))):
                x, y = int(point[0]), int(point[1])
                
                # 确保点在图像范围内
                if not (0 <= x < w and 0 <= y < h):
                    enhanced_points.append(point)
                    enhanced_labels.append(label)
                    continue
                
                if label == 1:  # 只对正样本点进行增强
                    # 获取点击位置的颜色
                    click_color = image_bgr[y, x]
                    
                    # 基于颜色相似度找到色块区域
                    color_mask = self.find_similar_color_region(image_bgr, click_color, x, y)
                    
                    if color_mask is not None and np.any(color_mask):
                        # 在色块边界上添加额外的引导点
                        boundary_points = self.extract_boundary_guidance_points(color_mask, x, y)
                        
                        # 添加原始点
                        enhanced_points.append(point)
                        enhanced_labels.append(label)
                        
                        # 添加边界引导点
                        for bp in boundary_points:
                            enhanced_points.append(bp)
                            enhanced_labels.append(1)  # 都是正样本
                        
                        print(f"点 ({x},{y}) 增强为 {len(boundary_points)+1} 个点")
                    else:
                        enhanced_points.append(point)
                        enhanced_labels.append(label)
                else:
                    # 负样本点直接添加
                    enhanced_points.append(point)
                    enhanced_labels.append(label)
            
            return enhanced_points, enhanced_labels
            
        except Exception as e:
            print(f"点增强失败: {e}")
            return points, point_labels
    
    def find_similar_color_region(self, image_bgr, target_color, center_x, center_y):
        """查找相似颜色的区域"""
        try:
            # 颜色容差（可调整）
            color_tolerance = 30
            
            # 创建颜色掩码
            lower_bound = np.maximum(target_color.astype(int) - color_tolerance, 0)
            upper_bound = np.minimum(target_color.astype(int) + color_tolerance, 255)
            
            color_mask = cv2.inRange(image_bgr, lower_bound, upper_bound)
            
            # 形态学操作连接相近的区域
            kernel = np.ones((5,5), np.uint8)
            color_mask = cv2.morphologyEx(color_mask, cv2.MORPH_CLOSE, kernel)
            color_mask = cv2.morphologyEx(color_mask, cv2.MORPH_OPEN, kernel)
            
            # 使用泛洪填充确保连通性
            h, w = image_bgr.shape[:2]
            flood_mask = np.zeros((h+2, w+2), np.uint8)
            
            cv2.floodFill(color_mask, flood_mask, (center_x, center_y), 255)
            
            return color_mask > 0
            
        except Exception as e:
            print(f"颜色区域查找失败: {e}")
            return None
    
    def extract_boundary_guidance_points(self, color_mask, center_x, center_y, max_points=4):
        """从色块边界提取引导点"""
        try:
            # 找到轮廓
            contours, _ = cv2.findContours(
                color_mask.astype(np.uint8), 
                cv2.RETR_EXTERNAL, 
                cv2.CHAIN_APPROX_SIMPLE
            )
            
            if not contours:
                return []
            
            # 选择包含中心点的最大轮廓
            target_contour = None
            for contour in contours:
                if cv2.pointPolygonTest(contour, (center_x, center_y), False) >= 0:
                    target_contour = contour
                    break
            
            if target_contour is None:
                target_contour = max(contours, key=cv2.contourArea)
            
            # 从轮廓上均匀采样点
            contour_points = target_contour.reshape(-1, 2)
            
            if len(contour_points) < max_points:
                return [[int(p[0]), int(p[1])] for p in contour_points]
            
            # 均匀采样
            step = len(contour_points) // max_points
            sampled_points = []
            
            for i in range(0, len(contour_points), step):
                if len(sampled_points) >= max_points:
                    break
                point = contour_points[i]
                sampled_points.append([int(point[0]), int(point[1])])
            
            return sampled_points
            
        except Exception as e:
            print(f"边界点提取失败: {e}")
            return []

# 全局SAM实例
sam_server = None

@app.route('/')
def index():
    """服务主页"""
    return send_from_directory('.', 'web_sam_annotator.html')

@app.route('/<path:filename>')
def serve_files(filename):
    """服务静态文件"""
    return send_from_directory('.', filename)

@app.route('/api/init', methods=['POST'])
def init_sam():
    """初始化SAM"""
    global sam_server
    try:
        data = request.get_json()
        image_path = data.get('image_path', 'lumine-yurakucho.png')
        
        if sam_server is None:
            sam_server = SAMAPIServer()
        
        success, message = sam_server.set_image(image_path)
        
        return jsonify({
            "success": success,
            "message": message,
            "image_shape": sam_server.current_image.shape if success else None
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/predict', methods=['POST'])
def predict():
    """SAM预测接口"""
    global sam_server
    try:
        if sam_server is None:
            return jsonify({"success": False, "message": "SAM not initialized"}), 400
        
        data = request.get_json()
        points = data.get('points', [])
        boxes = data.get('boxes', [])
        point_labels = data.get('point_labels', [])
        
        success, message, result = sam_server.predict(
            points=points if points else None,
            boxes=boxes if boxes else None,
            point_labels=point_labels if point_labels else None
        )
        
        if success:
            return jsonify({
                "success": True,
                "message": message,
                "masks": result["masks"],
                "best_mask": result["best_mask"],
                "best_score": result["best_score"],
                "shape": result["shape"],
                "num_masks": result["num_masks"],
                # 向后兼容
                "mask": result["best_mask"],
                "score": result["best_score"]
            })
        else:
            return jsonify({"success": False, "message": message}), 400
            
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health():
    """健康检查"""
    return jsonify({
        "status": "healthy",
        "sam_loaded": sam_server is not None,
        "image_loaded": sam_server.current_image is not None if sam_server else False
    })

def main():
    print("Starting SAM API Server...")
    print("Features:")
    print("  - Interactive point-based annotation")
    print("  - Bounding box annotation")
    print("  - Real SAM model integration")
    print("  - Web-based interface")
    print("\nAccess the annotator at: http://localhost:5000")
    print("API endpoints:")
    print("  - POST /api/init - Initialize SAM")
    print("  - POST /api/predict - Generate masks")
    print("  - GET /api/health - Health check")
    print("\n" + "="*50)
    
    app.run(host='0.0.0.0', port=5000, debug=True)

if __name__ == "__main__":
    main()