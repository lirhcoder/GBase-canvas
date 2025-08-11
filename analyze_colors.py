import cv2
import numpy as np
import matplotlib.pyplot as plt
from collections import Counter

def analyze_image_colors(image_path):
    """Analyze the dominant colors in the mall map"""
    # Load image
    image = cv2.imread(image_path)
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    
    # Get image dimensions
    height, width = image_rgb.shape[:2]
    print(f"Image size: {width}x{height}")
    
    # Sample colors from different regions
    regions = {
        "pink_area": (320, 180, 80, 60),  # x, y, w, h - approximate pink store area
        "blue_area": (450, 180, 80, 60),   # approximate blue store area  
        "green_area": (320, 520, 120, 80), # approximate green store area
        "background": (50, 50, 100, 100)   # background area
    }
    
    colors_by_region = {}
    
    for region_name, (x, y, w, h) in regions.items():
        # Extract region
        if x + w < width and y + h < height:
            region = image_rgb[y:y+h, x:x+w]
            
            # Get average color
            avg_color = np.mean(region.reshape(-1, 3), axis=0)
            colors_by_region[region_name] = avg_color.astype(int)
            
            print(f"{region_name}: RGB{tuple(avg_color.astype(int))}")
            
            # Show color sample
            plt.figure(figsize=(4, 2))
            plt.imshow(region)
            plt.title(f"{region_name}: RGB{tuple(avg_color.astype(int))}")
            plt.axis('off')
            plt.show()
    
    # Show full image with regions marked
    plt.figure(figsize=(12, 8))
    plt.imshow(image_rgb)
    
    # Draw rectangles around sampled regions
    for region_name, (x, y, w, h) in regions.items():
        rect = plt.Rectangle((x, y), w, h, linewidth=2, edgecolor='red', facecolor='none')
        plt.gca().add_patch(rect)
        plt.text(x, y-5, region_name, color='red', fontsize=10)
    
    plt.title('Color Analysis Regions')
    plt.axis('off')
    plt.show()
    
    return colors_by_region

if __name__ == "__main__":
    colors = analyze_image_colors("lumine-yurakucho.png")