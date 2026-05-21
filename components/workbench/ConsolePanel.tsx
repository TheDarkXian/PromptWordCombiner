import React, { useMemo, useState } from 'react';
import { RuntimeDiagnostic, UiLanguage } from '../../types';

interface ConsolePanelProps {
  language: UiLanguage;
  diagnostics: RuntimeDiagnostic[];
  onClear: () => void;
}

type ConsoleFilter = 'all' | RuntimeDiagnostic['level'];

const filters: ConsoleFilter[] = ['all', 'error', 'warning', 'info'];

export const ConsolePanel: React.FC<ConsolePanelProps> = ({ language, diagnostics, onClear }) => {
  const [filter, setFilter] = useState<ConsoleFilter>('all');
  const visibleDiagnostics = useMemo(
    () => diagnostics.filter((diagnostic) => filter === 'all' || diagnostic.level === filter),
    [diagnostics, filter]
  );

  const getFilterLabel = (value: ConsoleFilter) => {
    if (value === 'all') return language === 'zh-CN' ? '全部' : 'All';
    if (value === 'error') return language === 'zh-CN' ? '错误' : 'Errors';
    if (value === 'warning') return language === 'zh-CN' ? '警告' : 'Warnings';
    return language === 'zh-CN' ? '信息' : 'Info';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {filters.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className={`rounded px-2 py-1 text-[11px] font-bold transition-colors ${
                filter === item
                  ? 'bg-cyan-500/15 text-cyan-200'
                  : 'text-slate-500 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              {getFilterLabel(item)}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClear}
          className="rounded px-2 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-900 hover:text-white"
        >
          {language === 'zh-CN' ? '清空' : 'Clear'}
        </button>
      </div>

      {visibleDiagnostics.length === 0 ? (
        <div className="px-2 py-3 text-xs text-slate-500">
          {language === 'zh-CN' ? '暂无控制台输出。' : 'No console output.'}
        </div>
      ) : (
        <div className="space-y-1">
          {visibleDiagnostics.map((diagnostic) => (
            <div
              key={diagnostic.id}
              className="grid grid-cols-[72px_150px_minmax(0,1fr)] gap-2 rounded px-2 py-1.5 text-xs"
            >
              <span
                className={
                  diagnostic.level === 'error'
                    ? 'text-red-300'
                    : diagnostic.level === 'warning'
                      ? 'text-amber-300'
                      : 'text-slate-400'
                }
              >
                {getFilterLabel(diagnostic.level)}
              </span>
              <span className="truncate text-slate-500">
                {diagnostic.stepName || diagnostic.stepId || '-'}
              </span>
              <span className="min-w-0 text-slate-200">
                {diagnostic.message}
                {diagnostic.detail && (
                  <span className="ml-2 text-slate-500">{diagnostic.detail}</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
