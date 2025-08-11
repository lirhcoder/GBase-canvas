import React from 'react';
import { clsx } from 'clsx';

interface SeparatorProps {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export const Separator: React.FC<SeparatorProps> = ({
  orientation = 'horizontal',
  className
}) => {
  return (
    <div
      className={clsx(
        'bg-gray-200',
        orientation === 'horizontal' ? 'w-full h-px' : 'w-px h-full',
        className
      )}
      role="separator"
      aria-orientation={orientation}
    />
  );
};