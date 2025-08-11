import React from 'react';
import { MousePointer2, Square, Hexagon, Bot, Zap, Download } from 'lucide-react';
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