#!/usr/bin/env python3
"""
校准店铺位置 - 通过多点测试确定实际的店铺名称和位置对应关系
"""

import requests
import json
import time

def calibrate_store_positions():
    server_url = "http://localhost:5000"
    
    print("店铺位置校准工具")
    print("=" * 60)
    
    # Initialize SAM
    init_response = requests.post(f"{server_url}/api/init", 
                                json={"image_path": "lumine-yurakucho.png"})
    
    if not (init_response.status_code == 200 and init_response.json()["success"]):
        print("FAILED: Could not initialize SAM")
        return
    
    print("SAM initialized successfully!")
    
    # 测试图像中不同位置的点，帮助确定实际的店铺分布
    test_positions = [
        # 根据LUMINE Yurakucho的实际布局进行测试
        {"name": "左上区域", "point": [150, 120]},
        {"name": "中上区域", "point": [300, 120]}, 
        {"name": "右上区域", "point": [450, 120]},
        
        {"name": "左中区域", "point": [150, 200]},
        {"name": "中中区域", "point": [300, 200]},
        {"name": "右中区域", "point": [450, 200]},
        
        {"name": "左下区域", "point": [150, 300]},
        {"name": "中下区域", "point": [300, 300]},
        {"name": "右下区域", "point": [450, 300]},
        
        # 基于用户反馈的具体位置
        {"name": "用户测试点", "point": [441, 161]},
    ]
    
    print("\n正在分析各个区域的掩码特征...")
    print("请根据以下信息手动确认各区域对应的店铺名称：")
    print("-" * 60)
    
    results = []
    
    for i, pos in enumerate(test_positions):
        print(f"\n{i+1}. 分析 {pos['name']} - 坐标 {pos['point']}")
        
        response = requests.post(f"{server_url}/api/predict", 
                               json={
                                   "points": [pos['point']],
                                   "point_labels": [1]
                               })
        
        if response.status_code == 200:
            result = response.json()
            if result["success"]:
                mask_data = result["best_mask"]
                center_point = calculate_center_point(mask_data)
                area = count_mask_pixels(mask_data)
                
                analysis = {
                    "区域名": pos['name'],
                    "测试点": pos['point'],
                    "掩码中心": f"({center_point['x']}, {center_point['y']})",
                    "掩码面积": f"{area} 像素",
                    "置信度": f"{result['best_score']:.4f}"
                }
                
                results.append(analysis)
                
                print(f"  测试点: {pos['point']}")
                print(f"  掩码中心: ({center_point['x']}, {center_point['y']})")
                print(f"  掩码面积: {area} 像素")
                print(f"  置信度: {result['best_score']:.4f}")
                print(f"  ---")
                print(f"  请在浏览器中查看此区域对应的店铺名称")
                
            else:
                print(f"  处理失败: {result['message']}")
        else:
            print(f"  HTTP错误: {response.status_code}")
        
        time.sleep(1)
    
    # 生成校准报告
    print("\n" + "=" * 60)
    print("位置校准报告")
    print("=" * 60)
    
    for result in results:
        print(f"{result['区域名']}: 测试点{result['测试点']} → 中心{result['掩码中心']} (面积:{result['掩码面积']}, 置信度:{result['置信度']})")
    
    # 保存校准数据
    with open("store_position_calibration.json", "w", encoding="utf-8") as f:
        json.dump({
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "image_file": "lumine-yurakucho.png",
            "calibration_data": results,
            "notes": "请根据浏览器中看到的实际店铺位置，手动更新 detectStoreName 函数中的坐标范围"
        }, f, indent=2, ensure_ascii=False)
    
    print(f"\n校准数据已保存到: store_position_calibration.json")
    print("\n下一步:")
    print("1. 在浏览器中逐个测试上述坐标点")
    print("2. 记录每个坐标点实际对应的店铺名称")
    print("3. 更新 detectStoreName 函数中的坐标范围")

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

def count_mask_pixels(mask_data):
    """Count non-zero pixels in mask"""
    if not mask_data:
        return 0
    
    count = 0
    for row in mask_data:
        for pixel in row:
            if pixel > 0:
                count += 1
    return count

if __name__ == "__main__":
    calibrate_store_positions()