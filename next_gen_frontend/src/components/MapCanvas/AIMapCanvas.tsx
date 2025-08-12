import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { Stage, Layer, Image as KonvaImage, Group } from 'react-konva';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore, useViewport, useAnnotations } from '../../stores/appStore';
import { AIAssistant } from '../../services/aiService';
import { AnnotationRenderer } from './AnnotationRenderer';
import { InteractionHandler } from './InteractionHandler';
import { PerformanceMonitor } from '../../utils/performance';
import type { Point, Annotation } from '../../types/core';

interface AIMapCanvasProps {
  imageUrl: string;
  width: number;
  height: number;
  className?: string;
}

export const AIMapCanvas: React.FC<AIMapCanvasProps> = ({
  imageUrl,
  width,
  height,
  className
}) => {
  // Get map config from store to support dynamic image loading
  const mapConfig = useAppStore(state => state.map.config);
  // State and refs
  const stageRef = useRef<any>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Zustand store
  const viewport = useViewport();
  const annotations = useAnnotations();
  const selectedAnnotation = useAppStore(state => state.map.selectedAnnotation);
  const currentTool = useAppStore(state => state.ui.currentTool);
  const { setLoading, setError, addAnnotation, updateViewport, selectAnnotation } = useAppStore();
  
  // Services
  const aiAssistant = useMemo(() => new AIAssistant(), []);
  const performanceMonitor = useMemo(() => new PerformanceMonitor(), []);


  // Image loading and SAM initialization
  useEffect(() => {
    const initImageAndSAM = async () => {
      setLoading(true);
      
      try {
        // Use image from map config if available, otherwise use prop
        const currentImageUrl = mapConfig?.imageUrl || imageUrl;
        
        // 1. Load the image
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        
        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            imageRef.current = img;
            resolve();
          };
          img.onerror = () => reject(new Error('Failed to load map image'));
          img.src = currentImageUrl;
        });
        
        console.log('🖼️ Image loaded successfully');
        
        // 2. Initialize SAM with the image
        const currentImageUrl = mapConfig?.imageUrl || imageUrl;
        const imageName = currentImageUrl.split('/').pop() || 'lumine-yurakucho.png';
        const initResponse = await fetch('/api/init', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            image_path: imageName
          })
        });
        
        if (!initResponse.ok) {
          throw new Error(`SAM initialization failed: ${initResponse.statusText}`);
        }
        
        const initResult = await initResponse.json();
        console.log('🎯 SAM initialized successfully:', initResult);
        
        setLoading(false);
        
      } catch (error) {
        console.error('❌ Initialization failed:', error);
        setError(`Initialization failed: ${error.message}`);
        setLoading(false);
      }
    };
    
    initImageAndSAM();
  }, [imageUrl, mapConfig?.imageUrl, setLoading, setError]);

  // AI prediction handler
  const handleAIPrediction = useCallback(async (point: Point) => {
    console.log('🎯 AI prediction triggered at point:', point);
    
    if (!imageRef.current) {
      console.log('❌ Image not loaded');
      return;
    }

    try {
      setLoading(true);
      console.log('⏳ Starting AI prediction...');

      // 调用SAM API
      const adjustedPoint = {
        x: Math.round(point.x / viewport.zoom),
        y: Math.round(point.y / viewport.zoom)
      };
      
      console.log('🎯 点击坐标信息:');
      console.log('   原始点:', point);
      console.log('   视口缩放:', viewport.zoom);
      console.log('   调整后点:', adjustedPoint);
      
      const response = await fetch('/api/predict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          points: [[adjustedPoint.x, adjustedPoint.y]],
          point_labels: [1]
        })
      });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ AI prediction result:', result);

      // 基于SAM结果检测商店名称和类别
      const storeInfo = detectStoreInfo(Math.round(point.x / viewport.zoom), Math.round(point.y / viewport.zoom));

      // 从SAM mask生成多边形边界
      const polygonPoints = extractPolygonFromMask(result.best_mask, result.shape);
      const boundingBox = calculateBoundingBox(polygonPoints);
      const centerPoint = calculateCenterPoint(polygonPoints);

      // 创建基于SAM结果的标注
      const annotation: Annotation = {
        id: `annotation_${Date.now()}`,
        store: {
          id: `store_${Date.now()}`,
          name: storeInfo.name,
          category: storeInfo.category,
          tags: ['AI-detected'],
          metadata: { 
            sam_processed: true,
            mask_shape: result.shape,
            original_point: {x: point.x, y: point.y}
          }
        },
        geometry: {
          polygon: { points: polygonPoints },
          boundingBox: boundingBox,
          centerPoint: centerPoint
        },
        coordinates: {
          maskCoordinates: extractMaskCoordinates(result.best_mask, result.shape),
          boundaryPoints: extractBoundaryPoints(result.best_mask, result.shape)
        },
        ai: {
          confidence: result.scores?.[0] || result.best_score || 0.85,
          model_version: '1.0.0',
          processing_time: performanceMonitor.endTimer('ai_prediction') || 1000,
          suggestions: []
        },
        timestamps: {
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          last_verified: new Date().toISOString()
        },
        user: {
          creator_id: 'current_user',
          editors: [],
          status: 'draft'
        }
      };

      // 扩展的商店信息检测函数
      function detectStoreInfo(x: number, y: number): {name: string, category: string} {
        console.log(`🏪 Detecting store at (${x}, ${y})`);
        
        // 根据图像分析的店铺位置坐标范围
        const stores = [
          // 上层区域
          { name: 'シルパイ シルスチュアート', x1: 260, y1: 90, x2: 380, y2: 190, category: 'レディスファッション' },
          { name: 'フランフラン', x1: 400, y1: 90, x2: 500, y2: 190, category: 'インテリア・生活雑貨' },
          
          // 中层区域 
          { name: 'アンドクチュール', x1: 120, y1: 160, x2: 220, y2: 260, category: 'レディスファッション' },
          { name: 'ラグナムーン', x1: 260, y1: 220, x2: 380, y2: 320, category: 'レディスファッション' },
          { name: 'フランフラン', x1: 400, y1: 220, x2: 500, y2: 320, category: 'インテリア・生活雑貨' },
          
          // 中下层区域
          { name: 'アルページュストーリー', x1: 120, y1: 320, x2: 250, y2: 450, category: 'レディスファッション' },
          { name: 'ココディール リュクス', x1: 260, y1: 340, x2: 380, y2: 440, category: 'レディスファッション' },
          { name: 'ノエラ', x1: 400, y1: 340, x2: 500, y2: 400, category: 'レディスファッション' },
          { name: 'ヴィルセレクション', x1: 400, y1: 420, x2: 500, y2: 480, category: 'レディスファッション' },
          
          // 下层区域
          { name: 'マーキュリー デュオ', x1: 260, y1: 500, x2: 360, y2: 580, category: 'レディスファッション' },
          { name: 'エメ エクレ', x1: 380, y1: 500, x2: 500, y2: 580, category: 'レディスファッション' },
          
          // 底部大型区域
          { name: 'ダイアナ', x1: 160, y1: 600, x2: 300, y2: 760, category: 'ファッション雑貨' },
          { name: 'ピーチ・ジョン', x1: 320, y1: 600, x2: 500, y2: 760, category: 'ファッション雑貨' }
        ];
        
        // 查找匹配的店铺
        for (const store of stores) {
          if (x >= store.x1 && x <= store.x2 && y >= store.y1 && y <= store.y2) {
            console.log(`✅ Found store: ${store.name} at (${x}, ${y}) - Category: ${store.category}`);
            return { name: store.name, category: store.category };
          }
        }
        
        // 如果没有找到匹配的店铺，返回默认信息
        console.log(`❌ No store found at (${x}, ${y})`);
        return { name: `Unknown Store (${x}, ${y})`, category: 'その他' };
      }

      // SAM mask处理辅助函数 - 真实轮廓提取
      function extractPolygonFromMask(mask: number[][], shape: number[]): Point[] {
        console.log('🎨 Extracting true contour from mask, shape:', shape);
        
        if (!mask || !shape || shape.length < 2) {
          console.warn('Invalid mask or shape data');
          return [{x: point.x, y: point.y}];
        }

        const [height, width] = shape;
        
        // 首先检查掩码中是否有有效像素
        let hasMaskPixels = false;
        for (let y = 0; y < height && !hasMaskPixels; y++) {
          if (!mask[y]) continue;
          for (let x = 0; x < width; x++) {
            if (mask[y][x] > 0) {
              hasMaskPixels = true;
              break;
            }
          }
        }
        
        if (!hasMaskPixels) {
          console.warn('No mask pixels found');
          const size = 30;
          return [
            {x: point.x - size, y: point.y - size},
            {x: point.x + size, y: point.y - size},
            {x: point.x + size, y: point.y + size},
            {x: point.x - size, y: point.y + size}
          ];
        }

        // 创建二值化掩码
        const binaryMask: boolean[][] = [];
        for (let y = 0; y < height; y++) {
          binaryMask[y] = [];
          for (let x = 0; x < width; x++) {
            binaryMask[y][x] = (mask[y] && mask[y][x] > 0) || false;
          }
        }

        // 查找轮廓
        const contours = findContours(binaryMask, width, height);
        console.log(`🔍 Found ${contours.length} contours`);
        
        if (contours.length === 0) {
          console.warn('No contours found, using bounding box');
          return createBoundingBoxPolygon(mask, shape);
        }

        // 选择最大的轮廓
        const mainContour = contours.reduce((largest, current) => 
          current.length > largest.length ? current : largest
        );

        console.log(`🎯 Selected main contour with ${mainContour.length} points`);

        // 简化轮廓以减少顶点数量
        const simplifiedContour = simplifyContour(mainContour, 3);
        console.log(`📐 Simplified to ${simplifiedContour.length} points`);

        // 转换坐标并应用缩放
        const polygonPoints = simplifiedContour.map(p => ({
          x: p.x * viewport.zoom,
          y: p.y * viewport.zoom
        }));

        return polygonPoints;
      }

      // 查找轮廓的主函数
      function findContours(binaryMask: boolean[][], width: number, height: number): Point[][] {
        const visited: boolean[][] = Array(height).fill(null).map(() => Array(width).fill(false));
        const contours: Point[][] = [];

        // 8方向
        const directions = [
          [-1, -1], [0, -1], [1, -1],
          [-1, 0],           [1, 0],
          [-1, 1],  [0, 1],  [1, 1]
        ];

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            // 如果是前景像素且未访问过
            if (binaryMask[y][x] && !visited[y][x] && isEdgePixel(binaryMask, x, y, width, height)) {
              const contour = traceBoundary(binaryMask, visited, x, y, width, height, directions);
              if (contour.length > 4) { // 只保留有意义的轮廓
                contours.push(contour);
              }
            }
          }
        }

        return contours;
      }

      // 检查是否为边界像素
      function isEdgePixel(mask: boolean[][], x: number, y: number, width: number, height: number): boolean {
        if (!mask[y][x]) return false;
        
        // 边界条件：在图像边缘
        if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
          return true;
        }
        
        // 检查8邻域，如果有背景像素则为边界
        const neighbors = [
          [-1, -1], [0, -1], [1, -1],
          [-1, 0],           [1, 0],
          [-1, 1],  [0, 1],  [1, 1]
        ];
        
        for (const [dx, dy] of neighbors) {
          const nx = x + dx;
          const ny = y + dy;
          
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            if (!mask[ny][nx]) {
              return true; // 邻接背景像素，是边界
            }
          }
        }
        
        return false;
      }

      // 跟踪边界轮廓
      function traceBoundary(
        mask: boolean[][],
        visited: boolean[][],
        startX: number,
        startY: number,
        width: number,
        height: number,
        directions: number[][]
      ): Point[] {
        const contour: Point[] = [];
        const contourSet = new Set<string>();
        
        let currentX = startX;
        let currentY = startY;
        let steps = 0;
        const maxSteps = Math.max(width, height) * 4; // 防止无限循环
        
        do {
          const key = `${currentX},${currentY}`;
          
          // 避免重复访问
          if (contourSet.has(key) && contour.length > 6) {
            break;
          }
          
          contourSet.add(key);
          contour.push({ x: currentX, y: currentY });
          visited[currentY][currentX] = true;
          
          // 寻找下一个边界点
          let found = false;
          
          for (const [dx, dy] of directions) {
            const nextX = currentX + dx;
            const nextY = currentY + dy;
            
            if (nextX >= 0 && nextX < width && nextY >= 0 && nextY < height) {
              if (mask[nextY][nextX] && isEdgePixel(mask, nextX, nextY, width, height) && !contourSet.has(`${nextX},${nextY}`)) {
                currentX = nextX;
                currentY = nextY;
                found = true;
                break;
              }
            }
          }
          
          if (!found) {
            break;
          }
          
          steps++;
          
          // 检查是否回到起点附近
          if (steps > 8) {
            const distToStart = Math.sqrt((currentX - startX) ** 2 + (currentY - startY) ** 2);
            if (distToStart < 2) {
              break;
            }
          }
          
        } while (steps < maxSteps);
        
        return contour;
      }

      // 简化轮廓算法（Douglas-Peucker的简化版本）
      function simplifyContour(contour: Point[], tolerance: number): Point[] {
        if (contour.length <= 4) return contour;
        
        const simplified: Point[] = [contour[0]];
        
        // 使用距离阈值简化
        for (let i = 1; i < contour.length - 1; i++) {
          const prev = simplified[simplified.length - 1];
          const current = contour[i];
          
          const distance = Math.sqrt((current.x - prev.x) ** 2 + (current.y - prev.y) ** 2);
          
          if (distance >= tolerance) {
            simplified.push(current);
          }
        }
        
        // 确保闭合
        const first = simplified[0];
        const last = simplified[simplified.length - 1];
        const closingDistance = Math.sqrt((last.x - first.x) ** 2 + (last.y - first.y) ** 2);
        
        if (closingDistance > tolerance) {
          simplified.push(contour[contour.length - 1]);
        }
        
        return simplified;
      }

      // 创建边界框多边形作为备用方案
      function createBoundingBoxPolygon(mask: number[][], shape: number[]): Point[] {
        const [height, width] = shape;
        let minX = width, maxX = 0, minY = height, maxY = 0;
        
        for (let y = 0; y < height; y++) {
          if (!mask[y]) continue;
          for (let x = 0; x < width; x++) {
            if (mask[y][x] > 0) {
              minX = Math.min(minX, x);
              maxX = Math.max(maxX, x);
              minY = Math.min(minY, y);
              maxY = Math.max(maxY, y);
            }
          }
        }
        
        return [
          {x: minX * viewport.zoom, y: minY * viewport.zoom},
          {x: maxX * viewport.zoom, y: minY * viewport.zoom},
          {x: maxX * viewport.zoom, y: maxY * viewport.zoom},
          {x: minX * viewport.zoom, y: maxY * viewport.zoom}
        ];
      }

      // 模拟OpenCV的findContours算法
      function findContoursSimulated(binaryMask: number[][], width: number, height: number): Point[][] {
        console.log('🔍 Finding contours using simulated OpenCV method...');
        
        const contours: Point[][] = [];
        const visited: boolean[][] = [];
        
        // 初始化访问标记
        for (let y = 0; y < height; y++) {
          visited[y] = new Array(width).fill(false);
        }
        
        // 8连通性方向
        const directions = [
          {dx: -1, dy: -1}, {dx: 0, dy: -1}, {dx: 1, dy: -1},
          {dx: -1, dy: 0},                   {dx: 1, dy: 0},
          {dx: -1, dy: 1},  {dx: 0, dy: 1},  {dx: 1, dy: 1}
        ];
        
        // 扫描图像寻找轮廓
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            // 找到前景像素且未访问过
            if (binaryMask[y][x] > 0 && !visited[y][x]) {
              // 检查是否为边界点
              if (isBoundaryPixel(binaryMask, x, y, width, height)) {
                const contour = traceContourBoundary(binaryMask, visited, x, y, width, height, directions);
                if (contour.length > 2) { // 至少3个点才算有效轮廓
                  contours.push(contour);
                }
              } else {
                visited[y][x] = true; // 标记内部点为已访问
              }
            }
          }
        }
        
        console.log(`🎯 Found ${contours.length} contours`);
        return contours;
      }
      
      // 检查是否为边界像素
      function isBoundaryPixel(mask: number[][], x: number, y: number, width: number, height: number): boolean {
        // 边界条件：在图像边缘或邻接背景像素
        if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
          return mask[y][x] > 0;
        }
        
        // 检查8邻域，如果有背景像素则为边界
        const neighbors = [
          [-1, -1], [0, -1], [1, -1],
          [-1, 0],           [1, 0],
          [-1, 1],  [0, 1],  [1, 1]
        ];
        
        for (const [dx, dy] of neighbors) {
          const nx = x + dx;
          const ny = y + dy;
          
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            if (mask[ny][nx] === 0) {
              return true; // 邻接背景像素，是边界
            }
          }
        }
        
        return false; // 完全被前景像素包围，不是边界
      }
      
      // 跟踪轮廓边界
      function traceContourBoundary(
        mask: number[][], 
        visited: boolean[][], 
        startX: number, 
        startY: number, 
        width: number, 
        height: number, 
        directions: {dx: number, dy: number}[]
      ): Point[] {
        const contour: Point[] = [];
        const contourVisited = new Set<string>();
        
        let currentX = startX;
        let currentY = startY;
        let lastDirection = 0; // 开始方向
        let steps = 0;
        const maxSteps = width * height; // 防止无限循环
        
        do {
          const key = `${currentX},${currentY}`;
          
          // 避免在同一轮廓中重复访问同一点
          if (contourVisited.has(key) && contour.length > 3) {
            break;
          }
          
          contourVisited.add(key);
          contour.push({x: currentX, y: currentY});
          visited[currentY][currentX] = true;
          
          // 寻找下一个边界点（Moore邻域跟踪）
          let found = false;
          let searchStart = (lastDirection + 6) % 8; // 从前一方向的左侧开始搜索
          
          for (let i = 0; i < 8; i++) {
            const dirIndex = (searchStart + i) % 8;
            const dir = directions[dirIndex];
            const nextX = currentX + dir.dx;
            const nextY = currentY + dir.dy;
            
            // 检查边界条件
            if (nextX >= 0 && nextX < width && nextY >= 0 && nextY < height) {
              if (mask[nextY][nextX] > 0 && isBoundaryPixel(mask, nextX, nextY, width, height)) {
                currentX = nextX;
                currentY = nextY;
                lastDirection = dirIndex;
                found = true;
                break;
              }
            }
          }
          
          if (!found) {
            // 没有找到下一个边界点，轮廓结束
            break;
          }
          
          steps++;
          
          // 检查是否回到起点（完成闭合轮廓）
          if (steps > 8 && currentX === startX && currentY === startY) {
            break;
          }
          
        } while (steps < maxSteps);
        
        console.log(`🔗 Traced boundary contour with ${contour.length} points`);
        return contour;
      }
      
      // 计算轮廓面积
      function calculateContourArea(contour: Point[]): number {
        if (contour.length < 3) return 0;
        
        let area = 0;
        for (let i = 0; i < contour.length; i++) {
          const j = (i + 1) % contour.length;
          area += contour[i].x * contour[j].y;
          area -= contour[j].x * contour[i].y;
        }
        return Math.abs(area) / 2;
      }
      
      // Douglas-Peucker轮廓近似算法
      function approximateContourDP(contour: Point[], epsilon: number): Point[] {
        if (contour.length <= 2) return contour;
        
        // 对于闭合轮廓，找到最远点
        let maxDistance = 0;
        let maxIndex = 0;
        
        for (let i = 1; i < contour.length - 1; i++) {
          const distance = pointToLineDistance(contour[i], contour[0], contour[contour.length - 1]);
          if (distance > maxDistance) {
            maxDistance = distance;
            maxIndex = i;
          }
        }
        
        // 如果最大距离小于容差，简化为线段
        if (maxDistance < epsilon) {
          return [contour[0], contour[contour.length - 1]];
        }
        
        // 递归处理两段
        const segment1 = approximateContourDP(contour.slice(0, maxIndex + 1), epsilon);
        const segment2 = approximateContourDP(contour.slice(maxIndex), epsilon);
        
        // 合并结果
        return [...segment1.slice(0, -1), ...segment2];
      }
      
      // 计算点到直线的距离
      function pointToLineDistance(point: Point, lineStart: Point, lineEnd: Point): number {
        const A = lineEnd.x - lineStart.x;
        const B = lineEnd.y - lineStart.y;
        const C = point.x - lineStart.x;
        const D = point.y - lineStart.y;
        
        const dot = A * C + B * D;
        const lenSq = A * A + B * B;
        
        if (lenSq === 0) return Math.sqrt(C * C + D * D);
        
        const param = dot / lenSq;
        
        let closestX, closestY;
        if (param < 0) {
          closestX = lineStart.x;
          closestY = lineStart.y;
        } else if (param > 1) {
          closestX = lineEnd.x;
          closestY = lineEnd.y;
        } else {
          closestX = lineStart.x + param * A;
          closestY = lineStart.y + param * B;
        }
        
        const dx = point.x - closestX;
        const dy = point.y - closestY;
        return Math.sqrt(dx * dx + dy * dy);
      }


      function calculateBoundingBox(points: Point[]) {
        if (points.length === 0) return { x: point.x - 25, y: point.y - 25, width: 50, height: 50 };
        
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
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

      function calculateCenterPoint(points: Point[]): Point {
        if (points.length === 0) return point;
        
        return {
          x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
          y: points.reduce((sum, p) => sum + p.y, 0) / points.length
        };
      }

      function extractMaskCoordinates(mask: number[][], shape: number[]): Point[] {
        const coordinates: Point[] = [];
        if (!mask || !shape) return coordinates;
        
        const [height, width] = shape;
        for (let y = 0; y < height; y += 2) {
          for (let x = 0; x < width; x += 2) {
            if (mask[y] && mask[y][x] && mask[y][x] > 0) {
              coordinates.push({ x: x * viewport.zoom, y: y * viewport.zoom });
            }
          }
        }
        return coordinates;
      }

      function extractBoundaryPoints(mask: number[][], shape: number[]): Point[] {
        // 简化版本，返回多边形点
        return extractPolygonFromMask(mask, shape);
      }

      addAnnotation(annotation);
      console.log('✅ Annotation added');
      
    } catch (error) {
      console.error('❌ AI prediction failed:', error);
      setError(`AI prediction failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [imageRef, viewport.zoom, addAnnotation, setLoading, setError]);

  // 自动检测所有店铺
  const handleAutoDetectStores = useCallback(async () => {
    if (!imageRef.current) {
      setError('Image not loaded yet');
      return;
    }

    console.log('🔍 Starting auto-detection of all stores...');
    setLoading(true);

    try {
      // 清除现有标注
      const { clearAllAnnotations } = useAppStore.getState();
      clearAllAnnotations();

      // 获取所有店铺的中心点坐标
      const allStores = [
        // 上层区域
        { name: 'シルパイ シルスチュアート', centerX: 320, centerY: 140, category: 'レディスファッション' },
        { name: 'フランフラン', centerX: 450, centerY: 140, category: 'インテリア・生活雑貨' },
        
        // 中层区域 
        { name: 'アンドクチュール', centerX: 170, centerY: 210, category: 'レディスファッション' },
        { name: 'ラグナムーン', centerX: 320, centerY: 270, category: 'レディスファッション' },
        { name: 'フランフラン', centerX: 450, centerY: 270, category: 'インテリア・生活雑貨' },
        
        // 中下层区域
        { name: 'アルページュストーリー', centerX: 185, centerY: 385, category: 'レディスファッション' },
        { name: 'ココディール リュクス', centerX: 320, centerY: 390, category: 'レディスファッション' },
        { name: 'ノエラ', centerX: 450, centerY: 370, category: 'レディスファッション' },
        { name: 'ヴィルセレクション', centerX: 450, centerY: 450, category: 'レディスファッション' },
        
        // 下层区域
        { name: 'マーキュリー デュオ', centerX: 310, centerY: 540, category: 'レディスファッション' },
        { name: 'エメ エクレ', centerX: 440, centerY: 540, category: 'レディスファッション' },
        
        // 底部大型区域
        { name: 'ダイアナ', centerX: 230, centerY: 680, category: 'ファッション雑貨' },
        { name: 'ピーチ・ジョン', centerX: 410, centerY: 680, category: 'ファッション雑貨' }
      ];

      console.log(`🎯 将自动检测 ${allStores.length} 个店铺...`);

      // 逐个处理每个店铺
      for (let i = 0; i < allStores.length; i++) {
        const store = allStores[i];
        console.log(`🏪 处理店铺 ${i + 1}/${allStores.length}: ${store.name}`);

        try {
          // 使用店铺中心点进行SAM预测
          const point = {
            x: store.centerX * viewport.zoom,
            y: store.centerY * viewport.zoom
          };

          await handleAIPrediction(point);
          
          // 短暂延迟避免API过载
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (error) {
          console.error(`❌ 店铺 ${store.name} 检测失败:`, error);
        }
      }

      console.log('✅ 自动检测完成!');
      
    } catch (error) {
      console.error('❌ 自动检测失败:', error);
      setError(`Auto-detection failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [imageRef, viewport.zoom, handleAIPrediction, setLoading, setError]);

  // 监听自动检测事件
  useEffect(() => {
    const handleAutoDetectEvent = () => {
      handleAutoDetectStores();
    };

    window.addEventListener('autoDetectStores', handleAutoDetectEvent);
    return () => {
      window.removeEventListener('autoDetectStores', handleAutoDetectEvent);
    };
  }, [handleAutoDetectStores]);

  // 键盘快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Shift + A: 自动检测所有店铺
      if (e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        handleAutoDetectStores();
      }
      
      // Ctrl + E: 导出JSON
      if (e.ctrlKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('exportJSON'));
      }
      
      // Ctrl + X: 清除所有标注
      if (e.ctrlKey && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        const { clearAllAnnotations } = useAppStore.getState();
        if (annotations.length > 0) {
          clearAllAnnotations();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleAutoDetectStores, annotations.length]);

  // Viewport handlers
  const handleWheel = useCallback((e: any) => {
    e.evt.preventDefault();
    
    const scaleBy = 1.1;
    const stage = e.target.getStage();
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    const clampedScale = Math.max(0.1, Math.min(5, newScale));

    updateViewport({
      zoom: clampedScale,
      center: {
        x: pointer.x - mousePointTo.x * clampedScale,
        y: pointer.y - mousePointTo.y * clampedScale,
      }
    });
  }, [updateViewport]);

  const handleDrag = useCallback((e: any) => {
    const stage = e.target;
    updateViewport({
      center: { x: stage.x(), y: stage.y() }
    });
  }, [updateViewport]);

  // Touch gestures for mobile
  const handleTouchMove = useCallback((e: any) => {
    const touch1 = e.evt.touches[0];
    const touch2 = e.evt.touches[1];
    const stage = e.target.getStage();

    if (touch1 && touch2) {
      // Pinch to zoom
      const dist = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );
      
      if (!stage.lastDist) {
        stage.lastDist = dist;
      }

      const scale = (dist / stage.lastDist) * stage.scaleX();
      const clampedScale = Math.max(0.1, Math.min(5, scale));
      
      updateViewport({ zoom: clampedScale });
      stage.lastDist = dist;
    }
  }, [updateViewport]);

  return (
    <motion.div 
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Performance monitor overlay */}
      <div className="absolute top-2 right-2 z-10 bg-black/50 text-white text-xs p-2 rounded">
        FPS: {performanceMonitor.getFPS()} | 
        Annotations: {annotations.length}
      </div>

      {/* Main canvas */}
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        scaleX={viewport.zoom}
        scaleY={viewport.zoom}
        x={viewport.center.x}
        y={viewport.center.y}
        draggable={currentTool?.id === 'point' || currentTool?.id === 'ai_assist'}
        onWheel={handleWheel}
        onDragEnd={currentTool?.id === 'point' || currentTool?.id === 'ai_assist' ? handleDrag : undefined}
        onTouchMove={handleTouchMove}
        onTouchEnd={() => {
          if (stageRef.current) {
            stageRef.current.lastDist = null;
          }
        }}
      >
        <Layer>
          {/* Base map image */}
          {imageRef.current && (
            <KonvaImage 
              image={imageRef.current}
              width={imageRef.current.width}
              height={imageRef.current.height}
              onClick={(e) => {
                console.log('🖼️ Image clicked directly');
                const stage = e.target.getStage();
                const pointerPosition = stage.getPointerPosition();
                if (pointerPosition) {
                  handleAIPrediction({
                    x: pointerPosition.x,
                    y: pointerPosition.y
                  });
                }
              }}
              onTap={(e) => {
                console.log('📱 Image tapped (mobile)');
                const stage = e.target.getStage();
                const pointerPosition = stage.getPointerPosition();
                if (pointerPosition) {
                  handleAIPrediction({
                    x: pointerPosition.x,
                    y: pointerPosition.y
                  });
                }
              }}
            />
          )}
          
          {/* Annotations layer */}
          <Group>
            <AnimatePresence>
              {annotations.map((annotation) => (
                <AnnotationRenderer
                  key={annotation.id}
                  annotation={annotation}
                  selected={selectedAnnotation === annotation.id}
                  onSelect={(id) => selectAnnotation(id)}
                  onEdit={(id) => console.log('Edit annotation:', id)}
                />
              ))}
            </AnimatePresence>
          </Group>
        </Layer>
        
        {/* Interaction layer */}
        <Layer>
          <InteractionHandler 
            onPointClick={handleAIPrediction}
            stageRef={stageRef}
          />
        </Layer>
      </Stage>

      {/* Loading overlay */}
      <AnimatePresence>
        {useAppStore(state => state.ui.loading) && (
          <motion.div
            className="absolute inset-0 bg-black/20 flex items-center justify-center backdrop-blur-sm z-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="bg-white rounded-lg p-6 shadow-xl">
              <div className="flex items-center space-x-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="text-lg font-medium">AI Processing...</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};