#!/usr/bin/env python3
"""
验证フランフラン店铺名称识别
"""

import requests
import json

def test_francfranc_detection():
    server_url = "http://localhost:5000"
    
    print("验证フランフラン店铺名称识别")
    print("=" * 50)
    
    # Initialize SAM
    init_response = requests.post(f"{server_url}/api/init", 
                                json={"image_path": "lumine-yurakucho.png"})
    
    if not (init_response.status_code == 200 and init_response.json()["success"]):
        print("FAILED: Could not initialize SAM")
        return
    
    print("SAM initialized successfully!")
    
    # 测试フランフラン的位置
    test_point = [440, 161]
    print(f"\n测试坐标 {test_point} - 预期店铺: フランフラン")
    
    response = requests.post(f"{server_url}/api/predict", 
                           json={
                               "points": [test_point],
                               "point_labels": [1]
                           })
    
    if response.status_code == 200:
        result = response.json()
        if result["success"]:
            mask_data = result["best_mask"]
            center_point = calculate_center_point(mask_data)
            
            # 模拟更新后的检测逻辑
            detected_name = simulate_francfranc_detection(center_point)
            
            print(f"输入点: {test_point}")
            print(f"掩码中心: ({center_point['x']}, {center_point['y']})")
            print(f"检测到的店铺名称: {detected_name}")
            print(f"置信度: {result['best_score']:.4f}")
            
            if detected_name == "フランフラン":
                print("✅ フランフラン 识别成功!")
            else:
                print(f"❌ 期望: フランフラン, 实际: {detected_name}")
                
        else:
            print(f"FAILED: {result['message']}")
    else:
        print(f"HTTP ERROR: {response.status_code}")

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

def simulate_francfranc_detection(center_point):
    """模拟更新后的检测逻辑"""
    x, y = center_point["x"], center_point["y"]
    
    print(f"检测逻辑 - 中心点: ({x}, {y})")
    
    # 检查是否在フランフラン的范围内
    if x >= 420 and x <= 460 and y >= 150 and y <= 170:
        return "フランフラン"
    
    # 其他店铺...
    if x >= 300 and x <= 350 and y >= 140 and y <= 180:
        return "シルパイ シルスチュアート"
    elif x >= 120 and x <= 160 and y >= 90 and y <= 130:
        return "ビームス"
    elif x >= 320 and x <= 350 and y >= 290 and y <= 320:
        return "ラグナムーン"
    elif x >= 450 and x <= 480 and y >= 290 and y <= 320:
        return "プラダ"
    elif x >= 400 and x <= 500 and y >= 100 and y <= 200:
        return "マルニ"
    elif x >= 150 and x <= 250 and y >= 200 and y <= 300:
        return "フェンディ"
    elif x >= 200 and x <= 400 and y >= 350 and y <= 500:
        return "ユナイテッドアローズ"
    
    return None

if __name__ == "__main__":
    test_francfranc_detection()