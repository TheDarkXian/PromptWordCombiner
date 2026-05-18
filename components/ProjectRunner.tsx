import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ExecuteProjectStepOptions,
  ExecuteProjectStepResult,
  ModelCatalogItem,
  ProducerAutomationStepState,
  ProducerRunScope,
  ProducerRunResultItem,
  Project,
  ProviderConfig,
  StepFlowStatus,
  StructuredOverwriteConfirmRequest,
  StructuredParseLifecycleState,
  StepRunState,
  Template,
  UiLanguage,
} from '../types';
import { t } from '../services/i18n';
import { FloatingToast, useToast } from './FloatingToast';
import { ProducerRunPreflightModal } from './project-runner/ProducerRunPreflightModal';
import {
  ProducerRunProgressModal,
  ProducerRunProgressState,
} from './project-runner/ProducerRunProgressModal';
import { ProjectStepCard } from './project-runner/ProjectStepCard';
import { buildBatchResultExport, BatchResultExportFilter, BatchResultExportFormat } from '../services/batchResultExportService';
import { buildProducerPreflight, ProducerPreflight } from '../services/stepGraphService';
import { StructuredOverwriteConfirmModal } from './project-runner/StructuredOverwriteConfirmModal';
import { ioService } from '../services/ioService';
import { TemplateBlueprintCanvas } from './template-editor/TemplateBlueprintCanvas';
import { BlueprintActiveTool } from './template-editor/TemplateBlueprintCanvas';
import {
  buildBlueprintLayout,
  mergeBlueprintLayout,
  tidyBlueprintLayout,
  updateBlueprintNodePosition,
} from '../services/templateBlueprintService';
import { SplitPane } from './common/SplitPane';

interface ProjectRunnerProps {
  project: Project;
  template: Template;
  language: UiLanguage;
  modelCatalog: ModelCatalogItem[];
  providerConfigs: ProviderConfig[];
  onUpdateProject: (projectId: string, updates: Partial<Project>) => void;
  onUpdateTemplate: (templateId: string, updates: Partial<Template>) => void;
  onRunStep: (
    stepId: string,
    options?: ExecuteProjectStepOptions
  ) => Promise<ExecuteProjectStepResult>;
  onClearStepRunLogs: (stepId: string) => void;
  onClearProjectRunLogs: () => void;
  onRequestConfirm: (title: string, message: string, onConfirm: () => void) => void;
  fontSizeClass?: string;
  structuredOutputResultView: 'raw' | 'structured';
  onStructuredOutputResultViewChange: (view: 'raw' | 'structured') => void;
  selectedStepIds: string[];
  onSelectedStepIdsChange: (stepIds: string[]) => void;
  blueprintViewport: { x: number; y: number; zoom: number };
  onBlueprintViewportChange: (viewport: { x: number; y: number; zoom: number }) => void;
  viewMode: ViewMode;
  onViewModeChange: (viewMode: ViewMode) => void;
  blueprintInspectorWidth: number;
  onBlueprintInspectorWidthChange: (width: number) => void;
  blueprintActiveTool: BlueprintActiveTool;
  onBlueprintActiveToolChange: (tool: BlueprintActiveTool) => void;
  minimapCollapsed: boolean;
  onMinimapCollapsedChange: (collapsed: boolean) => void;
  detailsPanelVisible: boolean;
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
  structuredOutputResultView,
  onStructuredOutputResultViewChange,
  selectedStepIds,
  onSelectedStepIdsChange,
  blueprintViewport,
  onBlueprintViewportChange,
  viewMode,
  onViewModeChange,
  blueprintInspectorWidth,
  onBlueprintInspectorWidthChange,
  blueprintActiveTool,
  onBlueprintActiveToolChange,
  minimapCollapsed,
  onMinimapCollapsedChange,
  detailsPanelVisible,
}) => {
  const [collapsedSteps, setCollapsedSteps] = useState<Record<string, boolean>>({});
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});
  const [expandedResults, setExpandedResults] = useState<Record<string, boolean>>({});
  const [inspectedStepId, setInspectedStepId] = useState<string | null>(null);
  const [runStates, setRunStates] = useState<Record<string, StepRunState>>({});
  const [runErrors, setRunErrors] = useState<Record<string, string>>({});
  const [producerPreflight, setProducerPreflight] = useState<ProducerPreflight | null>(null);
  const [producerRunScope, setProducerRunScope] = useState<ProducerRunScope>('changed_only');
  const [selectedOverwriteStepIds, setSelectedOverwriteStepIds] = useState<string[]>([]);
  const [producerStepStates, setProducerStepStates] = useState<
    Record<string, { state: ProducerAutomationStepState; reason?: string }>
  >({});
  const [structuredParseStates, setStructuredParseStates] = useState<
    Record<string, { state: StructuredParseLifecycleState; message?: string }>
  >({});
  const [structuredOverwriteRequest, setStructuredOverwriteRequest] =
    useState<StructuredOverwriteConfirmRequest | null>(null);
  const [producerRunProgress, setProducerRunProgress] = useState<ProducerRunProgressState>(
    createInitialProducerRunProgress()
  );
  const detailsScrollRef = useRef<HTMLDivElement | null>(null);
  const detailsScrollByStepIdRef = useRef<Record<string, number>>({});
  const stopProducerRunRef = useRef(false);
  const structuredOverwriteResolverRef = useRef<
    ((decision: 'overwrite' | 'skip') => void) | null
  >(null);
  const { toasts, showToast, removeToast } = useToast();

  const projectLogCount = useMemo(
    () =>
      (Object.values(project.stepRunLogs || {}) as Array<unknown[]>).reduce(
        (total, logs) => total + logs.length,
        0
      ),
    [project.stepRunLogs]
  );

  const saveCurrentDetailsScroll = () => {
    if (!inspectedStepId || !detailsScrollRef.current) return;
    detailsScrollByStepIdRef.current[inspectedStepId] = detailsScrollRef.current.scrollTop;
  };

  const handleBlueprintSelectionChange = (stepIds: string[]) => {
    saveCurrentDetailsScroll();
    const nextStepId = stepIds[0];
    if (nextStepId && template.steps.some((step) => step.id === nextStepId)) {
      setInspectedStepId(nextStepId);
    }
    onSelectedStepIdsChange(stepIds);
  };

  useEffect(() => {
    const nextStepId = selectedStepIds[0];
    if (nextStepId && template.steps.some((step) => step.id === nextStepId)) {
      setInspectedStepId(nextStepId);
    }
  }, [selectedStepIds, template.steps]);

  useEffect(() => {
    if (inspectedStepId && !template.steps.some((step) => step.id === inspectedStepId)) {
      setInspectedStepId(null);
    }
  }, [inspectedStepId, template.steps]);

  useLayoutEffect(() => {
    const node = detailsScrollRef.current;
    if (!node || !inspectedStepId) return;
    const restore = () => {
      node.scrollTop = detailsScrollByStepIdRef.current[inspectedStepId] || 0;
    };
    restore();
    const frameOne = requestAnimationFrame(() => {
      restore();
      requestAnimationFrame(restore);
    });
    const timers = [50, 150, 300].map((delay) => window.setTimeout(restore, delay));
    return () => {
      cancelAnimationFrame(frameOne);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [inspectedStepId]);

  const runnerTemplateForBlueprint = useMemo(
    () => ({
      ...template,
      blueprint: {
        ...(mergeBlueprintLayout(template)),
        viewport: blueprintViewport,
      },
    }),
    [template, blueprintViewport]
  );
  const moveBlueprintNodes = (stepIds: string[], dx: number, dy: number) => {
    if (stepIds.length === 0) return;
    let nextTemplate: Template = {
      ...template,
      blueprint: mergeBlueprintLayout(template),
    };
    stepIds.forEach((stepId) => {
      const current = nextTemplate.blueprint?.nodes[stepId];
      if (!current) return;
      nextTemplate = updateBlueprintNodePosition(nextTemplate, stepId, {
        x: current.x + dx,
        y: current.y + dy,
      });
    });
    onUpdateTemplate(template.id, { blueprint: nextTemplate.blueprint });
  };

  const resetBlueprintLayout = () => {
    const blueprint = buildBlueprintLayout(template);
    onUpdateTemplate(template.id, { blueprint });
    if (blueprint.viewport) {
      onBlueprintViewportChange(blueprint.viewport);
    }
  };

  const tidyBlueprint = () => {
    const blueprint = tidyBlueprintLayout(template, { selectedStepIds });
    onUpdateTemplate(template.id, { blueprint });
  };

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

  useEffect(
    () => () => {
      structuredOverwriteResolverRef.current?.('skip');
      structuredOverwriteResolverRef.current = null;
    },
    []
  );

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

  const requestStructuredOverwriteConfirm = (
    request: StructuredOverwriteConfirmRequest
  ) =>
    new Promise<'overwrite' | 'skip'>((resolve) => {
      structuredOverwriteResolverRef.current = resolve;
      setStructuredOverwriteRequest(request);
    });

  const resolveStructuredOverwriteConfirm = (decision: 'overwrite' | 'skip') => {
    structuredOverwriteResolverRef.current?.(decision);
    structuredOverwriteResolverRef.current = null;
    setStructuredOverwriteRequest(null);
  };

  const scrollToStep = (stepId: string) => {
    const element = document.getElementById(stepId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const executeStepWithUi = async (
    stepId: string,
    options: {
      showSuccessToast?: boolean;
      structuredParseMode?: ExecuteProjectStepOptions['structuredParseMode'];
      isProducerRun?: boolean;
    } = {}
  ) => {
    setRunStates((prev) => ({ ...prev, [stepId]: 'running' }));
    setRunErrors((prev) => ({ ...prev, [stepId]: '' }));
    setStructuredParseStates((prev) => ({
      ...prev,
      [stepId]: { state: 'idle' },
    }));
    try {
      const result = await onRunStep(stepId, {
        structuredParseMode: options.structuredParseMode,
        confirmStructuredOverwrite: requestStructuredOverwriteConfirm,
        onStructuredParseStateChange: (state, message) => {
          setStructuredParseStates((prev) => ({
            ...prev,
            [stepId]: { state, message },
          }));

          if (options.isProducerRun) {
            if (state === 'awaiting_confirm') {
              setProducerStepStates((prev) => ({
                ...prev,
                [stepId]: {
                  state: 'waiting_structured_overwrite_confirm',
                  reason: message,
                },
              }));
            } else if (state === 'running') {
              setProducerStepStates((prev) => ({
                ...prev,
                [stepId]: { state: 'running', reason: message },
              }));
            }
          }
        },
      });
      setRunStates((prev) => ({ ...prev, [stepId]: 'success' }));
      if (options.showSuccessToast !== false) {
        showToast(t(language, 'toast.generated'), Math.max(120, window.innerWidth / 2), 72);
      }
      return { ok: true as const, result };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t(language, 'step.failed');
      setRunStates((prev) => ({ ...prev, [stepId]: 'error' }));
      setRunErrors((prev) => ({ ...prev, [stepId]: message }));
      return { ok: false as const, message };
    }
  };

  const runStep = async (stepId: string) => {
    await executeStepWithUi(stepId, {
      showSuccessToast: true,
      structuredParseMode: 'single',
    });
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

  const exportProducerRunResults = async (
    format: BatchResultExportFormat,
    filter: BatchResultExportFilter
  ) => {
    const exported = buildBatchResultExport({
      project,
      template,
      results: producerRunProgress.results,
      format,
      filter,
    });
    await ioService.exportFile(exported.filename, exported.content, exported.mimeType);
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

      const outcome = await executeStepWithUi(stepId, {
        showSuccessToast: false,
        structuredParseMode: 'automation',
        isProducerRun: true,
      });
      processed += 1;

      if (outcome.ok) {
        const structuredParse = outcome.result.structuredParse;
        const baseMessage =
          language === 'zh-CN'
            ? `已更新 {{${outputVariableKey}}}`
            : `Updated {{${outputVariableKey}}}`;

        if (structuredParse.status === 'error') {
          errorCount += 1;
          results.push({
            stepId,
            stepName,
            outputVariableKey,
            status: 'error',
            message: `${baseMessage}. ${structuredParse.message}`,
            structuredParseStatus: structuredParse.status,
            structuredParseMessage: structuredParse.message,
          });
          setProducerStepStates((prev) => ({
            ...prev,
            [stepId]: { state: 'error', reason: structuredParse.message },
          }));
        } else {
          successCount += 1;
          results.push({
            stepId,
            stepName,
            outputVariableKey,
            status: 'success',
            message:
              structuredParse.status === 'not_applicable'
                ? baseMessage
                : `${baseMessage}. ${structuredParse.message}`,
            structuredParseStatus: structuredParse.status,
            structuredParseMessage: structuredParse.message,
          });
          setProducerStepStates((prev) => ({
            ...prev,
            [stepId]: {
              state: 'success',
              reason:
                structuredParse.status === 'not_applicable'
                  ? undefined
                  : structuredParse.message,
            },
          }));
        }
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
    <div className={`flex min-h-0 w-full flex-1 ${fontSizeClass}`}>
      <div className="relative flex h-full min-h-0 w-full min-w-0 flex-col">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-900 p-4 pb-4 md:p-6">
          <div className="mb-6 shrink-0 animate-in slide-in-from-top-2 px-1 duration-500 fade-in">
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
                  onClick={() => onViewModeChange('compact')}
                  className={`rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                    viewMode === 'compact'
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-500 hover:text-white'
                  }`}
                >
                  {t(language, 'project.compact')}
                </button>
                <button
                  onClick={() => onViewModeChange('detail')}
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

          <div className="flex min-h-0 w-full flex-1 flex-col space-y-5">
            <SplitPane
              className="min-h-0 flex-1"
              direction="horizontal"
              size={detailsPanelVisible ? blueprintInspectorWidth : 0}
              sizeTarget="second"
              minSize={detailsPanelVisible ? 320 : 0}
              maxSize={detailsPanelVisible ? 640 : 0}
              onSizeChange={onBlueprintInspectorWidthChange}
              first={
                <div className="h-full min-h-0 w-full">
                  <TemplateBlueprintCanvas
                    language={language}
                    template={runnerTemplateForBlueprint}
                    selectedStepIds={selectedStepIds}
                    onSelectSteps={handleBlueprintSelectionChange}
                    onMoveNodes={moveBlueprintNodes}
                    onConnect={() => undefined}
                    onRemoveEdge={() => undefined}
                    onViewportChange={(x, y, zoom) => onBlueprintViewportChange({ x, y, zoom })}
                    onTidyLayout={tidyBlueprint}
                    onResetLayout={resetBlueprintLayout}
                    onCreateStepRequest={() => undefined}
                    activeTool={blueprintActiveTool}
                    onActiveToolChange={onBlueprintActiveToolChange}
                    minimapCollapsed={minimapCollapsed}
                    onMinimapCollapsedChange={onMinimapCollapsedChange}
                    debugState={{
                      currentStepId: Object.keys(runStates).find((stepId) => runStates[stepId] === 'running'),
                      successStepIds: Object.keys(runStates).filter((stepId) => runStates[stepId] === 'success'),
                      errorStepIds: Object.keys(runStates).filter((stepId) => runStates[stepId] === 'error'),
                      blockedStepIds: Object.keys(producerStepStates).filter(
                        (stepId) => producerStepStates[stepId]?.state === 'blocked'
                      ),
                    }}
                  />
                </div>
              }
              second={
                <div
                  ref={detailsScrollRef}
                  className="flex h-full min-h-0 w-full justify-center overflow-y-auto"
                  onScroll={(event) => {
                    if (!inspectedStepId) return;
                    detailsScrollByStepIdRef.current[inspectedStepId] = event.currentTarget.scrollTop;
                  }}
                >
                  <div className="w-full animate-in fade-in slide-in-from-right-1 duration-150">
                    {(() => {
                      const stepId = inspectedStepId;
                      const stepIndex = template.steps.findIndex((item) => item.id === stepId);
                      if (!stepId || stepIndex < 0) {
                        return (
                          <div className="space-y-3 rounded-lg border border-slate-800/90 bg-slate-900/80 p-4 text-xs text-slate-400">
                            <div className="text-sm font-bold text-slate-200">
                              {language === 'zh-CN' ? '项目运行概览' : 'Project Run Overview'}
                            </div>
                            <div>
                              {language === 'zh-CN'
                                ? '选择蓝图节点后，这里会显示对应节点的运行详情、结果和日志。'
                                : 'Select a blueprint node to inspect its run details, result, and logs.'}
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[11px]">
                              <div className="rounded border border-slate-800 bg-slate-950/70 p-2">
                                <div className="text-slate-500">{language === 'zh-CN' ? '步骤数' : 'Steps'}</div>
                                <div className="mt-1 font-bold text-slate-200">{template.steps.length}</div>
                              </div>
                              <div className="rounded border border-slate-800 bg-slate-950/70 p-2">
                                <div className="text-slate-500">{language === 'zh-CN' ? '日志数' : 'Logs'}</div>
                                <div className="mt-1 font-bold text-slate-200">{projectLogCount}</div>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      const step = template.steps[stepIndex];
                      const isShowingLastViewed = selectedStepIds[0] !== step.id;
                      return (
                        <div>
                          {isShowingLastViewed && (
                            <div className="mb-2 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-[11px] text-slate-400">
                              {language === 'zh-CN'
                                ? '当前显示上次查看的节点。点击节点可重新高亮，点击其他节点会切换详情。'
                                : 'Showing the last inspected node. Select a node to highlight or switch details.'}
                            </div>
                          )}
                          <ProjectStepCard
                            key={step.id}
                            index={stepIndex}
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
                            structuredParseState={structuredParseStates[step.id]?.state || 'idle'}
                            structuredParseMessage={structuredParseStates[step.id]?.message}
                            onToggleCollapse={() => setCollapsedSteps((prev) => ({ ...prev, [step.id]: !prev[step.id] }))}
                            onToggleLogs={() => setExpandedLogs((prev) => ({ ...prev, [step.id]: !prev[step.id] }))}
                            onToggleResults={() => setExpandedResults((prev) => ({ ...prev, [step.id]: !prev[step.id] }))}
                            onRunStep={runStep}
                            onUpdateProject={onUpdateProject}
                            onUpdateTemplate={onUpdateTemplate}
                            onClearStepRunLogs={onClearStepRunLogs}
                            onRequestConfirm={onRequestConfirm}
                            onQuickCopy={handleQuickCopy}
                            onCopyLogText={handleCopyLogText}
                            onRestoreLogOutput={restoreLogOutput}
                            structuredOutputResultView={structuredOutputResultView}
                            onStructuredOutputResultViewChange={onStructuredOutputResultViewChange}
                            interpolate={interpolate}
                            getVariableByKey={getVariableByKey}
                            getStepStatus={getStepStatus}
                            getStatusMeta={getStatusMeta}
                            getRunStateMeta={getRunStateMeta}
                            scrollToStep={scrollToStep}
                          />
                        </div>
                      );
                    })()}
                  </div>
                </div>
              }
            />
          </div>
          </div>
      </div>

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
        onExport={(format, filter) => {
          void exportProducerRunResults(format, filter);
        }}
      />

      <StructuredOverwriteConfirmModal
        language={language}
        request={structuredOverwriteRequest}
        onConfirmOverwrite={() => resolveStructuredOverwriteConfirm('overwrite')}
        onSkip={() => resolveStructuredOverwriteConfirm('skip')}
      />

      <FloatingToast toasts={toasts} onRemove={removeToast} />
    </div>
  );
};
