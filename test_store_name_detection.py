#!/usr/bin/env python3
"""
Test store name detection functionality
"""

import requests
import json
import time

def test_store_name_detection():
    server_url = "http://localhost:5000"
    
    print("Store Name Detection Test")
    print("=" * 50)
    
    # Initialize SAM
    init_response = requests.post(f"{server_url}/api/init", 
                                json={"image_path": "lumine-yurakucho.png"})
    
    if not (init_response.status_code == 200 and init_response.json()["success"]):
        print("FAILED: Could not initialize SAM")
        return
    
    print("SAM initialized successfully!")
    
    # Test specific store locations that should trigger name detection
    test_stores = [
        {
            "name": "Silpay Silstuart Expected Area", 
            "point": [325, 155], 
            "expected_name": "シルパイ シルスチュアート"
        },
        {
            "name": "Laguna Moon Expected Area", 
            "point": [215, 240], 
            "expected_name": "ラグナムーン"
        },
        {
            "name": "Agnes B Expected Area", 
            "point": [440, 160], 
            "expected_name": "アニエスベー"
        }
    ]
    
    for i, store in enumerate(test_stores):
        print(f"\nTest {i+1}: {store['name']} at {store['point']}")
        
        # Get SAM prediction
        response = requests.post(f"{server_url}/api/predict", 
                               json={
                                   "points": [store['point']],
                                   "point_labels": [1]
                               })
        
        if response.status_code == 200:
            result = response.json()
            if result["success"]:
                # Calculate center point for name detection simulation
                mask_data = result["best_mask"]
                center_point = calculate_center_point(mask_data)
                
                # Simulate name detection logic
                detected_name = detect_store_name_by_position(center_point)
                
                print(f"  Center Point: ({center_point['x']}, {center_point['y']})")
                print(f"  Expected: {store['expected_name']}")
                print(f"  Detected: {detected_name}")
                match_status = "YES" if detected_name == store['expected_name'] else "NO"
                print(f"  Match: {match_status}")
                print(f"  Confidence: {result['best_score']:.4f}")
                
            else:
                print(f"  FAILED: {result['message']}")
        else:
            print(f"  HTTP ERROR: {response.status_code}")
        
        time.sleep(0.5)
    
    print("\nStore name detection test completed!")

def calculate_center_point(mask_data):
    """Calculate the center point of the mask"""
    if not mask_data:
        return {"x": 0, "y": 0}
    
    sum_x, sum_y, count = 0, 0, 0
    height = len(mask_data)
    
    for y, row in enumerate(mask_data):
        for x, pixel in enumerate(row):
            if pixel > 0:
                sum_x += x
                sum_y += y
                count += 1
    
    if count > 0:
        return {"x": round(sum_x / count), "y": round(sum_y / count)}
    return {"x": 0, "y": 0}

def detect_store_name_by_position(center_point):
    """Same detection logic as in the web interface"""
    x, y = center_point["x"], center_point["y"]
    
    print(f"    Position check: x={x}, y={y}")
    
    if x >= 250 and x <= 400 and y >= 100 and y <= 200:
        return "シルパイ シルスチュアート"
    elif x >= 150 and x <= 280 and y >= 200 and y <= 280:
        return "ラグナムーン"
    elif x >= 380 and x <= 500 and y >= 100 and y <= 200:
        return "アニエスベー"
    elif x >= 100 and x <= 200 and y >= 300 and y <= 400:
        return "ビームス"
    elif x >= 450 and x <= 550 and y >= 200 and y <= 300:
        return "プラダ"
    elif x >= 200 and x <= 350 and y >= 400 and y <= 500:
        return "ユナイテッドアローズ"
    
    return None

if __name__ == "__main__":
    test_store_name_detection()