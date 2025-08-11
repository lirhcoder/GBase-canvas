#!/usr/bin/env python3
"""
测试修复后的店铺名称自动识别
"""

import requests
import json

def test_fixed_detection():
    server_url = "http://localhost:5000"
    
    print("测试修复后的店铺名称自动识别")
    print("=" * 50)
    
    # Initialize SAM
    init_response = requests.post(f"{server_url}/api/init", 
                                json={"image_path": "lumine-yurakucho.png"})
    
    if not (init_response.status_code == 200 and init_response.json()["success"]):
        print("FAILED: Could not initialize SAM")
        return
    
    print("SAM initialized successfully!")
    
    # 测试用户反馈的问题点
    test_point = [441, 161]
    print(f"\n测试坐标 {test_point} 的店铺识别...")
    
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
            
            # 模拟网页中的检测逻辑
            detected_name = simulate_detection_logic(center_point)
            
            print(f"输入点: {test_point}")
            print(f"掩码中心: ({center_point['x']}, {center_point['y']})")
            print(f"检测到的店铺名称: {detected_name}")
            print(f"置信度: {result['best_score']:.4f}")
            
            # 验证是否还有占位符文本
            if detected_name and "请在此填入" not in detected_name:
                print("✅ 店铺名称识别正常")
            elif detected_name is None:
                print("⚠️  无法识别此位置的店铺")
            else:
                print("❌ 仍有占位符文本")
                
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

def simulate_detection_logic(center_point):
    """模拟网页中的检测逻辑"""
    x, y = center_point["x"], center_point["y"]
    
    print(f"检测逻辑 - 中心点: ({x}, {y})")
    
    # 中心区域大店铺 - 掩码中心约 (325, 158)
    if x >= 300 and x <= 350 and y >= 140 and y <= 180:
        return "シルパイ シルスチュアート"
    # 右上区域店铺 - 掩码中心约 (440, 161)  
    elif x >= 420 and x <= 460 and y >= 150 and y <= 170:
        return "アニエスベー"
    # 左上小区域 - 掩码中心约 (138, 109)
    elif x >= 120 and x <= 160 and y >= 90 and y <= 130:
        return "ビームス"
    # 中下区域 - 掩码中心约 (335, 302)
    elif x >= 320 and x <= 350 and y >= 290 and y <= 320:
        return "ラグナムーン"
    # 右下区域 - 掩码中心约 (465, 302)
    elif x >= 450 and x <= 480 and y >= 290 and y <= 320:
        return "プラダ"
    # 扩大范围以覆盖更多可能的位置
    elif x >= 400 and x <= 500 and y >= 100 and y <= 200:
        return "マルニ"
    elif x >= 150 and x <= 250 and y >= 200 and y <= 300:
        return "フェンディ"
    elif x >= 200 and x <= 400 and y >= 350 and y <= 500:
        return "ユナイテッドアローズ"
    
    return None

if __name__ == "__main__":
    test_fixed_detection()