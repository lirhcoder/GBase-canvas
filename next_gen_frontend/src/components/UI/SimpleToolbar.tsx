import React from 'react';
import { MousePointer2, Square, Hexagon, Bot, Zap, Download, Upload, Save, FolderOpen } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';

export const SimpleToolbar: React.FC = () => {
  const currentTool = useAppStore(state => state.ui.currentTool);
  const annotations = useAppStore(state => state.map.annotations);
  const { setActiveTool, clearAllAnnotations } = useAppStore();

  const tools = [
    { id: 'point', icon: MousePointer2, name: 'Point' },
    { id: 'box', icon: Square, name: 'Box' },
    { id: 'polygon', icon: Hexagon, name: 'Polygon' },
    { id: 'ai_assist', icon: Bot, name: 'AI' },
  ];

  // 自动识别所有店铺
  const handleAutoDetect = async () => {
    setActiveTool('auto_detect');
    
    // 触发自动检测事件
    window.dispatchEvent(new CustomEvent('autoDetectStores'));
  };

  // 导出JSON数据
  const handleExportJSON = React.useCallback(() => {
    const exportData = {
      timestamp: new Date().toISOString(),
      image: 'lumine-yurakucho.png',
      annotations: annotations.map(annotation => ({
        id: annotation.id,
        store: {
          name: annotation.store.name,
          category: annotation.store.category,
          tags: annotation.store.tags
        },
        geometry: {
          polygon: annotation.geometry.polygon.points,
          boundingBox: annotation.geometry.boundingBox,
          centerPoint: annotation.geometry.centerPoint
        },
        coordinates: {
          maskCoordinates: annotation.coordinates.maskCoordinates,
          boundaryPoints: annotation.coordinates.boundaryPoints
        },
        ai: {
          confidence: annotation.ai.confidence,
          model_version: annotation.ai.model_version
        },
        timestamps: annotation.timestamps
      })),
      summary: {
        total_stores: annotations.length,
        categories: [...new Set(annotations.map(a => a.store.category))],
        avg_confidence: annotations.length > 0 
          ? annotations.reduce((sum, a) => sum + a.ai.confidence, 0) / annotations.length 
          : 0
      }
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lumine-yurakucho-annotations-${new Date().toISOString().slice(0, 16)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log('✅ JSON数据已导出:', exportData);
  }, [annotations]);

  // 图片上传处理
  const handleImageUpload = React.useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const imageUrl = event.target?.result as string;
          // 创建图片对象来获取尺寸
          const img = new Image();
          img.onload = () => {
            // 更新应用状态中的地图配置
            useAppStore.getState().setMapConfig({
              imageUrl: imageUrl,
              dimensions: { width: img.width, height: img.height },
              scale: 1,
              offset: { x: 0, y: 0 },
              metadata: {
                facility_name: file.name.replace(/\.[^/.]+$/, ""),
                floor_level: '1F',
                created_date: new Date().toISOString()
              }
            });
            // 清除之前的标注
            useAppStore.getState().clearAllAnnotations();
            console.log('✅ 图片上传成功:', file.name);
          };
          img.src = imageUrl;
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  }, []);

  // 保存项目处理
  const handleSaveProject = React.useCallback(() => {
    const state = useAppStore.getState();
    const projectData = {
      timestamp: new Date().toISOString(),
      map: {
        config: state.map.config,
        annotations: state.map.annotations
      },
      metadata: {
        version: '2.0',
        tool: 'FloorMap AI'
      }
    };

    const dataStr = JSON.stringify(projectData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    const fileName = state.map.config?.metadata?.facility_name || 'floormap-project';
    link.download = `${fileName}-${new Date().toISOString().slice(0, 16)}.floormap`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log('✅ 项目已保存:', projectData);
  }, []);

  // 加载项目处理
  const handleLoadProject = React.useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.floormap,.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const projectData = JSON.parse(event.target?.result as string);
            
            // 验证项目数据格式
            if (projectData.map && projectData.map.config) {
              // 加载地图配置
              useAppStore.getState().setMapConfig(projectData.map.config);
              
              // 加载标注数据
              if (projectData.map.annotations) {
                useAppStore.getState().importAnnotations(projectData.map.annotations);
              }
              
              console.log('✅ 项目加载成功:', file.name);
            } else {
              console.error('❌ 无效的项目文件格式');
            }
          } catch (error) {
            console.error('❌ 项目文件解析失败:', error);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }, []);

  // 监听导出JSON事件
  React.useEffect(() => {
    const handleExportEvent = () => {
      handleExportJSON();
    };

    window.addEventListener('exportJSON', handleExportEvent);
    return () => {
      window.removeEventListener('exportJSON', handleExportEvent);
    };
  }, [handleExportJSON]);

  return (
    <div 
      className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[9999] 
                 bg-white rounded-lg shadow-lg border border-gray-200 
                 px-4 py-2 flex items-center gap-2"
      style={{ position: 'fixed', top: '16px', left: '50%', transform: 'translateX(-50%)', zIndex: 9999 }}
    >
      <div className="text-sm font-medium text-gray-700">FloorMap AI</div>
      <div className="w-px h-6 bg-gray-300 mx-2"></div>
      
      {tools.map((tool) => {
        const Icon = tool.icon;
        const isActive = currentTool.id === tool.id;
        
        return (
          <button 
            key={tool.id}
            onClick={() => setActiveTool(tool.id)}
            className={`p-2 rounded transition-colors ${
              isActive 
                ? 'bg-blue-500 text-white shadow-md' 
                : 'hover:bg-gray-100 text-gray-700'
            }`}
            title={`${tool.name} Tool (${tool.id === 'point' ? 'P' : tool.id === 'box' ? 'B' : tool.id === 'polygon' ? 'G' : 'A'})`}
          >
            <Icon className="w-4 h-4" />
          </button>
        );
      })}
      
      <div className="w-px h-6 bg-gray-300 mx-2"></div>
      
      {/* 图片上传按钮 */}
      <button 
        onClick={handleImageUpload}
        className="p-2 rounded transition-colors bg-blue-500 text-white hover:bg-blue-600 shadow-md"
        title="Upload Image (Ctrl+U)"
      >
        <Upload className="w-4 h-4" />
      </button>
      
      {/* 保存项目按钮 */}
      <button 
        onClick={handleSaveProject}
        className="p-2 rounded transition-colors bg-orange-500 text-white hover:bg-orange-600 shadow-md"
        title="Save Project (Ctrl+S)"
        disabled={annotations.length === 0}
      >
        <Save className="w-4 h-4" />
      </button>
      
      {/* 加载项目按钮 */}
      <button 
        onClick={handleLoadProject}
        className="p-2 rounded transition-colors bg-cyan-500 text-white hover:bg-cyan-600 shadow-md"
        title="Load Project (Ctrl+L)"
      >
        <FolderOpen className="w-4 h-4" />
      </button>
      
      {/* 自动检测按钮 */}
      <button 
        onClick={handleAutoDetect}
        className="p-2 rounded transition-colors bg-green-500 text-white hover:bg-green-600 shadow-md"
        title="Auto Detect All Stores (Shift+A)"
      >
        <Zap className="w-4 h-4" />
      </button>
      
      {/* 导出JSON按钮 */}
      <button 
        onClick={handleExportJSON}
        className="p-2 rounded transition-colors bg-purple-500 text-white hover:bg-purple-600 shadow-md"
        title="Export JSON Data (Ctrl+E)"
        disabled={annotations.length === 0}
      >
        <Download className="w-4 h-4" />
      </button>
      
      {/* 清除全部按钮 */}
      <button 
        onClick={() => clearAllAnnotations()}
        className="p-2 rounded transition-colors bg-red-500 text-white hover:bg-red-600 shadow-md"
        title="Clear All Annotations (Ctrl+X)"
        disabled={annotations.length === 0}
      >
        <span className="w-4 h-4 flex items-center justify-center font-bold">×</span>
      </button>
      
      <div className="w-px h-6 bg-gray-300 mx-2"></div>
      <div className="text-xs text-gray-500">
        {annotations.length > 0 ? `${annotations.length} stores` : 'Current: ' + (currentTool.name || currentTool.id)}
      </div>
    </div>
  );
};