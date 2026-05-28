import React from 'react';
import {
  DEEPSEEK_EXECUTION_PRESETS,
  DEEPSEEK_SYSTEM_PROMPT_PRESETS,
} from '../../constants';
import {
  ExecutionPresetModelRefStrategy,
  ExecutionPresetTemplate,
  StepType,
  StepExecutionAvailability,
  StepExecutionConfig,
  StepOutputBinding,
  StepParameter,
  StructuredOutputFieldDefinition,
  Template,
  TemplateModelRef,
  TemplateStep,
  UiLanguage,
} from '../../types';
import { t } from '../../services/i18n';
import { Button } from '../Button';
import { AutoResizeTextarea } from '../common/AutoResizeTextarea';
import { PromptCodeEditor } from './PromptCodeEditor';
import { StepParametersPanel } from './StepParametersPanel';

interface VariableAutocompleteItem {
  key: string;
  label: string;
  sourceType: 'template_input' | 'step_output';
  sourceLabel: string;
}

interface VariableAutocompleteState {
  stepId: string;
  start: number;
  end: number;
  query: string;
  selectedIndex: number;
}

interface TemplateStepCardProps {
  language: UiLanguage;
  step: TemplateStep;
  stepIndex: number;
  editedTemplate: Template;
  modelRefs: TemplateModelRef[];
  isCollapsed: boolean;
  isSelected: boolean;
  isExecutionExpanded: boolean;
  availability: StepExecutionAvailability;
  binding: StepOutputBinding;
  execution: StepExecutionConfig;
  bindingKey: string;
  currentRef?: TemplateModelRef;
  matchedPreset?: { id: string; label: string; description?: string };
  recommendedPreset?: { id: string; label: string };
  matchedSystemPromptPreset?: { id: string; label: string; description?: string; content: string };
  recommendedSystemPromptPreset?: { id: string; label: string };
  selectedExecutionPresetValue: string;
  enabledExecutionPresetTemplates: ExecutionPresetTemplate[];
  executionSummaryParts: string[];
  structuredFields: StructuredOutputFieldDefinition[];
  copiedExecutionConfigSourceStepId?: string;
  copiedExecutionConfigSourceStepName?: string;
  savingExecutionPresetStepId: string | null;
  executionPresetDraft: {
    label: string;
    description: string;
    modelRefStrategy: ExecutionPresetModelRefStrategy;
  };
  autocompleteState: VariableAutocompleteState | null;
  filteredAutocompleteItems: VariableAutocompleteItem[];
  onToggleSelection: () => void;
  onToggleCollapse: () => void;
  onOpenFunctionTab?: () => void;
  isFunctionTabOpen?: boolean;
  onMoveStep: (direction: 'up' | 'down') => void;
  onRemoveStep: () => void;
  onToggleStepMenu: () => void;
  isStepMenuOpen: boolean;
  onCopyExecutionConfig: () => void;
  onPasteExecutionConfig: () => void;
  onUpdateStep: (updates: Partial<TemplateStep>) => void;
  onPromptChange: (value: string) => void;
  isPromptCollapsed?: boolean;
  onTogglePromptCollapsed?: () => void;
  onPromptKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSyncAutocomplete: () => void;
  onClearAutocompleteLater: () => void;
  onPromptTextareaRef: (node: HTMLTextAreaElement | null) => void;
  onApplyAutocompleteItem: (item: VariableAutocompleteItem) => void;
  onToggleExecutionSection: () => void;
  onSelectedExecutionPresetChange: (value: string) => void;
  onApplyExecutionPreset: () => void;
  onStartSavingExecutionPreset: () => void;
  onCancelSavingExecutionPreset: () => void;
  onSaveCurrentExecutionPreset: () => void;
  onUpdateExecutionPresetDraft: (updates: Partial<{
    label: string;
    description: string;
    modelRefStrategy: ExecutionPresetModelRefStrategy;
  }>) => void;
  onUpdateStepExecution: (updates: Partial<StepExecutionConfig>) => void;
  onUpdateStepMeta: (updates: Partial<Pick<TemplateStep, 'stepType' | 'autoRunEnabled'>>) => void;
  onSyncParametersFromContent: () => void;
  onAddParameter: () => void;
  onUpdateParameter: (parameterIndex: number, updates: Partial<StepParameter>) => void;
  onRemoveParameter: (parameterIndex: number) => void;
  onApplyStepModelRef: (modelRefId?: string) => void;
  onUpdateStepBinding: (updates: Partial<StepOutputBinding>) => void;
  onAddStructuredField: () => void;
  onUpdateStructuredField: (
    fieldIndex: number,
    updates: Partial<StructuredOutputFieldDefinition>
  ) => void;
  onReorderStructuredField: (fromIndex: number, toIndex: number) => void;
  onRemoveStructuredField: (fieldIndex: number) => void;
  getExecutionBadgeClassName: (
    availability: StepExecutionAvailability
  ) => string;
}

export const TemplateStepCard: React.FC<TemplateStepCardProps> = ({
  language,
  step,
  stepIndex,
  editedTemplate,
  modelRefs,
  isCollapsed,
  isSelected,
  isExecutionExpanded,
  availability,
  binding,
  execution,
  bindingKey,
  currentRef,
  matchedPreset,
  recommendedPreset,
  matchedSystemPromptPreset,
  recommendedSystemPromptPreset,
  selectedExecutionPresetValue,
  enabledExecutionPresetTemplates,
  executionSummaryParts,
  structuredFields,
  copiedExecutionConfigSourceStepId,
  copiedExecutionConfigSourceStepName,
  savingExecutionPresetStepId,
  executionPresetDraft,
  autocompleteState,
  filteredAutocompleteItems,
  onToggleSelection,
  onToggleCollapse,
  onOpenFunctionTab,
  isFunctionTabOpen = false,
  onMoveStep,
  onRemoveStep,
  onToggleStepMenu,
  isStepMenuOpen,
  onCopyExecutionConfig,
  onPasteExecutionConfig,
  onUpdateStep,
  onPromptChange,
  isPromptCollapsed = false,
  onTogglePromptCollapsed,
  onPromptKeyDown,
  onSyncAutocomplete,
  onClearAutocompleteLater,
  onPromptTextareaRef,
  onApplyAutocompleteItem,
  onToggleExecutionSection,
  onSelectedExecutionPresetChange,
  onApplyExecutionPreset,
  onStartSavingExecutionPreset,
  onCancelSavingExecutionPreset,
  onSaveCurrentExecutionPreset,
  onUpdateExecutionPresetDraft,
  onUpdateStepExecution,
  onUpdateStepMeta,
  onSyncParametersFromContent,
  onAddParameter,
  onUpdateParameter,
  onRemoveParameter,
  onApplyStepModelRef,
  onUpdateStepBinding,
  onAddStructuredField,
  onUpdateStructuredField,
  onReorderStructuredField,
  onRemoveStructuredField,
  getExecutionBadgeClassName,
}) => {
  const stepType = step.stepType || 'manual';
  const nodeKind = step.kind || 'prompt_function';
  const autoRunEnabled =
    stepType === 'text_generation' && step.autoRunEnabled === true;
  const stepTypeLabel =
    stepType === 'text_generation'
      ? t(language, 'templateEditor.stepTypeText')
      : stepType === 'external'
        ? t(language, 'templateEditor.stepTypeExternal')
        : t(language, 'templateEditor.stepTypeManual');
  const stepTypeHelp =
    stepType === 'text_generation'
      ? t(language, 'templateEditor.stepTypeHelpText')
      : stepType === 'external'
        ? t(language, 'templateEditor.stepTypeHelpExternal')
        : t(language, 'templateEditor.stepTypeHelpManual');
  const [draggingStructuredFieldIndex, setDraggingStructuredFieldIndex] = React.useState<number | null>(null);
  const draggingStructuredFieldIndexRef = React.useRef<number | null>(null);
  const structuredFieldRowRefs = React.useRef<Record<number, HTMLDivElement | null>>({});
  const parameters = step.parameters || [];
  const operationSymbol =
    step.math?.operation === 'subtract'
      ? '-'
      : step.math?.operation === 'multiply'
        ? '*'
        : step.math?.operation === 'divide'
          ? '/'
          : '+';
  const localOutputKey =
    nodeKind === 'variable'
      ? 'value'
      : nodeKind === 'math_operation'
        ? 'result'
        : nodeKind === 'model'
          ? 'model'
          : nodeKind === 'table_row'
            ? 'row'
        : '';
  const tableRowOutputCount = step.outputs?.length || 0;
  const modelNodeRef = modelRefs.find((item) => item.id === step.model?.modelRefId);
  const connectedModelStep = step.execution?.modelSourceStepId
    ? editedTemplate.steps.find((item) => item.id === step.execution?.modelSourceStepId)
    : undefined;
  const connectedModelRef = connectedModelStep?.kind === 'model'
    ? modelRefs.find((item) => item.id === connectedModelStep.model?.modelRefId)
    : undefined;
  const nodeSummary =
    nodeKind === 'variable'
      ? `${language === 'zh-CN' ? '输出端' : 'Output'} ${language === 'zh-CN' ? '值' : localOutputKey}`
      : nodeKind === 'math_operation'
        ? `${step.math?.leftKey?.trim() || 'A'} ${operationSymbol} ${step.math?.rightKey?.trim() || 'B'} -> ${
            language === 'zh-CN' ? '结果' : localOutputKey
          }`
        : nodeKind === 'table_row'
          ? `${step.tableRow?.tableKey?.trim() || 'table'}[${step.tableRow?.rowIndex?.trim() || '1'}] -> ${
              language === 'zh-CN' ? `${tableRowOutputCount} 个字段` : `${tableRowOutputCount} fields`
            }`
        : `${language === 'zh-CN' ? '入口' : 'Inputs'} ${parameters.length} / ${language === 'zh-CN' ? '返回' : 'Returns'} ${
            structuredFields.length > 0 ? 2 : bindingKey ? 1 : 0
          }`;
  const displayNodeSummary =
    nodeKind === 'model'
      ? `${language === 'zh-CN' ? '输出端' : 'Output'} model`
      : nodeSummary;
  const displayNodeKindLabel =
    nodeKind === 'model'
      ? language === 'zh-CN'
        ? '模型节点'
        : 'Model'
      : nodeKind === 'variable'
        ? language === 'zh-CN'
          ? '变量节点'
          : 'Variable'
        : nodeKind === 'math_operation'
          ? language === 'zh-CN'
            ? '数学节点'
            : 'Math'
          : nodeKind === 'table_row'
            ? language === 'zh-CN'
              ? '表行节点'
              : 'Table Row'
          : language === 'zh-CN'
            ? '函数节点'
            : 'Function';

  const updateStructuredFieldDragTarget = React.useCallback(
    (clientY: number) => {
      const fromIndex = draggingStructuredFieldIndexRef.current;
      if (fromIndex === null) return;

      const toIndex = structuredFields.findIndex((_, index) => {
        const row = structuredFieldRowRefs.current[index];
        if (!row) return false;
        const rect = row.getBoundingClientRect();
        return clientY >= rect.top && clientY <= rect.bottom;
      });

      if (toIndex < 0 || toIndex === fromIndex) return;
      onReorderStructuredField(fromIndex, toIndex);
      draggingStructuredFieldIndexRef.current = toIndex;
      setDraggingStructuredFieldIndex(toIndex);
    },
    [onReorderStructuredField, structuredFields]
  );

  const finishStructuredFieldDrag = React.useCallback(() => {
    draggingStructuredFieldIndexRef.current = null;
    setDraggingStructuredFieldIndex(null);
  }, []);

  return (
  <div
    className={`h-auto overflow-visible rounded-lg border bg-slate-900 ${
      isSelected ? 'border-cyan-500/60 ring-1 ring-cyan-500/20' : 'border-slate-700'
    }`}
  >
    <div
      className="flex cursor-pointer select-none items-center justify-between rounded-t-lg bg-slate-800/50 p-4 transition-colors hover:bg-slate-800"
      onClick={onToggleCollapse}
    >
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleSelection();
          }}
          className={`flex h-5 w-5 items-center justify-center rounded border text-[10px] font-bold transition-colors ${
            isSelected
              ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
              : 'border-slate-600 text-slate-500 hover:border-cyan-500 hover:text-cyan-300'
          }`}
          title={
            isSelected
              ? t(language, 'templateEditor.unselectStep')
              : t(language, 'templateEditor.selectStep')
          }
        >
          {isSelected ? '✓' : ''}
        </button>
        <span className="rounded bg-slate-700 px-2 py-0.5 text-xs font-bold text-slate-300">
          {displayNodeKindLabel}
        </span>
        <span className="truncate text-sm font-bold text-slate-200">
          {step.name || t(language, 'templateEditor.untitledStep')}
        </span>
        {execution.modelRefId && (
          <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-300">
            {currentRef?.label || t(language, 'templateEditor.modelRef')}
          </span>
        )}
        {nodeKind === 'prompt_function' && (
          <span className="rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 text-[10px] text-slate-300">
            {stepTypeLabel}
          </span>
        )}
        <span className="min-w-0 truncate rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 text-[10px] text-slate-400">
          {displayNodeSummary}
        </span>
        {autoRunEnabled && (
          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
            {t(language, 'templateEditor.autoRunEnabled')}
          </span>
        )}
        {copiedExecutionConfigSourceStepId === step.id && (
          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
            {t(language, 'templateEditor.copiedExecutionConfig')}
          </span>
        )}
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] ${getExecutionBadgeClassName(availability)}`}
        >
          {availability.label}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center overflow-hidden rounded-md border border-slate-700/50 bg-slate-950/40">
          <button
            onClick={(event) => {
              event.stopPropagation();
              onMoveStep('up');
            }}
            disabled={stepIndex === 0}
            className={`p-1.5 transition-colors ${
              stepIndex === 0
                ? 'cursor-not-allowed text-slate-800'
                : 'text-slate-500 hover:bg-slate-700 hover:text-blue-400'
            }`}
            title={t(language, 'templateEditor.moveUp')}
          >
            ^
          </button>
          <div className="h-4 w-px bg-slate-800" />
          <button
            onClick={(event) => {
              event.stopPropagation();
              onMoveStep('down');
            }}
            disabled={stepIndex === editedTemplate.steps.length - 1}
            className={`p-1.5 transition-colors ${
              stepIndex === editedTemplate.steps.length - 1
                ? 'cursor-not-allowed text-slate-800'
                : 'text-slate-500 hover:bg-slate-700 hover:text-blue-400'
            }`}
            title={t(language, 'templateEditor.moveDown')}
          >
            v
          </button>
        </div>

        <button
          onClick={(event) => {
            event.stopPropagation();
            onRemoveStep();
          }}
          className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-red-400/10 hover:text-red-400"
          title={t(language, 'templateEditor.deleteStep')}
        >
          {t(language, 'templateEditor.delete')}
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleStepMenu();
            }}
            className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] font-bold text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
            title={t(language, 'templateEditor.moreActions')}
          >
            {t(language, 'templateEditor.moreActions')}
          </button>
          {isStepMenuOpen && (
            <div
              className="absolute right-0 top-full z-20 mt-2 min-w-[200px] rounded-lg border border-slate-700 bg-slate-950 p-1 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={onCopyExecutionConfig}
                className="block w-full rounded px-3 py-2 text-left text-xs text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
              >
                {t(language, 'templateEditor.copyExecutionConfig')}
              </button>
              {copiedExecutionConfigSourceStepId &&
                copiedExecutionConfigSourceStepId !== step.id && (
                  <button
                    type="button"
                    onClick={onPasteExecutionConfig}
                    className="block w-full rounded px-3 py-2 text-left text-xs text-emerald-300 transition-colors hover:bg-slate-800 hover:text-white"
                    title={t(language, 'templateEditor.applyCopiedConfigFrom', {
                      stepName:
                        copiedExecutionConfigSourceStepName ||
                        t(language, 'templateEditor.untitledStep'),
                    })}
                  >
                    {t(language, 'templateEditor.applyCopiedConfig')}
                  </button>
                )}
            </div>
          )}
        </div>

        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          fill="currentColor"
          className={`h-4 w-4 text-slate-500 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
        >
          <path
            fillRule="evenodd"
            d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    </div>

    {!isCollapsed && (
      <div className="h-auto overflow-visible border-t border-slate-800 p-4">
        <div className="mb-4 flex items-start gap-4">
          <div className="flex-1 space-y-2">
            <label className="text-xs font-bold uppercase text-slate-500">
              {t(language, 'templateEditor.stepName')}
            </label>
            <input
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
              value={step.name}
              onChange={(event) => onUpdateStep({ name: event.target.value })}
              placeholder={t(language, 'templateEditor.stepName')}
            />
          </div>
          <div className="flex-1 space-y-2">
            <label className="text-xs font-bold uppercase text-slate-500">
              {t(language, 'templateEditor.description')}
            </label>
            <input
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
              value={step.description || ''}
              onChange={(event) =>
                onUpdateStep({ description: event.target.value })
              }
              placeholder={t(language, 'templateEditor.optionalDescription')}
            />
          </div>
        </div>

        {nodeKind === 'variable' && (
          <div className="mb-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-xs font-bold text-emerald-300">
                {language === 'zh-CN' ? '变量节点' : 'Variable node'}
              </div>
              <div className="truncate font-mono text-[11px] text-emerald-200">
                {language === 'zh-CN' ? '输出端：值' : 'Output: value'}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <label className="space-y-1">
                <span className="text-[11px] font-bold text-slate-500">
                  {language === 'zh-CN' ? '变量名' : 'Variable name'}
                </span>
                <input
                  value={step.variable?.name || ''}
                  onChange={(event) => {
                    const name = event.target.value;
                    onUpdateStep({
                      variable: {
                        ...(step.variable || { defaultValue: '' }),
                        name,
                      },
                    });
                  }}
                  className="w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-200 outline-none focus:border-emerald-500"
                  placeholder={language === 'zh-CN' ? '例如 topic' : 'e.g. topic'}
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-bold text-slate-500">
                  {language === 'zh-CN' ? '默认值' : 'Default value'}
                </span>
                <textarea
                  value={step.variable?.defaultValue || ''}
                  onChange={(event) =>
                    onUpdateStep({
                      variable: {
                        ...(step.variable || {}),
                        name: step.variable?.name || '',
                        defaultValue: event.target.value,
                      },
                    })
                  }
                  className="min-h-24 w-full resize-y rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-200 outline-none focus:border-emerald-500"
                  placeholder={language === 'zh-CN' ? '没有本地值时使用这个值' : 'Used when no local value exists'}
                />
              </label>
            </div>
          </div>
        )}

        {nodeKind === 'math_operation' && (
          <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-xs font-bold text-amber-300">
                {language === 'zh-CN' ? '数学节点' : 'Math node'}
              </div>
              <div className="truncate font-mono text-[11px] text-amber-200">
                {step.math?.leftKey?.trim() || 'A'} {operationSymbol} {step.math?.rightKey?.trim() || 'B'} -&gt;{' '}
                {language === 'zh-CN' ? '结果' : localOutputKey}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_72px_minmax(0,1fr)]">
              <input
                value={step.math?.leftKey || ''}
                onChange={(event) =>
                  onUpdateStep({ math: { ...(step.math || { operation: 'add', rightKey: '', outputKey: `${step.id}:result` }), leftKey: event.target.value } })
                }
                className="rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-200 outline-none focus:border-amber-500"
                placeholder={language === 'zh-CN' ? '输入 A：变量名或数字' : 'Input A: name or number'}
              />
              <select
                value={step.math?.operation || 'add'}
                onChange={(event) =>
                  onUpdateStep({
                    math: {
                      leftKey: step.math?.leftKey || '',
                      rightKey: step.math?.rightKey || '',
                      outputKey: step.math?.outputKey || `${step.id}:result`,
                      operation: event.target.value as 'add' | 'subtract' | 'multiply' | 'divide',
                    },
                  })
                }
                className="rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-200 outline-none focus:border-amber-500"
              >
                <option value="add">+</option>
                <option value="subtract">-</option>
                <option value="multiply">*</option>
                <option value="divide">/</option>
              </select>
              <input
                value={step.math?.rightKey || ''}
                onChange={(event) =>
                  onUpdateStep({ math: { ...(step.math || { operation: 'add', leftKey: '', outputKey: `${step.id}:result` }), rightKey: event.target.value } })
                }
                className="rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-200 outline-none focus:border-amber-500"
                placeholder={language === 'zh-CN' ? '输入 B：变量名或数字' : 'Input B: name or number'}
              />
            </div>
          </div>
        )}

        {nodeKind === 'model' && (
          <div className="mb-4 rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-xs font-bold text-violet-300">
                {language === 'zh-CN' ? '模型节点' : 'Model node'}
              </div>
              <div className="truncate font-mono text-[11px] text-violet-200">
                {language === 'zh-CN' ? '输出端' : 'Output'}: model
              </div>
            </div>
            <label className="space-y-1">
              <span className="text-[11px] font-bold text-slate-500">
                {language === 'zh-CN' ? '模型引用' : 'Model reference'}
              </span>
              <select
                value={step.model?.modelRefId || ''}
                onChange={(event) =>
                  onUpdateStep({
                    model: {
                      ...(step.model || {}),
                      modelRefId: event.target.value || undefined,
                    },
                  })
                }
                className="w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-200 outline-none focus:border-violet-500"
              >
                <option value="">
                  {language === 'zh-CN' ? '未绑定' : 'Unbound'}
                </option>
                {modelRefs.map((modelRef) => (
                  <option key={modelRef.id} value={modelRef.id}>
                    {modelRef.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-2 text-[11px] text-slate-500">
              {modelNodeRef
                ? language === 'zh-CN'
                  ? `当前会传递：${modelNodeRef.label}`
                  : `Passing: ${modelNodeRef.label}`
                : language === 'zh-CN'
                  ? '未选择模型引用时，连接到函数节点会阻断执行。'
                  : 'Execution is blocked when a connected model node is unbound.'}
            </div>
          </div>
        )}

        {nodeKind === 'table_row' && (
          <div className="mb-4 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-xs font-bold text-cyan-300">
                {language === 'zh-CN' ? '取表行节点' : 'Table row node'}
              </div>
              <div
                className={`rounded border px-2 py-0.5 text-[11px] ${
                  step.tableRow?.tableKey?.trim()
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                }`}
              >
                {step.tableRow?.tableKey?.trim()
                  ? language === 'zh-CN'
                    ? '已连接表'
                    : 'Table connected'
                  : language === 'zh-CN'
                    ? '等待连接表'
                    : 'Waiting for table'}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_160px]">
              <label className="space-y-1">
                <span className="text-[11px] font-bold text-slate-500">
                  {language === 'zh-CN' ? '已连接表' : 'Connected table'}
                </span>
                <input
                  value={step.tableRow?.tableKey || ''}
                  readOnly
                  className="w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-300 outline-none"
                  placeholder={language === 'zh-CN' ? '从表输出端连线到此节点' : 'Connect a table output to this node'}
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-bold text-slate-500">
                  {language === 'zh-CN' ? '行号' : 'Row number'}
                </span>
                <input
                  value={step.tableRow?.rowIndex || '1'}
                  onChange={(event) =>
                    onUpdateStep({
                      tableRow: {
                        tableKey: step.tableRow?.tableKey || '',
                        rowIndex: event.target.value,
                      },
                    })
                  }
                  className="w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-200 outline-none focus:border-cyan-500"
                  placeholder="1"
                />
              </label>
            </div>
            <div className="mt-3 rounded border border-slate-800 bg-slate-950/70 p-2">
              <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                <span className="font-bold text-slate-400">
                  {language === 'zh-CN' ? '执行效果' : 'Execution effect'}
                </span>
                <span className="font-mono text-cyan-200">
                  {step.tableRow?.tableKey?.trim() || 'table'}[{step.tableRow?.rowIndex?.trim() || '1'}]
                </span>
              </div>
              <div className="text-[11px] text-slate-500">
                {language === 'zh-CN'
                  ? '运行后会把选中行拆成下面这些字段输出，继续连到下游节点。'
                  : 'Running this node publishes the selected row as the field outputs below.'}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(step.outputs || []).length > 0 ? (
                (step.outputs || []).map((output) => (
                  <span
                    key={output.key}
                    className="rounded border border-cyan-500/20 bg-slate-950 px-2 py-1 font-mono text-[11px] text-cyan-200"
                    title={output.key}
                  >
                    {output.label || output.key}
                  </span>
                ))
              ) : (
                <span className="text-[11px] text-slate-500">
                  {language === 'zh-CN' ? '连接表输出后，会按表字段生成输出端。' : 'Connecting a table output creates one output per column.'}
                </span>
              )}
            </div>
          </div>
        )}

        {nodeKind === 'prompt_function' && (
          <>
        <div className="mb-4">
          <StepParametersPanel
            language={language}
            template={editedTemplate}
            step={step}
            onSyncParametersFromContent={onSyncParametersFromContent}
            onAddParameter={onAddParameter}
            onUpdateParameter={onUpdateParameter}
            onRemoveParameter={onRemoveParameter}
          />
        </div>

        <div className="mb-4 space-y-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onTogglePromptCollapsed}
              className="flex min-w-0 flex-1 items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-2 text-left transition-colors hover:border-slate-700"
            >
              <span className="truncate text-xs font-bold uppercase text-slate-400">
                {t(language, 'templateEditor.promptContent')}
              </span>
              <span className="shrink-0 text-[11px] text-slate-500">
                {isPromptCollapsed
                  ? language === 'zh-CN'
                    ? '已折叠'
                    : 'Collapsed'
                  : language === 'zh-CN'
                    ? '已展开'
                    : 'Expanded'}
              </span>
            </button>
            {onOpenFunctionTab && (
              <button
                type="button"
                onClick={onOpenFunctionTab}
                className="shrink-0 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-[11px] font-bold text-violet-200 transition-colors hover:border-violet-400/60 hover:text-white"
              >
                {language === 'zh-CN'
                  ? isFunctionTabOpen
                    ? '切到函数标签'
                    : '打开函数标签'
                  : isFunctionTabOpen
                    ? 'Show function tab'
                    : 'Open function tab'}
              </button>
            )}
          </div>
          {!isPromptCollapsed && (
          <div className="relative flex h-auto flex-col rounded border border-slate-700 bg-slate-950 p-4">
            <PromptCodeEditor
              className="rounded-md border border-slate-800 bg-slate-950/70 p-3 focus-within:border-cyan-500"
              minHeight={180}
              allowManualResize
              language={language}
              parameters={step.parameters || []}
              value={step.content}
              onChange={onPromptChange}
              onKeyDown={onPromptKeyDown}
              onClick={onSyncAutocomplete}
              onSelect={onSyncAutocomplete}
              onBlur={onClearAutocompleteLater}
              textareaRef={onPromptTextareaRef}
              placeholder={t(language, 'templateEditor.promptPlaceholder')}
            />
            {autocompleteState?.stepId === step.id &&
              filteredAutocompleteItems.length > 0 && (
                <div className="absolute left-4 right-4 top-full z-20 mt-2 rounded-xl border border-slate-700 bg-slate-900/95 p-2 shadow-2xl backdrop-blur">
                  <div className="mb-2 px-2 text-[11px] text-slate-500">
                    {language === 'zh-CN'
                      ? '变量补全'
                      : 'Variable suggestions'}
                  </div>
                  <div className="max-h-56 space-y-1 overflow-y-auto">
                    {filteredAutocompleteItems.map((item, itemIndex) => (
                      <button
                        key={`${step.id}_${item.key}_${itemIndex}`}
                        type="button"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          onApplyAutocompleteItem(item);
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors ${
                          autocompleteState.selectedIndex === itemIndex
                            ? 'bg-cyan-500/15 text-cyan-200'
                            : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <div>
                          <div className="font-mono text-xs">{`--${item.key}--`}</div>
                          <div className="text-[11px] text-slate-500">
                            {item.label}
                          </div>
                        </div>
                        <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-400">
                          {item.sourceLabel}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
          </div>
          )}
        </div>

        <div className="mb-4 border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={onToggleExecutionSection}
            className="flex w-full items-start justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-3 text-left transition-colors hover:border-slate-700"
          >
            <div>
              <div className="text-xs font-bold uppercase text-cyan-400">
                {t(language, 'templateEditor.executionSummary')}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                {executionSummaryParts.join(' / ')}
              </div>
            </div>
            <span className="text-[11px] font-bold text-cyan-300">
              {isExecutionExpanded
                ? t(language, 'templateEditor.collapseExecution')
                : t(language, 'templateEditor.expandExecution')}
            </span>
          </button>
          {isExecutionExpanded && (
            <div className="mt-3 space-y-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase text-slate-500">
                  {t(language, 'templateEditor.executionTemplateSelect')}
                </label>
                {matchedPreset && (
                  <div className="text-[11px] text-cyan-300">
                    {t(language, 'templateEditor.currentPreset')}:{' '}
                    {matchedPreset.label}
                  </div>
                )}
              </div>
              {!execution.modelRefId && (
                <div className="text-xs text-slate-500">
                  {t(language, 'templateEditor.manualStepHint')}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedExecutionPresetValue}
                  onChange={(event) =>
                    onSelectedExecutionPresetChange(event.target.value)
                  }
                  className="min-w-[160px] flex-1 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500"
                >
                  <option value="">
                    {t(language, 'templateEditor.executionTemplateSelect')}
                  </option>
                  {enabledExecutionPresetTemplates.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={onApplyExecutionPreset}
                  disabled={!selectedExecutionPresetValue}
                  className={`rounded-md px-3 py-2 text-xs font-bold transition-colors ${
                    selectedExecutionPresetValue
                      ? 'border border-cyan-500/20 bg-cyan-500/10 text-cyan-300 hover:border-cyan-400/40 hover:text-white'
                      : 'cursor-not-allowed border border-slate-800 bg-slate-900 text-slate-600'
                  }`}
                >
                  {t(language, 'templateEditor.applyExecutionTemplate')}
                </button>
                <button
                  type="button"
                  onClick={onStartSavingExecutionPreset}
                  className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
                >
                  {t(language, 'templateEditor.saveAsPreset')}
                </button>
              </div>
              {savingExecutionPresetStepId === step.id && (
                <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/80 p-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold uppercase text-slate-500">
                        {t(language, 'templateEditor.presetName')}
                      </label>
                      <input
                        value={executionPresetDraft.label}
                        onChange={(event) =>
                          onUpdateExecutionPresetDraft({
                            label: event.target.value,
                          })
                        }
                        className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500"
                        placeholder={t(language, 'templateEditor.presetName')}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold uppercase text-slate-500">
                        {t(language, 'templateEditor.modelStrategy')}
                      </label>
                      <select
                        value={executionPresetDraft.modelRefStrategy}
                        onChange={(event) =>
                          onUpdateExecutionPresetDraft({
                            modelRefStrategy:
                              event.target.value as ExecutionPresetModelRefStrategy,
                          })
                        }
                        className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500"
                      >
                        <option value="keep_current">
                          {t(language, 'templateEditor.keepCurrentModel')}
                        </option>
                        <option
                          value="bind_specific_model_catalog_item"
                          disabled={!currentRef?.modelCatalogItemId}
                        >
                          {t(language, 'templateEditor.bindCurrentCatalogModel')}
                        </option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase text-slate-500">
                      {t(language, 'templateEditor.presetDescription')}
                    </label>
                    <input
                      value={executionPresetDraft.description}
                      onChange={(event) =>
                        onUpdateExecutionPresetDraft({
                          description: event.target.value,
                        })
                      }
                      className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500"
                      placeholder={t(language, 'templateEditor.presetDescription')}
                    />
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {currentRef?.modelCatalogItemId
                      ? executionPresetDraft.modelRefStrategy ===
                        'bind_specific_model_catalog_item'
                        ? t(language, 'templateEditor.presetSaveHintBound')
                        : t(language, 'templateEditor.presetSaveHintKeep')
                      : t(language, 'templateEditor.presetSaveHintNoModel')}
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={onCancelSavingExecutionPreset}
                    >
                      {t(language, 'templateEditor.cancel')}
                    </Button>
                    <Button size="sm" onClick={onSaveCurrentExecutionPreset}>
                      {t(language, 'templateEditor.savePreset')}
                    </Button>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase text-slate-500">
                    {t(language, 'templateEditor.executionPreset')}
                  </label>
                  <button
                    onClick={() =>
                      onUpdateStepExecution({
                        temperature: undefined,
                        maxTokens: undefined,
                      })
                    }
                    className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] font-bold text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
                  >
                    {t(language, 'templateEditor.clearPreset')}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {DEEPSEEK_EXECUTION_PRESETS.map((preset) => {
                    const isActive =
                      execution.temperature === preset.temperature &&
                      execution.maxTokens === preset.maxTokens;
                    return (
                      <button
                        key={preset.id}
                        onClick={() =>
                          onUpdateStepExecution({
                            temperature: preset.temperature,
                            maxTokens: preset.maxTokens,
                          })
                        }
                        className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-bold transition-colors ${
                          isActive
                            ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-300'
                            : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500 hover:text-white'
                        }`}
                        title={preset.description}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
                <div className="text-[11px] text-slate-500">
                  {t(language, 'templateEditor.presetHelp')}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase text-slate-500">
                    {t(language, 'templateEditor.stepType')}
                  </label>
                  <select
                    value={stepType}
                    onChange={(event) => {
                      const nextStepType = event.target.value as StepType;
                      onUpdateStepMeta({
                        stepType: nextStepType,
                        autoRunEnabled:
                          nextStepType === 'text_generation'
                            ? step.autoRunEnabled === true
                            : false,
                      });
                    }}
                    className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                  >
                    <option value="text_generation">
                      {t(language, 'templateEditor.stepTypeText')}
                    </option>
                    <option value="manual">
                      {t(language, 'templateEditor.stepTypeManual')}
                    </option>
                    <option value="external">
                      {t(language, 'templateEditor.stepTypeExternal')}
                    </option>
                  </select>
                  <div className="text-[11px] text-slate-500">{stepTypeHelp}</div>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase text-slate-500">
                    {t(language, 'templateEditor.autoRunEnabled')}
                  </label>
                  <label className="flex items-center gap-3 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      checked={autoRunEnabled}
                      disabled={stepType !== 'text_generation'}
                      onChange={(event) =>
                        onUpdateStepMeta({
                          autoRunEnabled:
                            stepType === 'text_generation'
                              ? event.target.checked
                              : false,
                        })
                      }
                      className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                    />
                    <span className="text-xs">
                      {stepType === 'text_generation'
                        ? t(language, 'templateEditor.autoRunHelp')
                        : t(language, 'templateEditor.autoRunDisabledHelp')}
                    </span>
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase text-slate-500">
                    {t(language, 'templateEditor.modelRef')}
                  </label>
                  <select
                    value={execution.modelRefId || ''}
                    onChange={(event) =>
                      onApplyStepModelRef(event.target.value || undefined)
                    }
                    className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                  >
                    <option value="">
                      {t(language, 'templateEditor.noModelRefOption')}
                    </option>
                    {modelRefs.map((modelRef) => (
                      <option key={modelRef.id} value={modelRef.id}>
                        {modelRef.label}
                        {modelRef.modelCatalogItemId &&
                        !modelRefs.find((item) => item.id === modelRef.id)
                          ? t(language, 'templateEditor.missingSuffix')
                          : ''}
                      </option>
                    ))}
                  </select>
                  {recommendedPreset && (
                    <div className="text-[11px] text-slate-500">
                      {t(language, 'templateEditor.recommendedPreset')}:{' '}
                      {recommendedPreset.label}
                      {execution.temperature === undefined &&
                      execution.maxTokens === undefined
                        ? t(language, 'templateEditor.recommendedPresetAuto')
                        : t(language, 'templateEditor.recommendedPresetManual')}
                    </div>
                  )}
                  {execution.modelSourceStepId && (
                    <div className="text-[11px] text-violet-300">
                      {language === 'zh-CN'
                        ? `已连接模型节点，运行时优先使用：${connectedModelRef?.label || connectedModelStep?.name || execution.modelSourceStepId}`
                        : `Connected model node takes priority: ${connectedModelRef?.label || connectedModelStep?.name || execution.modelSourceStepId}`}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase text-slate-500">
                    {t(language, 'templateEditor.executionStatus')}
                  </label>
                  <div
                    className={`rounded border px-3 py-2 text-sm ${getExecutionBadgeClassName(availability)}`}
                  >
                    {availability.label}
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {t(language, 'templateEditor.statusNote')}
                </div>
                <div className="mt-1 text-xs text-slate-300">
                  {availability.message}
                </div>
                {availability.modelCatalogItem && availability.providerConfig && (
                  <div className="mt-2 text-[11px] text-slate-500">
                    {availability.providerConfig.label} /{' '}
                    {availability.modelCatalogItem.label}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase text-slate-500">
                    {t(language, 'step.temperature')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    value={execution.temperature ?? ''}
                    onChange={(event) =>
                      onUpdateStepExecution({
                        temperature:
                          event.target.value === ''
                            ? undefined
                            : Number(event.target.value),
                      })
                    }
                    className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                    placeholder={t(language, 'templateEditor.defaultPlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase text-slate-500">
                    {t(language, 'step.maxTokens')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={execution.maxTokens ?? ''}
                    onChange={(event) =>
                      onUpdateStepExecution({
                        maxTokens:
                          event.target.value === ''
                            ? undefined
                            : Number(event.target.value),
                      })
                    }
                    className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                    placeholder={t(language, 'templateEditor.defaultPlaceholder')}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase text-slate-500">
                  {t(language, 'step.systemPrompt')}
                </label>
                {matchedSystemPromptPreset && (
                  <div className="text-[11px] text-cyan-300">
                    {t(language, 'templateEditor.currentTemplate')}:{' '}
                    {matchedSystemPromptPreset.label}
                  </div>
                )}
                {recommendedSystemPromptPreset && (
                  <div className="text-[11px] text-slate-500">
                    {t(language, 'templateEditor.recommendedTemplate')}:{' '}
                    {recommendedSystemPromptPreset.label}
                    {!execution.systemPrompt.trim()
                      ? t(language, 'templateEditor.systemPromptAuto')
                      : t(language, 'templateEditor.systemPromptManual')}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {DEEPSEEK_SYSTEM_PROMPT_PRESETS.map((preset) => {
                    const isActive = execution.systemPrompt === preset.content;
                    return (
                      <button
                        key={preset.id}
                        onClick={() =>
                          onUpdateStepExecution({ systemPrompt: preset.content })
                        }
                        className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-bold transition-colors ${
                          isActive
                            ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-300'
                            : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500 hover:text-white'
                        }`}
                        title={preset.description}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => onUpdateStepExecution({ systemPrompt: '' })}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-[10px] font-bold text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
                  >
                    {t(language, 'templateEditor.clearTemplate')}
                  </button>
                </div>
                <div className="rounded border border-slate-700 bg-slate-950 p-4">
                  <AutoResizeTextarea
                    className="text-sm leading-relaxed text-slate-300"
                    value={execution.systemPrompt}
                    onChange={(value) =>
                      onUpdateStepExecution({ systemPrompt: value })
                    }
                    placeholder={t(
                      language,
                      'templateEditor.systemPromptPlaceholder'
                    )}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-slate-800 pt-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-violet-300">
                {language === 'zh-CN' ? '返回值' : 'Return values'}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                {language === 'zh-CN'
                  ? '不声明返回值时，只保留 AI 的原始返回。'
                  : 'When no return value is declared, the raw AI response is kept.'}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-[92px_minmax(0,1fr)] items-center gap-3">
            <div className="text-xs font-bold text-violet-300">
              {language === 'zh-CN' ? '文本' : 'Text'}
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <input
                value={binding.variableKey || ''}
                onChange={(event) =>
                  onUpdateStepBinding({
                    variableKey: event.target.value,
                    variableLabel: event.target.value,
                  })
                }
                className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-200 outline-none focus:border-blue-500"
                placeholder={language === 'zh-CN' ? '返回值名，例如：summary' : 'Return name, e.g. summary'}
              />
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="text-xs font-bold text-fuchsia-300">
                {language === 'zh-CN' ? '表' : 'Table'}
              </div>
              <span className="text-[11px] text-slate-500">
                {structuredFields.length > 0
                  ? language === 'zh-CN'
                    ? `${structuredFields.length} 列`
                    : `${structuredFields.length} columns`
                  : language === 'zh-CN'
                    ? '未设置'
                    : 'None'}
              </span>
            </div>
            <button
              type="button"
              onClick={onAddStructuredField}
              className="rounded border border-dashed border-fuchsia-500/30 bg-fuchsia-500/5 px-2 py-1 text-[11px] font-bold text-fuchsia-300 transition-colors hover:border-fuchsia-400/50 hover:text-white"
            >
              {language === 'zh-CN' ? '新增列' : 'Add column'}
            </button>
          </div>
          <div className="space-y-2">
              {structuredFields.map((field, fieldIndex) => {
                return (
                  <div
                    key={`${step.id}_structured_${fieldIndex}`}
                    ref={(node) => {
                      structuredFieldRowRefs.current[fieldIndex] = node;
                    }}
                    className={`grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1.4fr)_auto] items-center gap-2 rounded border p-2 transition-colors ${
                      draggingStructuredFieldIndex === fieldIndex
                        ? 'border-fuchsia-500/50 bg-fuchsia-500/10 opacity-70'
                        : 'border-slate-800 bg-slate-950/50'
                    }`}
                  >
                    <button
                      type="button"
                      onPointerDown={(event) => {
                        event.preventDefault();
                        draggingStructuredFieldIndexRef.current = fieldIndex;
                        setDraggingStructuredFieldIndex(fieldIndex);
                        event.currentTarget.setPointerCapture(event.pointerId);
                      }}
                      onPointerMove={(event) => {
                        if (draggingStructuredFieldIndexRef.current === null) return;
                        event.preventDefault();
                        updateStructuredFieldDragTarget(event.clientY);
                      }}
                      onPointerUp={(event) => {
                        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                          event.currentTarget.releasePointerCapture(event.pointerId);
                        }
                        finishStructuredFieldDrag();
                      }}
                      onPointerCancel={finishStructuredFieldDrag}
                      className="touch-none cursor-grab select-none rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] font-bold text-slate-500 active:cursor-grabbing"
                      title={language === 'zh-CN' ? '拖拽排序' : 'Drag to reorder'}
                    >
                      ⋮⋮
                    </button>
                    <div className="min-w-0">
                      <input
                        value={field.key}
                        onChange={(event) =>
                          onUpdateStructuredField(fieldIndex, {
                            key: event.target.value,
                            label: event.target.value,
                          })
                        }
                        className="w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-200 outline-none focus:border-fuchsia-500"
                        placeholder={language === 'zh-CN' ? `第 ${fieldIndex + 1} 列变量名` : `Column ${fieldIndex + 1} name`}
                      />
                    </div>
                    <div className="min-w-0">
                      <input
                        value={field.description || ''}
                        onChange={(event) =>
                          onUpdateStructuredField(fieldIndex, {
                            description: event.target.value,
                          })
                        }
                        className="w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-200 outline-none focus:border-fuchsia-500"
                        placeholder={language === 'zh-CN' ? '说明（可选）' : 'Description (optional)'}
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onRemoveStructuredField(fieldIndex)}
                        className="rounded border border-red-500/20 bg-red-500/10 px-1.5 py-1 text-[10px] font-bold text-red-300 hover:border-red-400/40 hover:text-white"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
        </div>
          </>
        )}
      </div>
    )}
  </div>
  );
};
