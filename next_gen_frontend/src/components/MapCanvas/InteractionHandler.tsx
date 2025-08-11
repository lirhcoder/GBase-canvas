import React, { useRef, useCallback, useState, useEffect } from 'react';
import { Rect, Line, Circle } from 'react-konva';
import { useAppStore, useCurrentTool } from '../../stores/appStore';
import type { Point } from '../../types/core';

interface InteractionHandlerProps {
  onPointClick: (point: Point) => void;
  stageRef: React.RefObject<any>;
}

export const InteractionHandler: React.FC<InteractionHandlerProps> = ({
  onPointClick,
  stageRef
}) => {
  const currentTool = useCurrentTool();
  const isDrawingRef = useRef(false);
  const startPointRef = useRef<Point | null>(null);
  const [selectionBox, setSelectionBox] = useState<{x: number, y: number, width: number, height: number} | null>(null);
  const [polygonPoints, setPolygonPoints] = useState<Point[]>([]);

  // Reset drawing state when tool changes
  useEffect(() => {
    setPolygonPoints([]);
    setSelectionBox(null);
    isDrawingRef.current = false;
    startPointRef.current = null;
  }, [currentTool.id]);

  const handleStageClick = useCallback((e: any) => {
    console.log('🖱️ Stage click detected');
    console.log('📍 Current tool:', currentTool);
    console.log('🎯 Click target:', e.target.constructor.name);
    
    // 允许点击舞台、图片或交互矩形
    const isStage = e.target === e.target.getStage();
    const isImage = e.target.constructor.name === 'Image';
    const isRect = e.target.constructor.name === 'Rect';
    
    if (!isStage && !isImage && !isRect) {
      console.log('❌ Not clicking on stage, image, or interaction rect, clicked on:', e.target.constructor.name);
      return; // 只拒绝点击其他形状
    }
    
    console.log('✅ Valid click target:', isStage ? 'Stage' : isImage ? 'Image' : 'InteractionRect');

    const stage = e.target.getStage();
    const pointerPosition = stage.getPointerPosition();
    
    if (!pointerPosition) {
      console.log('❌ No pointer position');
      return;
    }

    const point: Point = {
      x: pointerPosition.x,
      y: pointerPosition.y
    };
    
    console.log('📍 Click point:', point);
    console.log('🔧 Tool ID:', currentTool?.id);

    switch (currentTool?.id) {
      case 'point':
      case 'ai_assist':
        console.log('✅ Triggering point/AI click');
        onPointClick(point);
        break;
        
      case 'box':
        if (!isDrawingRef.current) {
          console.log('📦 Starting box selection');
          isDrawingRef.current = true;
          startPointRef.current = point;
          setSelectionBox({
            x: point.x,
            y: point.y,
            width: 0,
            height: 0
          });
        } else {
          console.log('📦 Finishing box selection');
          isDrawingRef.current = false;
          if (startPointRef.current) {
            const boxPoint: Point = {
              x: (startPointRef.current.x + point.x) / 2,
              y: (startPointRef.current.y + point.y) / 2
            };
            onPointClick(boxPoint);
            startPointRef.current = null;
            setSelectionBox(null);
          }
        }
        break;
        
      case 'polygon':
        console.log('🔷 Polygon tool - adding point:', point);
        const newPolygonPoints = [...polygonPoints, point];
        setPolygonPoints(newPolygonPoints);
        
        // Check if we've completed the polygon (double-click or close to first point)
        if (newPolygonPoints.length > 2) {
          const firstPoint = newPolygonPoints[0];
          const distance = Math.sqrt(
            Math.pow(point.x - firstPoint.x, 2) + 
            Math.pow(point.y - firstPoint.y, 2)
          );
          
          // If close to first point or more than 8 points, complete polygon
          if (distance < 20 || newPolygonPoints.length > 8) {
            console.log('🔷 Completing polygon with', newPolygonPoints.length, 'points');
            const centerPoint: Point = {
              x: newPolygonPoints.reduce((sum, p) => sum + p.x, 0) / newPolygonPoints.length,
              y: newPolygonPoints.reduce((sum, p) => sum + p.y, 0) / newPolygonPoints.length
            };
            onPointClick(centerPoint);
            setPolygonPoints([]);
          }
        }
        break;
        
      default:
        console.log('🔧 Default tool action');
        onPointClick(point);
    }
  }, [currentTool, onPointClick]);

  const handleMouseMove = useCallback((e: any) => {
    if (!isDrawingRef.current || currentTool.id !== 'box' || !startPointRef.current) return;
    
    const stage = e.target.getStage();
    const pointerPosition = stage.getPointerPosition();
    
    if (!pointerPosition) return;
    
    // Update selection box visual feedback
    const startPoint = startPointRef.current;
    const currentPoint = pointerPosition;
    
    setSelectionBox({
      x: Math.min(startPoint.x, currentPoint.x),
      y: Math.min(startPoint.y, currentPoint.y),
      width: Math.abs(currentPoint.x - startPoint.x),
      height: Math.abs(currentPoint.y - startPoint.y)
    });
  }, [currentTool.id]);

  return (
    <>
      {/* Interaction overlay */}
      <Rect
        x={0}
        y={0}
        width={2000}
        height={2000}
        fill="transparent"
        onClick={handleStageClick}
        onTap={handleStageClick}
        onMouseMove={handleMouseMove}
        listening={true}
      />
      
      {/* Selection box visualization */}
      {selectionBox && (
        <Rect
          x={selectionBox.x}
          y={selectionBox.y}
          width={selectionBox.width}
          height={selectionBox.height}
          stroke="#3b82f6"
          strokeWidth={2}
          fill="rgba(59, 130, 246, 0.1)"
          dash={[5, 5]}
          listening={false}
        />
      )}
      
      {/* Polygon drawing visualization */}
      {polygonPoints.length > 0 && (
        <>
          {/* Draw lines connecting the points */}
          {polygonPoints.length > 1 && (
            <Line
              points={polygonPoints.flatMap(p => [p.x, p.y])}
              stroke="#10b981"
              strokeWidth={2}
              dash={[3, 3]}
              listening={false}
            />
          )}
          
          {/* Draw circles at each polygon point */}
          {polygonPoints.map((point, index) => (
            <Circle
              key={index}
              x={point.x}
              y={point.y}
              radius={index === 0 ? 8 : 5}
              fill={index === 0 ? "#ef4444" : "#10b981"}
              stroke="white"
              strokeWidth={2}
              listening={false}
            />
          ))}
          
          {/* Show completion hint if we have enough points */}
          {polygonPoints.length > 2 && (
            <Circle
              x={polygonPoints[0].x}
              y={polygonPoints[0].y}
              radius={12}
              stroke="#ef4444"
              strokeWidth={2}
              dash={[2, 2]}
              listening={false}
            />
          )}
        </>
      )}
    </>
  );
};