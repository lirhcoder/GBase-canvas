import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Wifi, WifiOff, Eye, MessageSquare } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import type { UserPresence, CollaborationEvent } from '../../types/core';

interface RealtimeCollaborationProps {
  className?: string;
}

export const RealtimeCollaboration: React.FC<RealtimeCollaborationProps> = ({ className = '' }) => {
  const wsRef = useRef<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const { collaboration, user } = useAppStore();

  // WebSocket连接管理 (暂时禁用 - WebSocket server not available)
  useEffect(() => {
    // 设置为离线模式
    setConnectionStatus('disconnected');
    
    // TODO: 当WebSocket服务器可用时，取消注释以下代码
    /*
    const connectWebSocket = () => {
      setConnectionStatus('connecting');
      
      const ws = new WebSocket('ws://localhost:8080/collaborate');
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus('connected');
        ws.send(JSON.stringify({
          type: 'user_joined',
          user_id: user.id,
          name: user.name,
          timestamp: new Date().toISOString()
        }));
      };

      ws.onclose = () => {
        setConnectionStatus('disconnected');
        setTimeout(connectWebSocket, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('disconnected');
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleCollaborationEvent(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
    */
  }, [user.id, user.name]);

  const handleCollaborationEvent = (event: CollaborationEvent) => {
    // 处理协作事件
    switch (event.type) {
      case 'user_joined':
        // 添加用户到在线列表
        break;
      case 'user_left':
        // 从在线列表移除用户
        break;
      case 'annotation_added':
        // 实时显示其他用户的标注
        break;
      case 'cursor_moved':
        // 显示其他用户的光标位置
        break;
    }
  };

  const sendCollaborationEvent = (event: Omit<CollaborationEvent, 'id' | 'timestamp'>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        ...event,
        id: `event_${Date.now()}`,
        timestamp: new Date().toISOString()
      }));
    }
  };

  return (
    <div className={`${className}`}>
      {/* 连接状态指示器 */}
      <motion.div
        className="flex items-center gap-2 px-3 py-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm border"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center gap-2">
          {connectionStatus === 'connected' ? (
            <Wifi className="w-4 h-4 text-green-500" />
          ) : (
            <WifiOff className="w-4 h-4 text-red-500" />
          )}
          <span className={`text-sm font-medium ${
            connectionStatus === 'connected' ? 'text-green-700' : 'text-red-700'
          }`}>
            {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        {/* 在线用户数量 */}
        <div className="flex items-center gap-1 ml-4">
          <Users className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-600">{collaboration.users.length}</span>
        </div>
      </motion.div>

      {/* 在线用户列表 */}
      <AnimatePresence>
        {collaboration.users.length > 0 && (
          <motion.div
            className="mt-3 p-3 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm border"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Online Users</span>
            </div>
            
            <div className="space-y-2">
              {collaboration.users.map((user) => (
                <UserPresenceCard 
                  key={user.user_id} 
                  user={user}
                  onSendMessage={(message) => sendCollaborationEvent({
                    type: 'message_sent',
                    user_id: user.user_id,
                    data: { message }
                  })}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 实时活动流 */}
      <RealtimeActivityFeed events={collaboration.events} />
    </div>
  );
};

// 用户状态卡片
const UserPresenceCard: React.FC<{
  user: UserPresence;
  onSendMessage: (message: string) => void;
}> = ({ user, onSendMessage }) => {
  const getStatusColor = (status: UserPresence['status']) => {
    switch (status) {
      case 'active': return 'bg-green-400';
      case 'idle': return 'bg-yellow-400';
      case 'away': return 'bg-gray-400';
      default: return 'bg-gray-400';
    }
  };

  return (
    <motion.div
      className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors duration-200"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* 用户头像 */}
      <div className="relative">
        <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
          <span className="text-white text-sm font-medium">
            {user.name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className={`absolute -bottom-1 -right-1 w-3 h-3 ${getStatusColor(user.status)} rounded-full border-2 border-white`} />
      </div>

      {/* 用户信息 */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 truncate">
          {user.name}
        </div>
        <div className="text-xs text-gray-500">
          {user.current_tool && (
            <span className="inline-flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {user.current_tool}
            </span>
          )}
        </div>
      </div>

      {/* 操作按钮 */}
      <button
        onClick={() => onSendMessage('Hello!')}
        className="p-1 rounded hover:bg-gray-200 transition-colors duration-200"
      >
        <MessageSquare className="w-4 h-4 text-gray-500" />
      </button>
    </motion.div>
  );
};

// 实时活动流
const RealtimeActivityFeed: React.FC<{ events: CollaborationEvent[] }> = ({ events }) => {
  const recentEvents = events.slice(-5); // 只显示最近5个事件

  if (recentEvents.length === 0) return null;

  return (
    <motion.div
      className="mt-3 p-3 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm border"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.2 }}
    >
      <div className="text-sm font-medium text-gray-700 mb-2">Recent Activity</div>
      
      <div className="space-y-1">
        <AnimatePresence>
          {recentEvents.map((event) => (
            <motion.div
              key={event.id}
              className="text-xs text-gray-600 py-1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <EventDescription event={event} />
              <span className="text-gray-400 ml-2">
                {new Date(event.timestamp).toLocaleTimeString()}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

// 事件描述组件
const EventDescription: React.FC<{ event: CollaborationEvent }> = ({ event }) => {
  switch (event.type) {
    case 'annotation_added':
      return <span>🏷️ Added annotation "{event.data?.name}"</span>;
    case 'annotation_updated':
      return <span>✏️ Updated annotation</span>;
    case 'annotation_deleted':
      return <span>🗑️ Deleted annotation</span>;
    case 'cursor_moved':
      return <span>👆 Cursor moved</span>;
    default:
      return <span>📝 {event.type}</span>;
  }
};