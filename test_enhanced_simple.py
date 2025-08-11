#!/usr/bin/env python3
"""
Test enhanced coordinate system and interactive features - simplified version
"""

import requests
import json
import time

def test_enhanced_features():
    server_url = "http://localhost:5000"
    
    print("Enhanced Features Test - Coordinate System and Interaction")
    print("=" * 60)
    
    # Initialize SAM first
    print("Initializing SAM model...")
    init_response = requests.post(f"{server_url}/api/init", 
                                json={"image_path": "lumine-yurakucho.png"})
    
    if init_response.status_code == 200:
        init_result = init_response.json()
        if init_result["success"]:
            print(f"SAM initialized successfully!")
        else:
            print(f"SAM initialization failed: {init_result['message']}")
            return []
    else:
        print(f"Failed to connect to server: HTTP {init_response.status_code}")
        return []
    
    # Test different positions
    test_points = [
        {"name": "Pink Area Test", "point": [310, 150]},
        {"name": "Blue Area Test", "point": [200, 300]},
        {"name": "Green Area Test", "point": [400, 200]}
    ]
    
    results = []
    
    for i, test_case in enumerate(test_points):
        print(f"\n--- Test {i+1}: {test_case['name']} ---")
        print(f"Test point: {test_case['point']}")
        
        # Send prediction request
        response = requests.post(f"{server_url}/api/predict", 
                               json={
                                   "points": [test_case['point']],
                                   "point_labels": [1]
                               })
        
        if response.status_code == 200:
            result = response.json()
            if result["success"]:
                # Analyze result data
                mask_data = result["masks"][0] if result["masks"] else None
                best_mask = result["best_mask"]
                
                # Calculate mask statistics
                mask_stats = analyze_mask_data(best_mask)
                center_point = calculate_mask_center(best_mask)
                boundary_points = extract_boundary_points(best_mask)
                
                test_result = {
                    "test_name": test_case['name'],
                    "input_point": test_case['point'],
                    "success": True,
                    "num_masks": result["num_masks"],
                    "best_score": result["best_score"],
                    "mask_stats": mask_stats,
                    "center_point": center_point,
                    "boundary_points_count": len(boundary_points),
                    "first_few_boundary_points": boundary_points[:5]
                }
                
                results.append(test_result)
                
                print(f"SUCCESS: Generated {result['num_masks']} mask candidates")
                print(f"   Best confidence: {result['best_score']:.4f}")
                print(f"   Mask area: {mask_stats['area']} pixels ({mask_stats['coverage']:.2f}%)")
                print(f"   Calculated center: ({center_point['x']}, {center_point['y']})")
                print(f"   Boundary points: {len(boundary_points)}")
                print(f"   First 5 boundary points: {boundary_points[:5]}")
                
            else:
                print(f"FAILED: {result['message']}")
                results.append({
                    "test_name": test_case['name'],
                    "success": False,
                    "error": result['message']
                })
        else:
            print(f"HTTP ERROR: {response.status_code}")
            results.append({
                "test_name": test_case['name'],
                "success": False,
                "error": f"HTTP {response.status_code}"
            })
        
        time.sleep(1)
    
    # Generate summary report
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    successful_tests = [r for r in results if r.get("success", False)]
    failed_tests = [r for r in results if not r.get("success", False)]
    
    print(f"Total tests: {len(results)}")
    print(f"Success: {len(successful_tests)}")
    print(f"Failed: {len(failed_tests)}")
    print(f"Success rate: {len(successful_tests)/len(results)*100:.1f}%")
    
    if successful_tests:
        print("\nCoordinate data analysis:")
        for result in successful_tests:
            print(f"\n* {result['test_name']}:")
            print(f"  Input point: {result['input_point']}")
            print(f"  Center point: ({result['center_point']['x']}, {result['center_point']['y']})")
            print(f"  Area: {result['mask_stats']['area']} pixels")
            print(f"  Boundary points: {result['boundary_points_count']}")
            print(f"  Confidence: {result['best_score']:.4f}")
    
    # Save detailed results
    with open("coordinate_test_results.json", "w", encoding="utf-8") as f:
        json.dump({
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "test_summary": {
                "total": len(results),
                "successful": len(successful_tests),
                "failed": len(failed_tests),
                "success_rate": len(successful_tests)/len(results)*100
            },
            "detailed_results": results
        }, f, indent=2, ensure_ascii=False)
    
    print(f"\nDetailed results saved to: coordinate_test_results.json")
    
    return results

def analyze_mask_data(mask):
    """Analyze mask data statistics"""
    if not mask:
        return {"area": 0, "coverage": 0, "width": 0, "height": 0}
    
    height = len(mask)
    width = len(mask[0]) if height > 0 else 0
    total_pixels = height * width
    
    non_zero_pixels = 0
    for row in mask:
        for pixel in row:
            if pixel > 0:
                non_zero_pixels += 1
    
    coverage = (non_zero_pixels / total_pixels * 100) if total_pixels > 0 else 0
    
    return {
        "area": non_zero_pixels,
        "coverage": coverage,
        "width": width,
        "height": height
    }

def calculate_mask_center(mask):
    """Calculate mask center point"""
    if not mask:
        return {"x": 0, "y": 0}
    
    sum_x, sum_y, count = 0, 0, 0
    
    for y, row in enumerate(mask):
        for x, pixel in enumerate(row):
            if pixel > 0:
                sum_x += x
                sum_y += y
                count += 1
    
    if count > 0:
        return {"x": round(sum_x / count), "y": round(sum_y / count)}
    else:
        return {"x": 0, "y": 0}

def extract_boundary_points(mask):
    """Extract boundary points"""
    boundary_points = []
    
    if not mask or len(mask) == 0:
        return boundary_points
    
    height = len(mask)
    width = len(mask[0]) if height > 0 else 0
    
    # Simplified boundary detection
    for y in range(1, height - 1):
        for x in range(1, width - 1):
            if mask[y][x] > 0:
                # Check if it's a boundary point
                neighbors = [
                    mask[y-1][x], mask[y+1][x],  # up/down
                    mask[y][x-1], mask[y][x+1]   # left/right
                ]
                
                if any(n == 0 for n in neighbors):
                    boundary_points.append({"x": x, "y": y})
    
    return boundary_points

if __name__ == "__main__":
    test_enhanced_features()