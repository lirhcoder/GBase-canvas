import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as LucideIcons from 'lucide-react';
import { useAppStore, useCurrentTool } from '../../stores/appStore';
import { Button } from './Button';
import { Tooltip } from './Tooltip';
import { Separator } from './Separator';

interface ToolbarProps {
  className?: string;
}

export const ModernToolbar: React.FC<ToolbarProps> = ({ className = '' }) => {
  const currentTool = useAppStore(state => state.ui.currentTool);
  const { setActiveTool, exportAnnotations } = useAppStore();

  // 工具配置
  const tools = [
    { 
      id: 'point', 
      iconName: 'MousePointer2', 
      label: 'Point Select', 
      shortcut: 'P',
      description: 'Click to select store regions with AI assistance'
    },
    { 
      id: 'box', 
      iconName: 'Square', 
      label: 'Box Select', 
      shortcut: 'B',
      description: 'Draw rectangular selections'
    },
    { 
      id: 'polygon', 
      iconName: 'Hexagon', 
      label: 'Polygon Tool', 
      shortcut: 'G',
      description: 'Create custom polygon shapes'
    },
    { 
      id: 'ai_assist', 
      iconName: 'Bot', 
      label: 'AI Assistant', 
      shortcut: 'A',
      description: 'Enhanced AI-powered store detection'
    },
  ];

  const actions = [
    { 
      id: 'undo', 
      iconName: 'Undo', 
      label: 'Undo', 
      shortcut: 'Ctrl+Z',
      action: () => console.log('Undo') // TODO: implement
    },
    { 
      id: 'redo', 
      iconName: 'Redo', 
      label: 'Redo', 
      shortcut: 'Ctrl+Y',
      action: () => console.log('Redo') // TODO: implement
    },
    { 
      id: 'save', 
      iconName: 'Save', 
      label: 'Save', 
      shortcut: 'Ctrl+S',
      action: () => console.log('Save') // TODO: implement
    },
    { 
      id: 'export', 
      iconName: 'Download', 
      label: 'Export', 
      shortcut: 'Ctrl+E',
      action: exportAnnotations
    },
  ];

  // 动态获取 Lucide 图标的辅助函数
  const getIcon = (iconName: string) => {
    const IconComponent = (LucideIcons as any)[iconName];
    return IconComponent || LucideIcons.HelpCircle;
  };

  return (
    <motion.div
      className={`
        fixed top-4 left-1/2 transform -translate-x-1/2 z-[100]
        bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-gray-200/50
        px-3 py-2 flex items-center gap-1 max-w-4xl
        ${className}
      `}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {/* Tool Selection */}
      <div className="flex items-center gap-1">
        {tools.map((tool) => {
          const Icon = getIcon(tool.iconName);
          const isActive = currentTool.id === tool.id;
          
          return (
            <Tooltip key={tool.id} content={
              <div className="text-center">
                <div className="font-medium">{tool.label}</div>
                <div className="text-xs text-gray-500 mt-1">{tool.description}</div>
                <div className="text-xs bg-gray-100 px-1 rounded mt-1">{tool.shortcut}</div>
              </div>
            }>
              <Button
                variant={isActive ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTool(tool.id)}
                className={`
                  relative overflow-hidden transition-all duration-200
                  ${isActive ? 'bg-blue-500 text-white shadow-lg' : 'hover:bg-gray-100'}
                `}
              >
                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-blue-400 to-blue-600"
                      layoutId="activeToolBg"
                      initial={false}
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 30
                      }}
                    />
                  )}
                </AnimatePresence>
                <Icon className="w-4 h-4 relative z-10" />
              </Button>
            </Tooltip>
          );
        })}
      </div>

      <Separator orientation="vertical" className="mx-2 h-6" />

      {/* Actions */}
      <div className="flex items-center gap-1">
        {actions.map((action) => {
          const Icon = getIcon(action.iconName);
          
          return (
            <Tooltip key={action.id} content={
              <div className="text-center">
                <div className="font-medium">{action.label}</div>
                <div className="text-xs bg-gray-100 px-1 rounded mt-1">{action.shortcut}</div>
              </div>
            }>
              <Button
                variant="ghost"
                size="sm"
                onClick={action.action}
                className="hover:bg-gray-100 transition-colors duration-200"
              >
                <Icon className="w-4 h-4" />
              </Button>
            </Tooltip>
          );
        })}
      </div>

      <Separator orientation="vertical" className="mx-2 h-6" />

      {/* Additional Tools */}
      <div className="flex items-center gap-1">
        <Tooltip content="Quick Search">
          <Button variant="ghost" size="sm" className="hover:bg-gray-100">
            {React.createElement(getIcon('Search'), { className: "w-4 h-4" })}
          </Button>
        </Tooltip>
        
        <Tooltip content="Layer Management">
          <Button variant="ghost" size="sm" className="hover:bg-gray-100">
            {React.createElement(getIcon('Layers'), { className: "w-4 h-4" })}
          </Button>
        </Tooltip>
        
        <Tooltip content="Auto-detect All">
          <Button 
            variant="ghost" 
            size="sm" 
            className="hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 hover:text-purple-600 transition-all duration-200"
          >
            {React.createElement(getIcon('Zap'), { className: "w-4 h-4" })}
          </Button>
        </Tooltip>
        
        <Tooltip content="Settings">
          <Button variant="ghost" size="sm" className="hover:bg-gray-100">
            {React.createElement(getIcon('Settings'), { className: "w-4 h-4" })}
          </Button>
        </Tooltip>
      </div>

      {/* Floating indicator */}
      <motion.div
        className="absolute -bottom-1 left-3 right-3 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.5, duration: 0.8, ease: "easeOut" }}
      />
    </motion.div>
  );
};

// Keyboard shortcuts hook
export const useKeyboardShortcuts = () => {
  const { setActiveTool, exportAnnotations } = useAppStore();
  
  React.useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Prevent shortcuts when typing in inputs
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case 'p':
          event.preventDefault();
          setActiveTool('point');
          break;
        case 'b':
          event.preventDefault();
          setActiveTool('box');
          break;
        case 'g':
          event.preventDefault();
          setActiveTool('polygon');
          break;
        case 'a':
          event.preventDefault();
          setActiveTool('ai_assist');
          break;
      }

      // Ctrl combinations
      if (event.ctrlKey || event.metaKey) {
        switch (event.key.toLowerCase()) {
          case 'e':
            event.preventDefault();
            exportAnnotations();
            break;
          case 's':
            event.preventDefault();
            // TODO: implement save
            break;
          case 'z':
            event.preventDefault();
            // TODO: implement undo
            break;
          case 'y':
            event.preventDefault();
            // TODO: implement redo
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [setActiveTool, exportAnnotations]);
};