import React from 'react';
import { Group, Line, Text, Circle, Rect } from 'react-konva';
import { motion } from 'framer-motion';
import type { Annotation } from '../../types/core';

interface AnnotationRendererProps {
  annotation: Annotation;
  selected?: boolean;
  onSelect?: (id: string) => void;
  onEdit?: (id: string) => void;
}

export const AnnotationRenderer: React.FC<AnnotationRendererProps> = ({
  annotation,
  selected = false,
  onSelect,
  onEdit
}) => {
  const polygon = annotation.geometry.polygon.points;
  const centerPoint = annotation.geometry.centerPoint;
  const boundingBox = annotation.geometry.boundingBox;
  
  // Convert polygon points to flat array for Konva
  const polygonPoints = polygon.flatMap(point => [point.x, point.y]);
  
  // Color based on confidence
  const confidence = annotation.ai.confidence;
  const getColor = () => {
    if (confidence > 0.8) return '#10b981'; // Green - high confidence
    if (confidence > 0.6) return '#f59e0b'; // Yellow - medium confidence  
    return '#ef4444'; // Red - low confidence
  };

  const strokeColor = selected ? '#3b82f6' : getColor();
  const fillColor = selected ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.1)';

  // 检查是否有有效的多边形点
  const hasValidPolygon = polygon.length > 2;
  
  return (
    <Group>
      {/* SAM分割边界 - 主要的多边形轮廓 */}
      {hasValidPolygon && (
        <Line
          points={polygonPoints}
          closed
          stroke={strokeColor}
          strokeWidth={selected ? 4 : 3}
          fill={fillColor}
          onClick={() => onSelect?.(annotation.id)}
          onTap={() => onSelect?.(annotation.id)}
          perfectDrawEnabled={false}
          shadowEnabled={selected}
          shadowColor={strokeColor}
          shadowBlur={selected ? 15 : 5}
          shadowOffset={{ x: 0, y: 0 }}
          opacity={0.8}
          lineCap="round"
          lineJoin="round"
        />
      )}

      {/* 边界框（作为备选显示）*/}
      {!hasValidPolygon && (
        <Rect
          x={boundingBox.x}
          y={boundingBox.y}
          width={boundingBox.width}
          height={boundingBox.height}
          stroke={strokeColor}
          strokeWidth={selected ? 3 : 2}
          fill={fillColor}
          onClick={() => onSelect?.(annotation.id)}
          onTap={() => onSelect?.(annotation.id)}
          cornerRadius={4}
        />
      )}

      {/* 高亮边界点（调试模式）*/}
      {selected && annotation.coordinates.boundaryPoints && (
        <Group>
          {annotation.coordinates.boundaryPoints.slice(0, 20).map((point, index) => (
            <Circle
              key={index}
              x={point.x}
              y={point.y}
              radius={2}
              fill={strokeColor}
              opacity={0.6}
            />
          ))}
        </Group>
      )}
      
      {/* 中心点标记 */}
      <Circle
        x={centerPoint.x}
        y={centerPoint.y}
        radius={selected ? 8 : 6}
        fill={strokeColor}
        stroke="white"
        strokeWidth={3}
        onClick={() => onSelect?.(annotation.id)}
        onTap={() => onSelect?.(annotation.id)}
        shadowEnabled
        shadowColor={strokeColor}
        shadowBlur={8}
        shadowOffset={{ x: 0, y: 0 }}
      />
      
      {/* 商店名称标签 - 带背景 */}
      <Group>
        {/* 标签背景 */}
        <Rect
          x={centerPoint.x - 60}
          y={centerPoint.y - 45}
          width={120}
          height={25}
          fill="rgba(255, 255, 255, 0.95)"
          stroke={strokeColor}
          strokeWidth={1}
          cornerRadius={12}
          shadowEnabled
          shadowColor="rgba(0, 0, 0, 0.2)"
          shadowBlur={8}
          shadowOffset={{ x: 0, y: 2 }}
        />
        
        {/* 商店名称文字 */}
        <Text
          x={centerPoint.x - 55}
          y={centerPoint.y - 38}
          width={110}
          text={annotation.store.name}
          fontSize={13}
          fontFamily="Arial, sans-serif"
          fontStyle="bold"
          fill="#1f2937"
          align="center"
          onClick={() => onEdit?.(annotation.id)}
          onTap={() => onEdit?.(annotation.id)}
          perfectDrawEnabled={false}
        />
      </Group>
      
      {/* 置信度和详细信息（选中时显示）*/}
      {selected && (
        <Group>
          {/* 信息面板背景 */}
          <Rect
            x={centerPoint.x - 70}
            y={centerPoint.y + 20}
            width={140}
            height={40}
            fill="rgba(0, 0, 0, 0.8)"
            cornerRadius={8}
            shadowEnabled
            shadowColor="rgba(0, 0, 0, 0.3)"
            shadowBlur={10}
            shadowOffset={{ x: 0, y: 2 }}
          />
          
          {/* 置信度文字 */}
          <Text
            x={centerPoint.x - 65}
            y={centerPoint.y + 28}
            width={130}
            text={`AI Confidence: ${(confidence * 100).toFixed(1)}%`}
            fontSize={11}
            fontFamily="Arial"
            fill="#ffffff"
            align="center"
            perfectDrawEnabled={false}
          />
          
          {/* 类别信息 */}
          <Text
            x={centerPoint.x - 65}
            y={centerPoint.y + 42}
            width={130}
            text={annotation.store.category}
            fontSize={10}
            fontFamily="Arial"
            fill="#d1d5db"
            align="center"
            perfectDrawEnabled={false}
          />
        </Group>
      )}
    </Group>
  );
};