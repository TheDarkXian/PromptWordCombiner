import React, { useMemo, useState } from 'react';
import { ProducerRunResultItem, UiLanguage } from '../../types';
import { t } from '../../services/i18n';
import { Button } from '../Button';

export interface ProducerRunProgressState {
  isOpen: boolean;
  isRunning: boolean;
  total: number;
  processed: number;
  currentStepName: string;
  successCount: number;
  errorCount: number;
  skippedCount: number;
  results: ProducerRunResultItem[];
  stopRequested: boolean;
}

interface ProducerRunProgressModalProps {
  language: UiLanguage;
  state: ProducerRunProgressState;
  onStop: () => void;
  onClose: () => void;
}

export const ProducerRunProgressModal: React.FC<ProducerRunProgressModalProps> = ({
  language,
  state,
  onStop,
  onClose,
}) => {
  const [filter, setFilter] = useState<'all' | 'success' | 'error' | 'skipped' | 'blocked'>('all');
  if (!state.isOpen) return null;

  const progress = state.total > 0 ? Math.round((state.processed / state.total) * 100) : 0;
  const filteredResults = useMemo(
    () =>
      filter === 'all'
        ? state.results
        : state.results.filter((item) =>
            filter === 'skipped'
              ? item.status === 'skipped' || item.status === 'stopped'
              : item.status === filter
          ),
    [filter, state.results]
  );

  return (
    <div className="fixed inset-0 z-[145] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="mx-4 flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="border-b border-slate-800 px-6 py-5">
          <h3 className="text-lg font-bold text-white">{t(language, 'project.producerResultTitle')}</h3>
          <p className="mt-2 text-sm text-slate-400">
            {state.isRunning
              ? `${t(language, 'project.producerCurrent')}: ${state.currentStepName || '-'}`
              : t(language, 'project.producerSummary')}
          </p>
        </div>

        <div className="space-y-5 p-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-300">
                {t(language, 'project.producerProgress')}: {state.processed} / {state.total}
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
                {language === 'zh-CN' ? '成功' : 'Success'} {state.successCount}
              </span>
              <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-red-300">
                {language === 'zh-CN' ? '失败' : 'Failed'} {state.errorCount}
              </span>
              <span className="rounded-full border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-slate-300">
                {t(language, 'project.producerSkipped')} {state.skippedCount}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(['all', 'success', 'error', 'skipped', 'blocked'] as const).map((item) => (
              <button
                key={item}
                onClick={() => setFilter(item)}
                className={`rounded-md border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  filter === item
                    ? 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                    : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                {item === 'all'
                  ? language === 'zh-CN'
                    ? '全部'
                    : 'All'
                  : item === 'success'
                    ? language === 'zh-CN'
                      ? '成功'
                      : 'Success'
                    : item === 'error'
                      ? language === 'zh-CN'
                        ? '失败'
                        : 'Error'
                      : item === 'skipped'
                        ? t(language, 'project.producerSkipped')
                        : t(language, 'project.producerBlocked')}
              </button>
            ))}
          </div>

          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {filteredResults.map((item) => (
              <div key={`${item.stepId}_${item.status}`} className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-200">{item.stepName}</div>
                    <div className="mt-1 font-mono text-[11px] text-slate-500">{`{{${item.outputVariableKey}}}`}</div>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                      item.status === 'success'
                        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                        : item.status === 'error'
                          ? 'border-red-500/20 bg-red-500/10 text-red-300'
                          : item.status === 'blocked'
                            ? 'border-amber-500/20 bg-amber-500/10 text-amber-300'
                          : 'border-slate-700 bg-slate-800/80 text-slate-300'
                    }`}
                  >
                    {item.status === 'success'
                      ? language === 'zh-CN'
                        ? '成功'
                        : 'Success'
                        : item.status === 'error'
                          ? language === 'zh-CN'
                            ? '失败'
                            : 'Error'
                        : item.status === 'blocked'
                          ? t(language, 'project.producerBlocked')
                        : item.status === 'stopped'
                          ? t(language, 'project.producerStopped')
                          : t(language, 'project.producerSkipped')}
                  </span>
                </div>
                <div className="mt-1 whitespace-pre-wrap text-[11px] text-slate-400">{item.message}</div>
              </div>
            ))}
            {filteredResults.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-800 px-3 py-4 text-[11px] text-slate-500">
                {t(language, 'project.producerNothingToRun')}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-800 px-6 py-4">
          {state.isRunning ? (
            <Button variant="danger" onClick={onStop} disabled={state.stopRequested}>
              {state.stopRequested
                ? t(language, 'project.producerStopping')
                : t(language, 'project.producerStop')}
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onClose} disabled={state.isRunning}>
            {language === 'zh-CN' ? '关闭' : 'Close'}
          </Button>
        </div>
      </div>
    </div>
  );
};
