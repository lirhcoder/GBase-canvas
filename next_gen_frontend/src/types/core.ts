// 核心类型定义
export interface Point {
  x: number;
  y: number;
}

export interface Polygon {
  points: Point[];
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// AI模型相关
export interface SAMPrediction {
  masks: number[][][];
  scores: number[];
  logits: number[][][];
  shape: [number, number];
}

export interface AIInsightResult {
  confidence: number;
  suggestions: string[];
  category: StoreCategory;
  quality_score: number;
}

// 店铺和标注
export interface StoreInfo {
  id: string;
  name: string;
  category: StoreCategory;
  description?: string;
  tags: string[];
  metadata: Record<string, any>;
}

export interface Annotation {
  id: string;
  store: StoreInfo;
  geometry: {
    polygon: Polygon;
    boundingBox: BoundingBox;
    centerPoint: Point;
  };
  coordinates: {
    maskCoordinates: Point[];
    boundaryPoints: Point[];
  };
  ai: {
    confidence: number;
    model_version: string;
    processing_time: number;
    suggestions: AIInsightResult[];
  };
  timestamps: {
    created: string;
    updated: string;
    last_verified: string;
  };
  user: {
    creator_id: string;
    editors: string[];
    status: 'draft' | 'pending' | 'approved' | 'rejected';
  };
}

// 地图和画布
export interface MapConfig {
  imageUrl: string;
  dimensions: {
    width: number;
    height: number;
  };
  scale: number;
  offset: Point;
  metadata: {
    facility_name: string;
    floor_level?: string;
    created_date: string;
  };
}

export interface ViewportState {
  center: Point;
  zoom: number;
  rotation: number;
  bounds: BoundingBox;
}

// 交互和工具
export interface Tool {
  id: string;
  name: string;
  icon: string;
  shortcut?: string;
  active: boolean;
}

export interface InteractionMode {
  mode: 'point' | 'box' | 'polygon' | 'freehand' | 'ai_assist';
  settings: Record<string, any>;
}

// 实时协作
export interface CollaborationEvent {
  id: string;
  type: 'annotation_added' | 'annotation_updated' | 'annotation_deleted' | 'cursor_moved';
  user_id: string;
  timestamp: string;
  data: any;
}

export interface UserPresence {
  user_id: string;
  name: string;
  avatar?: string;
  cursor_position?: Point;
  current_tool?: string;
  status: 'active' | 'idle' | 'away';
  last_seen: string;
}

// 应用状态
export interface AppState {
  // 地图状态
  map: {
    config: MapConfig | null;
    viewport: ViewportState;
    annotations: Annotation[];
    selectedAnnotation: string | null;
  };
  
  // UI状态
  ui: {
    currentTool: Tool;
    interactionMode: InteractionMode;
    sidebarOpen: boolean;
    loading: boolean;
    error: string | null;
  };
  
  // 用户状态
  user: {
    id: string;
    name: string;
    preferences: UserPreferences;
  };
  
  // 协作状态
  collaboration: {
    connected: boolean;
    users: UserPresence[];
    events: CollaborationEvent[];
  };
}

// 用户偏好设置
export interface UserPreferences {
  language: string;
  theme: 'light' | 'dark' | 'auto';
  shortcuts: Record<string, string>;
  ai_assistance: {
    enabled: boolean;
    auto_suggest: boolean;
    confidence_threshold: number;
  };
  rendering: {
    quality: 'low' | 'medium' | 'high';
    animations: boolean;
    gpu_acceleration: boolean;
  };
}

// 店铺分类
export type StoreCategory = 
  | 'レディスファッション'
  | 'メンズファッション' 
  | 'ファッション雑貨'
  | 'インテリア・生活雑貨'
  | 'レストラン・カフェ'
  | 'サービス'
  | 'その他';

// API响应类型
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

// WebSocket消息类型
export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: string;
  user_id?: string;
}