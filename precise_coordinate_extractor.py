import cv2
import numpy as np
import matplotlib.pyplot as plt
import json

def extract_precise_coordinates():
    """Extract precise store coordinates using image analysis"""
    # Load the image
    image = cv2.imread("lumine-yurakucho.png")
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    
    print(f"Image dimensions: {image_rgb.shape[1]}x{image_rgb.shape[0]}")
    
    # Define color ranges for precise detection
    # Based on the actual colors we analyzed before
    color_ranges = {
        "pink": {
            "lower": np.array([210, 180, 190]),
            "upper": np.array([255, 220, 235]),
            "category": "レディスファッション",
            "color": "#FFB6C1"
        },
        "blue": {
            "lower": np.array([180, 200, 210]),
            "upper": np.array([220, 235, 245]),
            "category": "インテリア・生活雑貨", 
            "color": "#ADD8E6"
        },
        "green": {
            "lower": np.array([200, 225, 210]),
            "upper": np.array([235, 250, 235]),
            "category": "ファッション雑貨",
            "color": "#98FB98"
        }
    }
    
    all_store_regions = []
    
    # Process each color category
    for color_name, color_info in color_ranges.items():
        print(f"Processing {color_name} areas...")
        
        # Create mask for this color
        mask = cv2.inRange(image_rgb, color_info["lower"], color_info["upper"])
        
        # Clean up the mask
        kernel = np.ones((3, 3), np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
        
        # Find contours
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        for i, contour in enumerate(contours):
            area = cv2.contourArea(contour)
            if area > 2000:  # Filter by minimum area
                # Get bounding rectangle
                x, y, w, h = cv2.boundingRect(contour)
                
                # Simplify contour to polygon
                epsilon = 0.01 * cv2.arcLength(contour, True)
                approx = cv2.approxPolyDP(contour, epsilon, True)
                
                # Convert to our polygon format
                polygon_points = []
                for point in approx:
                    polygon_points.append({
                        "x": int(point[0][0]),
                        "y": int(point[0][1])
                    })
                
                # Calculate center
                M = cv2.moments(contour)
                if M["m00"] != 0:
                    cx = int(M["m10"] / M["m00"])
                    cy = int(M["m01"] / M["m00"])
                else:
                    cx, cy = x + w//2, y + h//2
                
                region_data = {
                    "color_category": color_name,
                    "category": color_info["category"],
                    "color": color_info["color"],
                    "bbox": {"x": x, "y": y, "width": w, "height": h},
                    "polygon": polygon_points,
                    "center": {"x": cx, "y": cy},
                    "area": int(area)
                }
                
                all_store_regions.append(region_data)
    
    # Sort by area (largest first)
    all_store_regions = sorted(all_store_regions, key=lambda x: x['area'], reverse=True)
    
    # Now manually assign store names based on position analysis
    store_assignments = assign_store_names(all_store_regions)
    
    return store_assignments

def assign_store_names(regions):
    """Manually assign store names based on position and area analysis"""
    # Store names by approximate position (top to bottom, left to right)
    store_info = [
        # Top row
        {"name": "シルパイ シルスチュアート", "expected_category": "レディスファッション", "approx_center": (310, 150)},
        {"name": "フランフラン", "expected_category": "インテリア・生活雑貨", "approx_center": (444, 150)},
        
        # Second row  
        {"name": "アンドクチュール", "expected_category": "レディスファッション", "approx_center": (182, 230)},
        {"name": "ラグナムーン", "expected_category": "レディスファッション", "approx_center": (310, 255)},
        {"name": "フランフラン", "expected_category": "インテリア・生活雑貨", "approx_center": (444, 255)},
        
        # Third row
        {"name": "アルページュストーリー", "expected_category": "レディスファッション", "approx_center": (182, 387)},
        {"name": "ココディールリックス", "expected_category": "レディスファッション", "approx_center": (310, 347)},
        {"name": "ノエラ", "expected_category": "レディスファッション", "approx_center": (444, 347)},
        
        # Fourth row
        {"name": "ウィルセレクション", "expected_category": "レディスファッション", "approx_center": (444, 453)},
        
        # Fifth row
        {"name": "マーキュリーデュオ", "expected_category": "ファッション雑貨", "approx_center": (310, 555)},
        {"name": "エメエクル", "expected_category": "レディスファッション", "approx_center": (444, 555)},
        
        # Bottom row
        {"name": "ダイアナ", "expected_category": "ファッション雑貨", "approx_center": (204, 700)},
        {"name": "ピーチ・ジョン", "expected_category": "ファッション雑貨", "approx_center": (397, 700)},
    ]
    
    assigned_stores = []
    used_regions = set()
    
    for store in store_info:
        expected_center = store["approx_center"]
        best_region = None
        best_distance = float('inf')
        best_idx = -1
        
        # Find the closest region that matches the expected category
        for i, region in enumerate(regions):
            if i in used_regions:
                continue
                
            # Check if categories match (allowing some flexibility)
            category_match = (region["category"] == store["expected_category"] or
                            store["expected_category"] == "ファッション雑貨")  # Fashion accessories can be flexible
            
            if category_match:
                region_center = (region["center"]["x"], region["center"]["y"])
                distance = np.sqrt((region_center[0] - expected_center[0])**2 + 
                                 (region_center[1] - expected_center[1])**2)
                
                if distance < best_distance and distance < 100:  # Within reasonable range
                    best_distance = distance
                    best_region = region
                    best_idx = i
        
        if best_region:
            # Assign the store name to this region
            store_data = best_region.copy()
            store_data["id"] = f"store_{len(assigned_stores)}"
            store_data["name"] = store["name"]
            assigned_stores.append(store_data)
            used_regions.add(best_idx)
        else:
            print(f"Warning: Could not find matching region for {store['name']}")
    
    return assigned_stores

def create_precise_store_data():
    """Create the final precise store data"""
    store_regions = extract_precise_coordinates()
    
    # Create the final data structure
    store_data = {
        "image_dimensions": {"width": 610, "height": 929},
        "extraction_method": "color_based_with_contour_detection",
        "categories": {
            "レディスファッション": {"color": "#FFB6C1", "label": "Ladies Fashion"},
            "インテリア・生活雑貨": {"color": "#ADD8E6", "label": "Interior & Lifestyle"},
            "ファッション雑貨": {"color": "#98FB98", "label": "Fashion Accessories"}
        },
        "stores": store_regions
    }
    
    # Save to file
    with open("output/precise_store_data.json", 'w', encoding='utf-8') as f:
        json.dump(store_data, f, ensure_ascii=False, indent=2)
    
    print(f"Created precise store data with {len(store_regions)} stores")
    
    # Create visualization
    visualize_precise_boundaries(store_regions)
    
    return store_data

def visualize_precise_boundaries(store_regions):
    """Visualize the precise boundaries"""
    image = cv2.imread("lumine-yurakucho.png")
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    
    plt.figure(figsize=(15, 20))
    plt.imshow(image_rgb)
    plt.axis('off')
    
    # Draw each store boundary
    for i, store in enumerate(store_regions):
        polygon = store['polygon']
        
        if len(polygon) > 2:
            # Draw polygon
            x_coords = [p['x'] for p in polygon] + [polygon[0]['x']]
            y_coords = [p['y'] for p in polygon] + [polygon[0]['y']]
            
            plt.fill(x_coords, y_coords, alpha=0.3, edgecolor='red', linewidth=2)
            
            # Add store name
            center = store['center']
            plt.text(center['x'], center['y'], store['name'], 
                    fontsize=8, ha='center', va='center',
                    bbox=dict(boxstyle="round,pad=0.3", facecolor='white', alpha=0.8))
    
    plt.title('Precise Store Boundaries (Color-based Detection)', fontsize=16)
    plt.tight_layout()
    plt.savefig("output/precise_boundaries_visualization.png", dpi=300, bbox_inches='tight')
    plt.close()
    
    print("Visualization saved to output/precise_boundaries_visualization.png")

if __name__ == "__main__":
    create_precise_store_data()