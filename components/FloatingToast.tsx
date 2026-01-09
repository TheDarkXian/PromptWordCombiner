
import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';

export interface ToastInfo {
  id: string;
  message: string;
  x: number;
  y: number;
}

interface FloatingToastProps {
  toasts: ToastInfo[];
  onRemove: (id: string) => void;
}

export const FloatingToast: React.FC<FloatingToastProps> = ({ toasts, onRemove }) => {
  return ReactDOM.createPortal(
    <div className="fixed inset-0 pointer-events-none z-[9999]">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>,
    document.body
  );
};

const ToastItem: React.FC<{ toast: ToastInfo; onRemove: (id: string) => void }> = ({ toast, onRemove }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onRemove(toast.id), 300); // Wait for fade out animation
    }, 1700);
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  return (
    <div
      className={`absolute transition-all duration-300 transform -translate-x-1/2 -translate-y-full flex items-center gap-2 px-3 py-1.5 bg-blue-600/90 backdrop-blur-md text-white text-[10px] font-bold rounded-full shadow-lg border border-blue-400/30 ${
        visible ? 'opacity-100 scale-100' : 'opacity-0 scale-90 -translate-y-[120%]'
      }`}
      style={{ left: toast.x, top: toast.y - 10 }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
        <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
      </svg>
      {toast.message}
    </div>
  );
};

// Hook for easy usage
export const useToast = () => {
  const [toasts, setToasts] = useState<ToastInfo[]>([]);

  const showToast = useCallback((message: string, x: number, y: number) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, x, y }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, showToast, removeToast };
};
