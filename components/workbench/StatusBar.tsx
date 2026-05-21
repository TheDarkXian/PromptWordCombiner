import React from 'react';
import { UiLanguage } from '../../types';

interface StatusBarProps {
  language: UiLanguage;
  errorCount: number;
  warningCount: number;
  activeLabel: string;
  consoleCount?: number;
  onOpenProblems: () => void;
  onOpenConsole?: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  language,
  errorCount,
  warningCount,
  activeLabel,
  consoleCount = 0,
  onOpenProblems,
  onOpenConsole,
}) => (
  <div className="mt-2 flex shrink-0 items-center justify-between rounded border border-slate-800 bg-slate-950 px-3 py-1.5 text-[11px] text-slate-500">
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onOpenProblems}
        className="font-bold text-slate-300 hover:text-white"
      >
        <span className={errorCount > 0 ? 'text-red-300' : ''}>
          {language === 'zh-CN' ? `${errorCount} 错误` : `${errorCount} errors`}
        </span>
        <span className={warningCount > 0 ? 'ml-2 text-amber-300' : 'ml-2'}>
          {warningCount > 0
            ? language === 'zh-CN'
              ? `${warningCount} 警告`
              : `${warningCount} warnings`
            : ''}
        </span>
      </button>
      {onOpenConsole && (
        <button
          type="button"
          onClick={onOpenConsole}
          className="font-bold text-slate-400 hover:text-white"
        >
          {language === 'zh-CN' ? `控制台 ${consoleCount}` : `Console ${consoleCount}`}
        </button>
      )}
    </div>
    <span>{activeLabel}</span>
  </div>
);
