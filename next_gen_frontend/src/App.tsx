import React, { Suspense, lazy } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ErrorBoundary } from 'react-error-boundary';

// Lazy imports for code splitting
const AIMapCanvas = lazy(() => import('./components/MapCanvas/AIMapCanvas').then(m => ({ default: m.AIMapCanvas })));
const SimpleToolbar = lazy(() => import('./components/UI/SimpleToolbar').then(m => ({ default: m.SimpleToolbar })));
const RealtimeCollaboration = lazy(() => import('./components/Collaboration/RealtimeCollaboration').then(m => ({ default: m.RealtimeCollaboration })));

// Store and hooks
import { useAppStore, useUIState } from './stores/appStore';
import { useKeyboardShortcuts } from './components/UI/ModernToolbar';

// Styles
import './styles/globals.css';

// Query client setup
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
    },
  },
});

// Error fallback component
const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({ 
  error, 
  resetErrorBoundary 
}) => (
  <motion.div
    className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-50"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
  >
    <div className="max-w-md mx-auto text-center p-6">
      <div className="text-6xl mb-4">🚨</div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h2>
      <p className="text-gray-600 mb-6">{error.message}</p>
      <button
        onClick={resetErrorBoundary}
        className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
      >
        Try again
      </button>
    </div>
  </motion.div>
);

// Loading component
const AppLoading: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
    <div className="text-center">
      <motion.div
        className="w-16 h-16 border-4 border-blue-200 border-t-blue-500 rounded-full mx-auto"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
      <motion.p
        className="mt-4 text-gray-600 font-medium"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        Loading FloorMap AI...
      </motion.p>
    </div>
  </div>
);

// Main App component
const AppContent: React.FC = () => {
  const ui = useUIState();
  const { setMapConfig } = useAppStore();
  
  // Initialize keyboard shortcuts
  useKeyboardShortcuts();

  // Initialize map config on mount
  React.useEffect(() => {
    setMapConfig({
      imageUrl: '/lumine-yurakucho.png',
      dimensions: { width: 610, height: 929 },
      scale: 1,
      offset: { x: 0, y: 0 },
      metadata: {
        facility_name: 'LUMINE Yurakucho',
        floor_level: '1F',
        created_date: new Date().toISOString()
      }
    });
  }, [setMapConfig]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Global loading overlay */}
      <AnimatePresence>
        {ui.loading && (
          <motion.div
            className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="bg-white rounded-2xl p-6 shadow-xl border">
              <div className="flex items-center gap-3">
                <motion.div
                  className="w-6 h-6 border-2 border-blue-200 border-t-blue-500 rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
                <span className="text-lg font-medium text-gray-700">
                  AI Processing...
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error toast */}
      <AnimatePresence>
        {ui.error && (
          <motion.div
            className="fixed top-4 right-4 z-50 bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg"
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              <span>{ui.error}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main interface */}
      <div className="flex h-screen overflow-hidden">
        {/* Main canvas area */}
        <div className="flex-1 relative">
          <Suspense fallback={<AppLoading />}>
            <AIMapCanvas
              imageUrl="/lumine-yurakucho.png"
              width={window.innerWidth - (ui.sidebarOpen ? 350 : 0)}
              height={window.innerHeight}
              className="w-full h-full"
            />
          </Suspense>

          {/* Floating toolbar */}
          <Suspense fallback={null}>
            <SimpleToolbar />
          </Suspense>
        </div>

        {/* Sidebar */}
        <AnimatePresence>
          {ui.sidebarOpen && (
            <motion.aside
              className="w-80 bg-white/95 backdrop-blur-sm border-l border-gray-200 shadow-xl"
              initial={{ x: 320 }}
              animate={{ x: 0 }}
              exit={{ x: 320 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            >
              <div className="h-full flex flex-col">
                {/* Sidebar header */}
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">
                        FloorMap AI
                      </h2>
                      <p className="text-sm text-gray-500">
                        Intelligent Floor Plan Annotation
                      </p>
                    </div>
                    <button
                      onClick={() => useAppStore.getState().setSidebarOpen(false)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Sidebar content */}
                <div className="flex-1 overflow-y-auto">
                  <div className="p-4 space-y-6">
                    {/* Collaboration section */}
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-3">
                        Collaboration
                      </h3>
                      <Suspense fallback={<div className="h-20 bg-gray-100 animate-pulse rounded-lg" />}>
                        <RealtimeCollaboration />
                      </Suspense>
                    </div>

                    {/* Annotations list */}
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-3">
                        Annotations ({useAppStore(state => state.map.annotations.length)})
                      </h3>
                      <AnnotationsList />
                    </div>

                    {/* AI Insights */}
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-3">
                        AI Insights
                      </h3>
                      <AIInsightPanel />
                    </div>
                  </div>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* Performance monitor (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 left-4 bg-black/80 text-white text-xs p-2 rounded font-mono">
          React: {React.version} | 
          Annotations: {useAppStore(state => state.map.annotations.length)}
        </div>
      )}
    </div>
  );
};

// Annotations list component
const AnnotationsList: React.FC = () => {
  const annotations = useAppStore(state => state.map.annotations);
  const { selectAnnotation, deleteAnnotation } = useAppStore();

  if (annotations.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <div className="text-4xl mb-2">🏷️</div>
        <p className="text-sm">No annotations yet</p>
        <p className="text-xs text-gray-400 mt-1">Click on the map to start</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {annotations.map((annotation, index) => (
        <motion.div
          key={annotation.id}
          className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          onClick={() => selectAnnotation(annotation.id)}
        >
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900">
                {annotation.store.name}
              </h4>
              <p className="text-xs text-gray-500">
                {annotation.store.category}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <div className="text-xs text-gray-400">
                {(annotation.ai.confidence * 100).toFixed(0)}%
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteAnnotation(annotation.id);
                }}
                className="p-1 hover:bg-red-100 hover:text-red-600 rounded transition-colors"
              >
                🗑️
              </button>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

// AI Insights panel component
const AIInsightPanel: React.FC = () => {
  const annotations = useAppStore(state => state.map.annotations);
  
  const totalConfidence = annotations.length > 0 
    ? annotations.reduce((sum, ann) => sum + ann.ai.confidence, 0) / annotations.length 
    : 0;

  const categories = [...new Set(annotations.map(ann => ann.store.category))];

  return (
    <div className="space-y-3">
      <div className="p-3 bg-blue-50 rounded-lg">
        <div className="text-sm font-medium text-blue-900">
          Average Confidence
        </div>
        <div className="text-2xl font-bold text-blue-700">
          {(totalConfidence * 100).toFixed(1)}%
        </div>
      </div>

      <div className="p-3 bg-green-50 rounded-lg">
        <div className="text-sm font-medium text-green-900">
          Store Categories
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {categories.map(category => (
            <span 
              key={category}
              className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded"
            >
              {category}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

// Main App with providers
const App: React.FC = () => {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={<AppLoading />}>
          <AppContent />
        </Suspense>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;