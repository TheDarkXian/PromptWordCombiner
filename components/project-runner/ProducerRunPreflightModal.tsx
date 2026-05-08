import React, { useMemo } from 'react';
import { ProducerPreflightItem, ProducerRunScope, UiLanguage } from '../../types';
import { t } from '../../services/i18n';
import { Button } from '../Button';

interface ProducerRunPreflightModalProps {
  isOpen: boolean;
  language: UiLanguage;
  items: ProducerPreflightItem[];
  scope: ProducerRunScope;
  onScopeChange: (scope: ProducerRunScope) => void;
  selectedOverwriteStepIds: string[];
  onToggleOverwrite: (stepId: string) => void;
  onSelectAllOverwrite: () => void;
  onSelectNoOverwrite: () => void;
  onClose: () => void;
  onConfirm: () => void;
}

export const ProducerRunPreflightModal: React.FC<ProducerRunPreflightModalProps> = ({
  isOpen,
  language,
  items,
  scope,
  onScopeChange,
  selectedOverwriteStepIds,
  onToggleOverwrite,
  onSelectAllOverwrite,
  onSelectNoOverwrite,
  onClose,
  onConfirm,
}) => {
  const readyItems = useMemo(() => items.filter((item) => item.status === 'ready'), [items]);
  const existingItems = useMemo(
    () => items.filter((item) => item.status === 'existing_result'),
    [items]
  );
  const blockedItems = useMemo(() => items.filter((item) => item.status === 'blocked'), [items]);
  const skippedItems = useMemo(() => items.filter((item) => item.status === 'skipped'), [items]);

  const selectedCount = readyItems.length + selectedOverwriteStepIds.length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="mx-4 flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="border-b border-slate-800 px-6 py-5">
          <h3 className="text-lg font-bold text-white">{t(language, 'project.producerPreflightTitle')}</h3>
          <p className="mt-2 text-sm text-slate-400">
            {t(language, 'project.producerPreflightSubtitle')}
          </p>
        </div>

        <div className="space-y-5 p-6">
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
            <div className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
              {t(language, 'project.producerScope')}
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              {([
                ['empty_only', t(language, 'project.producerScopeEmpty')],
                ['changed_only', t(language, 'project.producerScopeChanged')],
                ['all', t(language, 'project.producerScopeAll')],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => onScopeChange(value)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    scope === value
                      ? 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                      : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-emerald-300">
              {t(language, 'project.producerReady')} {readyItems.length}
            </span>
            <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-amber-300">
              {t(language, 'project.producerExisting')} {existingItems.length}
            </span>
            <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-red-300">
              {t(language, 'project.producerBlocked')} {blockedItems.length}
            </span>
            <span className="rounded-full border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-slate-300">
              {t(language, 'project.producerSkipped')} {skippedItems.length}
            </span>
          </div>

          {readyItems.length > 0 && (
            <section className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
              <div className="mb-3 text-xs font-bold uppercase tracking-wider text-emerald-300">
                {t(language, 'project.producerReady')}
              </div>
              <div className="space-y-2">
                {readyItems.map((item) => (
                  <div key={item.stepId} className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-200">{item.stepName}</div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          {t(language, 'project.producerOutputVar')}: {'{{'}
                          {item.outputVariableKey}
                          {'}}'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {existingItems.length > 0 && (
            <section className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  {t(language, 'project.producerExisting')}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={onSelectAllOverwrite}>
                    {t(language, 'project.producerOverwriteAll')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={onSelectNoOverwrite}>
                    {t(language, 'project.producerSkipAll')}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                {existingItems.map((item) => {
                  const isChecked = selectedOverwriteStepIds.includes(item.stepId);
                  return (
                    <label
                      key={item.stepId}
                      className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => onToggleOverwrite(item.stepId)}
                        className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-blue-500"
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-200">{item.stepName}</div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          {t(language, 'project.producerOutputVar')}: {'{{'}
                          {item.outputVariableKey}
                          {'}}'}
                        </div>
                        <div className="mt-1 text-[11px] text-amber-300">
                          {item.reason || t(language, 'project.producerWillOverwrite')}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </section>
          )}

          {blockedItems.length > 0 && (
            <section className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
              <div className="mb-3 text-xs font-bold uppercase tracking-wider text-red-300">
                {t(language, 'project.producerBlocked')}
              </div>
              <div className="space-y-2">
                {blockedItems.map((item) => (
                  <div key={item.stepId} className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2">
                    <div className="truncate text-sm font-semibold text-slate-200">{item.stepName}</div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      {t(language, 'project.producerOutputVar')}: {'{{'}
                      {item.outputVariableKey}
                      {'}}'}
                    </div>
                    <div className="mt-1 text-[11px] text-red-300">
                      {t(language, 'project.producerBlockedReason')}: {item.reason}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {skippedItems.length > 0 && (
            <section className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
              <div className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-300">
                {t(language, 'project.producerSkipped')}
              </div>
              <div className="space-y-2">
                {skippedItems.map((item) => (
                  <div key={item.stepId} className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2">
                    <div className="truncate text-sm font-semibold text-slate-200">{item.stepName}</div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      {t(language, 'project.producerOutputVar')}: {'{{'}
                      {item.outputVariableKey}
                      {'}}'}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-400">{item.reason}</div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-800 px-6 py-4">
          <div className="text-sm text-slate-400">
            {selectedCount > 0
              ? `${t(language, 'project.producerSummary')}: ${selectedCount}`
              : t(language, 'project.producerNoReady')}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={onClose}>
              {language === 'zh-CN' ? '取消' : 'Cancel'}
            </Button>
            <Button onClick={onConfirm} disabled={selectedCount <= 0}>
              {t(language, 'project.producerStart')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
