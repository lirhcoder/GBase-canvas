import json
import cv2
import numpy as np
from PIL import Image, ImageDraw

def create_store_data():
    """Create accurate store data based on the mall map layout"""
    
    # Load image to get dimensions
    image = cv2.imread("lumine-yurakucho.png")
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    height, width = image_rgb.shape[:2]
    
    # Manually defined store areas based on the mall map layout
    store_data = {
        "image_dimensions": {"width": width, "height": height},
        "categories": {
            "レディスファッション": {"color": "#FFB6C1", "label": "Ladies Fashion"},
            "インテリア・生活雑貨": {"color": "#ADD8E6", "label": "Interior & Lifestyle"},
            "ファッション雑貨": {"color": "#98FB98", "label": "Fashion Accessories"}
        },
        "stores": []
    }
    
    # Define store areas based on actual store shapes from the mall map
    stores_layout = [
        # Top row - B4-7F section
        {
            "name": "シルパイ シルスチュアート",
            "category": "レディスファッション",
            "bbox": {"x": 248, "y": 95, "width": 124, "height": 107},
            "polygon": [
                {"x": 248, "y": 95}, {"x": 372, "y": 95}, 
                {"x": 372, "y": 202}, {"x": 248, "y": 202}
            ]
        },
        {
            "name": "フランフラン", 
            "category": "インテリア・生活雑貨",
            "bbox": {"x": 382, "y": 95, "width": 123, "height": 107},
            "polygon": [
                {"x": 382, "y": 95}, {"x": 505, "y": 95},
                {"x": 505, "y": 202}, {"x": 382, "y": 202}
            ]
        },
        
        # Second row - with cut corner
        {
            "name": "アンドクチュール",
            "category": "レディスファッション", 
            "bbox": {"x": 124, "y": 160, "width": 116, "height": 138},
            "polygon": [
                {"x": 124, "y": 160}, {"x": 206, "y": 160}, {"x": 240, "y": 194},
                {"x": 240, "y": 298}, {"x": 124, "y": 298}
            ]
        },
        {
            "name": "ラグナムーン",
            "category": "レディスファッション",
            "bbox": {"x": 248, "y": 212, "width": 124, "height": 83},
            "polygon": [
                {"x": 248, "y": 212}, {"x": 372, "y": 212},
                {"x": 372, "y": 295}, {"x": 248, "y": 295}
            ]
        },
        {
            "name": "フランフラン",
            "category": "インテリア・生活雑貨", 
            "bbox": {"x": 382, "y": 212, "width": 123, "height": 83},
            "polygon": [
                {"x": 382, "y": 212}, {"x": 505, "y": 212},
                {"x": 505, "y": 295}, {"x": 382, "y": 295}
            ]
        },
        
        # Third row
        {
            "name": "アルページュストーリー",
            "category": "レディスファッション",
            "bbox": {"x": 124, "y": 308, "width": 116, "height": 158},
            "polygon": [
                {"x": 124, "y": 308}, {"x": 240, "y": 308},
                {"x": 240, "y": 466}, {"x": 124, "y": 466}
            ]
        },
        {
            "name": "ココディールリックス", 
            "category": "レディスファッション",
            "bbox": {"x": 248, "y": 305, "width": 124, "height": 83},
            "polygon": [
                {"x": 248, "y": 305}, {"x": 372, "y": 305},
                {"x": 372, "y": 388}, {"x": 248, "y": 388}
            ]
        },
        {
            "name": "ノエラ",
            "category": "レディスファッション",
            "bbox": {"x": 382, "y": 305, "width": 123, "height": 83},
            "polygon": [
                {"x": 382, "y": 305}, {"x": 505, "y": 305},
                {"x": 505, "y": 388}, {"x": 382, "y": 388}
            ]
        },
        
        # Fourth row - ウィルセレクション extends down
        {
            "name": "ウィルセレクション",
            "category": "レディスファッション",
            "bbox": {"x": 382, "y": 398, "width": 123, "height": 110},
            "polygon": [
                {"x": 382, "y": 398}, {"x": 505, "y": 398},
                {"x": 505, "y": 508}, {"x": 382, "y": 508}
            ]
        },
        
        # Fifth row
        {
            "name": "マーキュリーデュオ",
            "category": "ファッション雑貨",
            "bbox": {"x": 248, "y": 518, "width": 124, "height": 72},
            "polygon": [
                {"x": 248, "y": 518}, {"x": 372, "y": 518},
                {"x": 372, "y": 590}, {"x": 248, "y": 590}
            ]
        },
        {
            "name": "エメエクル", 
            "category": "レディスファッション",
            "bbox": {"x": 382, "y": 518, "width": 123, "height": 72},
            "polygon": [
                {"x": 382, "y": 518}, {"x": 505, "y": 518},
                {"x": 505, "y": 590}, {"x": 382, "y": 590}
            ]
        },
        
        # Bottom section - curved areas
        {
            "name": "ダイアナ",
            "category": "ファッション雑貨", 
            "bbox": {"x": 128, "y": 610, "width": 152, "height": 180},
            "polygon": [
                {"x": 128, "y": 610}, {"x": 280, "y": 610}, {"x": 280, "y": 760},
                {"x": 200, "y": 790}, {"x": 128, "y": 760}
            ]
        },
        {
            "name": "ピーチ・ジョン",
            "category": "ファッション雑貨",
            "bbox": {"x": 290, "y": 610, "width": 215, "height": 180},
            "polygon": [
                {"x": 290, "y": 610}, {"x": 505, "y": 610}, {"x": 505, "y": 700},
                {"x": 480, "y": 790}, {"x": 290, "y": 790}
            ]
        }
    ]
    
    # Add store data with IDs and additional info
    for i, store in enumerate(stores_layout):
        store_entry = store.copy()
        store_entry.update({
            "id": f"store_{i}",
            "color": store_data["categories"][store["category"]]["color"],
            "center": {
                "x": store["bbox"]["x"] + store["bbox"]["width"] // 2,
                "y": store["bbox"]["y"] + store["bbox"]["height"] // 2  
            },
            "area": store["bbox"]["width"] * store["bbox"]["height"]
        })
        store_data["stores"].append(store_entry)
    
    return store_data

def save_store_data():
    """Save the store data to JSON file"""
    store_data = create_store_data()
    
    with open("output/interactive_store_data.json", 'w', encoding='utf-8') as f:
        json.dump(store_data, f, ensure_ascii=False, indent=2)
    
    print(f"Created interactive store data with {len(store_data['stores'])} stores")
    
    # Print summary by category
    categories = {}
    for store in store_data['stores']:
        cat = store['category']
        if cat not in categories:
            categories[cat] = 0
        categories[cat] += 1
    
    for cat, count in categories.items():
        print(f"  {cat}: {count} stores")

if __name__ == "__main__":
    save_store_data()