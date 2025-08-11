import cv2
import numpy as np
import matplotlib.pyplot as plt
import json
from segment_anything import sam_model_registry, SamAutomaticMaskGenerator, SamPredictor
import os

class PreciseMallSegmenter:
    def __init__(self, checkpoint_path="sam_vit_b_01ec64.pth"):
        """Initialize SAM for precise segmentation"""
        print("Loading SAM model...")
        self.device = "cpu"  # Use CPU to avoid potential GPU issues
        sam = sam_model_registry["vit_b"](checkpoint=checkpoint_path)
        sam.to(device=self.device)
        
        # Configure mask generator for better results
        self.mask_generator = SamAutomaticMaskGenerator(
            model=sam,
            points_per_side=32,
            pred_iou_thresh=0.88,
            stability_score_thresh=0.95,
            crop_n_layers=1,
            crop_n_points_downscale_factor=2,
            min_mask_region_area=1000,  # Filter out small regions
        )
        
        self.predictor = SamPredictor(sam)
        
    def generate_masks(self, image_path):
        """Generate masks using SAM"""
        print("Loading image...")
        image = cv2.imread(image_path)
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        print("Generating masks with SAM...")
        masks = self.mask_generator.generate(image_rgb)
        
        print(f"Generated {len(masks)} masks")
        return image_rgb, masks
    
    def analyze_masks(self, image, masks):
        """Analyze and filter masks to identify store areas"""
        height, width = image.shape[:2]
        
        # Filter masks by size and characteristics
        store_masks = []
        for i, mask in enumerate(masks):
            area = mask['area']
            bbox = mask['bbox']  # [x, y, w, h]
            
            # Filter criteria
            min_area = width * height * 0.002  # At least 0.2% of image
            max_area = width * height * 0.08   # At most 8% of image
            
            # Check if mask is in the main store area (not in margins)
            x, y, w, h = bbox
            if (area > min_area and area < max_area and 
                x > width * 0.1 and x + w < width * 0.9 and  # Not on edges
                y > height * 0.05 and y + h < height * 0.95):  # Not on top/bottom edges
                
                # Additional shape analysis
                if self.is_store_like_region(mask, image):
                    store_masks.append({
                        'mask': mask,
                        'area': area,
                        'bbox': bbox,
                        'id': i
                    })
        
        # Sort by area
        store_masks = sorted(store_masks, key=lambda x: x['area'], reverse=True)
        return store_masks[:15]  # Keep top 15 candidates
    
    def is_store_like_region(self, mask, image):
        """Check if a mask represents a store-like region"""
        # Get mask data
        segmentation = mask['segmentation']
        
        # Find contours
        contours, _ = cv2.findContours(
            segmentation.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        
        if len(contours) == 0:
            return False
        
        # Get the largest contour
        largest_contour = max(contours, key=cv2.contourArea)
        
        # Calculate shape properties
        area = cv2.contourArea(largest_contour)
        if area < 100:
            return False
            
        # Aspect ratio check
        x, y, w, h = cv2.boundingRect(largest_contour)
        aspect_ratio = max(w, h) / min(w, h) if min(w, h) > 0 else 0
        
        # Solidity check (how filled the shape is)
        hull = cv2.convexHull(largest_contour)
        hull_area = cv2.contourArea(hull)
        solidity = area / hull_area if hull_area > 0 else 0
        
        # Store-like criteria
        return (aspect_ratio < 4.0 and  # Not too elongated
                solidity > 0.6 and      # Reasonably filled
                w > 30 and h > 30)      # Minimum size
    
    def extract_polygons(self, store_masks):
        """Extract precise polygon coordinates from masks"""
        polygons = []
        
        for store_mask in store_masks:
            mask = store_mask['mask']
            segmentation = mask['segmentation']
            
            # Find contours
            contours, _ = cv2.findContours(
                segmentation.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
            )
            
            if len(contours) > 0:
                # Get the largest contour
                largest_contour = max(contours, key=cv2.contourArea)
                
                # Simplify contour
                epsilon = 0.005 * cv2.arcLength(largest_contour, True)
                approx = cv2.approxPolyDP(largest_contour, epsilon, True)
                
                # Convert to polygon points
                polygon_points = []
                for point in approx:
                    polygon_points.append({
                        "x": int(point[0][0]), 
                        "y": int(point[0][1])
                    })
                
                # Calculate center
                M = cv2.moments(largest_contour)
                if M["m00"] != 0:
                    cx = int(M["m10"] / M["m00"])
                    cy = int(M["m01"] / M["m00"])
                else:
                    cx, cy = store_mask['bbox'][0] + store_mask['bbox'][2]//2, store_mask['bbox'][1] + store_mask['bbox'][3]//2
                
                polygons.append({
                    'polygon': polygon_points,
                    'center': {'x': cx, 'y': cy},
                    'bbox': {
                        'x': store_mask['bbox'][0],
                        'y': store_mask['bbox'][1], 
                        'width': store_mask['bbox'][2],
                        'height': store_mask['bbox'][3]
                    },
                    'area': int(store_mask['area']),
                    'mask_id': store_mask['id']
                })
        
        return polygons
    
    def visualize_results(self, image, polygons, output_path="output/sam_precise_segmentation.png"):
        """Visualize the segmentation results"""
        plt.figure(figsize=(15, 10))
        plt.imshow(image)
        plt.axis('off')
        
        # Draw polygons with different colors
        colors = plt.cm.Set3(np.linspace(0, 1, len(polygons)))
        
        for i, poly_data in enumerate(polygons):
            polygon = poly_data['polygon']
            if len(polygon) > 2:
                # Create polygon patch
                x_coords = [p['x'] for p in polygon] + [polygon[0]['x']]
                y_coords = [p['y'] for p in polygon] + [polygon[0]['y']]
                
                plt.fill(x_coords, y_coords, color=colors[i], alpha=0.3)
                plt.plot(x_coords, y_coords, color=colors[i], linewidth=2)
                
                # Add center point and label
                center = poly_data['center']
                plt.plot(center['x'], center['y'], 'ko', markersize=5)
                plt.text(center['x'], center['y'], f"{i}", 
                        fontsize=10, ha='center', va='center',
                        bbox=dict(boxstyle="round,pad=0.3", facecolor='white', alpha=0.8))
        
        plt.title('SAM Precise Segmentation Results', fontsize=16)
        plt.tight_layout()
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        plt.close()
        
        print(f"Visualization saved to {output_path}")
    
    def save_sam_data(self, polygons, image_shape, output_path="output/sam_store_boundaries.json"):
        """Save the precise SAM results"""
        sam_data = {
            "image_dimensions": {
                "width": image_shape[1],
                "height": image_shape[0]
            },
            "extraction_method": "SAM_automatic_mask_generation",
            "total_regions": len(polygons),
            "regions": []
        }
        
        for i, poly_data in enumerate(polygons):
            region = {
                "id": f"region_{i}",
                "mask_id": poly_data['mask_id'],
                "polygon": poly_data['polygon'],
                "bbox": poly_data['bbox'],
                "center": poly_data['center'],
                "area": poly_data['area']
            }
            sam_data["regions"].append(region)
        
        # Save to file
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(sam_data, f, ensure_ascii=False, indent=2)
        
        print(f"SAM data saved to {output_path}")
        print(f"Extracted {len(polygons)} precise regions")
        
        return sam_data

def main():
    try:
        segmenter = PreciseMallSegmenter()
        
        # Generate masks
        image, masks = segmenter.generate_masks("lumine-yurakucho.png")
        
        # Analyze and filter masks
        store_masks = segmenter.analyze_masks(image, masks)
        
        # Extract precise polygons
        polygons = segmenter.extract_polygons(store_masks)
        
        # Visualize results
        segmenter.visualize_results(image, polygons)
        
        # Save SAM data
        sam_data = segmenter.save_sam_data(polygons, image.shape)
        
        print(f"\nExtraction complete!")
        print(f"Found {len(polygons)} potential store regions")
        print("Check the visualization to see the detected boundaries.")
        
    except Exception as e:
        print(f"Error during SAM processing: {e}")
        print("This might be due to memory constraints or model loading issues.")
        print("You can use the visualization output to manually refine the coordinates.")

if __name__ == "__main__":
    main()