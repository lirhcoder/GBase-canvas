#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试SAM边界检测精度 - 参考官方演示实现
用于验证不同颜色色块的边界检测准确性
"""

import cv2
import numpy as np
import requests
import json
import time
from pathlib import Path

class BoundaryPrecisionTester:
    def __init__(self, server_url="http://localhost:5000"):
        self.server_url = server_url
        self.test_results = []
        
    def initialize_sam(self):
        """初始化SAM模型"""
        print("初始化SAM模型...")
        response = requests.post(f"{self.server_url}/api/init", 
                               json={"image_path": "lumine-yurakucho.png"})
        
        if response.status_code == 200:
            result = response.json()
            if result["success"]:
                print("[SUCCESS] SAM模型初始化成功！")
                return True
            else:
                print(f"[ERROR] SAM初始化失败: {result['message']}")
                return False
        else:
            print(f"[ERROR] 服务器连接失败: {response.status_code}")
            return False
    
    def test_color_block_detection(self, test_points):
        """测试不同颜色色块的边界检测"""
        print("\n[TEST] 开始测试不同颜色色块的边界检测精度...")
        
        for i, (name, points, expected_area_range) in enumerate(test_points):
            print(f"\n📍 测试 {i+1}: {name}")
            print(f"   测试点: {points}")
            
            # 发送预测请求
            response = requests.post(f"{self.server_url}/api/predict", 
                                   json={
                                       "points": points,
                                       "point_labels": [1] * len(points)
                                   })
            
            if response.status_code == 200:
                result = response.json()
                if result["success"]:
                    # 分析结果
                    self.analyze_prediction_result(name, result, expected_area_range)
                else:
                    print(f"   ❌ 预测失败: {result['message']}")
                    self.test_results.append({
                        "name": name,
                        "status": "failed",
                        "error": result["message"]
                    })
            else:
                print(f"   ❌ 请求失败: {response.status_code}")
                self.test_results.append({
                    "name": name,
                    "status": "failed", 
                    "error": f"HTTP {response.status_code}"
                })
            
            # 避免过快请求
            time.sleep(1)
    
    def analyze_prediction_result(self, name, result, expected_area_range):
        """分析预测结果"""
        num_masks = result.get("num_masks", 1)
        best_score = result.get("best_score", 0)
        
        print(f"   📊 生成掩码数量: {num_masks}")
        print(f"   🎯 最佳置信度: {best_score:.4f}")
        
        # 分析所有掩码候选
        if "masks" in result:
            print(f"   🎭 掩码分析:")
            for i, mask_data in enumerate(result["masks"]):
                area = mask_data["area"]
                score = mask_data["score"]
                is_best = mask_data["is_best"]
                status = "👑 推荐" if is_best else "   候选"
                
                print(f"      {status} 掩码{i+1}: 面积={area}, 置信度={score:.4f}")
                
                # 检查面积是否在期望范围内
                if expected_area_range:
                    min_area, max_area = expected_area_range
                    area_ok = min_area <= area <= max_area
                    area_status = "✅" if area_ok else "⚠️"
                    print(f"         {area_status} 面积检查: {area} ∈ [{min_area}, {max_area}]")
        
        # 记录测试结果
        self.test_results.append({
            "name": name,
            "status": "success",
            "num_masks": num_masks,
            "best_score": best_score,
            "masks": result.get("masks", [])
        })
        
        print(f"   ✅ {name} 测试完成")
    
    def run_precision_tests(self):
        """运行精度测试"""
        # 定义测试用例 - 商场地图中不同颜色区域的测试点
        test_cases = [
            # (名称, 测试点坐标, 期望面积范围)
            ("粉色区域-シルパイ シルスチュアート", [[310, 150]], (8000, 15000)),
            ("蓝色区域-ラグナムーン", [[200, 300]], (5000, 12000)),
            ("绿色区域-小店铺", [[400, 200]], (3000, 8000)),
            ("多点测试-大区域", [[250, 100], [300, 150]], (10000, 20000)),
            ("边界测试-角落区域", [[50, 50]], (1000, 5000))
        ]
        
        print("🚀 开始SAM边界检测精度测试")
        print(f"📡 服务器: {self.server_url}")
        print(f"🧪 测试用例数量: {len(test_cases)}")
        
        # 初始化SAM
        if not self.initialize_sam():
            print("❌ 无法初始化SAM，测试终止")
            return
        
        # 运行测试
        self.test_color_block_detection(test_cases)
        
        # 生成报告
        self.generate_test_report()
    
    def generate_test_report(self):
        """生成测试报告"""
        print("\n📋 测试报告")
        print("=" * 60)
        
        successful_tests = [r for r in self.test_results if r["status"] == "success"]
        failed_tests = [r for r in self.test_results if r["status"] == "failed"]
        
        print(f"✅ 成功测试: {len(successful_tests)}")
        print(f"❌ 失败测试: {len(failed_tests)}")
        print(f"📊 成功率: {len(successful_tests)/len(self.test_results)*100:.1f}%")
        
        if successful_tests:
            avg_score = np.mean([r["best_score"] for r in successful_tests])
            avg_masks = np.mean([r["num_masks"] for r in successful_tests])
            print(f"🎯 平均置信度: {avg_score:.4f}")
            print(f"🎭 平均掩码数: {avg_masks:.1f}")
        
        print("\n📈 详细结果:")
        for result in self.test_results:
            status_icon = "✅" if result["status"] == "success" else "❌"
            print(f"{status_icon} {result['name']}")
            
            if result["status"] == "success":
                print(f"    置信度: {result['best_score']:.4f}")
                print(f"    掩码数: {result['num_masks']}")
            else:
                print(f"    错误: {result.get('error', 'Unknown error')}")
        
        # 保存报告
        report_data = {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "server_url": self.server_url,
            "summary": {
                "total_tests": len(self.test_results),
                "successful": len(successful_tests),
                "failed": len(failed_tests),
                "success_rate": len(successful_tests)/len(self.test_results)*100
            },
            "results": self.test_results
        }
        
        with open("boundary_precision_test_report.json", "w", encoding="utf-8") as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2)
        
        print(f"\n💾 测试报告已保存: boundary_precision_test_report.json")

def main():
    """主函数"""
    print("SAM边界检测精度测试工具")
    print("参考segment-anything.com/demo的精确实现")
    print("-" * 50)
    
    tester = BoundaryPrecisionTester()
    tester.run_precision_tests()

if __name__ == "__main__":
    main()