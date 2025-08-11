import cv2
import numpy as np
import matplotlib.pyplot as plt
from segment_anything import sam_model_registry, SamAutomaticMaskGenerator, SamPredictor
import json
from PIL import Image, ImageDraw

class MallMapSegmenter:
    def __init__(self, checkpoint_path="sam_vit_b_01ec64.pth"):
        """Initialize the SAM model"""
        print("Loading SAM model...")
        self.sam = sam_model_registry["vit_b"](checkpoint=checkpoint_path)
        self.mask_generator = SamAutomaticMaskGenerator(self.sam)
        self.predictor = SamPredictor(self.sam)
        
    def segment_mall_map(self, image_path):
        """Segment the mall map into different store areas"""
        # Load image
        image = cv2.imread(image_path)
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        print("Generating masks...")
        masks = self.mask_generator.generate(image_rgb)
        
        # Filter masks by size and location to get store areas
        filtered_masks = self.filter_store_masks(masks, image_rgb.shape)
        
        return image_rgb, filtered_masks
    
    def filter_store_masks(self, masks, image_shape):
        """Filter masks to identify store areas"""
        # Sort masks by area (largest first)
        masks = sorted(masks, key=lambda x: x['area'], reverse=True)
        
        # Filter out masks that are too small or too large
        height, width = image_shape[:2]
        min_area = width * height * 0.005  # At least 0.5% of image
        max_area = width * height * 0.15   # At most 15% of image
        
        store_masks = []
        for mask in masks:
            area = mask['area']
            if min_area < area < max_area:
                # Check if the mask is roughly rectangular (store-like shape)
                if self.is_store_like_shape(mask['segmentation']):
                    store_masks.append(mask)
        
        return store_masks[:20]  # Limit to top 20 masks
    
    def is_store_like_shape(self, mask):
        """Check if a mask has a store-like rectangular shape"""
        # Find contours
        contours, _ = cv2.findContours(
            mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        
        if len(contours) == 0:
            return False
        
        # Get the largest contour
        largest_contour = max(contours, key=cv2.contourArea)
        
        # Calculate the aspect ratio and solidity
        x, y, w, h = cv2.boundingRect(largest_contour)
        aspect_ratio = w / h if h > 0 else 0
        
        area = cv2.contourArea(largest_contour)
        hull_area = cv2.contourArea(cv2.convexHull(largest_contour))
        solidity = area / hull_area if hull_area > 0 else 0
        
        # Store-like shapes should have reasonable aspect ratio and high solidity
        return 0.3 < aspect_ratio < 3.0 and solidity > 0.7
    
    def create_interactive_data(self, image, masks):
        """Create data structure for interactive map"""
        # Store information extracted from the image
        # This would normally be manually curated or extracted via OCR
        store_data = {
            "image_dimensions": {"width": image.shape[1], "height": image.shape[0]},
            "stores": []
        }
        
        # Sample store information based on the original image
        sample_stores = [
            {"name": "シルパイ シルスチュアート", "category": "レディスファッション", "color": "#FFB6C1"},
            {"name": "フランフラン", "category": "インテリア・生活雑貨", "color": "#ADD8E6"},
            {"name": "アンドクチュール", "category": "レディスファッション", "color": "#FFB6C1"},
            {"name": "ラグナムーン", "category": "レディスファッション", "color": "#FFB6C1"},
            {"name": "アルページュストーリー", "category": "レディスファッション", "color": "#FFB6C1"},
            {"name": "ココディールリックス", "category": "レディスファッション", "color": "#FFB6C1"},
            {"name": "ノエラ", "category": "レディスファッション", "color": "#FFB6C1"},
            {"name": "ウィルセレクション", "category": "レディスファッション", "color": "#FFB6C1"},
            {"name": "マーキュリーデュオ", "category": "ファッション雑貨", "color": "#98FB98"},
            {"name": "エメエクル", "category": "レディスファッション", "color": "#FFB6C1"},
            {"name": "ダイアナ", "category": "ファッション雑貨", "color": "#98FB98"},
            {"name": "ピーチ・ジョン", "category": "ファッション雑貨", "color": "#98FB98"},
        ]
        
        # Match masks with stores (simplified approach)
        for i, mask in enumerate(masks):
            if i < len(sample_stores):
                # Get mask bounds
                y_indices, x_indices = np.where(mask['segmentation'])
                if len(x_indices) > 0 and len(y_indices) > 0:
                    bbox = {
                        "x": int(np.min(x_indices)),
                        "y": int(np.min(y_indices)),
                        "width": int(np.max(x_indices) - np.min(x_indices)),
                        "height": int(np.max(y_indices) - np.min(y_indices))
                    }
                    
                    # Convert mask to polygon points
                    contours, _ = cv2.findContours(
                        mask['segmentation'].astype(np.uint8), 
                        cv2.RETR_EXTERNAL, 
                        cv2.CHAIN_APPROX_SIMPLE
                    )
                    
                    if len(contours) > 0:
                        largest_contour = max(contours, key=cv2.contourArea)
                        # Simplify contour
                        epsilon = 0.02 * cv2.arcLength(largest_contour, True)
                        approx = cv2.approxPolyDP(largest_contour, epsilon, True)
                        
                        polygon = [{"x": int(point[0][0]), "y": int(point[0][1])} 
                                 for point in approx]
                        
                        store_info = sample_stores[i].copy()
                        store_info.update({
                            "id": f"store_{i}",
                            "bbox": bbox,
                            "polygon": polygon,
                            "mask_area": int(mask['area'])
                        })
                        
                        store_data["stores"].append(store_info)
        
        return store_data
    
    def save_results(self, image, masks, store_data, output_dir="output"):
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
        
        # Save segmented image
        plt.figure(figsize=(12, 8))
        plt.imshow(image)
        self.show_masks(masks)
        plt.axis('off')
        plt.title('Segmented Store Areas')
        plt.tight_layout()
        plt.savefig(f"{output_dir}/segmented_map.png", dpi=150, bbox_inches='tight')
        plt.close()
        
        # Save store data as JSON
        with open(f"{output_dir}/store_data.json", 'w', encoding='utf-8') as f:
            json.dump(store_data, f, ensure_ascii=False, indent=2)
        
        print(f"Results saved to {output_dir}/")
        print(f"Found {len(store_data['stores'])} store areas")
    
    def show_masks(self, masks):
        """Display masks with different colors"""
        if len(masks) == 0:
            return
        
        sorted_masks = sorted(masks, key=(lambda x: x['area']), reverse=True)
        
        for i, mask in enumerate(sorted_masks):
            m = mask['segmentation']
            color = np.random.random(3)
            plt.imshow(np.dstack([m, m, m]) * color.reshape(1, 1, -1), alpha=0.5)


def main():
    # Initialize segmenter
    segmenter = MallMapSegmenter()
    
    # Process the mall map
    image, masks = segmenter.segment_mall_map("lumine-yurakucho.png")
    
    # Create interactive data structure
    store_data = segmenter.create_interactive_data(image, masks)
    
    # Save results
    segmenter.save_results(image, masks, store_data)
    
    print("Mall map segmentation complete!")
    print(f"Extracted {len(masks)} store segments")


if __name__ == "__main__":
    main()