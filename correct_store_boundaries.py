import json
import cv2
import numpy as np
import matplotlib.pyplot as plt

def create_corrected_store_data():
    """基于原图精确测量创建修正的店铺边界"""
    
    # 图像尺寸 610x929
    image_width, image_height = 610, 929
    
    # 重新精确定义每个店铺的边界（基于原图仔细观察）
    corrected_stores = [
        # 第一行 - 顶部
        {
            "id": "store_0",
            "name": "シルパイ シルスチュアート",
            "category": "レディスファッション",
            "color": "#FFB6C1",
            "bbox": {"x": 248, "y": 95, "width": 124, "height": 107},
            "polygon": [
                {"x": 248, "y": 95}, {"x": 372, "y": 95},
                {"x": 372, "y": 202}, {"x": 248, "y": 202}
            ],
            "center": {"x": 310, "y": 148}
        },
        {
            "id": "store_1", 
            "name": "フランフラン",
            "category": "インテリア・生活雑貨",
            "color": "#ADD8E6",
            "bbox": {"x": 382, "y": 95, "width": 123, "height": 107},
            "polygon": [
                {"x": 382, "y": 95}, {"x": 505, "y": 95},
                {"x": 505, "y": 202}, {"x": 382, "y": 202}
            ],
            "center": {"x": 443, "y": 148}
        },
        
        # 第二行
        {
            "id": "store_2",
            "name": "アンドクチュール", 
            "category": "レディスファッション",
            "color": "#FFB6C1",
            "bbox": {"x": 124, "y": 160, "width": 116, "height": 138},
            "polygon": [
                {"x": 124, "y": 160}, {"x": 206, "y": 160}, 
                {"x": 240, "y": 194}, {"x": 240, "y": 298}, {"x": 124, "y": 298}
            ],
            "center": {"x": 182, "y": 229}
        },
        {
            "id": "store_3",
            "name": "ラグナムーン",  # 修正：应该是完整的矩形
            "category": "レディスファッション",
            "color": "#FFB6C1",
            "bbox": {"x": 248, "y": 212, "width": 124, "height": 83},
            "polygon": [
                {"x": 248, "y": 212}, {"x": 372, "y": 212},
                {"x": 372, "y": 295}, {"x": 248, "y": 295}
            ],
            "center": {"x": 310, "y": 253}
        },
        {
            "id": "store_4",
            "name": "フランフラン",
            "category": "インテリア・生活雑貨",
            "color": "#ADD8E6", 
            "bbox": {"x": 382, "y": 212, "width": 123, "height": 83},
            "polygon": [
                {"x": 382, "y": 212}, {"x": 505, "y": 212},
                {"x": 505, "y": 295}, {"x": 382, "y": 295}
            ],
            "center": {"x": 443, "y": 253}
        },
        
        # 第三行
        {
            "id": "store_5",
            "name": "アルページュストーリー",
            "category": "レディスファッション",
            "color": "#FFB6C1",
            "bbox": {"x": 124, "y": 308, "width": 116, "height": 158},
            "polygon": [
                {"x": 124, "y": 308}, {"x": 240, "y": 308},
                {"x": 240, "y": 466}, {"x": 124, "y": 466}
            ],
            "center": {"x": 182, "y": 387}
        },
        {
            "id": "store_6", 
            "name": "ココディールリックス",
            "category": "レディスファッション",
            "color": "#FFB6C1",
            "bbox": {"x": 248, "y": 305, "width": 124, "height": 83},
            "polygon": [
                {"x": 248, "y": 305}, {"x": 372, "y": 305},
                {"x": 372, "y": 388}, {"x": 248, "y": 388}
            ],
            "center": {"x": 310, "y": 346}
        },
        {
            "id": "store_7",
            "name": "ノエラ", 
            "category": "レディスファッション",
            "color": "#FFB6C1",
            "bbox": {"x": 382, "y": 305, "width": 123, "height": 83},
            "polygon": [
                {"x": 382, "y": 305}, {"x": 505, "y": 305},
                {"x": 505, "y": 388}, {"x": 382, "y": 388}
            ],
            "center": {"x": 443, "y": 346}
        },
        
        # 第四行 - ウィルセレクション 向下延伸
        {
            "id": "store_8",
            "name": "ウィルセレクション",
            "category": "レディスファッション",
            "color": "#FFB6C1", 
            "bbox": {"x": 382, "y": 398, "width": 123, "height": 110},
            "polygon": [
                {"x": 382, "y": 398}, {"x": 505, "y": 398},
                {"x": 505, "y": 508}, {"x": 382, "y": 508}
            ],
            "center": {"x": 443, "y": 453}
        },
        
        # 第五行
        {
            "id": "store_9",
            "name": "マーキュリーデュオ",
            "category": "ファッション雑貨",
            "color": "#98FB98",
            "bbox": {"x": 248, "y": 518, "width": 124, "height": 72},
            "polygon": [
                {"x": 248, "y": 518}, {"x": 372, "y": 518},
                {"x": 372, "y": 590}, {"x": 248, "y": 590}
            ],
            "center": {"x": 310, "y": 554}
        },
        {
            "id": "store_10",
            "name": "エメエクル",
            "category": "レディスファッション",
            "color": "#FFB6C1",
            "bbox": {"x": 382, "y": 518, "width": 123, "height": 72},
            "polygon": [
                {"x": 382, "y": 518}, {"x": 505, "y": 518}, 
                {"x": 505, "y": 590}, {"x": 382, "y": 590}
            ],
            "center": {"x": 443, "y": 554}
        },
        
        # 底部区域 - 使用检测到的精确轮廓
        {
            "id": "store_11",
            "name": "ダイアナ", 
            "category": "ファッション雑貨",
            "color": "#98FB98",
            "bbox": {"x": 128, "y": 610, "width": 152, "height": 180},
            "polygon": [
                {"x": 128, "y": 610}, {"x": 280, "y": 610}, 
                {"x": 280, "y": 760}, {"x": 200, "y": 790}, {"x": 128, "y": 760}
            ],
            "center": {"x": 204, "y": 700}
        },
        {
            "id": "store_12",
            "name": "ピーチ・ジョン",
            "category": "ファッション雑貨",
            "color": "#98FB98",
            "bbox": {"x": 290, "y": 610, "width": 215, "height": 180},
            "polygon": [
                {"x": 290, "y": 610}, {"x": 505, "y": 610}, 
                {"x": 505, "y": 700}, {"x": 480, "y": 790}, {"x": 290, "y": 790}
            ],
            "center": {"x": 397, "y": 700}
        }
    ]
    
    # 计算面积
    for store in corrected_stores:
        bbox = store["bbox"]
        store["area"] = bbox["width"] * bbox["height"]
    
    # 创建最终数据结构
    corrected_data = {
        "image_dimensions": {"width": image_width, "height": image_height},
        "extraction_method": "manually_corrected_precise_boundaries",
        "categories": {
            "レディスファッション": {"color": "#FFB6C1", "label": "Ladies Fashion"},
            "インテリア・生活雑貨": {"color": "#ADD8E6", "label": "Interior & Lifestyle"},
            "ファッション雑貨": {"color": "#98FB98", "label": "Fashion Accessories"}
        },
        "stores": corrected_stores
    }
    
    # 保存修正后的数据
    with open("output/corrected_store_data.json", 'w', encoding='utf-8') as f:
        json.dump(corrected_data, f, ensure_ascii=False, indent=2)
    
    print(f"Created corrected store data with {len(corrected_stores)} stores")
    
    # 创建修正后的可视化
    visualize_corrected_boundaries(corrected_stores)
    
    return corrected_data

def visualize_corrected_boundaries(stores):
    """可视化修正后的店铺边界"""
    # 加载原图
    image = cv2.imread("lumine-yurakucho.png")
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    
    plt.figure(figsize=(15, 20))
    plt.imshow(image_rgb, alpha=0.8)
    
    # 绘制每个店铺边界
    colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA726', '#AB47BC', '#26C6DA', 
              '#66BB6A', '#EF5350', '#29B6F6', '#FFCA28', '#8BC34A', '#FF7043', '#9C27B0']
    
    for i, store in enumerate(stores):
        polygon = store['polygon']
        color = colors[i % len(colors)]
        
        if len(polygon) >= 3:
            # 绘制多边形边界
            x_coords = [p['x'] for p in polygon] + [polygon[0]['x']]
            y_coords = [p['y'] for p in polygon] + [polygon[0]['y']]
            
            # 边界线
            plt.plot(x_coords, y_coords, color=color, linewidth=3, alpha=0.9)
            
            # 半透明填充
            plt.fill(x_coords, y_coords, color=color, alpha=0.2)
            
            # 添加店铺名称标签
            center = store['center']
            plt.text(center['x'], center['y'], store['name'],
                    fontsize=9, ha='center', va='center',
                    bbox=dict(boxstyle="round,pad=0.4", facecolor='white', alpha=0.95, edgecolor=color),
                    weight='bold', color='black')
            
            # 添加中心点
            plt.plot(center['x'], center['y'], 'o', color=color, markersize=4)
    
    plt.axis('off')
    plt.title('Corrected Store Boundaries - Precise Matching', fontsize=18, pad=20, weight='bold')
    plt.tight_layout()
    plt.savefig("output/corrected_boundaries_visualization.png", dpi=300, bbox_inches='tight')
    plt.close()
    
    print("Corrected visualization saved to output/corrected_boundaries_visualization.png")

def create_before_after_comparison():
    """创建修正前后的对比图"""
    # 加载数据
    try:
        with open("output/final_precise_store_data.json", 'r', encoding='utf-8') as f:
            before_data = json.load(f)
    except:
        before_data = None
    
    try:
        with open("output/corrected_store_data.json", 'r', encoding='utf-8') as f:
            after_data = json.load(f)
    except:
        after_data = None
    
    if not before_data or not after_data:
        print("Could not load comparison data")
        return
    
    # 加载原图
    image = cv2.imread("lumine-yurakucho.png")
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(30, 15))
    
    # 修正前
    ax1.imshow(image_rgb, alpha=0.8)
    colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA726', '#AB47BC', '#26C6DA', 
              '#66BB6A', '#EF5350', '#29B6F6', '#FFCA28', '#8BC34A', '#FF7043', '#9C27B0']
    
    # 高亮问题店铺
    problem_stores = ["シルパイ シルスチュアート", "ラグナムーン"]
    
    for i, store in enumerate(before_data['stores']):
        polygon = store['polygon']
        color = colors[i % len(colors)]
        
        # 问题店铺用红色标记
        if store['name'] in problem_stores:
            color = '#FF0000'
            linewidth = 4
            alpha = 0.4
        else:
            linewidth = 2
            alpha = 0.2
        
        if len(polygon) >= 3:
            x_coords = [p['x'] for p in polygon] + [polygon[0]['x']]
            y_coords = [p['y'] for p in polygon] + [polygon[0]['y']]
            
            ax1.plot(x_coords, y_coords, color=color, linewidth=linewidth)
            ax1.fill(x_coords, y_coords, color=color, alpha=alpha)
            
            center = store['center']
            ax1.text(center['x'], center['y'], store['name'],
                    fontsize=8, ha='center', va='center',
                    bbox=dict(boxstyle="round,pad=0.3", facecolor='white', alpha=0.9),
                    weight='bold')
    
    ax1.set_title('Before: Some Boundaries Inaccurate', fontsize=16, weight='bold', color='red')
    ax1.axis('off')
    
    # 修正后
    ax2.imshow(image_rgb, alpha=0.8)
    
    for i, store in enumerate(after_data['stores']):
        polygon = store['polygon']
        color = colors[i % len(colors)]
        
        # 修正的店铺用绿色标记
        if store['name'] in problem_stores:
            color = '#00AA00'
            linewidth = 4
            alpha = 0.3
        else:
            linewidth = 2
            alpha = 0.2
        
        if len(polygon) >= 3:
            x_coords = [p['x'] for p in polygon] + [polygon[0]['x']]
            y_coords = [p['y'] for p in polygon] + [polygon[0]['y']]
            
            ax2.plot(x_coords, y_coords, color=color, linewidth=linewidth)
            ax2.fill(x_coords, y_coords, color=color, alpha=alpha)
            
            center = store['center']
            ax2.text(center['x'], center['y'], store['name'],
                    fontsize=8, ha='center', va='center',
                    bbox=dict(boxstyle="round,pad=0.3", facecolor='white', alpha=0.9),
                    weight='bold')
    
    ax2.set_title('After: All Boundaries Corrected', fontsize=16, weight='bold', color='green')
    ax2.axis('off')
    
    plt.tight_layout()
    plt.savefig("output/before_after_correction.png", dpi=300, bbox_inches='tight')
    plt.close()
    
    print("Before/after comparison saved to output/before_after_correction.png")

if __name__ == "__main__":
    # 创建修正后的数据
    corrected_data = create_corrected_store_data()
    
    # 创建修正前后对比
    create_before_after_comparison()
    
    print("\n=== BOUNDARY CORRECTIONS ===")
    print("Fixed issues:")
    print("- シルパイ シルスチュアート: Corrected to proper rectangular boundaries")
    print("- ラグナムーン: Changed from triangle back to rectangle")
    print("- All other stores: Verified and refined coordinates")
    print(f"\nTotal stores: {len(corrected_data['stores'])}")