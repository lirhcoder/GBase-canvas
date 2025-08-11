import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { AppState, Annotation, Tool, InteractionMode, MapConfig, ViewportState } from '../types/core';

// 默认工具配置  
const DEFAULT_TOOLS: Tool[] = [
  { id: 'point', name: 'Point Select', icon: 'MousePointer2', shortcut: 'P', active: true },
  { id: 'box', name: 'Box Select', icon: 'Square', shortcut: 'B', active: false },
  { id: 'polygon', name: 'Polygon', icon: 'Hexagon', shortcut: 'G', active: false },
  { id: 'ai_assist', name: 'AI Assist', icon: 'Bot', shortcut: 'A', active: false },
];

const DEFAULT_INTERACTION_MODE: InteractionMode = {
  mode: 'point',
  settings: {
    multiSelect: false,
    snapToGrid: false,
    showPreview: true
  }
};

const DEFAULT_VIEWPORT: ViewportState = {
  center: { x: 0, y: 0 },
  zoom: 1,
  rotation: 0,
  bounds: { x: 0, y: 0, width: 800, height: 600 }
};

interface AppActions {
  // 地图操作
  setMapConfig: (config: MapConfig) => void;
  updateViewport: (viewport: Partial<ViewportState>) => void;
  
  // 标注操作
  addAnnotation: (annotation: Annotation) => void;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  deleteAnnotation: (id: string) => void;
  selectAnnotation: (id: string | null) => void;
  
  // 工具操作
  setActiveTool: (toolId: string) => void;
  setInteractionMode: (mode: InteractionMode) => void;
  
  // UI操作
  setSidebarOpen: (open: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // 批量操作
  clearAllAnnotations: () => void;
  importAnnotations: (annotations: Annotation[]) => void;
  exportAnnotations: () => Annotation[];
}

export const useAppStore = create<AppState & AppActions>()(
  subscribeWithSelector((set, get) => ({
    // 初始状态
    map: {
      config: null,
      viewport: DEFAULT_VIEWPORT,
      annotations: [],
      selectedAnnotation: null,
    },
    
    ui: {
      currentTool: DEFAULT_TOOLS[0],
      interactionMode: DEFAULT_INTERACTION_MODE,
      sidebarOpen: true,
      loading: false,
      error: null,
    },
    
    user: {
      id: 'user_' + Date.now(),
      name: 'User',
      preferences: {
        language: 'ja',
        theme: 'light',
        shortcuts: {},
        ai_assistance: {
          enabled: true,
          auto_suggest: true,
          confidence_threshold: 0.8
        },
        rendering: {
          quality: 'high',
          animations: true,
          gpu_acceleration: true
        }
      }
    },
    
    collaboration: {
      connected: false,
      users: [],
      events: []
    },

    // Actions
    setMapConfig: (config: MapConfig) => 
      set((state) => ({
        map: { ...state.map, config }
      })),

    updateViewport: (viewport: Partial<ViewportState>) => 
      set((state) => ({
        map: { ...state.map, viewport: { ...state.map.viewport, ...viewport } }
      })),

    addAnnotation: (annotation: Annotation) => 
      set((state) => ({
        map: {
          ...state.map,
          annotations: [...state.map.annotations, annotation]
        }
      })),

    updateAnnotation: (id: string, updates: Partial<Annotation>) => 
      set((state) => ({
        map: {
          ...state.map,
          annotations: state.map.annotations.map(ann => 
            ann.id === id 
              ? { ...ann, ...updates, timestamps: { ...ann.timestamps, updated: new Date().toISOString() } }
              : ann
          )
        }
      })),

    deleteAnnotation: (id: string) => 
      set((state) => ({
        map: {
          ...state.map,
          annotations: state.map.annotations.filter(ann => ann.id !== id),
          selectedAnnotation: state.map.selectedAnnotation === id ? null : state.map.selectedAnnotation
        }
      })),

    selectAnnotation: (id: string | null) => 
      set((state) => ({
        map: { ...state.map, selectedAnnotation: id }
      })),

    setActiveTool: (toolId: string) => 
      set((state) => {
        const tools = DEFAULT_TOOLS.map(tool => ({ ...tool, active: tool.id === toolId }));
        const activeTool = tools.find(t => t.active) || tools[0];
        
        return {
          ui: { 
            ...state.ui, 
            currentTool: activeTool,
            interactionMode: { ...state.ui.interactionMode, mode: toolId as any }
          }
        };
      }),

    setInteractionMode: (mode: InteractionMode) => 
      set((state) => ({
        ui: { ...state.ui, interactionMode: mode }
      })),

    setSidebarOpen: (open: boolean) => 
      set((state) => ({
        ui: { ...state.ui, sidebarOpen: open }
      })),

    setLoading: (loading: boolean) => 
      set((state) => ({
        ui: { ...state.ui, loading }
      })),

    setError: (error: string | null) => 
      set((state) => ({
        ui: { ...state.ui, error }
      })),

    clearAllAnnotations: () => 
      set((state) => ({
        map: { ...state.map, annotations: [], selectedAnnotation: null }
      })),

    importAnnotations: (annotations: Annotation[]) => 
      set((state) => ({
        map: { ...state.map, annotations }
      })),

    exportAnnotations: () => get().map.annotations,
  }))
);

// 选择器函数
export const useMapConfig = () => useAppStore(state => state.map.config);
export const useAnnotations = () => useAppStore(state => state.map.annotations);
export const useSelectedAnnotation = () => useAppStore(state => {
  const selected = state.map.selectedAnnotation;
  return selected ? state.map.annotations.find(a => a.id === selected) : null;
});
export const useCurrentTool = () => useAppStore(state => state.ui.currentTool);
export const useViewport = () => useAppStore(state => state.map.viewport);
export const useUIState = () => useAppStore(state => state.ui);