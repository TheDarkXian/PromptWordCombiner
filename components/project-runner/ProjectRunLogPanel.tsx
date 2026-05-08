import React from 'react';
import { StepRunLog, UiLanguage } from '../../types';
import { t } from '../../services/i18n';

interface ProjectRunLogPanelProps {
  language: UiLanguage;
  stepId: string;
  stepLogs: StepRunLog[];
  visibleLogs: StepRunLog[];
  isLogsExpanded: boolean;
  runState: 'idle' | 'running' | 'success' | 'error';
  runError?: string;
  viewMode: 'compact' | 'detail';
  onToggleLogs: () => void;
  onRequestClearLogs: () => void;
  onCopyLogText: (content: string, label: string) => Promise<void>;
  onRestoreLogOutput: (stepId: string, output: string) => void;
}

export const ProjectRunLogPanel: React.FC<ProjectRunLogPanelProps> = ({
  language,
  stepId,
  stepLogs,
  visibleLogs,
  isLogsExpanded,
  runState,
  runError,
  viewMode,
  onToggleLogs,
  onRequestClearLogs,
  onCopyLogText,
  onRestoreLogOutput,
}) => (
  <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2.5">
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{t(language, 'step.runLogs')}</div>
        <div className="mt-1 text-xs text-slate-400">
          {stepLogs.length > 0
            ? `${viewMode === 'compact' ? t(language, 'step.summaryView') : t(language, 'step.detailView')}, ${t(language, 'step.logCount', { count: stepLogs.length })}`
            : t(language, 'step.noRunLogs')}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {stepLogs.length > 1 && (
          <button
            onClick={onToggleLogs}
            className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-[10px] font-bold text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
          >
            {isLogsExpanded ? t(language, 'step.hideHistory') : t(language, 'step.showHistory')}
          </button>
        )}
        {stepLogs.length > 0 && (
          <button
            onClick={onRequestClearLogs}
            className="rounded-md border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-[10px] font-bold text-red-300 transition-colors hover:border-red-400/40 hover:text-white"
          >
            {t(language, 'step.clearStepLogs')}
          </button>
        )}
      </div>
    </div>

    {runState === 'error' && runError && stepLogs.length === 0 && (
      <div className="mt-3 rounded border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-300">{runError}</div>
    )}

    {visibleLogs.length > 0 && (
      <div className="mt-2 space-y-2.5">
        {visibleLogs.map((log) => (
          <div key={log.id} className="rounded-lg border border-slate-800 bg-slate-900/80 p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] ${
                  log.status === 'success'
                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                    : 'border-red-500/20 bg-red-500/10 text-red-300'
                }`}
              >
                {log.status === 'success' ? t(language, 'step.done') : t(language, 'step.failed')}
              </span>
              <span className="text-[11px] text-slate-500">{new Date(log.createdAt).toLocaleString(language)}</span>
              <span className="text-[11px] text-slate-400">
                {log.providerLabel} / {log.modelLabel}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
              <span>{`${t(language, 'step.temperature')}: ${log.temperature ?? t(language, 'step.default')}`}</span>
              <span>{`${t(language, 'step.maxTokens')}: ${log.maxTokens ?? t(language, 'step.default')}`}</span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => {
                  void onCopyLogText(log.systemPrompt || '', t(language, 'toast.systemPrompt'));
                }}
                className="rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1 text-[10px] font-bold text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
              >
                {t(language, 'step.copySystem')}
              </button>
              <button
                onClick={() => {
                  void onCopyLogText(log.userPrompt || '', t(language, 'toast.userPrompt'));
                }}
                className="rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1 text-[10px] font-bold text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
              >
                {t(language, 'step.copyUser')}
              </button>
              <button
                onClick={() => {
                  void onCopyLogText(
                    log.status === 'success' ? log.output || '' : log.error || '',
                    log.status === 'success' ? t(language, 'toast.result') : t(language, 'toast.error')
                  );
                }}
                className="rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1 text-[10px] font-bold text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
              >
                {log.status === 'success' ? t(language, 'step.copyResult') : t(language, 'step.copyError')}
              </button>
              {log.status === 'success' && (
                <button
                  onClick={() => onRestoreLogOutput(stepId, log.output)}
                  className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-300 transition-colors hover:border-emerald-400/40 hover:text-white"
                >
                  {t(language, 'step.restoreResult')}
                </button>
              )}
            </div>

            <div className="mt-3 space-y-3 text-xs">
              <div>
                <div className="mb-1 font-bold uppercase tracking-wider text-slate-500">{t(language, 'step.systemPrompt')}</div>
                <div className="whitespace-pre-wrap break-words rounded border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-300">
                  {log.systemPrompt || t(language, 'step.notSet')}
                </div>
              </div>
              <div>
                <div className="mb-1 font-bold uppercase tracking-wider text-slate-500">{t(language, 'step.userPrompt')}</div>
                <div className="whitespace-pre-wrap break-words rounded border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-300">
                  {log.userPrompt || t(language, 'step.emptyText')}
                </div>
              </div>
              {log.status === 'success' ? (
                <div>
                  <div className="mb-1 font-bold uppercase tracking-wider text-slate-500">{t(language, 'step.output')}</div>
                  <div className="whitespace-pre-wrap break-words rounded border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-300">
                    {log.output || t(language, 'step.emptyText')}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="mb-1 font-bold uppercase tracking-wider text-slate-500">{t(language, 'step.error')}</div>
                  <div className="whitespace-pre-wrap break-words rounded border border-red-500/20 bg-red-500/5 px-3 py-2 text-red-300">
                    {log.error || t(language, 'step.failed')}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);
