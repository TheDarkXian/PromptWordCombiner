import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { publishNotification } from '../services/notificationService';
import type { NotificationLevel, NotificationPayload } from '../services/notificationService';

interface AppLogEntry extends NotificationPayload {
  id: string;
  createdAt: number;
}

interface NotificationContextValue {
  logs: AppLogEntry[];
  unreadCount: number;
  isLogOpen: boolean;
  toggleLogPanel: () => void;
  publish: (payload: NotificationPayload) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const levelStyles: Record<NotificationLevel, string> = {
  info: 'border-blue-500/40 text-blue-300',
  success: 'border-emerald-500/40 text-emerald-300',
  warning: 'border-amber-500/40 text-amber-300',
  error: 'border-red-500/40 text-red-300',
};

const levelLabels: Record<NotificationLevel, string> = {
  info: '信息',
  success: '成功',
  warning: '警告',
  error: '错误',
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [logs, setLogs] = useState<AppLogEntry[]>([]);
  const [toasts, setToasts] = useState<AppLogEntry[]>([]);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const append = useCallback((payload: NotificationPayload) => {
    const entry: AppLogEntry = {
      ...payload,
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: Date.now(),
    };
    setLogs(current => [entry, ...current].slice(0, 200));
    if (!isLogOpen) {
      setUnreadCount(current => current + 1);
      setToasts(current => [...current, entry].slice(-5));
    }
  }, [isLogOpen]);

  useEffect(() => {
    const handleNotification = (event: Event) => append((event as CustomEvent<NotificationPayload>).detail);
    window.addEventListener('pwc:notification', handleNotification);
    return () => window.removeEventListener('pwc:notification', handleNotification);
  }, [append]);

  const toggleLogPanel = () => {
    setIsLogOpen(current => {
      const next = !current;
      if (next) {
        setUnreadCount(0);
        setToasts([]);
      }
      return next;
    });
  };

  const removeToast = useCallback((id: string) => {
    setToasts(current => current.filter(item => item.id !== id));
  }, []);

  const value = useMemo<NotificationContextValue>(() => ({
    logs,
    unreadCount,
    isLogOpen,
    toggleLogPanel,
    publish: publishNotification,
  }), [logs, unreadCount, isLogOpen]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      {ReactDOM.createPortal(
        <>
          {isLogOpen && (
            <div className="fixed right-0 bottom-6 top-16 w-[420px] max-w-[90vw] z-[9000] border-l border-t border-slate-700 bg-slate-950 shadow-2xl flex flex-col">
              <div className="h-10 shrink-0 flex items-center justify-between border-b border-slate-800 px-3">
                <span className="text-xs font-bold text-slate-200">日志</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => setLogs([])} className="text-[10px] text-slate-500 hover:text-red-300">清空</button>
                  <button onClick={toggleLogPanel} className="text-sm text-slate-500 hover:text-white">×</button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {logs.length === 0 && <div className="p-6 text-center text-xs text-slate-600">暂无日志</div>}
                {logs.map(log => (
                  <div key={log.id} className={`rounded border bg-slate-900/70 p-2 ${levelStyles[log.level]}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold">{levelLabels[log.level]} · {log.title}</span>
                      <span className="text-[9px] text-slate-600">{new Date(log.createdAt).toLocaleTimeString()}</span>
                    </div>
                    {(log.projectName || log.stepName) && (
                      <div className="mt-1 text-[9px] text-slate-500">{[log.projectName, log.stepName].filter(Boolean).join(' / ')}</div>
                    )}
                    <div className="mt-1 text-[11px] leading-relaxed text-slate-300 whitespace-pre-wrap break-words">{log.message}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!isLogOpen && (
            <div className="fixed right-3 bottom-9 z-[9100] w-80 max-w-[calc(100vw-24px)] space-y-2 pointer-events-none">
              {toasts.map(toast => (
                <ToastEntry key={toast.id} entry={toast} onRemove={removeToast} />
              ))}
            </div>
          )}
        </>,
        document.body
      )}
    </NotificationContext.Provider>
  );
};

const ToastEntry: React.FC<{ entry: AppLogEntry; onRemove: (id: string) => void }> = ({ entry, onRemove }) => {
  useEffect(() => {
    const timer = window.setTimeout(() => onRemove(entry.id), entry.level === 'error' ? 6000 : 3500);
    return () => window.clearTimeout(timer);
  }, [entry.id, entry.level, onRemove]);

  return (
    <button
      onClick={() => onRemove(entry.id)}
      className={`pointer-events-auto w-full rounded border bg-slate-950/95 px-3 py-2 text-left shadow-xl backdrop-blur ${levelStyles[entry.level]}`}
    >
      <div className="text-[10px] font-bold">{entry.title}</div>
      <div className="mt-0.5 text-[11px] text-slate-300 line-clamp-3">{entry.message}</div>
    </button>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used inside NotificationProvider');
  return context;
};
