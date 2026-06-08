import React, { useEffect, useState } from 'react';
import { useNotifications } from './NotificationCenter';

declare const __APP_VERSION__: string;

interface TextStats {
  totalCharacters: number;
  englishCharacters: number;
  chineseCharacters: number;
  words: number;
  lines: number;
}

interface StatusBarProps {
  contextLabel: string;
}

const emptyStats: TextStats = {
  totalCharacters: 0,
  englishCharacters: 0,
  chineseCharacters: 0,
  words: 0,
  lines: 0,
};

const getSelectedText = () => {
  const active = document.activeElement;
  if (active instanceof HTMLTextAreaElement || (active instanceof HTMLInputElement && active.type === 'text')) {
    const start = active.selectionStart ?? 0;
    const end = active.selectionEnd ?? 0;
    if (end > start) return active.value.slice(start, end);
  }
  return window.getSelection()?.toString() || '';
};

const calculateStats = (text: string): TextStats => {
  if (!text) return emptyStats;
  return {
    totalCharacters: text.replace(/\r?\n/g, '').length,
    englishCharacters: (text.match(/[\x20-\x7E]/g) || []).length,
    chineseCharacters: (text.match(/[\u3400-\u4DBF\u4E00-\u9FFF]/g) || []).length,
    words: (text.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) || []).length,
    lines: text.split(/\r?\n/).length,
  };
};

export const StatusBar: React.FC<StatusBarProps> = ({ contextLabel }) => {
  const { unreadCount, isLogOpen, toggleLogPanel, logs } = useNotifications();
  const [stats, setStats] = useState<TextStats>(emptyStats);
  const [hasSelection, setHasSelection] = useState(false);
  const [activeAiRequests, setActiveAiRequests] = useState(0);
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved' | 'error'>('saved');

  useEffect(() => {
    const updateSelection = () => {
      const text = getSelectedText();
      setHasSelection(Boolean(text));
      setStats(calculateStats(text));
    };
    document.addEventListener('selectionchange', updateSelection);
    document.addEventListener('keyup', updateSelection);
    document.addEventListener('mouseup', updateSelection);
    document.addEventListener('select', updateSelection, true);
    return () => {
      document.removeEventListener('selectionchange', updateSelection);
      document.removeEventListener('keyup', updateSelection);
      document.removeEventListener('mouseup', updateSelection);
      document.removeEventListener('select', updateSelection, true);
    };
  }, []);

  useEffect(() => {
    const handleAiActivity = (event: Event) => {
      setActiveAiRequests(Math.max(0, Number((event as CustomEvent<number>).detail) || 0));
    };
    const handleSaveStatus = (event: Event) => {
      setSaveStatus((event as CustomEvent<'saving' | 'saved' | 'error'>).detail);
    };
    window.addEventListener('pwc:ai-activity', handleAiActivity);
    window.addEventListener('pwc:save-status', handleSaveStatus);
    return () => {
      window.removeEventListener('pwc:ai-activity', handleAiActivity);
      window.removeEventListener('pwc:save-status', handleSaveStatus);
    };
  }, []);

  return (
    <div className="h-6 shrink-0 border-t border-slate-800 bg-slate-950 px-3 flex items-center justify-between gap-4 text-[10px] text-slate-500 select-none z-[210]">
      <div className="min-w-0 flex items-center gap-3 overflow-hidden whitespace-nowrap">
        {hasSelection ? (
          <>
            <span className="text-slate-300">已选择</span>
            <span>字符 {stats.totalCharacters}</span>
            <span>英文字符 {stats.englishCharacters}</span>
            <span>中文字 {stats.chineseCharacters}</span>
            <span>单词 {stats.words}</span>
            <span>行 {stats.lines}</span>
          </>
        ) : (
          <span>未选择文本</span>
        )}
      </div>
      <div className="shrink-0 flex items-center gap-3 whitespace-nowrap">
        <span className="max-w-48 truncate text-slate-400" title={contextLabel}>{contextLabel}</span>
        <span className={activeAiRequests > 0 ? 'text-blue-400' : 'text-slate-600'}>AI 请求 {activeAiRequests}</span>
        <span className={saveStatus === 'error' ? 'text-red-400' : saveStatus === 'saving' ? 'text-amber-400' : 'text-emerald-500/80'}>
          {saveStatus === 'error' ? '保存失败' : saveStatus === 'saving' ? '保存中' : '已保存'}
        </span>
        <button
          onClick={toggleLogPanel}
          className={`relative flex items-center gap-1 px-1 py-0.5 rounded hover:bg-slate-800 ${
            logs.some(log => log.level === 'error') ? 'text-red-400' : isLogOpen ? 'text-blue-300' : 'text-slate-500'
          }`}
          title="日志"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M8 1.75A4.25 4.25 0 0 0 3.75 6v2.1c0 .54-.16 1.06-.47 1.5l-.86 1.22A.75.75 0 0 0 3.03 12h9.94a.75.75 0 0 0 .61-1.18l-.86-1.22a2.6 2.6 0 0 1-.47-1.5V6A4.25 4.25 0 0 0 8 1.75ZM6.25 13a1.75 1.75 0 0 0 3.5 0h-3.5Z" />
          </svg>
          {unreadCount > 0 && <span className="text-[9px] font-bold">{unreadCount}</span>}
        </button>
        <span className="text-slate-700">Beta {__APP_VERSION__}</span>
      </div>
    </div>
  );
};
