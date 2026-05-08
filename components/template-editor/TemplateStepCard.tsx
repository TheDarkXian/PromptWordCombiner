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
  Template,
  TemplateModelRef,
  TemplateStep,
  UiLanguage,
} from '../../types';
import { t } from '../../services/i18n';
import { Button } from '../Button';
import { AutoResizeTextarea } from '../common/AutoResizeTextarea';

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
  isBindingExpanded: boolean;
  availability: StepExecutionAvailability;
  binding: StepOutputBinding;
  execution: StepExecutionConfig;
  bindingKey: string;
  isKnownVariable: boolean;
  currentRef?: TemplateModelRef;
  matchedPreset?: { id: string; label: string; description?: string };
  recommendedPreset?: { id: string; label: string };
  matchedSystemPromptPreset?: { id: string; label: string; description?: string; content: string };
  recommendedSystemPromptPreset?: { id: string; label: string };
  selectedExecutionPresetValue: string;
  enabledExecutionPresetTemplates: ExecutionPresetTemplate[];
  executionSummaryParts: string[];
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
  onMoveStep: (direction: 'up' | 'down') => void;
  onRemoveStep: () => void;
  onToggleStepMenu: () => void;
  isStepMenuOpen: boolean;
  onCopyExecutionConfig: () => void;
  onPasteExecutionConfig: () => void;
  onUpdateStep: (updates: Partial<TemplateStep>) => void;
  onPromptChange: (value: string) => void;
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
  onApplyStepModelRef: (modelRefId?: string) => void;
  onToggleBindingSection: () => void;
  onUpdateStepBinding: (updates: Partial<StepOutputBinding>) => void;
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
  isBindingExpanded,
  availability,
  binding,
  execution,
  bindingKey,
  isKnownVariable,
  currentRef,
  matchedPreset,
  recommendedPreset,
  matchedSystemPromptPreset,
  recommendedSystemPromptPreset,
  selectedExecutionPresetValue,
  enabledExecutionPresetTemplates,
  executionSummaryParts,
  copiedExecutionConfigSourceStepId,
  copiedExecutionConfigSourceStepName,
  savingExecutionPresetStepId,
  executionPresetDraft,
  autocompleteState,
  filteredAutocompleteItems,
  onToggleSelection,
  onToggleCollapse,
  onMoveStep,
  onRemoveStep,
  onToggleStepMenu,
  isStepMenuOpen,
  onCopyExecutionConfig,
  onPasteExecutionConfig,
  onUpdateStep,
  onPromptChange,
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
  onApplyStepModelRef,
  onToggleBindingSection,
  onUpdateStepBinding,
  getExecutionBadgeClassName,
}) => {
  const stepType = step.stepType || 'manual';
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
          Step {stepIndex + 1}
        </span>
        <span className="truncate text-sm font-bold text-slate-200">
          {step.name || t(language, 'templateEditor.untitledStep')}
        </span>
        {execution.modelRefId && (
          <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-300">
            {currentRef?.label || t(language, 'templateEditor.modelRef')}
          </span>
        )}
        <span className="rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 text-[10px] text-slate-300">
          {stepTypeLabel}
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
            ↑
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
            ↓
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

        <div className="mb-4 space-y-2">
          <label className="text-xs font-bold uppercase text-slate-400">
            {t(language, 'templateEditor.promptContent')}
          </label>
          <div className="relative flex h-auto flex-col rounded border border-slate-700 bg-slate-950 p-4">
            <AutoResizeTextarea
              className="font-mono text-sm leading-relaxed text-slate-300"
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
                          <div className="font-mono text-xs">{`{{${item.key}}}`}</div>
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
                {executionSummaryParts.join(' · ')}
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
                  className="min-w-[220px] flex-1 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500"
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

        <div className="border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={onToggleBindingSection}
            className="flex w-full items-start justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-3 text-left transition-colors hover:border-slate-700"
          >
            <div>
              <div className="text-xs font-bold uppercase text-violet-400">
                {t(language, 'templateEditor.outputToVar')}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                {bindingKey
                  ? t(language, 'templateEditor.bindingSummaryBound', {
                      key: bindingKey,
                    })
                  : t(language, 'templateEditor.bindingSummaryUnbound')}
              </div>
            </div>
            <span className="text-[11px] font-bold text-violet-300">
              {isBindingExpanded
                ? t(language, 'templateEditor.collapseBinding')
                : t(language, 'templateEditor.expandBinding')}
            </span>
          </button>
          {isBindingExpanded && (
            <div className="mt-3 space-y-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <div className="text-xs text-slate-500">
                {t(language, 'templateEditor.bindingHelp')}
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase text-slate-500">
                    {t(language, 'templateEditor.varKey')}
                  </label>
                  <input
                    value={binding.variableKey || ''}
                    onChange={(event) =>
                      onUpdateStepBinding({ variableKey: event.target.value })
                    }
                    className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                    placeholder="scene_description"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase text-slate-500">
                    {t(language, 'templateEditor.displayName')}
                  </label>
                  <input
                    value={binding.variableLabel || ''}
                    onChange={(event) =>
                      onUpdateStepBinding({ variableLabel: event.target.value })
                    }
                    className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                    placeholder={t(language, 'templateEditor.displayName')}
                  />
                </div>
              </div>
              {bindingKey && (
                <div
                  className={`text-xs ${
                    isKnownVariable ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {isKnownVariable
                    ? t(language, 'templateEditor.bindingKnown')
                    : t(language, 'templateEditor.bindingNew')}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )}
  </div>
  );
};
