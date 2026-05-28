import React from 'react';
import {
  ModelCatalogItem,
  ProducerAutomationStepState,
  Project,
  ProviderConfig,
  StepFlowStatus,
  StructuredParseLifecycleState,
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
import { getVariableTableCellValue } from '../../services/variableTableService.runtime';
import {
  buildStepInputPreviews,
  buildStepOutputPreviews,
  StepInputPreviewItem,
  StepOutputPreviewItem,
  TablePreviewSummary,
} from '../../services/stepPreviewService';

type ViewMode = 'compact' | 'detail';

const summarizeText = (value: string) => {
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized.length > 160 ? `${normalized.slice(0, 160)}...` : normalized;
};

const PreviewTable: React.FC<{
  language: UiLanguage;
  table: TablePreviewSummary;
}> = ({ language, table }) => (
  <div className="mt-2 overflow-hidden rounded-lg border border-slate-800 bg-slate-950/60">
    <div className="flex items-center justify-between border-b border-slate-800 px-2.5 py-1.5 text-[10px] text-slate-500">
      <span>
        {language === 'zh-CN'
          ? `${table.columns.length} 列 / ${table.totalRows} 行`
          : `${table.columns.length} columns / ${table.totalRows} rows`}
      </span>
      {table.totalRows > table.rows.length && (
        <span>
          {language === 'zh-CN'
            ? `预览前 ${table.rows.length} 行`
            : `First ${table.rows.length} rows`}
        </span>
      )}
    </div>
    {table.columns.length > 0 && table.rows.length > 0 ? (
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-[11px]">
          <thead className="bg-slate-900/80 text-slate-400">
            <tr>
              {table.columns.map((column) => (
                <th key={column.key} className="border-b border-slate-800 px-2 py-1 font-semibold">
                  {column.label || column.key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIndex) => (
              <tr key={row.id || `row_${rowIndex}`} className="border-t border-slate-900">
                {table.columns.map((column) => (
                  <td key={`${row.id || rowIndex}_${column.key}`} className="max-w-48 truncate px-2 py-1 text-slate-300">
                    {row.cells[column.key] || ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <div className="px-2.5 py-2 text-[11px] text-slate-500">
        {language === 'zh-CN' ? '暂无表格数据' : 'No table data yet'}
      </div>
    )}
  </div>
);

const InputPreviewPanel: React.FC<{
  language: UiLanguage;
  items: StepInputPreviewItem[];
}> = ({ language, items }) => {
  if (items.length === 0) return null;
  return (
    <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950/55 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          {language === 'zh-CN' ? '输入预览' : 'Input preview'}
        </div>
        <div className="text-[10px] text-slate-500">
          {language === 'zh-CN' ? `${items.length} 个输入` : `${items.length} inputs`}
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {items.map((item) => (
          <div
            key={`${item.label}_${item.key || 'missing'}`}
            className={`rounded-lg border p-2.5 ${
              item.missing
                ? 'border-red-500/25 bg-red-500/5'
                : item.type === 'table'
                  ? 'border-fuchsia-500/20 bg-fuchsia-500/5'
                  : 'border-slate-800 bg-slate-950/60'
            }`}
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-xs font-bold text-slate-200">{item.label}</div>
                <div className="truncate text-[10px] text-slate-500">
                  {item.sourceLabel || (language === 'zh-CN' ? '未连接' : 'Unconnected')}
                </div>
              </div>
              <span
                className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] ${
                  item.missing
                    ? 'border-red-500/30 text-red-300'
                    : item.type === 'table'
                      ? 'border-fuchsia-500/30 text-fuchsia-200'
                      : 'border-cyan-500/30 text-cyan-200'
                }`}
              >
                {item.missing ? (language === 'zh-CN' ? '缺失' : 'Missing') : item.type}
              </span>
            </div>
            {item.table ? (
              <PreviewTable language={language} table={item.table} />
            ) : (
              <div className="mt-2 rounded border border-slate-800 bg-slate-950/70 px-2 py-1.5 text-[11px] text-slate-300">
                {item.value.trim()
                  ? summarizeText(item.value)
                  : language === 'zh-CN'
                    ? '暂无值'
                    : 'No value yet'}
              </div>
            )}
            {item.selectedRow && (
              <div className="mt-2 rounded border border-cyan-500/20 bg-cyan-500/5 px-2 py-1.5 text-[11px]">
                <div className="mb-1 font-semibold text-cyan-200">
                  {language === 'zh-CN'
                    ? `当前选择第 ${item.selectedRow.rowNumber || '?'} 行`
                    : `Selected row ${item.selectedRow.rowNumber || '?'}`}
                </div>
                {item.selectedRow.row ? (
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(item.selectedRow.row.cells).map(([key, value]) => (
                      <span key={key} className="rounded bg-slate-950 px-1.5 py-0.5 text-slate-300">
                        <span className="text-slate-500">{key}=</span>{value}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-red-300">
                    {item.selectedRow.message || (language === 'zh-CN' ? '找不到该行' : 'Row not found')}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const OutputPreviewPanel: React.FC<{
  language: UiLanguage;
  items: StepOutputPreviewItem[];
}> = ({ language, items }) => {
  if (items.length === 0) return null;
  return (
    <div className="mb-3 rounded-xl border border-slate-800 bg-slate-950/55 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          {language === 'zh-CN' ? '输出预览' : 'Output preview'}
        </div>
        <div className="text-[10px] text-slate-500">
          {language === 'zh-CN' ? `${items.length} 个输出` : `${items.length} outputs`}
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.key}
            className={`rounded-lg border p-2.5 ${
              item.missing
                ? 'border-slate-800 bg-slate-950/50'
                : item.type === 'table'
                  ? 'border-fuchsia-500/20 bg-fuchsia-500/5'
                  : 'border-cyan-500/20 bg-cyan-500/5'
            }`}
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-xs font-bold text-slate-200">{item.label}</div>
                <div className="truncate font-mono text-[10px] text-slate-500">{item.key}</div>
              </div>
              <span className="shrink-0 rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300">
                {item.type}
              </span>
            </div>
            {item.table ? (
              <PreviewTable language={language} table={item.table} />
            ) : (
              <div className="mt-2 rounded border border-slate-800 bg-slate-950/70 px-2 py-1.5 text-[11px] text-slate-300">
                {item.value.trim()
                  ? summarizeText(item.value)
                  : language === 'zh-CN'
                    ? '暂无输出'
                    : 'No output yet'}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const getStepRoleMeta = (language: UiLanguage, step: TemplateStep) => {
  if (step.kind === 'variable') {
    return {
      stepType: 'variable',
      roleLabel: language === 'zh-CN' ? '变量节点' : 'Variable node',
      autoRunEnabled: true,
    };
  }

  if (step.kind === 'math_operation') {
    return {
      stepType: 'math_operation',
      roleLabel: language === 'zh-CN' ? '数学节点' : 'Math node',
      autoRunEnabled: true,
    };
  }

  if (step.kind === 'table_row') {
    return {
      stepType: 'table_row',
      roleLabel: language === 'zh-CN' ? '表行节点' : 'Table row node',
      autoRunEnabled: true,
    };
  }

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
  structuredParseState: StructuredParseLifecycleState;
  structuredParseMessage?: string;
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
  structuredOutputResultView: 'raw' | 'structured';
  onStructuredOutputResultViewChange: (view: 'raw' | 'structured') => void;
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
  structuredParseState,
  structuredParseMessage,
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
  structuredOutputResultView,
  onStructuredOutputResultViewChange,
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
      : producerState === 'waiting_structured_overwrite_confirm'
        ? {
            label: t(language, 'step.structuredAwaitingConfirm'),
            className: 'border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-300',
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
  const structuredParseMeta =
    structuredParseState === 'running'
      ? {
          label: t(language, 'step.structuredParsing'),
          className: 'border-blue-500/20 bg-blue-500/10 text-blue-300',
        }
      : structuredParseState === 'awaiting_confirm'
        ? {
            label: t(language, 'step.structuredAwaitingConfirm'),
            className: 'border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-300',
          }
        : structuredParseState === 'success'
          ? {
              label: t(language, 'step.structuredUpdated'),
              className:
                'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
            }
          : structuredParseState === 'skipped'
            ? {
                label: t(language, 'step.structuredSkipped'),
                className: 'border-slate-700 bg-slate-800/80 text-slate-300',
              }
            : structuredParseState === 'error'
              ? {
                  label: t(language, 'step.structuredFailed'),
                  className: 'border-red-500/20 bg-red-500/10 text-red-300',
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
  const structuredFields = step.structuredOutputFields || [];
  const structuredBindings = step.structuredOutputBindings || [];
  const variableTable = (project.variableTables || []).find((table) => table.sourceStepId === step.id);
  const tableRows =
    variableTable?.rows && variableTable.rows.length > 0
      ? variableTable.rows
      : [
          {
            id: `row_${step.id}_draft`,
            cells: project.stepStructuredOutputs?.[step.id] || {},
          },
        ];
  const structuredValues = tableRows[0]?.cells || project.stepStructuredOutputs?.[step.id] || {};
  const hasStructuredFields = structuredFields.length > 0;
  const hasUnfilledStructuredFields =
    hasStructuredFields &&
    resultValue.trim().length > 0 &&
    structuredFields.some((field) => !String(structuredValues[field.key] || '').trim());
  const promptSectionLabel = language === 'zh-CN' ? '函数体' : 'Function body';
  const resultSectionLabel = language === 'zh-CN' ? '返回值' : 'Return value';
  const flowSummary =
    language === 'zh-CN'
      ? '输入变量 -> 函数体 -> 返回值'
      : 'Input variables -> Function body -> Return values';
  const showFlowSummary = stepRoleMeta.stepType === 'text_generation';
  const currentStepAssetUpdatedAt = Math.max(
    project.stepOutputMeta?.[step.id]?.updatedAt || 0,
    latestLog?.createdAt || 0
  );
  const inputPreviews = buildStepInputPreviews(project, template, step);
  const outputPreviews = buildStepOutputPreviews(project, step);

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
    const tableValue = getVariableTableCellValue(project, key);
    if (tableValue !== undefined) {
      if (!String(tableValue || '').trim()) {
        missingKeys.push(key);
      }
      return;
    }

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

  const updateStructuredValue = (rowIndex: number, fieldKey: string, value: string) => {
    const columns = structuredFields
      .filter((field) => field.key.trim() && field.label.trim())
      .map((field) => ({
        key: field.key.trim(),
        label: field.label.trim(),
        description: field.description?.trim() || undefined,
      }));
    const nextRows = tableRows.map((row, currentIndex) => ({
      id: row.id,
      cells: {
        ...row.cells,
        ...(currentIndex === rowIndex ? { [fieldKey]: value } : {}),
      },
    }));
    const nextTable = {
      id: variableTable?.id || `table_step_${step.id}`,
      key: variableTable?.key || step.outputBinding?.variableKey?.trim() || `table_${step.id}`,
      label: variableTable?.label || step.outputBinding?.variableLabel?.trim() || step.name,
      sourceStepId: step.id,
      columns,
      rows: nextRows,
      updatedAt: Date.now(),
    };

    onUpdateProject(project.id, {
      stepStructuredOutputs: {
        ...(project.stepStructuredOutputs || {}),
        [step.id]: {
          ...(project.stepStructuredOutputs?.[step.id] || {}),
          ...(rowIndex === 0 ? { [fieldKey]: value } : {}),
        },
      },
      variableTables: [
        ...(project.variableTables || []).filter((table) => table.sourceStepId !== step.id),
        nextTable,
      ],
    });
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

          {viewMode === 'detail' && (
            <InputPreviewPanel language={language} items={inputPreviews} />
          )}

          <PromptEditor
            language={language}
            label={promptSectionLabel}
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

          {(showFlowSummary ||
            configuredBinding ||
            (viewMode === 'detail' && referencedSourceSteps.length > 0)) && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-slate-800/40 bg-slate-950/30 px-2.5 py-1.5 text-[10px]">
              {showFlowSummary && (
                <span className="font-bold uppercase tracking-tight text-slate-500">
                  {flowSummary}
                </span>
              )}
              {configuredBinding && (
                <span className="text-violet-400">
                  {`${resultSectionLabel} -> {{${configuredBinding.variableKey}}}`}
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
          )}

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
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                {resultSectionLabel} ({t(language, 'step.resultHint')})
              </label>
              <div className="flex items-center gap-2">
                {hasStructuredFields && (
                  <div className="flex items-center gap-1 rounded-md border border-slate-800 bg-slate-950/70 p-1">
                    <button
                      type="button"
                      onClick={() => onStructuredOutputResultViewChange('raw')}
                      className={`rounded px-2 py-1 text-[10px] font-bold transition-colors ${
                        structuredOutputResultView === 'raw'
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-500 hover:text-white'
                      }`}
                    >
                      {language === 'zh-CN' ? '整段' : 'Raw'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onStructuredOutputResultViewChange('structured')}
                      className={`rounded px-2 py-1 text-[10px] font-bold transition-colors ${
                        structuredOutputResultView === 'structured'
                          ? 'bg-fuchsia-500/15 text-fuchsia-200'
                          : 'text-slate-500 hover:text-white'
                      }`}
                    >
                      {language === 'zh-CN' ? '表变量' : 'Table variable'}
                    </button>
                  </div>
                )}
                {configuredBinding && structuredOutputResultView === 'raw' && (
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
            {hasStructuredFields && hasUnfilledStructuredFields && (
              <div className="mb-2 rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/5 px-3 py-2 text-[11px] text-fuchsia-200/90">
                {language === 'zh-CN'
                  ? '当前提示词函数已有整段结果，但表变量还未整理完成。'
                  : 'This prompt function already has a raw result, but its table variable is not filled yet.'}
              </div>
            )}
            {hasStructuredFields && structuredParseMeta && (
              <div
                className={`mb-2 rounded-lg border px-3 py-2 text-[11px] ${structuredParseMeta.className}`}
              >
                <div className="font-semibold">{structuredParseMeta.label}</div>
                {structuredParseMessage && viewMode === 'detail' && (
                  <div className="mt-1 whitespace-pre-wrap text-[11px] opacity-90">
                    {structuredParseMessage}
                  </div>
                )}
              </div>
            )}
            {viewMode === 'detail' && (
              <OutputPreviewPanel language={language} items={outputPreviews} />
            )}
            {(structuredOutputResultView === 'raw' || !hasStructuredFields) ? (
            <>
            <div
              className={`overflow-y-auto rounded-xl border border-slate-700/80 bg-slate-950/70 px-3 py-3 transition-all hover:border-slate-600 ${
                isResultExpanded ? 'max-h-[440px]' : 'max-h-32'
              }`}
            >
              <AutoResizeTextarea
                className="font-sans text-sm leading-relaxed text-slate-300"
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
            </>
            ) : (
              <div
                className={`space-y-3 overflow-y-auto rounded-xl border border-fuchsia-700/40 bg-slate-950/70 px-3 py-3 transition-all hover:border-fuchsia-500/40 ${
                  isResultExpanded ? 'max-h-[520px]' : 'max-h-40'
                }`}
              >
                {tableRows.map((row, rowIndex) => (
                  <div key={`${step.id}_table_row_${row.id}`} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-fuchsia-300">
                      {language === 'zh-CN' ? `第 ${rowIndex + 1} 行` : `Row ${rowIndex + 1}`}
                    </div>
                    <div className="space-y-3">
                {structuredFields.map((field) => {
                  const binding = structuredBindings.find((item) => item.fieldKey === field.key);
                  return (
                    <div
                      key={`${step.id}_field_${row.id}_${field.key}`}
                      className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"
                    >
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-xs font-bold text-fuchsia-200">
                            {field.label || field.key}
                          </div>
                          {field.description?.trim() && (
                            <div className="mt-0.5 text-[11px] text-slate-500">
                              {field.description}
                            </div>
                          )}
                        </div>
                        {binding?.variableKey && (
                          <span className="shrink-0 font-mono text-[10px] text-violet-400">
                            {`{{${binding.variableKey}}}`}
                          </span>
                        )}
                      </div>
                      <AutoResizeTextarea
                        className="font-sans text-sm leading-relaxed text-slate-300"
                        value={row.cells[field.key] || ''}
                        onChange={(value) => updateStructuredValue(rowIndex, field.key, value)}
                        placeholder={
                          language === 'zh-CN'
                            ? '填写该表字段...'
                            : 'Fill this table field...'
                        }
                      />
                    </div>
                  );
                })}
                    </div>
                  </div>
                ))}
              </div>
            )}
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
