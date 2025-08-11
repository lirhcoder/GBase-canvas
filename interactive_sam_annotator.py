import cv2
import numpy as np
import matplotlib.pyplot as plt
import json
import tkinter as tk
from tkinter import messagebox, simpledialog
from PIL import Image, ImageTk
from segment_anything import sam_model_registry, SamPredictor

class InteractiveSAMAnnotator:
    def __init__(self, image_path, checkpoint_path="sam_vit_b_01ec64.pth"):
        """交互式SAM标注工具"""
        print("Loading SAM model...")
        self.sam = sam_model_registry["vit_b"](checkpoint=checkpoint_path)
        self.predictor = SamPredictor(self.sam)
        
        # 加载图像
        self.image = cv2.imread(image_path)
        self.image_rgb = cv2.cvtColor(self.image, cv2.COLOR_BGR2RGB)
        self.predictor.set_image(self.image_rgb)
        
        # 标注数据
        self.annotations = []
        self.current_points = []
        self.current_boxes = []
        self.point_labels = []
        
        # UI设置
        self.root = tk.Tk()
        self.root.title("Interactive SAM Mall Annotator")
        
        # 调整图像尺寸以适应屏幕
        self.display_scale = min(800 / self.image.shape[1], 600 / self.image.shape[0])
        self.display_width = int(self.image.shape[1] * self.display_scale)
        self.display_height = int(self.image.shape[0] * self.display_scale)
        
        self.display_image = cv2.resize(self.image_rgb, (self.display_width, self.display_height))
        
        self.setup_ui()
        
    def setup_ui(self):
        """设置用户界面"""
        # 控制面板
        control_frame = tk.Frame(self.root)
        control_frame.pack(side=tk.TOP, fill=tk.X, padx=10, pady=5)
        
        # 模式选择
        tk.Label(control_frame, text="标注模式:").pack(side=tk.LEFT)
        self.mode_var = tk.StringVar(value="point")
        tk.Radiobutton(control_frame, text="点击模式", variable=self.mode_var, 
                      value="point").pack(side=tk.LEFT)
        tk.Radiobutton(control_frame, text="框选模式", variable=self.mode_var, 
                      value="box").pack(side=tk.LEFT)
        
        # 按钮
        tk.Button(control_frame, text="生成掩码", command=self.generate_mask,
                 bg='green', fg='white').pack(side=tk.LEFT, padx=5)
        tk.Button(control_frame, text="保存当前", command=self.save_current_annotation,
                 bg='blue', fg='white').pack(side=tk.LEFT, padx=5)
        tk.Button(control_frame, text="清除当前", command=self.clear_current,
                 bg='orange', fg='white').pack(side=tk.LEFT, padx=5)
        tk.Button(control_frame, text="导出数据", command=self.export_annotations,
                 bg='purple', fg='white').pack(side=tk.LEFT, padx=5)
        
        # 信息显示
        info_frame = tk.Frame(self.root)
        info_frame.pack(side=tk.TOP, fill=tk.X, padx=10)
        
        self.info_label = tk.Label(info_frame, text="点击图像添加正样本点，右键添加负样本点，框选模式下拖拽选择区域")
        self.info_label.pack()
        
        self.count_label = tk.Label(info_frame, text="已标注店铺: 0")
        self.count_label.pack()
        
        # 图像画布
        self.canvas = tk.Canvas(self.root, width=self.display_width, height=self.display_height)
        self.canvas.pack(padx=10, pady=10)
        
        # 显示图像
        self.update_display()
        
        # 绑定事件
        self.canvas.bind("<Button-1>", self.on_left_click)
        self.canvas.bind("<Button-3>", self.on_right_click)
        self.canvas.bind("<B1-Motion>", self.on_drag)
        self.canvas.bind("<ButtonRelease-1>", self.on_release)
        
        # 拖拽状态
        self.dragging = False
        self.drag_start = None
        
    def update_display(self):
        """更新显示图像"""
        display_img = self.display_image.copy()
        
        # 绘制当前点
        for i, (point, label) in enumerate(zip(self.current_points, self.point_labels)):
            x, y = int(point[0] * self.display_scale), int(point[1] * self.display_scale)
            color = (0, 255, 0) if label == 1 else (255, 0, 0)
            cv2.circle(display_img, (x, y), 5, color, -1)
            cv2.putText(display_img, str(i+1), (x+8, y), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
        
        # 绘制当前框
        for box in self.current_boxes:
            x1, y1, x2, y2 = box
            x1, y1 = int(x1 * self.display_scale), int(y1 * self.display_scale)
            x2, y2 = int(x2 * self.display_scale), int(y2 * self.display_scale)
            cv2.rectangle(display_img, (x1, y1), (x2, y2), (255, 255, 0), 2)
        
        # 绘制已保存的标注
        for i, annotation in enumerate(self.annotations):
            mask = annotation['mask']
            # 调整掩码尺寸
            mask_resized = cv2.resize(mask.astype(np.uint8), (self.display_width, self.display_height))
            
            # 用不同颜色显示每个标注
            color = plt.cm.tab10(i % 10)[:3]
            color = tuple(int(c * 255) for c in color)
            
            # 半透明覆盖
            overlay = display_img.copy()
            overlay[mask_resized > 0] = color
            display_img = cv2.addWeighted(display_img, 0.7, overlay, 0.3, 0)
            
            # 绘制边界
            contours, _ = cv2.findContours(mask_resized, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            cv2.drawContours(display_img, contours, -1, color, 2)
        
        # 转换为PhotoImage并显示
        pil_image = Image.fromarray(display_img)
        self.photo = ImageTk.PhotoImage(pil_image)
        self.canvas.delete("all")
        self.canvas.create_image(0, 0, anchor=tk.NW, image=self.photo)
        
    def on_left_click(self, event):
        """左键点击处理"""
        if self.mode_var.get() == "point":
            # 点击模式：添加正样本点
            x = event.x / self.display_scale
            y = event.y / self.display_scale
            self.current_points.append([x, y])
            self.point_labels.append(1)  # 正样本
            self.update_display()
        elif self.mode_var.get() == "box":
            # 框选模式：开始拖拽
            self.dragging = True
            self.drag_start = (event.x / self.display_scale, event.y / self.display_scale)
            
    def on_right_click(self, event):
        """右键点击处理"""
        if self.mode_var.get() == "point":
            # 右键：添加负样本点
            x = event.x / self.display_scale
            y = event.y / self.display_scale
            self.current_points.append([x, y])
            self.point_labels.append(0)  # 负样本
            self.update_display()
            
    def on_drag(self, event):
        """拖拽处理"""
        if self.mode_var.get() == "box" and self.dragging and self.drag_start:
            # 实时显示拖拽框
            self.update_display()
            x1, y1 = self.drag_start
            x2, y2 = event.x / self.display_scale, event.y / self.display_scale
            
            # 在画布上绘制临时框
            canvas_x1, canvas_y1 = int(x1 * self.display_scale), int(y1 * self.display_scale)
            canvas_x2, canvas_y2 = event.x, event.y
            self.canvas.create_rectangle(canvas_x1, canvas_y1, canvas_x2, canvas_y2,
                                       outline='yellow', width=2, tags='temp_box')
            
    def on_release(self, event):
        """鼠标释放处理"""
        if self.mode_var.get() == "box" and self.dragging and self.drag_start:
            # 完成框选
            x1, y1 = self.drag_start
            x2, y2 = event.x / self.display_scale, event.y / self.display_scale
            
            # 确保坐标顺序正确
            x1, x2 = min(x1, x2), max(x1, x2)
            y1, y2 = min(y1, y2), max(y1, y2)
            
            if abs(x2 - x1) > 5 and abs(y2 - y1) > 5:  # 避免太小的框
                self.current_boxes.append([x1, y1, x2, y2])
            
            self.dragging = False
            self.drag_start = None
            self.canvas.delete('temp_box')
            self.update_display()
            
    def generate_mask(self):
        """生成SAM掩码"""
        if not self.current_points and not self.current_boxes:
            messagebox.showwarning("警告", "请先添加点或框！")
            return
            
        try:
            # 准备输入
            input_points = np.array(self.current_points) if self.current_points else None
            input_labels = np.array(self.point_labels) if self.current_points else None
            input_boxes = np.array(self.current_boxes) if self.current_boxes else None
            
            # 使用SAM预测
            masks, scores, _ = self.predictor.predict(
                point_coords=input_points,
                point_labels=input_labels,
                box=input_boxes,
                multimask_output=True
            )
            
            # 选择最佳掩码
            best_mask = masks[np.argmax(scores)]
            
            # 临时显示预测结果
            self.temp_mask = best_mask
            self.show_temp_mask()
            
        except Exception as e:
            messagebox.showerror("错误", f"SAM预测失败: {str(e)}")
            
    def show_temp_mask(self):
        """显示临时掩码"""
        if hasattr(self, 'temp_mask'):
            display_img = self.display_image.copy()
            
            # 调整掩码尺寸
            mask_resized = cv2.resize(self.temp_mask.astype(np.uint8), 
                                    (self.display_width, self.display_height))
            
            # 高亮显示
            overlay = display_img.copy()
            overlay[mask_resized > 0] = [255, 255, 0]  # 黄色高亮
            display_img = cv2.addWeighted(display_img, 0.6, overlay, 0.4, 0)
            
            # 绘制边界
            contours, _ = cv2.findContours(mask_resized, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            cv2.drawContours(display_img, contours, -1, (255, 255, 0), 3)
            
            # 绘制当前输入
            for i, (point, label) in enumerate(zip(self.current_points, self.point_labels)):
                x, y = int(point[0] * self.display_scale), int(point[1] * self.display_scale)
                color = (0, 255, 0) if label == 1 else (255, 0, 0)
                cv2.circle(display_img, (x, y), 5, color, -1)
            
            for box in self.current_boxes:
                x1, y1, x2, y2 = box
                x1, y1 = int(x1 * self.display_scale), int(y1 * self.display_scale)
                x2, y2 = int(x2 * self.display_scale), int(y2 * self.display_scale)
                cv2.rectangle(display_img, (x1, y1), (x2, y2), (255, 255, 0), 2)
            
            # 更新显示
            pil_image = Image.fromarray(display_img)
            self.photo = ImageTk.PhotoImage(pil_image)
            self.canvas.delete("all")
            self.canvas.create_image(0, 0, anchor=tk.NW, image=self.photo)
            
    def save_current_annotation(self):
        """保存当前标注"""
        if not hasattr(self, 'temp_mask'):
            messagebox.showwarning("警告", "请先生成掩码！")
            return
            
        # 询问店铺名称
        store_name = simpledialog.askstring("店铺名称", "请输入店铺名称:")
        if not store_name:
            return
            
        # 询问店铺类别
        categories = ["レディスファッション", "インテリア・生活雑貨", "ファッション雑貨"]
        category_window = tk.Toplevel(self.root)
        category_window.title("选择类别")
        category_window.geometry("300x150")
        
        selected_category = tk.StringVar(value=categories[0])
        
        for cat in categories:
            tk.Radiobutton(category_window, text=cat, variable=selected_category, 
                          value=cat).pack(anchor=tk.W, padx=20, pady=5)
        
        def confirm_category():
            category_window.quit()
            category_window.destroy()
            
        tk.Button(category_window, text="确认", command=confirm_category,
                 bg='green', fg='white').pack(pady=10)
        
        category_window.wait_window()
        category = selected_category.get()
        
        # 保存标注
        mask = self.temp_mask
        
        # 计算边界框和多边形
        y_indices, x_indices = np.where(mask)
        if len(x_indices) > 0:
            x1, x2 = int(np.min(x_indices)), int(np.max(x_indices))
            y1, y2 = int(np.min(y_indices)), int(np.max(y_indices))
            
            # 提取轮廓
            contours, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if contours:
                largest_contour = max(contours, key=cv2.contourArea)
                
                # 简化轮廓
                epsilon = 0.005 * cv2.arcLength(largest_contour, True)
                approx = cv2.approxPolyDP(largest_contour, epsilon, True)
                
                polygon = [{"x": int(point[0][0]), "y": int(point[0][1])} for point in approx]
                
                # 计算中心点
                M = cv2.moments(largest_contour)
                if M["m00"] != 0:
                    cx = int(M["m10"] / M["m00"])
                    cy = int(M["m01"] / M["m00"])
                else:
                    cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
                
                # 创建标注数据
                annotation = {
                    "id": f"store_{len(self.annotations)}",
                    "name": store_name,
                    "category": category,
                    "color": self.get_category_color(category),
                    "bbox": {"x": x1, "y": y1, "width": x2-x1, "height": y2-y1},
                    "polygon": polygon,
                    "center": {"x": cx, "y": cy},
                    "area": int(np.sum(mask)),
                    "mask": mask
                }
                
                self.annotations.append(annotation)
                
                # 清除当前输入
                self.clear_current()
                
                # 更新计数
                self.count_label.config(text=f"已标注店铺: {len(self.annotations)}")
                
                messagebox.showinfo("成功", f"店铺 '{store_name}' 标注完成！")
                
    def get_category_color(self, category):
        """获取类别颜色"""
        colors = {
            "レディスファッション": "#FFB6C1",
            "インテリア・生活雑貨": "#ADD8E6", 
            "ファッション雑貨": "#98FB98"
        }
        return colors.get(category, "#CCCCCC")
        
    def clear_current(self):
        """清除当前输入"""
        self.current_points = []
        self.current_boxes = []
        self.point_labels = []
        if hasattr(self, 'temp_mask'):
            delattr(self, 'temp_mask')
        self.update_display()
        
    def export_annotations(self):
        """导出标注数据"""
        if not self.annotations:
            messagebox.showwarning("警告", "没有标注数据可导出！")
            return
            
        # 准备导出数据（不包含掩码数据）
        export_data = {
            "image_dimensions": {"width": self.image.shape[1], "height": self.image.shape[0]},
            "extraction_method": "interactive_sam_annotation",
            "categories": {
                "レディスファッション": {"color": "#FFB6C1", "label": "Ladies Fashion"},
                "インテリア・生活雑貨": {"color": "#ADD8E6", "label": "Interior & Lifestyle"},
                "ファッション雑貨": {"color": "#98FB98", "label": "Fashion Accessories"}
            },
            "stores": []
        }
        
        for annotation in self.annotations:
            store_data = annotation.copy()
            del store_data['mask']  # 移除掩码数据
            export_data["stores"].append(store_data)
        
        # 保存数据
        with open("output/interactive_sam_annotations.json", 'w', encoding='utf-8') as f:
            json.dump(export_data, f, ensure_ascii=False, indent=2)
        
        # 创建可视化
        self.create_final_visualization(export_data)
        
        messagebox.showinfo("成功", f"已导出 {len(self.annotations)} 个店铺标注！\n"
                                   f"数据文件: output/interactive_sam_annotations.json\n"
                                   f"可视化: output/interactive_sam_result.png")
        
    def create_final_visualization(self, export_data):
        """创建最终可视化"""
        plt.figure(figsize=(15, 20))
        plt.imshow(self.image_rgb)
        
        colors = plt.cm.tab10(np.linspace(0, 1, len(self.annotations)))
        
        for i, (annotation, color) in enumerate(zip(self.annotations, colors)):
            mask = annotation['mask']
            
            # 绘制掩码
            plt.imshow(np.dstack([mask, mask, mask]) * color.reshape(1, 1, -1)[:3], alpha=0.4)
            
            # 绘制边界
            contours, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            for contour in contours:
                x_coords = contour[:, 0, 0]
                y_coords = contour[:, 0, 1]
                plt.plot(np.append(x_coords, x_coords[0]), np.append(y_coords, y_coords[0]), 
                        color=color, linewidth=3)
            
            # 添加标签
            center = annotation['center']
            plt.text(center['x'], center['y'], annotation['name'],
                    fontsize=10, ha='center', va='center',
                    bbox=dict(boxstyle="round,pad=0.4", facecolor='white', alpha=0.9, edgecolor=color),
                    weight='bold')
        
        plt.axis('off')
        plt.title('Interactive SAM Annotation Results', fontsize=18, pad=20, weight='bold')
        plt.tight_layout()
        plt.savefig("output/interactive_sam_result.png", dpi=300, bbox_inches='tight')
        plt.close()
        
    def run(self):
        """运行标注工具"""
        print("\n=== 交互式SAM标注工具 ===")
        print("使用说明:")
        print("1. 选择'点击模式'：左键添加正样本点，右键添加负样本点")
        print("2. 选择'框选模式'：拖拽鼠标选择区域")
        print("3. 点击'生成掩码'预览SAM结果")
        print("4. 点击'保存当前'保存标注")
        print("5. 完成所有标注后点击'导出数据'")
        print("=====================================")
        
        self.root.mainloop()

def main():
    """主函数"""
    try:
        annotator = InteractiveSAMAnnotator("lumine-yurakucho.png")
        annotator.run()
    except Exception as e:
        print(f"启动标注工具失败: {e}")
        print("请确保已安装必要依赖: tkinter, pillow")

if __name__ == "__main__":
    main()