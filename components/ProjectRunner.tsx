import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ModelCatalogItem,
  Project,
  ProviderConfig,
  StepExecutionAvailability,
  StepFlowStatus,
  StepRunLog,
  StepRunState,
  Template,
  UiLanguage,
} from '../types';
import { t } from '../services/i18n';
import { resolveStepExecutionAvailability } from '../services/modelService';
import { PromptEditor } from './PromptEditor';
import { FloatingToast, useToast } from './FloatingToast';

interface ProjectRunnerProps {
  project: Project;
  template: Template;
  language: UiLanguage;
  modelCatalog: ModelCatalogItem[];
  providerConfigs: ProviderConfig[];
  onUpdateProject: (projectId: string, updates: Partial<Project>) => void;
  onUpdateTemplate: (templateId: string, updates: Partial<Template>) => void;
  onRunStep: (stepId: string) => Promise<string>;
  onClearStepRunLogs: (stepId: string) => void;
  onClearProjectRunLogs: () => void;
  onRequestConfirm: (title: string, message: string, onConfirm: () => void) => void;
  fontSizeClass?: string;
  rightPanelWidth: number;
  onRightPanelWidthChange: (width: number) => void;
  isRightPanelOpen: boolean;
  onRightPanelOpenChange: (isOpen: boolean) => void;
}

const AutoResizeTextarea: React.FC<{
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}> = ({ value, onChange, placeholder, className }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = () => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = '0px';
    element.style.height = `${element.scrollHeight}px`;
  };

  useLayoutEffect(() => {
    adjustHeight();
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className={`block w-full resize-none overflow-hidden bg-transparent p-0 m-0 outline-none focus:ring-0 ${className}`}
      rows={1}
      spellCheck={false}
    />
  );
};

type ViewMode = 'compact' | 'detail';

const getExecutionMeta = (language: UiLanguage, availability: StepExecutionAvailability) => {
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

export const ProjectRunner: React.FC<ProjectRunnerProps> = ({
  project,
  template,
  language,
  modelCatalog,
  providerConfigs,
  onUpdateProject,
  onUpdateTemplate,
  onRunStep,
  onClearStepRunLogs,
  onClearProjectRunLogs,
  onRequestConfirm,
  fontSizeClass = 'text-sm',
  rightPanelWidth,
  onRightPanelWidthChange,
  isRightPanelOpen,
  onRightPanelOpenChange,
}) => {
  const [collapsedSteps, setCollapsedSteps] = useState<Record<string, boolean>>({});
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<ViewMode>('compact');
  const [isResizingRight, setIsResizingRight] = useState(false);
  const [runStates, setRunStates] = useState<Record<string, StepRunState>>({});
  const [runErrors, setRunErrors] = useState<Record<string, string>>({});
  const { toasts, showToast, removeToast } = useToast();

  const getVariableByKey = (key: string) => (project.variables || []).find((variable) => variable.key === key);

  const getStepStatus = (stepId: string): StepFlowStatus => {
    const output = project.stepOutputs[stepId] || '';
    if (!output.trim()) return 'empty';

    const meta = project.stepOutputMeta?.[stepId];
    const boundVariable = (project.variables || []).find(
      (variable) => variable.sourceType === 'step_output' && variable.sourceRef === stepId
    );
    if (!boundVariable) return 'draft';

    const lastSavedAt = meta?.lastSavedToVariableAt || 0;
    const updatedAt = meta?.updatedAt || 0;
    if (lastSavedAt >= updatedAt && boundVariable.updatedAt >= updatedAt) return 'saved';
    return 'stale';
  };

  const getStatusMeta = (status: StepFlowStatus) => {
    switch (status) {
      case 'saved':
        return { label: t(language, 'step.synced'), className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
      case 'stale':
        return { label: t(language, 'step.stale'), className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
      case 'draft':
        return { label: t(language, 'step.draft'), className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
      default:
        return { label: t(language, 'step.empty'), className: 'bg-slate-800 text-slate-500 border-slate-700' };
    }
  };

  const getRunStateMeta = (state: StepRunState) => {
    switch (state) {
      case 'running':
        return { label: t(language, 'step.running'), className: 'bg-blue-500/10 text-blue-300 border-blue-500/20' };
      case 'success':
        return { label: t(language, 'step.done'), className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' };
      case 'error':
        return { label: t(language, 'step.failed'), className: 'bg-red-500/10 text-red-300 border-red-500/20' };
      default:
        return { label: t(language, 'step.idle'), className: 'bg-slate-800/60 text-slate-300 border-slate-700' };
    }
  };

  const extractVariableKeys = (content: string) => {
    if (!content) return [];
    const matches = Array.from(content.matchAll(/\{\{([^}]+)\}\}/g));
    return Array.from(new Set(matches.map((match) => String(match[1]).trim()).filter(Boolean)));
  };

  const getDependencyState = (content: string) => {
    const referencedKeys = extractVariableKeys(content);
    const missingKeys: string[] = [];
    const staleKeys: string[] = [];

    referencedKeys.forEach((key) => {
      const variable = getVariableByKey(key);
      if (!variable || !String(variable.value || '').trim()) {
        missingKeys.push(key);
        return;
      }

      if (variable.sourceType === 'step_output' && variable.sourceRef) {
        const sourceStatus = getStepStatus(variable.sourceRef);
        if (sourceStatus === 'stale') staleKeys.push(key);
      }
    });

    return { referencedKeys, missingKeys, staleKeys };
  };

  const interpolate = (templateStr: string): string => {
    if (!templateStr) return '';
    let result = templateStr;
    const variableMap = Object.fromEntries((project.variables || []).map((variable) => [variable.key, variable.value || '']));

    result = result.replace(/\{\{([^}]+)\}\}/g, (_, rawKey) => variableMap[String(rawKey).trim()] || '');

    template.inputs.forEach((input, index) => {
      const value = project.inputValues[input.id] || '';
      result = result.split(`<${index}>`).join(value);
      result = result.split(`<${input.label}>`).join(value);
    });

    (project.customInputs || []).forEach((input, index) => {
      const value = project.inputValues[input.id] || '';
      result = result.split(`<l${index + 1}>`).join(value);
      result = result.split(`<${input.label}>`).join(value);
    });

    template.steps.forEach((step, index) => {
      const output = project.stepOutputs[step.id] || '';
      result = result.split(`[[${index + 1}]]`).join(output);
      result = result.split(`[[${step.name}]]`).join(output);
    });

    return result;
  };

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isResizingRight) return;
      const newWidth = window.innerWidth - event.clientX;
      if (newWidth > 250 && newWidth < 1000) onRightPanelWidthChange(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizingRight(false);
      document.body.style.cursor = 'default';
    };

    if (isResizingRight) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingRight, onRightPanelWidthChange]);

  const handleDoubleClickCopy = (content: string, event: React.MouseEvent) => {
    navigator.clipboard.writeText(content);
    showToast(t(language, 'toast.copied', { label: '' }).trim(), event.clientX, event.clientY);
  };

  const handleQuickCopy = async (content: string, label: string) => {
    if (!content.trim()) return;
    await navigator.clipboard.writeText(content);
    showToast(t(language, 'toast.copied', { label }), Math.max(120, window.innerWidth / 2), 72);
  };

  const handleCopyLogText = async (content: string, label: string) => {
    if (!content.trim()) return;
    await navigator.clipboard.writeText(content);
    showToast(t(language, 'toast.copied', { label }), Math.max(120, window.innerWidth / 2), 72);
  };

  const restoreLogOutput = (stepId: string, output: string) => {
    if (!output.trim()) return;
    onUpdateProject(project.id, {
      stepOutputs: { ...project.stepOutputs, [stepId]: output },
      stepOutputMeta: {
        ...project.stepOutputMeta,
        [stepId]: {
          ...(project.stepOutputMeta?.[stepId] || {}),
          updatedAt: Date.now(),
        },
      },
    });
    showToast(t(language, 'toast.restored'), Math.max(120, window.innerWidth / 2), 72);
  };

  const scrollToStep = (stepId: string) => {
    const element = document.getElementById(stepId);
    if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const runStep = async (stepId: string) => {
    setRunStates((prev) => ({ ...prev, [stepId]: 'running' }));
    setRunErrors((prev) => ({ ...prev, [stepId]: '' }));
    try {
      await onRunStep(stepId);
      setRunStates((prev) => ({ ...prev, [stepId]: 'success' }));
      showToast(t(language, 'toast.generated'), Math.max(120, window.innerWidth / 2), 72);
    } catch (error) {
      const message = error instanceof Error ? error.message : t(language, 'step.failed');
      setRunStates((prev) => ({ ...prev, [stepId]: 'error' }));
      setRunErrors((prev) => ({ ...prev, [stepId]: message }));
    }
  };

  const projectLogGroups = Object.values(project.stepRunLogs || {}) as StepRunLog[][];
  const projectLogCount = projectLogGroups.reduce((total, logs) => total + logs.length, 0);

  return (
    <div className={`flex h-full w-full ${fontSizeClass}`}>
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 pb-32 no-scrollbar">
          <div className="mb-6 px-1 animate-in fade-in slide-in-from-top-2 duration-500">
            <div className="group/title flex items-center gap-3">
              <div className="rounded-xl bg-blue-600/10 p-2 text-blue-500 transition-all duration-300 group-hover/title:bg-blue-600 group-hover/title:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-5 h-5">
                  <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.596.892l-.848 2.047a.75.75 0 0 0 .98.98l2.047-.848a2.75 2.75 0 0 0 .892-.596l4.261-4.262a1.75 1.75 0 0 0 0-2.474Z" />
                </svg>
              </div>
              <input
                type="text"
                value={project.name}
                onChange={(event) => onUpdateProject(project.id, { name: event.target.value })}
                className="w-full max-w-2xl rounded-lg border-b-2 border-transparent bg-transparent px-2 py-1 text-2xl font-black tracking-tight text-white outline-none transition-all hover:bg-white/5 focus:border-blue-500/50"
                placeholder={t(language, 'project.untitled')}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
                }}
              />
            </div>
            <div className="mt-1.5 ml-12 flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-600">
              <span className="truncate">{t(language, 'project.template')}: {template.name}</span>
              <div className="h-1 w-1 rounded-full bg-slate-800" />
              <span className="truncate">{t(language, 'project.id')}: {project.id}</span>
              <div className="h-1 w-1 rounded-full bg-slate-800" />
              <div className="flex items-center gap-1 rounded-md border border-slate-800 bg-slate-950/70 p-1">
                <button
                  onClick={() => setViewMode('compact')}
                  className={`rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                    viewMode === 'compact' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-white'
                  }`}
                >
                  {t(language, 'project.compact')}
                </button>
                <button
                  onClick={() => setViewMode('detail')}
                  className={`rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                    viewMode === 'detail' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-white'
                  }`}
                >
                  {t(language, 'project.detail')}
                </button>
              </div>
              {projectLogCount > 0 && (
                <>
                  <div className="h-1 w-1 rounded-full bg-slate-800" />
                  <button
                    onClick={() =>
                      onRequestConfirm(t(language, 'project.clearLogsTitle'), t(language, 'project.clearLogsMessage'), () => {
                        onClearProjectRunLogs();
                      })
                    }
                    className="text-[10px] font-black uppercase tracking-widest text-slate-500 transition-colors hover:text-red-400"
                  >
                    {t(language, 'project.clearLogs')} ({projectLogCount})
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="w-full space-y-5">
            {template.steps.map((step, index) => {
              const override = project.stepOverrides[step.id];
              const rawContent = override?.content !== undefined ? override.content : step.content || '';
              const interpolated = interpolate(rawContent);
              const isCollapsed = collapsedSteps[step.id];
              const configuredBinding = step.outputBinding?.variableKey ? step.outputBinding : null;
              const stepStatus = getStepStatus(step.id);
              const statusMeta = getStatusMeta(stepStatus);
              const dependencyState = getDependencyState(rawContent);
              const riskMeta =
                dependencyState.missingKeys.length > 0
                  ? {
                      className: 'bg-red-500/10 text-red-400 border-red-500/20',
                      label: t(language, 'step.missingVars', { count: dependencyState.missingKeys.length }),
                    }
                  : dependencyState.staleKeys.length > 0
                    ? {
                        className: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                        label: t(language, 'step.staleDeps', { count: dependencyState.staleKeys.length }),
                      }
                    : null;

              const availability = resolveStepExecutionAvailability({
                step,
                template,
                modelCatalog,
                providerConfigs,
              });
              const executionMeta = getExecutionMeta(language, availability);
              const runState = runStates[step.id] || 'idle';
              const runStateMeta = getRunStateMeta(runState);
              const stepLogs = (project.stepRunLogs?.[step.id] || []) as StepRunLog[];
              const latestLog = stepLogs[stepLogs.length - 1];
              const isLogsExpanded = expandedLogs[step.id];
              const visibleLogs = isLogsExpanded ? [...stepLogs].reverse() : latestLog ? [latestLog] : [];

              const referencedSourceSteps = dependencyState.referencedKeys
                .map((key) => getVariableByKey(key))
                .filter((variable): variable is Exclude<typeof variable, undefined> => Boolean(variable?.sourceType === 'step_output' && variable.sourceRef))
                .map((variable) => ({
                  key: variable.key,
                  stepId: variable.sourceRef as string,
                  stepName: template.steps.find((item) => item.id === variable.sourceRef)?.name || variable.sourceRef || variable.key,
                }))
                .filter((item, itemIndex, array) => array.findIndex((candidate) => candidate.stepId === item.stepId) === itemIndex);

              return (
                <div
                  key={step.id}
                  id={step.id}
                  className="scroll-mt-8 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40 shadow-sm transition-all duration-300"
                >
                  <div
                    className="flex cursor-pointer items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 px-4 py-3 transition-colors hover:bg-slate-800/80"
                    onClick={() => setCollapsedSteps((prev) => ({ ...prev, [step.id]: !isCollapsed }))}
                  >
                    <div className="min-w-0 flex items-center gap-3">
                      <span className="rounded-md bg-slate-800 px-2 py-0.5 font-mono text-xs font-bold text-slate-500">{index + 1}</span>
                      <h3 className="truncate text-sm font-black tracking-tight text-slate-200">{step.name}</h3>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] ${statusMeta.className}`}>{statusMeta.label}</span>
                      {riskMeta && (
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] ${riskMeta.className}`}>{riskMeta.label}</span>
                      )}
                      {availability.status !== 'manual' && (
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] ${executionMeta.className}`}>{executionMeta.badge}</span>
                      )}
                      {runState !== 'idle' && (
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] ${runStateMeta.className}`}>{runStateMeta.label}</span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleQuickCopy(interpolated, t(language, 'toast.result'));
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
                            void runStep(step.id);
                          }}
                          disabled={!availability.isRunnable || runState === 'running'}
                          className={`rounded-md border px-2.5 py-1 text-[10px] font-bold transition-colors ${
                            availability.isRunnable && runState !== 'running'
                              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:border-emerald-400/40 hover:text-white'
                              : 'border-slate-700 bg-slate-900 text-slate-500'
                          }`}
                        >
                          {runState === 'running' ? t(language, 'step.running') : t(language, 'step.generate')}
                        </button>
                      )}
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-5 h-5 text-slate-600 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}>
                        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" />
                      </svg>
                    </div>
                  </div>

                  {!isCollapsed && (
                    <div className="bg-slate-900/20 p-4">
                      {viewMode === 'detail' && availability.status !== 'manual' && (
                        <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] ${executionMeta.className}`}>{executionMeta.badge}</span>
                            {availability.providerConfig && availability.modelCatalogItem && (
                              <span className="text-xs text-slate-300">
                                {availability.providerConfig.label} / {availability.modelCatalogItem.label}
                              </span>
                            )}
                          </div>
                          <div className="mt-2 text-xs text-slate-400">{executionMeta.message}</div>
                          <div className="mt-3 grid gap-2 text-xs text-slate-400 md:grid-cols-2">
                            <div className="rounded border border-slate-800 bg-slate-950/80 px-3 py-2">
                              <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{t(language, 'step.model')}</div>
                              <div className="text-slate-300">
                                {availability.modelCatalogItem
                                  ? `${availability.modelCatalogItem.label} (${availability.modelCatalogItem.modelName})`
                                  : t(language, 'step.unbound')}
                              </div>
                            </div>
                            <div className="rounded border border-slate-800 bg-slate-950/80 px-3 py-2">
                              <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{t(language, 'step.provider')}</div>
                              <div className="text-slate-300">{availability.providerConfig?.label || t(language, 'step.unbound')}</div>
                            </div>
                            <div className="rounded border border-slate-800 bg-slate-950/80 px-3 py-2">
                              <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{t(language, 'step.temperature')}</div>
                              <div className="text-slate-300">{step.execution?.temperature ?? t(language, 'step.default')}</div>
                            </div>
                            <div className="rounded border border-slate-800 bg-slate-950/80 px-3 py-2">
                              <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{t(language, 'step.maxTokens')}</div>
                              <div className="text-slate-300">{step.execution?.maxTokens ?? t(language, 'step.default')}</div>
                            </div>
                          </div>
                          <div className="mt-3 rounded border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-300">
                            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{t(language, 'step.systemPrompt')}</div>
                            <div className="whitespace-pre-wrap break-words">{step.execution?.systemPrompt?.trim() || t(language, 'step.notSet')}</div>
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
                            stepOverrides: { ...project.stepOverrides, [step.id]: { content } },
                          })
                        }
                        onRevert={() => {
                          const nextOverrides = { ...project.stepOverrides };
                          delete nextOverrides[step.id];
                          onUpdateProject(project.id, { stepOverrides: nextOverrides });
                        }}
                        onSaveToTemplate={(content) =>
                          onRequestConfirm(t(language, 'editor.saveTitle'), t(language, 'editor.saveMessage'), () => {
                            onUpdateTemplate(template.id, {
                              steps: template.steps.map((item) => (item.id === step.id ? { ...item, content } : item)),
                            });
                            const nextOverrides = { ...project.stepOverrides };
                            delete nextOverrides[step.id];
                            onUpdateProject(project.id, { stepOverrides: nextOverrides });
                          })
                        }
                      />

                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
                        {configuredBinding && <span className="text-violet-400">{`${t(language, 'step.outputVar')} {{${configuredBinding.variableKey}}}`}</span>}
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

                      {(dependencyState.missingKeys.length > 0 || dependencyState.staleKeys.length > 0) && (
                        <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-xs text-slate-400">
                          {dependencyState.missingKeys.length > 0 && (
                            <div className="break-words">
                              <span className="font-bold text-red-400">{t(language, 'step.missing')}:</span>{' '}
                              <span className="text-red-200/80">{dependencyState.missingKeys.map((key) => `{{${key}}}`).join(' , ')}</span>
                            </div>
                          )}
                          {dependencyState.staleKeys.length > 0 && (
                            <div className="mt-1 break-words">
                              <span className="font-bold text-amber-400">{t(language, 'step.staleLabel')}:</span>{' '}
                              <span className="text-amber-200/80">{dependencyState.staleKeys.map((key) => `{{${key}}}`).join(' , ')}</span>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="mt-4 border-t border-slate-800/50 pt-4">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-600">
                            {t(language, 'step.result')} ({t(language, 'step.resultHint')})
                          </label>
                          {configuredBinding && <span className="font-mono text-[10px] text-violet-400">{`{{${configuredBinding.variableKey}}}`}</span>}
                        </div>
                        <div className="rounded-xl border border-slate-800/60 bg-slate-950/50 px-3 py-2.5 transition-colors hover:border-slate-700">
                          <AutoResizeTextarea
                            className="min-h-[52px] font-sans text-sm leading-relaxed text-slate-400"
                            value={project.stepOutputs[step.id] || ''}
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

                      {(viewMode === 'detail' || runState === 'error' || latestLog) && (
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
                                  onClick={() => setExpandedLogs((prev) => ({ ...prev, [step.id]: !prev[step.id] }))}
                                  className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-[10px] font-bold text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
                                >
                                  {isLogsExpanded ? t(language, 'step.hideHistory') : t(language, 'step.showHistory')}
                                </button>
                              )}
                              {stepLogs.length > 0 && (
                                <button
                                  onClick={() =>
                                    onRequestConfirm(t(language, 'step.clearStepLogsTitle'), t(language, 'step.clearStepLogsMessage'), () => {
                                      onClearStepRunLogs(step.id);
                                    })
                                  }
                                  className="rounded-md border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-[10px] font-bold text-red-300 transition-colors hover:border-red-400/40 hover:text-white"
                                >
                                  {t(language, 'step.clearStepLogs')}
                                </button>
                              )}
                            </div>
                          </div>

                          {runState === 'error' && runErrors[step.id] && stepLogs.length === 0 && (
                            <div className="mt-3 rounded border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-300">
                              {runErrors[step.id]}
                            </div>
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

                                  {viewMode === 'compact' && !isLogsExpanded ? (
                                    <div className="mt-2 text-xs text-slate-400">
                                      {log.status === 'success'
                                        ? t(language, 'step.latestResult', {
                                            text: `${(log.output || '').slice(0, 96)}${(log.output || '').length > 96 ? '...' : ''}`,
                                          })
                                        : t(language, 'step.latestError', {
                                            text: `${(log.error || '').slice(0, 96)}${(log.error || '').length > 96 ? '...' : ''}`,
                                          })}
                                    </div>
                                  ) : (
                                    <>
                                      <div className="mt-3 flex flex-wrap gap-2">
                                        <button
                                          onClick={() => {
                                            void handleCopyLogText(log.systemPrompt || '', t(language, 'toast.systemPrompt'));
                                          }}
                                          className="rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1 text-[10px] font-bold text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
                                        >
                                          {t(language, 'step.copySystem')}
                                        </button>
                                        <button
                                          onClick={() => {
                                            void handleCopyLogText(log.userPrompt || '', t(language, 'toast.userPrompt'));
                                          }}
                                          className="rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1 text-[10px] font-bold text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
                                        >
                                          {t(language, 'step.copyUser')}
                                        </button>
                                        <button
                                          onClick={() => {
                                            void handleCopyLogText(
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
                                            onClick={() => restoreLogOutput(step.id, log.output)}
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
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {isRightPanelOpen && (
        <div
          className="w-1.5 flex-shrink-0 cursor-col-resize bg-slate-800 transition-colors hover:bg-blue-600"
          onMouseDown={(event) => {
            event.preventDefault();
            setIsResizingRight(true);
          }}
        />
      )}

      <div
        style={{ width: isRightPanelOpen ? rightPanelWidth : '40px' }}
        className="relative flex flex-shrink-0 flex-col border-l border-slate-800 bg-slate-900 transition-all duration-75"
      >
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900 px-2.5 py-2">
          {isRightPanelOpen && <span className="truncate pl-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">{t(language, 'project.liveOutline')}</span>}
          <button onClick={() => onRightPanelOpenChange(!isRightPanelOpen)} className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-white">
            {isRightPanelOpen ? t(language, 'project.hide') : t(language, 'project.show')}
          </button>
        </div>
        {isRightPanelOpen && (
          <div className="flex-1 overflow-y-auto bg-slate-950/30 p-4 space-y-5 no-scrollbar">
            {template.steps.map((step, idx) => {
              const override = project.stepOverrides[step.id];
              const content = interpolate(override?.content !== undefined ? override.content : step.content || '');
              return (
                <div key={step.id} className="group relative">
                  <div className="mb-2 flex items-center gap-2.5">
                    <span className="text-[10px] font-mono font-bold text-slate-600">&lt;{idx + 1}&gt;</span>
                    <span className="truncate text-xs font-black uppercase tracking-tight text-slate-500">{step.name}</span>
                  </div>
                  <div
                    onDoubleClick={(event) => handleDoubleClickCopy(content, event)}
                    className="relative cursor-copy select-none whitespace-pre-wrap break-words border-l-2 border-slate-800 pl-3 py-1.5 font-mono text-[13px] leading-relaxed text-slate-300 transition-colors group-hover:border-blue-500/30 active:bg-blue-500/5"
                    title={t(language, 'project.doubleClickToCopy')}
                  >
                    {content}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <FloatingToast toasts={toasts} onRemove={removeToast} />
    </div>
  );
};
