#!/usr/bin/env python3
"""
Test raw SAM output without refinement
"""

import cv2
import numpy as np
from segment_anything import sam_model_registry, SamPredictor
import matplotlib.pyplot as plt

def test_raw_sam():
    """测试原始SAM输出"""
    print("Loading SAM model...")
    sam = sam_model_registry["vit_b"](checkpoint="sam_vit_b_01ec64.pth")
    predictor = SamPredictor(sam)
    
    # 加载图像
    print("Loading image...")
    image = cv2.imread("lumine-yurakucho.png")
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    predictor.set_image(image_rgb)
    
    print(f"Image shape: {image_rgb.shape}")
    
    # 测试点
    test_point = [310, 150]  # 商场中的一个点
    input_points = np.array([test_point])
    input_labels = np.array([1])  # 正样本
    
    print(f"Testing point: {test_point}")
    
    # SAM预测
    print("Running SAM prediction...")
    masks, scores, logits = predictor.predict(
        point_coords=input_points,
        point_labels=input_labels,
        multimask_output=True,
        return_logits=True
    )
    
    print(f"Generated {len(masks)} masks")
    
    # 分析每个掩码
    for i, (mask, score) in enumerate(zip(masks, scores)):
        area = np.sum(mask)
        total_pixels = mask.size
        coverage = (area / total_pixels) * 100
        
        print(f"Mask {i+1}:")
        print(f"  Score: {score:.4f}")
        print(f"  Area: {area} pixels")
        print(f"  Coverage: {coverage:.2f}% of image")
        print(f"  Shape: {mask.shape}")
        
        # 检查是否覆盖全图
        if coverage > 80:
            print(f"  WARNING: Mask covers {coverage:.1f}% of image!")
        elif coverage < 1:
            print(f"  WARNING: Mask covers only {coverage:.3f}% of image!")
        else:
            print(f"  OK: Normal coverage")
            
        # 保存掩码可视化
        plt.figure(figsize=(10, 6))
        
        plt.subplot(1, 2, 1)
        plt.imshow(image_rgb)
        plt.plot(test_point[0], test_point[1], 'ro', markersize=10)
        plt.title('Original Image + Test Point')
        plt.axis('off')
        
        plt.subplot(1, 2, 2)
        plt.imshow(image_rgb)
        plt.imshow(mask, alpha=0.5, cmap='jet')
        plt.plot(test_point[0], test_point[1], 'ro', markersize=10)
        plt.title(f'Mask {i+1} (Score: {score:.3f}, Coverage: {coverage:.1f}%)')
        plt.axis('off')
        
        plt.tight_layout()
        plt.savefig(f'raw_sam_mask_{i+1}.png', dpi=150, bbox_inches='tight')
        plt.close()
        
        print(f"  Saved visualization: raw_sam_mask_{i+1}.png")
    
    # 选择最佳掩码进行详细分析
    best_idx = np.argmax(scores)
    best_mask = masks[best_idx]
    best_score = scores[best_idx]
    
    print(f"\nBest mask analysis (Mask {best_idx+1}):")
    print(f"  Score: {best_score:.4f}")
    print(f"  Shape: {best_mask.shape}")
    print(f"  Data type: {best_mask.dtype}")
    print(f"  Min/Max values: {best_mask.min()}/{best_mask.max()}")
    
    # 检查掩码中心区域
    h, w = best_mask.shape
    center_region = best_mask[h//2-50:h//2+50, w//2-50:w//2+50]
    center_coverage = np.sum(center_region) / center_region.size * 100
    print(f"  Center region coverage: {center_coverage:.1f}%")
    
    # 检查测试点周围区域
    py, px = test_point[1], test_point[0]  # 注意y,x顺序
    if 0 <= py < h and 0 <= px < w:
        point_region = best_mask[max(0,py-10):min(h,py+10), max(0,px-10):min(w,px+10)]
        point_coverage = np.sum(point_region) / point_region.size * 100
        print(f"  Test point region coverage: {point_coverage:.1f}%")
        print(f"  Test point value: {best_mask[py, px]}")
    
    print("\nRaw SAM test completed!")

if __name__ == "__main__":
    test_raw_sam()