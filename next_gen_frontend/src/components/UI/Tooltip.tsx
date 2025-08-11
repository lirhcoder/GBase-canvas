import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 500,
  className
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [actualPosition, setActualPosition] = useState(position);
  const triggerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      // Check if tooltip would go off screen and adjust position
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        const viewport = {
          width: window.innerWidth,
          height: window.innerHeight
        };

        let newPosition = position;

        switch (position) {
          case 'top':
            if (rect.top < 60) newPosition = 'bottom';
            break;
          case 'bottom':
            if (rect.bottom > viewport.height - 60) newPosition = 'top';
            break;
          case 'left':
            if (rect.left < 200) newPosition = 'right';
            break;
          case 'right':
            if (rect.right > viewport.width - 200) newPosition = 'left';
            break;
        }

        setActualPosition(newPosition);
      }
      
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  const positionClasses = {
    top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 transform -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 transform -translate-y-1/2 ml-2'
  };

  const arrowClasses = {
    top: 'top-full left-1/2 transform -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-gray-800',
    bottom: 'bottom-full left-1/2 transform -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-gray-800',
    left: 'left-full top-1/2 transform -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-gray-800',
    right: 'right-full top-1/2 transform -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-gray-800'
  };

  const animations = {
    top: { 
      initial: { opacity: 0, y: 10, scale: 0.8 }, 
      animate: { opacity: 1, y: 0, scale: 1 },
      exit: { opacity: 0, y: 10, scale: 0.8 }
    },
    bottom: { 
      initial: { opacity: 0, y: -10, scale: 0.8 }, 
      animate: { opacity: 1, y: 0, scale: 1 },
      exit: { opacity: 0, y: -10, scale: 0.8 }
    },
    left: { 
      initial: { opacity: 0, x: 10, scale: 0.8 }, 
      animate: { opacity: 1, x: 0, scale: 1 },
      exit: { opacity: 0, x: 10, scale: 0.8 }
    },
    right: { 
      initial: { opacity: 0, x: -10, scale: 0.8 }, 
      animate: { opacity: 1, x: 0, scale: 1 },
      exit: { opacity: 0, x: -10, scale: 0.8 }
    }
  };

  return (
    <div 
      className={clsx('relative inline-block', className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      ref={triggerRef}
    >
      {children}
      
      <AnimatePresence>
        {isVisible && (
          <motion.div
            className={clsx(
              'absolute z-50 px-3 py-2 text-sm text-white bg-gray-800 rounded-lg shadow-lg whitespace-nowrap max-w-xs',
              positionClasses[actualPosition]
            )}
            {...animations[actualPosition]}
            transition={{ 
              duration: 0.2, 
              ease: [0.4, 0.0, 0.2, 1]
            }}
          >
            {content}
            
            {/* Arrow */}
            <div
              className={clsx(
                'absolute w-0 h-0 border-4',
                arrowClasses[actualPosition]
              )}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};