import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';

interface StepContextMenuProps {
  x: number;
  y: number;
  onCollapseOthers: () => void;
  onExpandAll: () => void;
  onClose: () => void;
}

export const StepContextMenu: React.FC<StepContextMenuProps> = ({
  x,
  y,
  onCollapseOthers,
  onExpandAll,
  onClose,
}) => {
  useEffect(() => {
    const close = () => onClose();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose]);

  return ReactDOM.createPortal(
    <div
      className="fixed z-[200] min-w-[150px] overflow-hidden rounded border border-slate-700 bg-slate-900 py-1 shadow-2xl"
      style={{ left: Math.min(x, window.innerWidth - 170), top: Math.min(y, window.innerHeight - 90) }}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <button
        onClick={onCollapseOthers}
        className="block w-full px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
      >
        折叠其他步骤
      </button>
      <button
        onClick={onExpandAll}
        className="block w-full px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
      >
        展开所有步骤
      </button>
    </div>,
    document.body
  );
};
