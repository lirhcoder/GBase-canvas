#!/usr/bin/env python3
"""
测试坐标系统和交互功能
"""

import requests
import json
import time

def test_enhanced_features():
    server_url = "http://localhost:5000"
    
    print("Enhanced Features Test - 坐标系统和交互功能")
    print("=" * 60)
    
    # 测试多个不同位置的点
    test_points = [
        {"name": "粉色区域测试", "point": [310, 150]},
        {"name": "蓝色区域测试", "point": [200, 300]},
        {"name": "绿色区域测试", "point": [400, 200]}
    ]
    
    results = []
    
    for i, test_case in enumerate(test_points):
        print(f"\n--- 测试 {i+1}: {test_case['name']} ---")
        print(f"测试点: {test_case['point']}")
        
        # 发送预测请求
        response = requests.post(f"{server_url}/api/predict", 
                               json={
                                   "points": [test_case['point']],
                                   "point_labels": [1]
                               })
        
        if response.status_code == 200:
            result = response.json()
            if result["success"]:
                # 分析结果数据
                mask_data = result["masks"][0] if result["masks"] else None
                best_mask = result["best_mask"]
                
                # 计算掩码统计信息
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
                
                print(f"✅ 成功生成 {result['num_masks']} 个掩码候选")
                print(f"   最佳置信度: {result['best_score']:.4f}")
                print(f"   掩码覆盖面积: {mask_stats['area']} 像素 ({mask_stats['coverage']:.2f}%)")
                print(f"   计算的中心点: ({center_point['x']}, {center_point['y']})")
                print(f"   边界点数量: {len(boundary_points)}")
                print(f"   前5个边界点: {boundary_points[:5]}")
                
            else:
                print(f"❌ 预测失败: {result['message']}")
                results.append({
                    "test_name": test_case['name'],
                    "success": False,
                    "error": result['message']
                })
        else:
            print(f"❌ 请求失败: HTTP {response.status_code}")
            results.append({
                "test_name": test_case['name'],
                "success": False,
                "error": f"HTTP {response.status_code}"
            })
        
        time.sleep(1)
    
    # 生成总结报告
    print("\n" + "=" * 60)
    print("测试总结")
    print("=" * 60)
    
    successful_tests = [r for r in results if r.get("success", False)]
    failed_tests = [r for r in results if not r.get("success", False)]
    
    print(f"总测试数: {len(results)}")
    print(f"成功: {len(successful_tests)}")
    print(f"失败: {len(failed_tests)}")
    print(f"成功率: {len(successful_tests)/len(results)*100:.1f}%")
    
    if successful_tests:
        print("\n坐标数据分析:")
        for result in successful_tests:
            print(f"\n• {result['test_name']}:")
            print(f"  输入点: {result['input_point']}")
            print(f"  中心点: ({result['center_point']['x']}, {result['center_point']['y']})")
            print(f"  面积: {result['mask_stats']['area']} 像素")
            print(f"  边界点数: {result['boundary_points_count']}")
            print(f"  置信度: {result['best_score']:.4f}")
    
    # 保存详细结果
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
    
    print(f"\n📄 详细结果已保存到: coordinate_test_results.json")
    
    return results

def analyze_mask_data(mask):
    """分析掩码数据统计信息"""
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
    """计算掩码的中心点"""
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
    """提取边界点"""
    boundary_points = []
    
    if not mask or len(mask) == 0:
        return boundary_points
    
    height = len(mask)
    width = len(mask[0]) if height > 0 else 0
    
    # 简化的边界检测
    for y in range(1, height - 1):
        for x in range(1, width - 1):
            if mask[y][x] > 0:
                # 检查是否为边界点
                neighbors = [
                    mask[y-1][x], mask[y+1][x],  # 上下
                    mask[y][x-1], mask[y][x+1]   # 左右
                ]
                
                if any(n == 0 for n in neighbors):
                    boundary_points.append({"x": x, "y": y})
    
    return boundary_points

if __name__ == "__main__":
    test_enhanced_features()