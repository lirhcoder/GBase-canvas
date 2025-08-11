import type { Point, SAMPrediction, AIInsightResult, StoreCategory } from '../types/core';

interface PredictionRequest {
  imageData: ImageData;
  point: Point;
  box?: [number, number, number, number];
}

interface PredictionResponse extends SAMPrediction {
  polygon: Point[];
  boundingBox: { x: number; y: number; width: number; height: number };
  centerPoint: Point;
  maskCoordinates: Point[];
  boundaryPoints: Point[];
}

/**
 * AI助手服务 - 整合SAM模型和智能分析
 */
export class AIAssistant {
  private apiEndpoint: string;
  private modelVersion: string;
  
  constructor() {
    this.apiEndpoint = '/api/sam';
    this.modelVersion = '1.0.0';
  }

  /**
   * SAM图像分割预测
   */
  async predictSegmentation(request: PredictionRequest): Promise<PredictionResponse> {
    const response = await fetch(`${this.apiEndpoint}/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_data: this.imageDataToBase64(request.imageData),
        points: [[request.point.x, request.point.y]],
        point_labels: [1],
        box: request.box,
        model_version: this.modelVersion
      })
    });

    if (!response.ok) {
      throw new Error(`SAM prediction failed: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || 'SAM prediction failed');
    }

    return this.processSAMResult(result);
  }

  /**
   * 智能区域分析
   */
  async analyzeRegion(mask: number[][], imageData: ImageData): Promise<AIInsightResult> {
    // 提取区域特征
    const features = this.extractVisualFeatures(mask, imageData);
    
    // 预测店铺类型
    const category = await this.predictStoreCategory(features);
    
    // 生成建议名称
    const suggestedName = await this.generateStoreName(category, features);
    
    // 质量评估
    const qualityScore = this.assessSegmentationQuality(mask);

    return {
      confidence: qualityScore,
      suggestions: [
        `建议店铺名称: ${suggestedName}`,
        `类别: ${category}`,
        `置信度: ${(qualityScore * 100).toFixed(1)}%`
      ],
      category,
      quality_score: qualityScore,
      suggestedName,
      tags: this.generateTags(category, features)
    };
  }

  /**
   * 批量预测优化
   */
  async batchPredict(requests: PredictionRequest[]): Promise<PredictionResponse[]> {
    const batchSize = 10;
    const results: PredictionResponse[] = [];

    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const promises = batch.map(req => this.predictSegmentation(req));
      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * 智能边界优化
   */
  async refineBoundaries(roughMask: number[][], context: ImageData): Promise<number[][]> {
    // 使用图像处理技术优化边界
    const smoothed = this.applyGaussianSmoothing(roughMask);
    const refined = this.applyEdgePreservingFilter(smoothed, context);
    
    return refined;
  }

  /**
   * 学习用户反馈
   */
  async learnFromFeedback(corrections: UserCorrection[]): Promise<void> {
    // 发送用户反馈到训练服务
    await fetch(`${this.apiEndpoint}/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        corrections,
        model_version: this.modelVersion,
        timestamp: new Date().toISOString()
      })
    });
  }

  // 私有辅助方法

  private imageDataToBase64(imageData: ImageData): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
  }

  private processSAMResult(result: any): PredictionResponse {
    const bestMask = result.best_mask;
    const shape = result.shape;
    
    // 计算多边形
    const polygon = this.maskToPolygon(bestMask);
    
    // 计算边界框
    const boundingBox = this.calculateBoundingBox(polygon);
    
    // 计算中心点
    const centerPoint = this.calculateCenter(polygon);
    
    // 提取掩码坐标
    const maskCoordinates = this.extractMaskCoordinates(bestMask);
    
    // 提取边界点
    const boundaryPoints = this.extractBoundaryPoints(bestMask);

    return {
      masks: result.masks,
      scores: result.scores || [result.best_score],
      logits: result.logits || [],
      shape: shape,
      polygon,
      boundingBox,
      centerPoint,
      maskCoordinates,
      boundaryPoints
    };
  }

  private maskToPolygon(mask: number[][]): Point[] {
    const contours = this.findContours(mask);
    if (contours.length === 0) return [];
    
    // 使用最大轮廓
    const mainContour = contours.reduce((largest, current) => 
      current.length > largest.length ? current : largest
    );
    
    // 简化轮廓
    return this.simplifyPolygon(mainContour, 2.0);
  }

  private findContours(mask: number[][]): Point[][] {
    const height = mask.length;
    const width = mask[0].length;
    const visited = Array(height).fill(null).map(() => Array(width).fill(false));
    const contours: Point[][] = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (mask[y][x] > 0 && !visited[y][x]) {
          const contour = this.traceContour(mask, x, y, visited);
          if (contour.length > 10) {
            contours.push(contour);
          }
        }
      }
    }

    return contours;
  }

  private traceContour(mask: number[][], startX: number, startY: number, visited: boolean[][]): Point[] {
    const contour: Point[] = [];
    const directions = [
      [-1, -1], [0, -1], [1, -1],
      [-1,  0],          [1,  0],
      [-1,  1], [0,  1], [1,  1]
    ];

    let x = startX, y = startY;
    let steps = 0;
    const maxSteps = 1000;

    while (steps < maxSteps) {
      if (visited[y][x]) break;
      
      visited[y][x] = true;
      contour.push({ x, y });

      // 寻找下一个边界点
      let found = false;
      for (const [dx, dy] of directions) {
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < mask[0].length && ny >= 0 && ny < mask.length) {
          if (mask[ny][nx] > 0 && !visited[ny][nx]) {
            x = nx;
            y = ny;
            found = true;
            break;
          }
        }
      }
      
      if (!found) break;
      steps++;
    }

    return contour;
  }

  private simplifyPolygon(points: Point[], tolerance: number): Point[] {
    if (points.length <= 2) return points;

    // Douglas-Peucker算法
    const douglasPeucker = (pts: Point[], epsilon: number): Point[] => {
      if (pts.length <= 2) return pts;

      let maxDistance = 0;
      let index = 0;
      const start = pts[0];
      const end = pts[pts.length - 1];

      for (let i = 1; i < pts.length - 1; i++) {
        const distance = this.pointToLineDistance(pts[i], start, end);
        if (distance > maxDistance) {
          maxDistance = distance;
          index = i;
        }
      }

      if (maxDistance > epsilon) {
        const left = douglasPeucker(pts.slice(0, index + 1), epsilon);
        const right = douglasPeucker(pts.slice(index), epsilon);
        return [...left.slice(0, -1), ...right];
      } else {
        return [start, end];
      }
    };

    return douglasPeucker(points, tolerance);
  }

  private pointToLineDistance(point: Point, lineStart: Point, lineEnd: Point): number {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    
    if (lenSq === 0) return Math.sqrt(A * A + B * B);

    const param = dot / lenSq;
    let xx: number, yy: number;

    if (param < 0) {
      xx = lineStart.x;
      yy = lineStart.y;
    } else if (param > 1) {
      xx = lineEnd.x;
      yy = lineEnd.y;
    } else {
      xx = lineStart.x + param * C;
      yy = lineStart.y + param * D;
    }

    const dx = point.x - xx;
    const dy = point.y - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private calculateBoundingBox(polygon: Point[]) {
    if (polygon.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

    const xs = polygon.map(p => p.x);
    const ys = polygon.map(p => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  private calculateCenter(polygon: Point[]): Point {
    if (polygon.length === 0) return { x: 0, y: 0 };

    const sum = polygon.reduce(
      (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
      { x: 0, y: 0 }
    );

    return {
      x: Math.round(sum.x / polygon.length),
      y: Math.round(sum.y / polygon.length)
    };
  }

  private extractMaskCoordinates(mask: number[][]): Point[] {
    const coordinates: Point[] = [];
    
    for (let y = 0; y < mask.length; y++) {
      for (let x = 0; x < mask[0].length; x++) {
        if (mask[y][x] > 0) {
          coordinates.push({ x, y });
        }
      }
    }
    
    return coordinates;
  }

  private extractBoundaryPoints(mask: number[][]): Point[] {
    const boundaryPoints: Point[] = [];
    const height = mask.length;
    const width = mask[0].length;
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        if (mask[y][x] > 0) {
          const neighbors = [
            mask[y-1][x], mask[y+1][x],
            mask[y][x-1], mask[y][x+1]
          ];
          
          if (neighbors.some(n => n === 0)) {
            boundaryPoints.push({ x, y });
          }
        }
      }
    }
    
    return boundaryPoints;
  }

  private extractVisualFeatures(mask: number[][], imageData: ImageData): VisualFeatures {
    // 提取颜色直方图、纹理特征等
    return {
      avgColor: this.calculateAverageColor(mask, imageData),
      area: this.calculateMaskArea(mask),
      aspectRatio: this.calculateAspectRatio(mask),
      compactness: this.calculateCompactness(mask)
    };
  }

  private calculateAverageColor(mask: number[][], imageData: ImageData): [number, number, number] {
    let r = 0, g = 0, b = 0, count = 0;
    
    for (let y = 0; y < mask.length; y++) {
      for (let x = 0; x < mask[0].length; x++) {
        if (mask[y][x] > 0) {
          const idx = (y * imageData.width + x) * 4;
          r += imageData.data[idx];
          g += imageData.data[idx + 1];
          b += imageData.data[idx + 2];
          count++;
        }
      }
    }
    
    return count > 0 ? [r/count, g/count, b/count] : [0, 0, 0];
  }

  private calculateMaskArea(mask: number[][]): number {
    let area = 0;
    for (let y = 0; y < mask.length; y++) {
      for (let x = 0; x < mask[0].length; x++) {
        if (mask[y][x] > 0) area++;
      }
    }
    return area;
  }

  private calculateAspectRatio(mask: number[][]): number {
    // 计算最小外接矩形的宽高比
    return 1.0; // 简化实现
  }

  private calculateCompactness(mask: number[][]): number {
    const area = this.calculateMaskArea(mask);
    const perimeter = this.extractBoundaryPoints(mask).length;
    return perimeter > 0 ? (4 * Math.PI * area) / (perimeter * perimeter) : 0;
  }

  private async predictStoreCategory(features: VisualFeatures): Promise<StoreCategory> {
    // 基于特征的简单分类逻辑
    const { avgColor, area } = features;
    
    if (avgColor[0] > 150 && avgColor[1] < 100 && avgColor[2] < 100) {
      return 'レディスファッション';
    }
    if (area > 10000) {
      return 'インテリア・生活雑貨';
    }
    
    return 'その他';
  }

  private async generateStoreName(category: StoreCategory, features: VisualFeatures): Promise<string> {
    const storeNames: Record<StoreCategory, string[]> = {
      'レディスファッション': ['フランフラン', 'シルパイ シルスチュアート', 'ラグナムーン'],
      'インテリア・生活雑貨': ['無印良品', 'ニトリ', 'IKEA'],
      'ファッション雑貨': ['アクセサリーショップ', 'バッグ専門店'],
      'メンズファッション': ['メンズウェア', 'スーツショップ'],
      'レストラン・カフェ': ['カフェ', 'レストラン'],
      'サービス': ['サービスカウンター'],
      'その他': ['ショップ']
    };
    
    const candidates = storeNames[category] || ['Unknown Store'];
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  private generateTags(category: StoreCategory, features: VisualFeatures): string[] {
    return [category, `area_${Math.floor(features.area / 1000)}k`];
  }

  private assessSegmentationQuality(mask: number[][]): number {
    const area = this.calculateMaskArea(mask);
    const compactness = this.calculateCompactness(mask);
    
    // 简单的质量评估
    return Math.min(1.0, (area / 10000) * compactness);
  }

  private applyGaussianSmoothing(mask: number[][]): number[][] {
    // 高斯平滑实现
    return mask; // 简化实现
  }

  private applyEdgePreservingFilter(mask: number[][], context: ImageData): number[][] {
    // 边缘保持滤波实现
    return mask; // 简化实现
  }
}

// 类型定义
interface VisualFeatures {
  avgColor: [number, number, number];
  area: number;
  aspectRatio: number;
  compactness: number;
}

interface UserCorrection {
  original_prediction: any;
  corrected_mask: number[][];
  feedback_type: 'boundary' | 'category' | 'name';
  user_id: string;
}