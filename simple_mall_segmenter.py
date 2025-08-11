import cv2
import numpy as np
import matplotlib.pyplot as plt
import json
from PIL import Image, ImageDraw
from sklearn.cluster import KMeans

class SimpleMallMapSegmenter:
    def __init__(self):
        """Initialize the simple segmenter"""
        pass
    
    def extract_store_areas(self, image_path):
        """Extract store areas using color-based segmentation"""
        # Load image
        image = cv2.imread(image_path)
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # Define color ranges for different store categories (based on actual image analysis)
        # Pink areas (ladies fashion) - RGB(225, 207, 217)
        pink_lower = np.array([210, 190, 200])
        pink_upper = np.array([240, 220, 235])
        
        # Light blue/gray areas (interior/lifestyle) - RGB(203, 212, 216)  
        blue_lower = np.array([190, 200, 200])
        blue_upper = np.array([220, 225, 230])
        
        # Light green areas (fashion accessories) - similar to pink but more green
        green_lower = np.array([210, 180, 190])
        green_upper = np.array([235, 210, 220])
        
        # Create masks for each color
        pink_mask = cv2.inRange(image_rgb, pink_lower, pink_upper)
        blue_mask = cv2.inRange(image_rgb, blue_lower, blue_upper)
        green_mask = cv2.inRange(image_rgb, green_lower, green_upper)
        
        # Find contours for each mask
        pink_contours = self.find_store_contours(pink_mask)
        blue_contours = self.find_store_contours(blue_mask)
        green_contours = self.find_store_contours(green_mask)
        
        return image_rgb, pink_contours, blue_contours, green_contours
    
    def find_store_contours(self, mask):
        """Find and filter contours for store areas"""
        # Clean up the mask
        kernel = np.ones((3, 3), np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
        
        # Find contours
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # Filter contours by area
        min_area = 1000  # Minimum area for a store
        filtered_contours = []
        
        for contour in contours:
            area = cv2.contourArea(contour)
            if area > min_area:
                # Simplify contour
                epsilon = 0.02 * cv2.arcLength(contour, True)
                approx = cv2.approxPolyDP(contour, epsilon, True)
                filtered_contours.append({
                    'contour': contour,
                    'area': area,
                    'simplified': approx
                })
        
        return sorted(filtered_contours, key=lambda x: x['area'], reverse=True)
    
    def create_interactive_data(self, image, pink_contours, blue_contours, green_contours):
        """Create data structure for interactive map"""
        store_data = {
            "image_dimensions": {"width": image.shape[1], "height": image.shape[0]},
            "stores": []
        }
        
        # Store information for each category
        store_info = {
            "pink": {
                "category": "レディスファッション",
                "color": "#FFB6C1",
                "stores": [
                    "シルパイ シルスチュアート", "アンドクチュール", "ラグナムーン",
                    "アルページュストーリー", "ココディールリックス", "ノエラ",
                    "ウィルセレクション", "エメエクル"
                ]
            },
            "blue": {
                "category": "インテリア・生活雑貨", 
                "color": "#ADD8E6",
                "stores": ["フランフラン", "フランフラン2"]
            },
            "green": {
                "category": "ファッション雑貨",
                "color": "#98FB98", 
                "stores": ["マーキュリーデュオ", "ダイアナ", "ピーチ・ジョン"]
            }
        }
        
        # Process each category
        all_contours = [
            ("pink", pink_contours),
            ("blue", blue_contours), 
            ("green", green_contours)
        ]
        
        store_id = 0
        for color_type, contours in all_contours:
            category_info = store_info[color_type]
            
            for i, contour_data in enumerate(contours):
                if i < len(category_info["stores"]):
                    contour = contour_data['contour']
                    
                    # Get bounding box
                    x, y, w, h = cv2.boundingRect(contour)
                    
                    # Convert contour to polygon points
                    simplified = contour_data['simplified']
                    polygon = [{"x": int(point[0][0]), "y": int(point[0][1])} 
                             for point in simplified]
                    
                    # Create store entry
                    store_entry = {
                        "id": f"store_{store_id}",
                        "name": category_info["stores"][i],
                        "category": category_info["category"],
                        "color": category_info["color"],
                        "bbox": {"x": x, "y": y, "width": w, "height": h},
                        "polygon": polygon,
                        "area": int(contour_data['area']),
                        "center": {"x": x + w//2, "y": y + h//2}
                    }
                    
                    store_data["stores"].append(store_entry)
                    store_id += 1
        
        return store_data
    
    def save_results(self, image, pink_contours, blue_contours, green_contours, store_data, output_dir="output"):
        """Save segmentation results and interactive data"""
        import os
        os.makedirs(output_dir, exist_ok=True)
        
        # Save original image
        plt.figure(figsize=(12, 8))
        plt.imshow(image)
        plt.axis('off')
        plt.title('Original Mall Map')
        plt.tight_layout()
        plt.savefig(f"{output_dir}/original_map.png", dpi=150, bbox_inches='tight')
        plt.close()
        
        # Save segmented image with contours
        plt.figure(figsize=(12, 8))
        plt.imshow(image)
        
        # Draw contours
        image_contours = image.copy()
        
        # Draw pink contours
        for contour_data in pink_contours:
            cv2.drawContours(image_contours, [contour_data['contour']], -1, (255, 0, 0), 2)
        
        # Draw blue contours  
        for contour_data in blue_contours:
            cv2.drawContours(image_contours, [contour_data['contour']], -1, (0, 0, 255), 2)
            
        # Draw green contours
        for contour_data in green_contours:
            cv2.drawContours(image_contours, [contour_data['contour']], -1, (0, 255, 0), 2)
        
        plt.imshow(image_contours)
        plt.axis('off')
        plt.title('Detected Store Areas')
        plt.tight_layout()
        plt.savefig(f"{output_dir}/segmented_map.png", dpi=150, bbox_inches='tight')
        plt.close()
        
        # Save store data as JSON
        with open(f"{output_dir}/store_data.json", 'w', encoding='utf-8') as f:
            json.dump(store_data, f, ensure_ascii=False, indent=2)
        
        print(f"Results saved to {output_dir}/")
        print(f"Found {len(store_data['stores'])} store areas")
        
        # Print summary
        categories = {}
        for store in store_data['stores']:
            cat = store['category']
            if cat not in categories:
                categories[cat] = 0
            categories[cat] += 1
        
        for cat, count in categories.items():
            print(f"  {cat}: {count} stores")


def main():
    # Initialize segmenter
    segmenter = SimpleMallMapSegmenter()
    
    # Process the mall map
    image, pink_contours, blue_contours, green_contours = segmenter.extract_store_areas("lumine-yurakucho.png")
    
    # Create interactive data structure
    store_data = segmenter.create_interactive_data(image, pink_contours, blue_contours, green_contours)
    
    # Save results
    segmenter.save_results(image, pink_contours, blue_contours, green_contours, store_data)
    
    print("Mall map segmentation complete!")


if __name__ == "__main__":
    main()