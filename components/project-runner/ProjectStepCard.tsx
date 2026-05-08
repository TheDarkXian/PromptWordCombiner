import React from 'react';
import {
  ModelCatalogItem,
  ProducerAutomationStepState,
  Project,
  ProviderConfig,
  StepFlowStatus,
  StepRunLog,
  StepRunState,
  Template,
  TemplateStep,
  UiLanguage,
} from '../../types';
import { t } from '../../services/i18n';
import { resolveStepExecutionAvailability } from '../../services/modelService';
import { PromptEditor } from '../PromptEditor';
import { AutoResizeTextarea } from '../common/AutoResizeTextarea';
import { ProjectRunLogPanel } from './ProjectRunLogPanel';

type ViewMode = 'compact' | 'detail';

const getStepRoleMeta = (language: UiLanguage, step: TemplateStep) => {
  const stepType =
    step.stepType ||
    (step.execution?.modelRefId ? 'text_generation' : 'manual');
  const roleLabel =
    stepType === 'text_generation'
      ? t(language, 'step.roleText')
      : stepType === 'external'
        ? t(language, 'step.roleExternal')
        : t(language, 'step.roleManual');

  return {
    stepType,
    roleLabel,
    autoRunEnabled:
      stepType === 'text_generation' && step.autoRunEnabled === true,
  };
};

const getExecutionMeta = (
  language: UiLanguage,
  availability: ReturnType<typeof resolveStepExecutionAvailability>
) => {
  switch (availability.status) {
    case 'manual':
      return {
        badge: t(language, 'step.manual'),
        message: t(language, 'step.manualMessage'),
        className: 'border-slate-700 bg-slate-800/60 text-slate-300',
      };
    case 'missing_model_ref':
      return {
        badge: t(language, 'step.missingRef'),
        message: t(language, 'step.missingRefMessage'),
        className: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
      };
    case 'missing_model_catalog_item':
      return {
        badge: t(language, 'step.missingModel'),
        message: t(language, 'step.missingModelMessage'),
        className: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
      };
    case 'model_disabled':
      return {
        badge: t(language, 'step.modelOff'),
        message: t(language, 'step.modelOffMessage'),
        className: 'border-red-500/20 bg-red-500/10 text-red-300',
      };
    case 'missing_provider':
      return {
        badge: t(language, 'step.missingProvider'),
        message: t(language, 'step.missingProviderMessage'),
        className: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
      };
    case 'provider_disabled':
      return {
        badge: t(language, 'step.providerOff'),
        message: t(language, 'step.providerOffMessage'),
        className: 'border-red-500/20 bg-red-500/10 text-red-300',
      };
    case 'missing_api_key':
      return {
        badge: t(language, 'step.missingKey'),
        message: t(language, 'step.missingKeyMessage'),
        className: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
      };
    case 'unsupported_provider':
      return {
        badge: t(language, 'step.unsupported'),
        message: t(language, 'step.unsupportedMessage'),
        className: 'border-red-500/20 bg-red-500/10 text-red-300',
      };
    case 'ready':
      return {
        badge: t(language, 'step.runnable'),
        message:
          availability.modelCatalogItem && availability.providerConfig
            ? t(language, 'step.runnableMessage', {
                provider: availability.providerConfig.label,
                model: availability.modelCatalogItem.label,
              })
            : t(language, 'step.runnableMessage', { provider: '-', model: '-' }),
        className: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
      };
    default:
      return {
        badge: t(language, 'step.unknown'),
        message: t(language, 'step.unknownMessage'),
        className: 'border-slate-700 bg-slate-800/60 text-slate-300',
      };
  }
};

interface ProjectStepCardProps {
  index: number;
  language: UiLanguage;
  project: Project;
  template: Template;
  step: TemplateStep;
  modelCatalog: ModelCatalogItem[];
  providerConfigs: ProviderConfig[];
  viewMode: ViewMode;
  isCollapsed: boolean;
  isLogsExpanded: boolean;
  isResultExpanded: boolean;
  runState: StepRunState;
  runError?: string;
  producerState: ProducerAutomationStepState;
  producerStateReason?: string;
  onToggleCollapse: () => void;
  onToggleLogs: () => void;
  onToggleResults: () => void;
  onRunStep: (stepId: string) => Promise<void>;
  onUpdateProject: (projectId: string, updates: Partial<Project>) => void;
  onUpdateTemplate: (templateId: string, updates: Partial<Template>) => void;
  onClearStepRunLogs: (stepId: string) => void;
  onRequestConfirm: (title: string, message: string, onConfirm: () => void) => void;
  onQuickCopy: (content: string, label: string) => Promise<void>;
  onCopyLogText: (content: string, label: string) => Promise<void>;
  onRestoreLogOutput: (stepId: string, output: string) => void;
  interpolate: (templateStr: string) => string;
  getVariableByKey: (key: string) => Project['variables'][number] | undefined;
  getStepStatus: (stepId: string) => StepFlowStatus;
  getStatusMeta: (status: StepFlowStatus) => { label: string; className: string };
  getRunStateMeta: (state: StepRunState) => { label: string; className: string };
  scrollToStep: (stepId: string) => void;
}

export const ProjectStepCard: React.FC<ProjectStepCardProps> = ({
  index,
  language,
  project,
  template,
  step,
  modelCatalog,
  providerConfigs,
  viewMode,
  isCollapsed,
  isLogsExpanded,
  isResultExpanded,
  runState,
  runError,
  producerState,
  producerStateReason,
  onToggleCollapse,
  onToggleLogs,
  onToggleResults,
  onRunStep,
  onUpdateProject,
  onUpdateTemplate,
  onClearStepRunLogs,
  onRequestConfirm,
  onQuickCopy,
  onCopyLogText,
  onRestoreLogOutput,
  interpolate,
  getVariableByKey,
  getStepStatus,
  getStatusMeta,
  getRunStateMeta,
  scrollToStep,
}) => {
  const override = project.stepOverrides[step.id];
  const rawContent =
    override?.content !== undefined ? override.content : step.content || '';
  const interpolated = interpolate(rawContent);
  const configuredBinding = step.outputBinding?.variableKey
    ? step.outputBinding
    : null;
  const stepRoleMeta = getStepRoleMeta(language, step);
  const stepStatus = getStepStatus(step.id);
  const statusMeta = getStatusMeta(stepStatus);
  const availability = resolveStepExecutionAvailability({
    step,
    template,
    modelCatalog,
    providerConfigs,
  });
  const executionMeta = getExecutionMeta(language, availability);
  const runStateMeta = getRunStateMeta(runState);
  const producerStateMeta =
    producerState === 'queued'
      ? {
          label: t(language, 'step.autoQueued'),
          className: 'border-blue-500/20 bg-blue-500/10 text-blue-300',
        }
      : producerState === 'blocked'
        ? {
            label: t(language, 'step.autoBlocked'),
            className: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
          }
        : producerState === 'skipped'
          ? {
              label: t(language, 'step.autoSkipped'),
              className: 'border-slate-700 bg-slate-800/80 text-slate-300',
            }
          : producerState === 'stopped'
            ? {
                label: t(language, 'step.autoStopped'),
                className: 'border-slate-700 bg-slate-800/80 text-slate-300',
              }
            : null;
  const stepLogs = (project.stepRunLogs?.[step.id] || []) as StepRunLog[];
  const latestLog = stepLogs[stepLogs.length - 1];
  const visibleLogs = isLogsExpanded
    ? [...stepLogs].reverse()
    : latestLog
      ? [latestLog]
      : [];
  const resultValue = project.stepOutputs[step.id] || '';
  const currentStepAssetUpdatedAt = Math.max(
    project.stepOutputMeta?.[step.id]?.updatedAt || 0,
    latestLog?.createdAt || 0
  );

  const extractVariableKeys = (content: string) => {
    if (!content) return [];
    const matches = Array.from(content.matchAll(/\{\{([^}]+)\}\}/g));
    return Array.from(
      new Set(
        matches.map((match) => String(match[1]).trim()).filter(Boolean)
      )
    );
  };

  const referencedKeys = extractVariableKeys(rawContent);
  const missingKeys: string[] = [];
  const staleKeys: string[] = [];

  referencedKeys.forEach((key) => {
    const variable = getVariableByKey(key);
    if (!variable || !String(variable.value || '').trim()) {
      missingKeys.push(key);
      return;
    }
    if (currentStepAssetUpdatedAt <= 0) {
      return;
    }
    if ((variable.updatedAt || 0) > currentStepAssetUpdatedAt) {
      staleKeys.push(key);
    }
  });

  const riskMeta =
    missingKeys.length > 0
      ? {
          className: 'bg-red-500/10 text-red-400 border-red-500/20',
          label: t(language, 'step.missingVars', { count: missingKeys.length }),
        }
      : staleKeys.length > 0
        ? {
            className:
              'bg-amber-500/10 text-amber-400 border-amber-500/20',
            label:
              staleKeys.length === 1
                ? language === 'zh-CN'
                  ? `变量 {{${staleKeys[0]}}} 已更新`
                  : `{{${staleKeys[0]}}} updated`
                : language === 'zh-CN'
                  ? `${staleKeys.length} 个引用变量已更新`
                  : `${staleKeys.length} referenced vars updated`,
          }
        : null;

  const referencedSourceSteps = referencedKeys
    .map((key) => getVariableByKey(key))
    .filter(
      (variable): variable is NonNullable<typeof variable> =>
        Boolean(variable?.sourceType === 'step_output' && variable.sourceRef)
    )
    .map((variable) => ({
      key: variable.key,
      stepId: variable.sourceRef as string,
      stepName:
        template.steps.find((item) => item.id === variable.sourceRef)?.name ||
        variable.sourceRef ||
        variable.key,
    }))
    .filter(
      (item, itemIndex, array) =>
        array.findIndex((candidate) => candidate.stepId === item.stepId) ===
        itemIndex
    );

  const getResultPreview = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return language === 'zh-CN' ? '暂无结果' : 'No result yet';
    }
    const normalized = trimmed.replace(/\s+/g, ' ');
    return `${normalized.slice(0, 96)}${normalized.length > 96 ? '...' : ''}`;
  };

  return (
    <div
      id={step.id}
      className="scroll-mt-8 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40 shadow-sm transition-all duration-300"
    >
      <div
        className="flex cursor-pointer items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 px-4 py-3 transition-colors hover:bg-slate-800/80"
        onClick={onToggleCollapse}
      >
        <div className="min-w-0 flex items-center gap-3">
          <span className="rounded-md bg-slate-800 px-2 py-0.5 font-mono text-xs font-bold text-slate-500">
            {index + 1}
          </span>
          <h3 className="truncate text-sm font-black tracking-tight text-slate-200">
            {step.name}
          </h3>
          <span className="rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 text-[10px] text-slate-300">
            {stepRoleMeta.roleLabel}
          </span>
          {stepRoleMeta.autoRunEnabled && (
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
              {t(language, 'step.autoRun')}
            </span>
          )}
          {stepStatus !== 'empty' && (
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] ${statusMeta.className}`}
            >
              {statusMeta.label}
            </span>
          )}
          {riskMeta && (
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] ${riskMeta.className}`}
            >
              {riskMeta.label}
            </span>
          )}
          {availability.status !== 'manual' && (
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] ${executionMeta.className}`}
            >
              {executionMeta.badge}
            </span>
          )}
          {runState !== 'idle' && (
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] ${runStateMeta.className}`}
            >
              {runStateMeta.label}
            </span>
          )}
          {producerStateMeta && runState === 'idle' && (
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] ${producerStateMeta.className}`}
            >
              {producerStateMeta.label}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={(event) => {
              event.stopPropagation();
              void onQuickCopy(interpolated, t(language, 'toast.result'));
            }}
            className="rounded-md border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-[10px] font-bold text-blue-300 transition-colors hover:border-blue-400/40 hover:text-white"
          >
            {t(language, 'step.copy')}
          </button>
          {availability.status !== 'manual' && (
            <button
              onClick={(event) => {
                event.stopPropagation();
                if (!availability.isRunnable || runState === 'running') return;
                void onRunStep(step.id);
              }}
              disabled={!availability.isRunnable || runState === 'running'}
              className={`rounded-md border px-2.5 py-1 text-[10px] font-bold transition-colors ${
                availability.isRunnable && runState !== 'running'
                  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:border-emerald-400/40 hover:text-white'
                  : 'border-slate-700 bg-slate-900 text-slate-500'
              }`}
            >
              {runState === 'running'
                ? t(language, 'step.running')
                : t(language, 'step.generate')}
            </button>
          )}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`h-5 w-5 text-slate-600 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            />
          </svg>
        </div>
      </div>

      {!isCollapsed && (
        <div className="bg-slate-900/20 p-4">
          {viewMode === 'detail' && (
            <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2.5 text-xs text-slate-400">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-slate-300">
                  {t(language, 'step.roleInfo', { role: stepRoleMeta.roleLabel })}
                </span>
                <span className="text-slate-500">
                  {t(language, 'step.autoRunInfo', {
                    status: stepRoleMeta.autoRunEnabled
                      ? t(language, 'step.autoRun')
                      : t(language, 'step.autoRunOff'),
                  })}
                </span>
                {producerState !== 'idle' && (
                  <span className="text-slate-500">
                    {t(language, 'step.autoStateInfo', {
                      state:
                        producerState === 'queued'
                          ? t(language, 'step.autoQueued')
                          : producerState === 'blocked'
                            ? t(language, 'step.autoBlocked')
                            : producerState === 'skipped'
                              ? t(language, 'step.autoSkipped')
                              : producerState === 'stopped'
                                ? t(language, 'step.autoStopped')
                                : producerState === 'success'
                                  ? t(language, 'step.done')
                                  : producerState === 'error'
                                    ? t(language, 'step.failed')
                                    : t(language, 'step.running'),
                    })}
                  </span>
                )}
              </div>
              {producerStateReason && producerState !== 'success' && (
                <div className="mt-2 text-[11px] text-slate-500">{producerStateReason}</div>
              )}
            </div>
          )}
          {viewMode === 'detail' && availability.status !== 'manual' && (
            <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] ${executionMeta.className}`}
                >
                  {executionMeta.badge}
                </span>
                {availability.providerConfig &&
                  availability.modelCatalogItem && (
                    <span className="text-xs text-slate-300">
                      {availability.providerConfig.label} /{' '}
                      {availability.modelCatalogItem.label}
                    </span>
                  )}
              </div>
              <div className="mt-2 text-xs text-slate-400">
                {executionMeta.message}
              </div>
              <div className="mt-3 grid gap-2 text-xs text-slate-400 md:grid-cols-2">
                <div className="rounded border border-slate-800 bg-slate-950/80 px-3 py-2">
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {t(language, 'step.model')}
                  </div>
                  <div className="text-slate-300">
                    {availability.modelCatalogItem
                      ? `${availability.modelCatalogItem.label} (${availability.modelCatalogItem.modelName})`
                      : t(language, 'step.unbound')}
                  </div>
                </div>
                <div className="rounded border border-slate-800 bg-slate-950/80 px-3 py-2">
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {t(language, 'step.provider')}
                  </div>
                  <div className="text-slate-300">
                    {availability.providerConfig?.label ||
                      t(language, 'step.unbound')}
                  </div>
                </div>
                <div className="rounded border border-slate-800 bg-slate-950/80 px-3 py-2">
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {t(language, 'step.temperature')}
                  </div>
                  <div className="text-slate-300">
                    {step.execution?.temperature ?? t(language, 'step.default')}
                  </div>
                </div>
                <div className="rounded border border-slate-800 bg-slate-950/80 px-3 py-2">
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {t(language, 'step.maxTokens')}
                  </div>
                  <div className="text-slate-300">
                    {step.execution?.maxTokens ?? t(language, 'step.default')}
                  </div>
                </div>
              </div>
              <div className="mt-3 rounded border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-300">
                <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {t(language, 'step.systemPrompt')}
                </div>
                <div className="whitespace-pre-wrap break-words">
                  {step.execution?.systemPrompt?.trim() ||
                    t(language, 'step.notSet')}
                </div>
              </div>
            </div>
          )}

          <PromptEditor
            language={language}
            label={t(language, 'step.prompt')}
            templateContent={rawContent}
            interpolatedContent={interpolated}
            originalTemplateContent={step.content || ''}
            onUpdateOverride={(content) =>
              onUpdateProject(project.id, {
                stepOverrides: {
                  ...project.stepOverrides,
                  [step.id]: { content },
                },
              })
            }
            onRevert={() => {
              const nextOverrides = { ...project.stepOverrides };
              delete nextOverrides[step.id];
              onUpdateProject(project.id, { stepOverrides: nextOverrides });
            }}
            onSaveToTemplate={(content) =>
              onRequestConfirm(
                t(language, 'editor.saveTitle'),
                t(language, 'editor.saveMessage'),
                () => {
                  onUpdateTemplate(template.id, {
                    steps: template.steps.map((item) =>
                      item.id === step.id ? { ...item, content } : item
                    ),
                  });
                  const nextOverrides = { ...project.stepOverrides };
                  delete nextOverrides[step.id];
                  onUpdateProject(project.id, { stepOverrides: nextOverrides });
                }
              )
            }
          />

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
            {configuredBinding && (
              <span className="text-violet-400">
                {`${t(language, 'step.outputVar')} {{${configuredBinding.variableKey}}}`}
              </span>
            )}
            {viewMode === 'detail' &&
              referencedSourceSteps.slice(0, 2).map((sourceStep) => (
                <button
                  key={sourceStep.stepId}
                  onClick={() => scrollToStep(sourceStep.stepId)}
                  className="text-amber-400 transition-colors hover:text-amber-300"
                >
                  {t(language, 'step.source')}: {sourceStep.stepName}
                </button>
              ))}
          </div>

          {viewMode === 'detail' &&
            (missingKeys.length > 0 || staleKeys.length > 0) && (
              <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-xs text-slate-400">
                {missingKeys.length > 0 && (
                  <div className="break-words">
                    <span className="font-bold text-red-400">
                      {t(language, 'step.missing')}:
                    </span>{' '}
                    <span className="text-red-200/80">
                      {missingKeys.map((key) => `{{${key}}}`).join(' , ')}
                    </span>
                  </div>
                )}
                {staleKeys.length > 0 && (
                  <div className="mt-1 break-words">
                    <span className="font-bold text-amber-400">
                      {language === 'zh-CN'
                        ? '引用变量已更新，当前提示词需要刷新'
                        : 'Referenced vars changed, prompt should be refreshed'}
                      :
                    </span>{' '}
                    <span className="text-amber-200/80">
                      {staleKeys.map((key) => `{{${key}}}`).join(' , ')}
                    </span>
                  </div>
                )}
              </div>
            )}

          <div className="mt-4 border-t border-slate-800/50 pt-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-600">
                {t(language, 'step.result')} ({t(language, 'step.resultHint')})
              </label>
              <div className="flex items-center gap-2">
                {configuredBinding && (
                  <span className="font-mono text-[10px] text-violet-400">
                    {`{{${configuredBinding.variableKey}}}`}
                  </span>
                )}
                <button
                  onClick={onToggleResults}
                  className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-bold text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
                >
                  {isResultExpanded
                    ? language === 'zh-CN'
                      ? '收起结果'
                      : 'Collapse result'
                    : language === 'zh-CN'
                      ? '展开结果'
                      : 'Expand result'}
                </button>
              </div>
            </div>
            {!isResultExpanded && (
              <div className="mb-2 rounded-xl border border-slate-800/60 bg-slate-950/40 px-3 py-2 text-xs text-slate-400">
                {getResultPreview(resultValue)}
              </div>
            )}
            <div
              className={`overflow-y-auto rounded-xl border border-slate-800/60 bg-slate-950/50 px-3 py-2.5 transition-all hover:border-slate-700 ${
                isResultExpanded ? 'max-h-[420px]' : 'max-h-28'
              }`}
            >
              <AutoResizeTextarea
                className="font-sans text-sm leading-relaxed text-slate-400"
                value={resultValue}
                onChange={(value) =>
                  onUpdateProject(project.id, {
                    stepOutputs: { ...project.stepOutputs, [step.id]: value },
                    stepOutputMeta: {
                      ...project.stepOutputMeta,
                      [step.id]: {
                        ...(project.stepOutputMeta?.[step.id] || {}),
                        updatedAt: Date.now(),
                      },
                    },
                  })
                }
                placeholder={t(language, 'step.resultPlaceholder')}
              />
            </div>
            <div className="mt-2 flex justify-end">
              <button
                onClick={() =>
                  onUpdateProject(project.id, {
                    stepOutputs: { ...project.stepOutputs, [step.id]: '' },
                    stepOutputMeta: {
                      ...project.stepOutputMeta,
                      [step.id]: {
                        ...(project.stepOutputMeta?.[step.id] || {}),
                        updatedAt: Date.now(),
                      },
                    },
                  })
                }
                className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-tighter text-slate-600 transition-colors hover:bg-red-500/10 hover:text-red-400"
              >
                {t(language, 'step.clear')}
              </button>
            </div>
          </div>

          {viewMode === 'detail' && (
            <ProjectRunLogPanel
              language={language}
              stepId={step.id}
              stepLogs={stepLogs}
              visibleLogs={visibleLogs}
              isLogsExpanded={isLogsExpanded}
              runState={runState}
              runError={runError}
              viewMode={viewMode}
              onToggleLogs={onToggleLogs}
              onRequestClearLogs={() =>
                onRequestConfirm(
                  t(language, 'step.clearStepLogsTitle'),
                  t(language, 'step.clearStepLogsMessage'),
                  () => {
                    onClearStepRunLogs(step.id);
                  }
                )
              }
              onCopyLogText={onCopyLogText}
              onRestoreLogOutput={onRestoreLogOutput}
            />
          )}
        </div>
      )}
    </div>
  );
};
