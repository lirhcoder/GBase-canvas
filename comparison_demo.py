import cv2
import numpy as np
import matplotlib.pyplot as plt
import json

def create_comparison_visualization():
    """Create a comparison visualization showing different segmentation approaches"""
    
    # Load original image
    image = cv2.imread("lumine-yurakucho.png")
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    
    # Load different data files
    try:
        with open("output/interactive_store_data.json", 'r', encoding='utf-8') as f:
            manual_data = json.load(f)
    except:
        manual_data = None
    
    try:
        with open("output/precise_store_data.json", 'r', encoding='utf-8') as f:
            contour_data = json.load(f)
    except:
        contour_data = None
    
    try:
        with open("output/final_precise_store_data.json", 'r', encoding='utf-8') as f:
            final_data = json.load(f)
    except:
        final_data = None
    
    # Create comparison plot
    fig, axes = plt.subplots(2, 2, figsize=(20, 25))
    
    # Original image
    axes[0, 0].imshow(image_rgb)
    axes[0, 0].set_title('Original Mall Map', fontsize=16, weight='bold')
    axes[0, 0].axis('off')
    
    # Manual approach (if available)
    axes[0, 1].imshow(image_rgb, alpha=0.7)
    if manual_data:
        for store in manual_data['stores']:
            if 'polygon' in store and len(store['polygon']) > 2:
                polygon = store['polygon']
                x_coords = [p['x'] for p in polygon] + [polygon[0]['x']]
                y_coords = [p['y'] for p in polygon] + [polygon[0]['y']]
                axes[0, 1].fill(x_coords, y_coords, alpha=0.3, edgecolor='red', linewidth=2)
    axes[0, 1].set_title('Manual Coordinate Definition', fontsize=16, weight='bold')
    axes[0, 1].axis('off')
    
    # SAM contour detection
    axes[1, 0].imshow(image_rgb, alpha=0.7)
    if contour_data:
        colors = ['#FF6B6B', '#4ECDC4', '#45B7D1']
        for i, store in enumerate(contour_data['stores']):
            if 'polygon' in store and len(store['polygon']) > 2:
                polygon = store['polygon']
                x_coords = [p['x'] for p in polygon] + [polygon[0]['x']]
                y_coords = [p['y'] for p in polygon] + [polygon[0]['y']]
                axes[1, 0].fill(x_coords, y_coords, color=colors[i % len(colors)], 
                              alpha=0.4, edgecolor=colors[i % len(colors)], linewidth=2)
    axes[1, 0].set_title('SAM Color-based Contour Detection', fontsize=16, weight='bold')
    axes[1, 0].axis('off')
    
    # Final precise segmentation
    axes[1, 1].imshow(image_rgb, alpha=0.6)
    if final_data:
        colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA726', '#AB47BC', '#26C6DA', 
                 '#66BB6A', '#EF5350', '#29B6F6', '#FFCA28', '#8BC34A', '#FF7043', '#9C27B0']
        for i, store in enumerate(final_data['stores']):
            if 'polygon' in store and len(store['polygon']) > 2:
                polygon = store['polygon']
                x_coords = [p['x'] for p in polygon] + [polygon[0]['x']]
                y_coords = [p['y'] for p in polygon] + [polygon[0]['y']]
                axes[1, 1].fill(x_coords, y_coords, color=colors[i % len(colors)], 
                              alpha=0.5, edgecolor=colors[i % len(colors)], linewidth=2)
                
                # Add store name
                center = store['center']
                axes[1, 1].text(center['x'], center['y'], store['name'],
                               fontsize=8, ha='center', va='center',
                               bbox=dict(boxstyle="round,pad=0.3", facecolor='white', alpha=0.9),
                               weight='bold')
    
    axes[1, 1].set_title('Final Precise Individual Store Segmentation', fontsize=16, weight='bold')
    axes[1, 1].axis('off')
    
    plt.tight_layout()
    plt.savefig("output/segmentation_comparison.png", dpi=300, bbox_inches='tight')
    plt.close()
    
    print("Comparison visualization saved to output/segmentation_comparison.png")
    
    # Print comparison statistics
    print("\n=== SEGMENTATION COMPARISON ===")
    
    if manual_data:
        print(f"Manual approach: {len(manual_data['stores'])} stores")
    
    if contour_data:
        print(f"SAM contour detection: {len(contour_data['stores'])} regions")
        
    if final_data:
        print(f"Final precise segmentation: {len(final_data['stores'])} individual stores")
        
        # Category breakdown
        categories = {}
        for store in final_data['stores']:
            cat = store['category']
            if cat not in categories:
                categories[cat] = 0
            categories[cat] += 1
        
        print("\nStore categories:")
        for cat, count in categories.items():
            print(f"  {cat}: {count} stores")

if __name__ == "__main__":
    create_comparison_visualization()