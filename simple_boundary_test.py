#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Simple SAM boundary detection test
Test precision for different color blocks
"""

import requests
import json
import time

def test_sam_precision():
    server_url = "http://localhost:5000"
    
    print("SAM Boundary Detection Precision Test")
    print("Reference: segment-anything.com/demo implementation")
    print("=" * 50)
    
    # Initialize SAM
    print("Initializing SAM model...")
    response = requests.post(f"{server_url}/api/init", 
                           json={"image_path": "lumine-yurakucho.png"})
    
    if response.status_code != 200:
        print(f"ERROR: Cannot connect to server: {response.status_code}")
        return
    
    result = response.json()
    if not result["success"]:
        print(f"ERROR: SAM initialization failed: {result['message']}")
        return
    
    print("SUCCESS: SAM model initialized")
    
    # Test cases for different color blocks
    test_cases = [
        ("Pink Area - Store 1", [[310, 150]]),
        ("Blue Area - Store 2", [[200, 300]]), 
        ("Green Area - Store 3", [[400, 200]]),
        ("Multi-point test", [[250, 100], [300, 150]]),
        ("Corner area", [[100, 100]])
    ]
    
    results = []
    
    for i, (name, points) in enumerate(test_cases):
        print(f"\nTest {i+1}: {name}")
        print(f"Points: {points}")
        
        # Send prediction request
        response = requests.post(f"{server_url}/api/predict", 
                               json={
                                   "points": points,
                                   "point_labels": [1] * len(points)
                               })
        
        if response.status_code == 200:
            result = response.json()
            if result["success"]:
                num_masks = result.get("num_masks", 1)
                best_score = result.get("best_score", 0)
                
                print(f"  Generated masks: {num_masks}")
                print(f"  Best confidence: {best_score:.4f}")
                
                if "masks" in result:
                    print("  Mask analysis:")
                    for j, mask_data in enumerate(result["masks"]):
                        area = mask_data["area"]
                        score = mask_data["score"]
                        is_best = mask_data["is_best"]
                        status = "BEST" if is_best else "ALT"
                        print(f"    {status} Mask{j+1}: area={area}, score={score:.4f}")
                
                results.append({
                    "name": name,
                    "success": True,
                    "num_masks": num_masks,
                    "best_score": best_score
                })
                
                print(f"  SUCCESS: {name} completed")
            else:
                print(f"  ERROR: Prediction failed: {result['message']}")
                results.append({"name": name, "success": False, "error": result["message"]})
        else:
            print(f"  ERROR: Request failed: {response.status_code}")
            results.append({"name": name, "success": False, "error": f"HTTP {response.status_code}"})
        
        time.sleep(1)  # Avoid rapid requests
    
    # Generate summary
    print("\n" + "=" * 50)
    print("TEST SUMMARY")
    print("=" * 50)
    
    successful = [r for r in results if r.get("success", False)]
    failed = [r for r in results if not r.get("success", False)]
    
    print(f"Total tests: {len(results)}")
    print(f"Successful: {len(successful)}")
    print(f"Failed: {len(failed)}")
    print(f"Success rate: {len(successful)/len(results)*100:.1f}%")
    
    if successful:
        avg_score = sum(r["best_score"] for r in successful) / len(successful)
        avg_masks = sum(r["num_masks"] for r in successful) / len(successful)
        print(f"Average confidence: {avg_score:.4f}")
        print(f"Average masks per prediction: {avg_masks:.1f}")
    
    print("\nDetailed results:")
    for result in results:
        status = "PASS" if result.get("success", False) else "FAIL"
        print(f"  {status}: {result['name']}")
        if result.get("success", False):
            print(f"    Confidence: {result['best_score']:.4f}")
            print(f"    Masks: {result['num_masks']}")
        else:
            print(f"    Error: {result.get('error', 'Unknown')}")
    
    # Save report
    with open("boundary_test_report.json", "w", encoding="utf-8") as f:
        json.dump({
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "summary": {
                "total": len(results),
                "successful": len(successful),
                "failed": len(failed),
                "success_rate": len(successful)/len(results)*100
            },
            "results": results
        }, f, indent=2)
    
    print("\nReport saved: boundary_test_report.json")

if __name__ == "__main__":
    test_sam_precision()