import React, { useEffect, useRef, useState } from 'react';

interface SplitPaneProps {
  direction: 'horizontal' | 'vertical';
  size: number;
  sizeTarget?: 'first' | 'second';
  minSize: number;
  maxSize: number;
  onSizeChange: (size: number) => void;
  first: React.ReactNode;
  second: React.ReactNode;
  dividerClassName?: string;
  className?: string;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const SplitPane: React.FC<SplitPaneProps> = ({
  direction,
  size,
  sizeTarget = 'first',
  minSize,
  maxSize,
  onSizeChange,
  first,
  second,
  dividerClassName,
  className,
}) => {
  const [dragging, setDragging] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!dragging) return undefined;

    const onMouseMove = (event: MouseEvent) => {
      const root = rootRef.current;
      if (!root) return;
      const rect = root.getBoundingClientRect();
      if (direction === 'horizontal') {
        const primary = event.clientX - rect.left;
        const targetSize = sizeTarget === 'first' ? primary : rect.width - primary;
        onSizeChange(clamp(targetSize, minSize, maxSize));
      } else {
        const primary = event.clientY - rect.top;
        const targetSize = sizeTarget === 'first' ? primary : rect.height - primary;
        onSizeChange(clamp(targetSize, minSize, maxSize));
      }
    };

    const onMouseUp = () => {
      setDragging(false);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = '';
    };
  }, [direction, dragging, maxSize, minSize, onSizeChange, sizeTarget]);

  const normalizedSize = clamp(size, minSize, maxSize);
  const firstStyle =
    direction === 'horizontal'
      ? { width: sizeTarget === 'first' ? normalizedSize : undefined }
      : { height: sizeTarget === 'first' ? normalizedSize : undefined };
  const secondStyle =
    direction === 'horizontal'
      ? { width: sizeTarget === 'second' ? normalizedSize : undefined }
      : { height: sizeTarget === 'second' ? normalizedSize : undefined };

  return (
    <div
      ref={rootRef}
      className={`flex min-h-0 min-w-0 ${direction === 'horizontal' ? 'flex-row' : 'flex-col'} ${className || ''}`}
    >
      <div className={`flex min-h-0 min-w-0 ${direction === 'horizontal' ? 'h-full' : 'w-full'} ${sizeTarget === 'first' ? 'shrink-0' : 'flex-1'}`} style={firstStyle}>
        {first}
      </div>
      <div
        className={
          dividerClassName ||
          (direction === 'horizontal'
            ? 'w-1.5 shrink-0 cursor-col-resize bg-slate-800/80 transition-colors hover:bg-blue-600'
            : 'h-1.5 shrink-0 cursor-row-resize bg-slate-800/80 transition-colors hover:bg-blue-600')
        }
        onMouseDown={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
      />
      <div className={`flex min-h-0 min-w-0 ${direction === 'horizontal' ? 'h-full' : 'w-full'} ${sizeTarget === 'second' ? 'shrink-0' : 'flex-1'}`} style={secondStyle}>
        {second}
      </div>
    </div>
  );
};
