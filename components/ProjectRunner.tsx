import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ModelCatalogItem,
  ProducerAutomationStepState,
  ProducerRunScope,
  ProducerRunResultItem,
  Project,
  ProviderConfig,
  StepFlowStatus,
  StepRunState,
  Template,
  UiLanguage,
} from '../types';
import { t } from '../services/i18n';
import { FloatingToast, useToast } from './FloatingToast';
import { ProjectPreviewPanel } from './project-runner/ProjectPreviewPanel';
import { ProducerRunPreflightModal } from './project-runner/ProducerRunPreflightModal';
import {
  ProducerRunProgressModal,
  ProducerRunProgressState,
} from './project-runner/ProducerRunProgressModal';
import { ProjectStepCard } from './project-runner/ProjectStepCard';
import { buildProducerPreflight, ProducerPreflight } from '../services/stepGraphService';

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

type ViewMode = 'compact' | 'detail';

const createInitialProducerRunProgress = (): ProducerRunProgressState => ({
  isOpen: false,
  isRunning: false,
  total: 0,
  processed: 0,
  currentStepName: '',
  successCount: 0,
  errorCount: 0,
  skippedCount: 0,
  results: [],
  stopRequested: false,
});

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
  const [expandedResults, setExpandedResults] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<ViewMode>('compact');
  const [isResizingRight, setIsResizingRight] = useState(false);
  const [runStates, setRunStates] = useState<Record<string, StepRunState>>({});
  const [runErrors, setRunErrors] = useState<Record<string, string>>({});
  const [producerPreflight, setProducerPreflight] = useState<ProducerPreflight | null>(null);
  const [producerRunScope, setProducerRunScope] = useState<ProducerRunScope>('changed_only');
  const [selectedOverwriteStepIds, setSelectedOverwriteStepIds] = useState<string[]>([]);
  const [producerStepStates, setProducerStepStates] = useState<
    Record<string, { state: ProducerAutomationStepState; reason?: string }>
  >({});
  const [producerRunProgress, setProducerRunProgress] = useState<ProducerRunProgressState>(
    createInitialProducerRunProgress()
  );
  const stopProducerRunRef = useRef(false);
  const { toasts, showToast, removeToast } = useToast();

  const projectLogCount = useMemo(
    () =>
      (Object.values(project.stepRunLogs || {}) as Array<unknown[]>).reduce(
        (total, logs) => total + logs.length,
        0
      ),
    [project.stepRunLogs]
  );

  const getVariableByKey = (key: string) =>
    (project.variables || []).find((variable) => variable.key === key);

  const getStepStatus = (stepId: string): StepFlowStatus => {
    const output = project.stepOutputs[stepId] || '';
    if (!output.trim()) return 'empty';

    const boundVariable = (project.variables || []).find(
      (variable) =>
        variable.sourceType === 'step_output' && variable.sourceRef === stepId
    );
    if (!boundVariable) return 'draft';

    if (String(boundVariable.value || '') === output) {
      return 'saved';
    }
    return 'stale';
  };

  const getStatusMeta = (status: StepFlowStatus) => {
    switch (status) {
      case 'saved':
        return {
          label: t(language, 'step.synced'),
          className:
            'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        };
      case 'stale':
        return {
          label: language === 'zh-CN' ? '结果已更新' : 'Updated',
          className: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        };
      case 'draft':
        return {
          label: t(language, 'step.draft'),
          className: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        };
      default:
        return {
          label: t(language, 'step.empty'),
          className: 'bg-slate-800 text-slate-500 border-slate-700',
        };
    }
  };

  const getRunStateMeta = (state: StepRunState) => {
    switch (state) {
      case 'running':
        return {
          label: t(language, 'step.running'),
          className: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
        };
      case 'success':
        return {
          label: t(language, 'step.done'),
          className:
            'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
        };
      case 'error':
        return {
          label: t(language, 'step.failed'),
          className: 'bg-red-500/10 text-red-300 border-red-500/20',
        };
      default:
        return {
          label: t(language, 'step.idle'),
          className: 'bg-slate-800/60 text-slate-300 border-slate-700',
        };
    }
  };

  const interpolate = (templateStr: string): string => {
    if (!templateStr) return '';
    let result = templateStr;
    const variableMap = Object.fromEntries(
      (project.variables || []).map((variable) => [
        variable.key,
        variable.value || '',
      ])
    );

    result = result.replace(
      /\{\{([^}]+)\}\}/g,
      (_, rawKey) => variableMap[String(rawKey).trim()] || ''
    );

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
      if (newWidth > 250 && newWidth < 1000) {
        onRightPanelWidthChange(newWidth);
      }
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
    showToast(
      t(language, 'toast.copied', { label: '' }).trim(),
      event.clientX,
      event.clientY
    );
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
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const executeStepWithUi = async (
    stepId: string,
    options: { showSuccessToast?: boolean } = {}
  ) => {
    setRunStates((prev) => ({ ...prev, [stepId]: 'running' }));
    setRunErrors((prev) => ({ ...prev, [stepId]: '' }));
    try {
      await onRunStep(stepId);
      setRunStates((prev) => ({ ...prev, [stepId]: 'success' }));
      if (options.showSuccessToast !== false) {
        showToast(t(language, 'toast.generated'), Math.max(120, window.innerWidth / 2), 72);
      }
      return { ok: true as const };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t(language, 'step.failed');
      setRunStates((prev) => ({ ...prev, [stepId]: 'error' }));
      setRunErrors((prev) => ({ ...prev, [stepId]: message }));
      return { ok: false as const, message };
    }
  };

  const runStep = async (stepId: string) => {
    await executeStepWithUi(stepId, { showSuccessToast: true });
  };

  const openProducerPreflight = () => {
    const nextPreflight = buildProducerPreflight({
      project,
      template,
      modelCatalog,
      providerConfigs,
      scope: producerRunScope,
    });
    setProducerPreflight(nextPreflight);
    setSelectedOverwriteStepIds([]);
  };

  const closeProducerPreflight = () => {
    setProducerPreflight(null);
    setSelectedOverwriteStepIds([]);
  };

  const closeProducerRunProgress = () => {
    if (producerRunProgress.isRunning) return;
    setProducerRunProgress(createInitialProducerRunProgress());
  };

  useEffect(() => {
    if (!producerPreflight) return;
    const nextPreflight = buildProducerPreflight({
      project,
      template,
      modelCatalog,
      providerConfigs,
      scope: producerRunScope,
    });
    setProducerPreflight(nextPreflight);
    setSelectedOverwriteStepIds((prev) =>
      prev.filter((stepId) => nextPreflight.existingResultStepIds.includes(stepId))
    );
  }, [producerPreflight !== null, producerRunScope, project, template, modelCatalog, providerConfigs]);

  const toggleProducerOverwriteStep = (stepId: string) => {
    setSelectedOverwriteStepIds((prev) =>
      prev.includes(stepId) ? prev.filter((id) => id !== stepId) : [...prev, stepId]
    );
  };

  const startProducerRunLegacy = async () => {
    if (!producerPreflight) return;

    const selectedOverwriteIds = new Set(selectedOverwriteStepIds);
    const selectedStepIds = new Set([
      ...producerPreflight.readyStepIds,
      ...selectedOverwriteStepIds,
    ]);
    const queuedStepIds = producerPreflight.orderedStepIds.filter((stepId) =>
      selectedStepIds.has(stepId)
    );

    const itemByStepId = new Map<string, ProducerPreflight['items'][number]>(
      producerPreflight.items.map((item) => [item.stepId, item] as const)
    );
    const initialResults: ProducerRunResultItem[] = producerPreflight.existingResultStepIds
      .filter((stepId) => !selectedOverwriteIds.has(stepId))
      .map((stepId) => {
        const item = itemByStepId.get(stepId);
        return {
          stepId,
          stepName: item?.stepName || stepId,
          outputVariableKey: item?.outputVariableKey || '',
          status: 'skipped',
          message:
            language === 'zh-CN'
              ? '已有结果，启动前选择了跳过覆盖。'
              : 'Existing result was kept and skipped before the run started.',
        } satisfies ProducerRunResultItem;
      });

    stopProducerRunRef.current = false;
    closeProducerPreflight();
    setProducerRunProgress({
      isOpen: true,
      isRunning: true,
      total: queuedStepIds.length,
      processed: 0,
      currentStepName: '',
      successCount: 0,
      errorCount: 0,
      skippedCount: initialResults.length,
      results: initialResults,
      stopRequested: false,
    });

    let processed = 0;
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = initialResults.length;
    const results = [...initialResults];

    for (let index = 0; index < queuedStepIds.length; index += 1) {
      const stepId = queuedStepIds[index];
      const item = itemByStepId.get(stepId);
      const stepName = item?.stepName || stepId;
      const outputVariableKey = item?.outputVariableKey || '';

      setProducerRunProgress((prev) => ({
        ...prev,
        currentStepName: stepName,
        processed,
        successCount,
        errorCount,
        skippedCount,
        results: [...results],
      }));

      const outcome = await executeStepWithUi(stepId, { showSuccessToast: false });
      processed += 1;

      if (outcome.ok) {
        successCount += 1;
        results.push({
          stepId,
          stepName,
          outputVariableKey,
          status: 'success',
          message:
            language === 'zh-CN'
              ? `已更新 {{${outputVariableKey}}}`
              : `Updated {{${outputVariableKey}}}`,
        });
      } else {
        errorCount += 1;
        results.push({
          stepId,
          stepName,
          outputVariableKey,
          status: 'error',
          message: outcome.message,
        });
      }

      setProducerRunProgress((prev) => ({
        ...prev,
        processed,
        successCount,
        errorCount,
        skippedCount,
        results: [...results],
      }));

      if (stopProducerRunRef.current) {
        const remainingStepIds = queuedStepIds.slice(index + 1);
        remainingStepIds.forEach((remainingStepId) => {
          const remainingItem = itemByStepId.get(remainingStepId);
          results.push({
            stepId: remainingStepId,
            stepName: remainingItem?.stepName || remainingStepId,
            outputVariableKey: remainingItem?.outputVariableKey || '',
            status: 'stopped',
            message:
              language === 'zh-CN'
                ? '执行已停止，后续节点未继续运行。'
              : 'Execution was stopped before this node could run.',
          });
        });
        skippedCount += remainingStepIds.length;
        break;
      }
    }

    setProducerRunProgress({
      isOpen: true,
      isRunning: false,
      total: queuedStepIds.length,
      processed,
      currentStepName: '',
      successCount,
      errorCount,
      skippedCount,
      results,
      stopRequested: false,
    });
  };

  const startProducerRun = async () => {
    if (!producerPreflight) return;

    const selectedOverwriteIds = new Set(selectedOverwriteStepIds);
    const selectedStepIds = new Set([
      ...producerPreflight.readyStepIds,
      ...selectedOverwriteStepIds,
    ]);
    const queuedStepIds = producerPreflight.orderedStepIds.filter((stepId) =>
      selectedStepIds.has(stepId)
    );

    const itemByStepId = new Map<string, ProducerPreflight['items'][number]>(
      producerPreflight.items.map((item) => [item.stepId, item] as const)
    );

    const initialResults: ProducerRunResultItem[] = producerPreflight.items
      .filter((item) => {
        if (item.status === 'blocked' || item.status === 'skipped') return true;
        return item.status === 'existing_result' && !selectedOverwriteIds.has(item.stepId);
      })
      .map((item) => ({
        stepId: item.stepId,
        stepName: item.stepName,
        outputVariableKey: item.outputVariableKey,
        status: item.status === 'blocked' ? 'blocked' : 'skipped',
        message:
          item.status === 'blocked'
            ? item.reason || (language === 'zh-CN' ? '当前节点被阻塞。' : 'This node is blocked.')
            : item.status === 'skipped'
              ? item.reason ||
                (language === 'zh-CN'
                  ? '当前节点不在本次执行范围内。'
                  : 'This node is outside the current run scope.')
              : language === 'zh-CN'
                ? '已有结果，启动前选择了跳过覆盖。'
                : 'Existing result was kept and skipped before the run started.',
      }));

    const initialStepStates: Record<
      string,
      { state: ProducerAutomationStepState; reason?: string }
    > = {};
    producerPreflight.items.forEach((item) => {
      if (item.status === 'blocked') {
        initialStepStates[item.stepId] = { state: 'blocked', reason: item.reason };
      } else if (item.status === 'skipped') {
        initialStepStates[item.stepId] = { state: 'skipped', reason: item.reason };
      } else if (item.status === 'existing_result' && !selectedOverwriteIds.has(item.stepId)) {
        initialStepStates[item.stepId] = {
          state: 'skipped',
          reason:
            language === 'zh-CN'
              ? '已有结果，未选择覆盖。'
              : 'Existing result was kept and skipped.',
        };
      } else if (selectedStepIds.has(item.stepId)) {
        initialStepStates[item.stepId] = { state: 'queued' };
      }
    });

    stopProducerRunRef.current = false;
    setProducerStepStates(initialStepStates);
    closeProducerPreflight();
    setProducerRunProgress({
      isOpen: true,
      isRunning: true,
      total: queuedStepIds.length,
      processed: 0,
      currentStepName: '',
      successCount: 0,
      errorCount: 0,
      skippedCount: initialResults.length,
      results: initialResults,
      stopRequested: false,
    });

    let processed = 0;
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = initialResults.length;
    const results = [...initialResults];

    for (let index = 0; index < queuedStepIds.length; index += 1) {
      const stepId = queuedStepIds[index];
      const item = itemByStepId.get(stepId);
      const stepName = item?.stepName || stepId;
      const outputVariableKey = item?.outputVariableKey || '';

      setProducerRunProgress((prev) => ({
        ...prev,
        currentStepName: stepName,
        processed,
        successCount,
        errorCount,
        skippedCount,
        results: [...results],
      }));
      setProducerStepStates((prev) => ({
        ...prev,
        [stepId]: { state: 'running' },
      }));

      const outcome = await executeStepWithUi(stepId, { showSuccessToast: false });
      processed += 1;

      if (outcome.ok) {
        successCount += 1;
        results.push({
          stepId,
          stepName,
          outputVariableKey,
          status: 'success',
          message:
            language === 'zh-CN'
              ? `已更新 {{${outputVariableKey}}}`
              : `Updated {{${outputVariableKey}}}`,
        });
        setProducerStepStates((prev) => ({
          ...prev,
          [stepId]: { state: 'success' },
        }));
      } else {
        errorCount += 1;
        results.push({
          stepId,
          stepName,
          outputVariableKey,
          status: 'error',
          message: outcome.message,
        });
        setProducerStepStates((prev) => ({
          ...prev,
          [stepId]: { state: 'error', reason: outcome.message },
        }));
      }

      setProducerRunProgress((prev) => ({
        ...prev,
        processed,
        successCount,
        errorCount,
        skippedCount,
        results: [...results],
      }));

      if (stopProducerRunRef.current) {
        const remainingStepIds = queuedStepIds.slice(index + 1);
        remainingStepIds.forEach((remainingStepId) => {
          const remainingItem = itemByStepId.get(remainingStepId);
          const stopMessage =
            language === 'zh-CN'
              ? '执行已停止，后续节点未继续运行。'
              : 'Execution was stopped before this node could run.';
          results.push({
            stepId: remainingStepId,
            stepName: remainingItem?.stepName || remainingStepId,
            outputVariableKey: remainingItem?.outputVariableKey || '',
            status: 'stopped',
            message: stopMessage,
          });
          setProducerStepStates((prev) => ({
            ...prev,
            [remainingStepId]: { state: 'stopped', reason: stopMessage },
          }));
        });
        skippedCount += remainingStepIds.length;
        break;
      }
    }

    setProducerRunProgress({
      isOpen: true,
      isRunning: false,
      total: queuedStepIds.length,
      processed,
      currentStepName: '',
      successCount,
      errorCount,
      skippedCount,
      results,
      stopRequested: false,
    });
  };

  return (
    <div className={`flex h-full w-full ${fontSizeClass}`}>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto p-4 pb-32 md:p-6 no-scrollbar">
          <div className="mb-6 animate-in slide-in-from-top-2 px-1 duration-500 fade-in">
            <div className="group/title flex items-center gap-3">
              <div className="rounded-xl bg-blue-600/10 p-2 text-blue-500 transition-all duration-300 group-hover/title:bg-blue-600 group-hover/title:text-white">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  className="h-5 w-5"
                >
                  <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.596.892l-.848 2.047a.75.75 0 0 0 .98.98l2.047-.848a2.75 2.75 0 0 0 .892-.596l4.261-4.262a1.75 1.75 0 0 0 0-2.474Z" />
                </svg>
              </div>
              <input
                type="text"
                value={project.name}
                onChange={(event) =>
                  onUpdateProject(project.id, { name: event.target.value })
                }
                className="w-full max-w-2xl rounded-lg border-b-2 border-transparent bg-transparent px-2 py-1 text-2xl font-black tracking-tight text-white outline-none transition-all hover:bg-white/5 focus:border-blue-500/50"
                placeholder={t(language, 'project.untitled')}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    (event.target as HTMLInputElement).blur();
                  }
                }}
              />
            </div>
            <div className="mt-1.5 ml-12 flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-600">
              <span className="truncate">
                {t(language, 'project.template')}: {template.name}
              </span>
              <div className="h-1 w-1 rounded-full bg-slate-800" />
              <span className="truncate">
                {t(language, 'project.id')}: {project.id}
              </span>
              <div className="h-1 w-1 rounded-full bg-slate-800" />
              <div className="flex items-center gap-1 rounded-md border border-slate-800 bg-slate-950/70 p-1">
                <button
                  onClick={() => setViewMode('compact')}
                  className={`rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                    viewMode === 'compact'
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-500 hover:text-white'
                  }`}
                >
                  {t(language, 'project.compact')}
                </button>
                <button
                  onClick={() => setViewMode('detail')}
                  className={`rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                    viewMode === 'detail'
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-500 hover:text-white'
                  }`}
                >
                  {t(language, 'project.detail')}
                </button>
              </div>
              <div className="h-1 w-1 rounded-full bg-slate-800" />
              <button
                onClick={openProducerPreflight}
                className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-300 transition-colors hover:border-emerald-400/40 hover:text-white"
              >
                {t(language, 'project.updateProducers')}
              </button>
              {projectLogCount > 0 && (
                <>
                  <div className="h-1 w-1 rounded-full bg-slate-800" />
                  <button
                    onClick={() =>
                      onRequestConfirm(
                        t(language, 'project.clearLogsTitle'),
                        t(language, 'project.clearLogsMessage'),
                        () => {
                          onClearProjectRunLogs();
                        }
                      )
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
            {template.steps.map((step, index) => (
              <ProjectStepCard
                key={step.id}
                index={index}
                language={language}
                project={project}
                template={template}
                step={step}
                modelCatalog={modelCatalog}
                providerConfigs={providerConfigs}
                viewMode={viewMode}
                isCollapsed={Boolean(collapsedSteps[step.id])}
                isLogsExpanded={Boolean(expandedLogs[step.id])}
                isResultExpanded={Boolean(expandedResults[step.id])}
                runState={runStates[step.id] || 'idle'}
                runError={runErrors[step.id]}
                producerState={producerStepStates[step.id]?.state || 'idle'}
                producerStateReason={producerStepStates[step.id]?.reason}
                onToggleCollapse={() =>
                  setCollapsedSteps((prev) => ({
                    ...prev,
                    [step.id]: !prev[step.id],
                  }))
                }
                onToggleLogs={() =>
                  setExpandedLogs((prev) => ({
                    ...prev,
                    [step.id]: !prev[step.id],
                  }))
                }
                onToggleResults={() =>
                  setExpandedResults((prev) => ({
                    ...prev,
                    [step.id]: !prev[step.id],
                  }))
                }
                onRunStep={runStep}
                onUpdateProject={onUpdateProject}
                onUpdateTemplate={onUpdateTemplate}
                onClearStepRunLogs={onClearStepRunLogs}
                onRequestConfirm={onRequestConfirm}
                onQuickCopy={handleQuickCopy}
                onCopyLogText={handleCopyLogText}
                onRestoreLogOutput={restoreLogOutput}
                interpolate={interpolate}
                getVariableByKey={getVariableByKey}
                getStepStatus={getStepStatus}
                getStatusMeta={getStatusMeta}
                getRunStateMeta={getRunStateMeta}
                scrollToStep={scrollToStep}
              />
            ))}
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

      <ProjectPreviewPanel
        isOpen={isRightPanelOpen}
        rightPanelWidth={rightPanelWidth}
        language={language}
        project={project}
        template={template}
        onRightPanelOpenChange={onRightPanelOpenChange}
        onDoubleClickCopy={handleDoubleClickCopy}
        interpolate={interpolate}
      />

      <ProducerRunPreflightModal
        isOpen={Boolean(producerPreflight)}
        language={language}
        items={producerPreflight?.items || []}
        scope={producerRunScope}
        onScopeChange={setProducerRunScope}
        selectedOverwriteStepIds={selectedOverwriteStepIds}
        onToggleOverwrite={toggleProducerOverwriteStep}
        onSelectAllOverwrite={() =>
          setSelectedOverwriteStepIds(producerPreflight?.existingResultStepIds || [])
        }
        onSelectNoOverwrite={() => setSelectedOverwriteStepIds([])}
        onClose={closeProducerPreflight}
        onConfirm={() => {
          void startProducerRun();
        }}
      />

      <ProducerRunProgressModal
        language={language}
        state={producerRunProgress}
        onStop={() => {
          stopProducerRunRef.current = true;
          setProducerRunProgress((prev) => ({ ...prev, stopRequested: true }));
        }}
        onClose={closeProducerRunProgress}
      />

      <FloatingToast toasts={toasts} onRemove={removeToast} />
    </div>
  );
};
