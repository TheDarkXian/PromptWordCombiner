import React, { useMemo, useState } from 'react';
import { Button } from './Button';

export interface BatchRunResultItem {
  projectId: string;
  projectName: string;
  status: 'success' | 'error';
  message: string;
}

export interface BatchRunFailureItem {
  projectId: string;
  projectName: string;
  message: string;
}

export interface BatchRunProgressState {
  isOpen: boolean;
  isRunning: boolean;
  templateId: string | null;
  templateName: string;
  stepId: string | null;
  stepName: string;
  total: number;
  processed: number;
  successCount: number;
  failures: BatchRunFailureItem[];
  results: BatchRunResultItem[];
}

interface BatchRunProgressModalProps {
  state: BatchRunProgressState;
  onClose: () => void;
  onRetryFailed: () => void;
  onExportResults: (format: 'json' | 'csv', scope: 'all' | 'success' | 'error') => void;
}

export const BatchRunProgressModal: React.FC<BatchRunProgressModalProps> = ({
  state,
  onClose,
  onRetryFailed,
  onExportResults,
}) => {
  const [filter, setFilter] = useState<'all' | 'success' | 'error'>('all');

  const progress = state.total > 0 ? Math.round((state.processed / state.total) * 100) : 0;
  const filteredResults = useMemo(
    () => (filter === 'all' ? state.results : state.results.filter((item) => item.status === filter)),
    [filter, state.results]
  );

  if (!state.isOpen) return null;

  return (
    <div className="fixed inset-0 z-[135] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="mx-4 flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="border-b border-slate-800 px-6 py-5">
          <h3 className="text-lg font-bold text-white">批量执行进度</h3>
          <p className="mt-2 text-sm text-slate-400">
            模板：<span className="font-semibold text-emerald-300">{state.templateName || '未选择'}</span>
            <span className="mx-2 text-slate-600">/</span>
            步骤：<span className="font-semibold text-blue-300">{state.stepName || '未选择'}</span>
          </p>
        </div>

        <div className="space-y-5 p-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-300">
                {state.isRunning ? '执行中' : '执行完成'}：{state.processed} / {state.total}
              </span>
              <span className="font-semibold text-slate-200">{progress}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  state.isRunning ? 'bg-blue-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-emerald-300">
                成功 {state.successCount}
              </span>
              <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-red-300">
                失败 {state.failures.length}
              </span>
            </div>
          </div>

          {state.results.length > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-300">执行结果</div>
                <div className="flex flex-wrap gap-2">
                  {(['all', 'success', 'error'] as const).map((item) => (
                    <button
                      key={item}
                      onClick={() => setFilter(item)}
                      className={`rounded-md border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                        filter === item
                          ? 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                          : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-white'
                      }`}
                    >
                      {item === 'all' ? '全部' : item === 'success' ? '成功' : '失败'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => onExportResults('json', filter)}>
                  导出 JSON
                </Button>
                <Button size="sm" variant="secondary" onClick={() => onExportResults('csv', filter)}>
                  导出 CSV
                </Button>
              </div>

              <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                {filteredResults.map((item) => (
                  <div key={`${item.projectId}_${item.status}`} className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-slate-200">{item.projectName}</div>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                          item.status === 'success'
                            ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                            : 'border-red-500/20 bg-red-500/10 text-red-300'
                        }`}
                      >
                        {item.status === 'success' ? '成功' : '失败'}
                      </span>
                    </div>
                    <div className="mt-1 whitespace-pre-wrap text-[11px] text-slate-400">{item.message}</div>
                  </div>
                ))}
                {filteredResults.length === 0 && (
                  <div className="rounded-lg border border-dashed border-slate-800 px-3 py-4 text-[11px] text-slate-500">
                    当前筛选条件下没有结果。
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-800 px-6 py-4">
          {!state.isRunning && state.failures.length > 0 && (
            <Button variant="danger" onClick={onRetryFailed}>
              重跑失败项
            </Button>
          )}
          <Button variant="secondary" onClick={onClose} disabled={state.isRunning}>
            {state.isRunning ? '执行中...' : '关闭'}
          </Button>
        </div>
      </div>
    </div>
  );
};
