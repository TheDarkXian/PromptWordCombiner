import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  DEEPSEEK_EXECUTION_PRESETS,
  DEEPSEEK_SYSTEM_PROMPT_PRESETS,
  getRecommendedDeepSeekPresetByModelName,
  getRecommendedDeepSeekSystemPromptPresetByModelName,
} from '../constants';
import {
  ExecutionPresetModelRefStrategy,
  ExecutionPresetTemplate,
  ModelCatalogItem,
  ProviderConfig,
  StepType,
  StepExecutionAvailability,
  StepExecutionConfig,
  StepOutputBinding,
  Template,
  TemplateInput,
  TemplateModelRef,
  TemplateStep,
  UiLanguage,
} from '../types';
import { resolveStepExecutionAvailability } from '../services/modelService';
import { t } from '../services/i18n';
import { Button } from './Button';
import { TemplateInputsPanel } from './template-editor/TemplateInputsPanel';
import { TemplateMetaPanel } from './template-editor/TemplateMetaPanel';
import { TemplateModelRefsPanel } from './template-editor/TemplateModelRefsPanel';
import { TemplateStepCard } from './template-editor/TemplateStepCard';

interface TemplateEditorProps {
  language: UiLanguage;
  template: Template;
  modelCatalog: ModelCatalogItem[];
  providerConfigs: ProviderConfig[];
  executionPresetTemplates: ExecutionPresetTemplate[];
  onSave: (template: Template) => void;
  onSaveExecutionPresetTemplate: (preset: {
    label: string;
    description?: string;
    modelRefStrategy: ExecutionPresetModelRefStrategy;
    modelCatalogItemId?: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
  }) => void;
  onCancel: () => void;
  onRequestConfirm: (title: string, message: string, onConfirm: () => void) => void;
}

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

const normalizeBinding = (binding?: StepOutputBinding): StepOutputBinding => binding || {};
const normalizeExecution = (execution?: StepExecutionConfig): StepExecutionConfig => ({
  systemPrompt: '',
  temperature: undefined,
  maxTokens: undefined,
  ...execution,
});
const cloneTemplate = (template: Template): Template => JSON.parse(JSON.stringify(template));
const createLocalizedModelRefLabel = (language: UiLanguage, existingRefs: TemplateModelRef[]) =>
  t(language, 'templateEditor.defaultModelRefLabel', { count: existingRefs.length + 1 });

const getStepTypeLabel = (language: UiLanguage, stepType: StepType) =>
  stepType === 'text_generation'
    ? t(language, 'templateEditor.stepTypeText')
    : stepType === 'external'
      ? t(language, 'templateEditor.stepTypeExternal')
      : t(language, 'templateEditor.stepTypeManual');

const getExecutionBadgeClassName = (availability: StepExecutionAvailability) => {
  switch (availability.status) {
    case 'ready':
      return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300';
    case 'manual':
      return 'border-slate-700 bg-slate-900 text-slate-400';
    default:
      return 'border-amber-500/20 bg-amber-500/10 text-amber-300';
  }
};

export const TemplateEditor: React.FC<TemplateEditorProps> = ({
  language,
  template,
  modelCatalog,
  providerConfigs,
  executionPresetTemplates,
  onSave,
  onSaveExecutionPresetTemplate,
  onCancel,
  onRequestConfirm,
}) => {
  const [editedTemplate, setEditedTemplate] = useState<Template>(cloneTemplate(template));
  const [collapsedSteps, setCollapsedSteps] = useState<Record<number, boolean>>({});
  const [selectedStepIds, setSelectedStepIds] = useState<string[]>([]);
  const [selectionModelRefId, setSelectionModelRefId] = useState<string>('');
  const [copiedExecutionConfig, setCopiedExecutionConfig] = useState<{
    sourceStepId: string;
    sourceStepName: string;
    execution: StepExecutionConfig;
  } | null>(null);
  const [openStepMenuId, setOpenStepMenuId] = useState<string | null>(null);
  const [expandedExecutionByStepId, setExpandedExecutionByStepId] = useState<Record<string, boolean>>({});
  const [expandedBindingByStepId, setExpandedBindingByStepId] = useState<Record<string, boolean>>({});
  const [selectedExecutionPresetByStepId, setSelectedExecutionPresetByStepId] = useState<Record<string, string>>({});
  const [savingExecutionPresetStepId, setSavingExecutionPresetStepId] = useState<string | null>(null);
  const [executionPresetDraft, setExecutionPresetDraft] = useState<{
    label: string;
    description: string;
    modelRefStrategy: ExecutionPresetModelRefStrategy;
  }>({
    label: '新执行模板',
    description: '',
    modelRefStrategy: 'keep_current',
  });
  const [autocompleteState, setAutocompleteState] = useState<VariableAutocompleteState | null>(null);
  const promptTextareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  useEffect(() => {
    setEditedTemplate(cloneTemplate(template));
    setSelectedStepIds([]);
    setSelectionModelRefId('');
    setCopiedExecutionConfig(null);
    setOpenStepMenuId(null);
    setExpandedExecutionByStepId({});
    setExpandedBindingByStepId({});
    setSelectedExecutionPresetByStepId({});
    setSavingExecutionPresetStepId(null);
    setAutocompleteState(null);
  }, [template]);

  const modelRefs = editedTemplate.modelRefs || [];

  const knownVariableKeys = useMemo(
    () =>
      Array.from(
        new Set([
          ...editedTemplate.inputs.map((input) => input.label.trim()).filter(Boolean),
          ...editedTemplate.steps
            .map((step) => step.outputBinding?.variableKey?.trim() || '')
            .filter(Boolean),
        ])
      ),
    [editedTemplate.inputs, editedTemplate.steps]
  );

  const variableAutocompleteItems = useMemo<VariableAutocompleteItem[]>(
    () => [
      ...editedTemplate.inputs
        .map((input) => input.label.trim())
        .filter(Boolean)
        .map((key) => ({
          key,
          label: key,
          sourceType: 'template_input' as const,
          sourceLabel: language === 'zh-CN' ? '输入变量' : 'Input',
        })),
      ...editedTemplate.steps
        .map((step) => {
          const key = step.outputBinding?.variableKey?.trim() || '';
          if (!key) return null;
          return {
            key,
            label: step.outputBinding?.variableLabel?.trim() || key,
            sourceType: 'step_output' as const,
            sourceLabel: language === 'zh-CN' ? '步骤输出' : 'Step output',
          };
        })
        .filter((item): item is VariableAutocompleteItem => Boolean(item)),
    ],
    [editedTemplate.inputs, editedTemplate.steps, language]
  );

  const enabledExecutionPresetTemplates = useMemo(
    () => executionPresetTemplates.filter((item) => item.enabled),
    [executionPresetTemplates]
  );

  const filteredAutocompleteItems = useMemo(() => {
    if (!autocompleteState) return [];
    const query = autocompleteState.query.trim().toLowerCase();
    if (!query) return variableAutocompleteItems;

    return variableAutocompleteItems.filter((item) => {
      const key = item.key.toLowerCase();
      const label = item.label.toLowerCase();
      return key.includes(query) || label.includes(query);
    });
  }, [autocompleteState, variableAutocompleteItems]);

  useEffect(() => {
    if (!autocompleteState) return;

    if (filteredAutocompleteItems.length === 0) {
      setAutocompleteState((prev) => (prev ? { ...prev, selectedIndex: 0 } : prev));
      return;
    }

    setAutocompleteState((prev) =>
      prev
        ? {
            ...prev,
            selectedIndex: Math.min(prev.selectedIndex, filteredAutocompleteItems.length - 1),
          }
        : prev
    );
  }, [autocompleteState, filteredAutocompleteItems.length]);

  const getCatalogItem = (itemId?: string) => modelCatalog.find((item) => item.id === itemId);
  const getModelRef = (modelRefId?: string) => modelRefs.find((item) => item.id === modelRefId);

  const getRecommendedPresetForModelRef = (modelRefId?: string) => {
    const modelRef = getModelRef(modelRefId);
    const catalogItem = getCatalogItem(modelRef?.modelCatalogItemId);
    return getRecommendedDeepSeekPresetByModelName(catalogItem?.modelName);
  };

  const getRecommendedSystemPromptPresetForModelRef = (modelRefId?: string) => {
    const modelRef = getModelRef(modelRefId);
    const catalogItem = getCatalogItem(modelRef?.modelCatalogItemId);
    return getRecommendedDeepSeekSystemPromptPresetByModelName(catalogItem?.modelName);
  };

  const addInput = () => {
    const newInput: TemplateInput = {
      id: `input_${Date.now()}`,
      label: 'new_input',
    };
    setEditedTemplate((prev) => ({ ...prev, inputs: [...prev.inputs, newInput] }));
  };

  const updateInput = (index: number, updates: Partial<TemplateInput>) => {
    setEditedTemplate((prev) => {
      const inputs = [...prev.inputs];
      inputs[index] = { ...inputs[index], ...updates };
      return { ...prev, inputs };
    });
  };

  const removeInput = (index: number) => {
    onRequestConfirm(t(language, 'templateEditor.deleteInputTitle'), t(language, 'templateEditor.deleteInputMessage'), () => {
      setEditedTemplate((prev) => ({
        ...prev,
        inputs: prev.inputs.filter((_, currentIndex) => currentIndex !== index),
      }));
    });
  };

  const addModelRef = () => {
    const newRef: TemplateModelRef = {
      id: `model_ref_${Date.now()}`,
      label: createLocalizedModelRefLabel(language, modelRefs),
      modelCatalogItemId: modelCatalog[0]?.id,
    };
    setEditedTemplate((prev) => ({
      ...prev,
      modelRefs: [...(prev.modelRefs || []), newRef],
    }));
  };

  const updateModelRef = (index: number, updates: Partial<TemplateModelRef>) => {
    setEditedTemplate((prev) => {
      const nextRefs = [...(prev.modelRefs || [])];
      nextRefs[index] = { ...nextRefs[index], ...updates };
      return { ...prev, modelRefs: nextRefs };
    });
  };

  const removeModelRef = (index: number) => {
    const currentRef = modelRefs[index];
    onRequestConfirm(t(language, 'templateEditor.deleteModelRefTitle'), t(language, 'templateEditor.deleteModelRefMessage'), () => {
      setEditedTemplate((prev) => {
        const nextRefs = (prev.modelRefs || []).filter((_, currentIndex) => currentIndex !== index);
        const nextSteps = prev.steps.map((step) => {
          if (step.execution?.modelRefId !== currentRef.id) return step;
          return {
            ...step,
            execution: {
              ...normalizeExecution(step.execution),
              modelRefId: undefined,
            },
          };
        });

        return {
          ...prev,
          modelRefs: nextRefs,
          steps: nextSteps,
        };
      });
    });
  };

  const addStep = () => {
    const newStep: TemplateStep = {
      id: `step_${Date.now()}`,
      name: 'New Step',
      content: 'Write your prompt template here...',
      outputBinding: {},
      execution: normalizeExecution(),
      stepType: 'manual',
      autoRunEnabled: false,
    };
    setEditedTemplate((prev) => ({ ...prev, steps: [...prev.steps, newStep] }));
  };

  const updateStep = (index: number, updates: Partial<TemplateStep>) => {
    setEditedTemplate((prev) => {
      const steps = [...prev.steps];
      steps[index] = { ...steps[index], ...updates };
      return { ...prev, steps };
    });
  };

  const updateStepBinding = (index: number, updates: Partial<StepOutputBinding>) => {
    setEditedTemplate((prev) => {
      const steps = [...prev.steps];
      const nextBinding: StepOutputBinding = { ...normalizeBinding(steps[index].outputBinding), ...updates };
      if (!nextBinding.variableKey?.trim()) {
        nextBinding.variableKey = '';
        nextBinding.variableLabel = '';
      }
      steps[index] = { ...steps[index], outputBinding: nextBinding };
      return { ...prev, steps };
    });
  };

  const updateStepExecution = (index: number, updates: Partial<StepExecutionConfig>) => {
    setEditedTemplate((prev) => {
      const steps = [...prev.steps];
      steps[index] = {
        ...steps[index],
        execution: { ...normalizeExecution(steps[index].execution), ...updates },
      };
      return { ...prev, steps };
    });
  };

  const updateStepMeta = (
    index: number,
    updates: Partial<Pick<TemplateStep, 'stepType' | 'autoRunEnabled'>>
  ) => {
    setEditedTemplate((prev) => {
      const steps = [...prev.steps];
      const currentStep = steps[index];
      const nextStepType =
        updates.stepType ||
        currentStep.stepType ||
        (normalizeExecution(currentStep.execution).modelRefId ? 'text_generation' : 'manual');
      steps[index] = {
        ...currentStep,
        ...updates,
        stepType: nextStepType,
        autoRunEnabled:
          nextStepType === 'text_generation'
            ? updates.autoRunEnabled ?? currentStep.autoRunEnabled ?? false
            : false,
      };
      return { ...prev, steps };
    });
  };

  const updateExecutionPresetDraft = (
    updates: Partial<{
      label: string;
      description: string;
      modelRefStrategy: ExecutionPresetModelRefStrategy;
    }>
  ) => {
    setExecutionPresetDraft((prev) => ({ ...prev, ...updates }));
  };

  const getPromptTextarea = (stepId: string) => promptTextareaRefs.current[stepId];

  const findAutocompleteMatch = (value: string, caret: number) => {
    const safeCaret = Math.max(0, Math.min(caret, value.length));
    const openIndex = value.lastIndexOf('{{', safeCaret - 1);
    if (openIndex < 0) return null;

    const closingIndex = value.indexOf('}}', openIndex + 2);
    if (closingIndex >= 0 && closingIndex < safeCaret) return null;

    const query = value.slice(openIndex + 2, safeCaret);
    if (/[\s{}]/.test(query)) return null;

    return {
      start: openIndex,
      end: safeCaret,
      query,
    };
  };

  const syncAutocomplete = (stepId: string, value: string) => {
    const textarea = getPromptTextarea(stepId);
    const caret = textarea?.selectionStart ?? value.length;
    const match = findAutocompleteMatch(value, caret);

    if (!match) {
      setAutocompleteState((prev) => (prev?.stepId === stepId ? null : prev));
      return;
    }

    setAutocompleteState((prev) => ({
      stepId,
      start: match.start,
      end: match.end,
      query: match.query,
      selectedIndex: prev?.stepId === stepId ? prev.selectedIndex : 0,
    }));
  };

  const applyExecutionPresetToStep = (index: number, presetId: string) => {
    const preset = enabledExecutionPresetTemplates.find((item) => item.id === presetId);
    if (!preset) return;

    updateStepExecution(index, {
      temperature: preset.temperature,
      maxTokens: preset.maxTokens,
      systemPrompt: preset.systemPrompt || '',
    });

    setSelectedExecutionPresetByStepId((prev) => ({
      ...prev,
      [editedTemplate.steps[index].id]: preset.id,
    }));
  };

  const startSavingExecutionPreset = (step: TemplateStep) => {
    setSavingExecutionPresetStepId(step.id);
    setExecutionPresetDraft({
      label: `${step.name || t(language, 'templateEditor.untitledStep')} ${language === 'zh-CN' ? '执行模板' : 'Preset'}`,
      description: '',
      modelRefStrategy: 'keep_current',
    });
  };

  const cancelSavingExecutionPreset = () => {
    setSavingExecutionPresetStepId(null);
    setExecutionPresetDraft({
      label: '新执行模板',
      description: '',
      modelRefStrategy: 'keep_current',
    });
  };

  const saveCurrentExecutionPreset = (step: TemplateStep, currentRef?: TemplateModelRef) => {
    const label = executionPresetDraft.label.trim();
    if (!label) return;

    onSaveExecutionPresetTemplate({
      label,
      description: executionPresetDraft.description.trim() || undefined,
      modelRefStrategy: executionPresetDraft.modelRefStrategy,
      modelCatalogItemId:
        executionPresetDraft.modelRefStrategy === 'bind_specific_model_catalog_item'
          ? currentRef?.modelCatalogItemId || undefined
          : undefined,
      temperature: normalizeExecution(step.execution).temperature,
      maxTokens: normalizeExecution(step.execution).maxTokens,
      systemPrompt: normalizeExecution(step.execution).systemPrompt,
    });

    cancelSavingExecutionPreset();
  };

  const applyStepModelRef = (index: number, modelRefId?: string) => {
    setEditedTemplate((prev) => {
      const steps = [...prev.steps];
      const currentExecution = normalizeExecution(steps[index].execution);
      const nextExecution: StepExecutionConfig = {
        ...currentExecution,
        modelRefId,
      };

      const shouldApplyRecommendedPreset =
        currentExecution.temperature === undefined && currentExecution.maxTokens === undefined;
      const recommendedPreset = shouldApplyRecommendedPreset ? getRecommendedPresetForModelRef(modelRefId) : undefined;
      const shouldApplyRecommendedSystemPrompt = !currentExecution.systemPrompt.trim();
      const recommendedSystemPromptPreset = shouldApplyRecommendedSystemPrompt
        ? getRecommendedSystemPromptPresetForModelRef(modelRefId)
        : undefined;

      if (recommendedPreset) {
        nextExecution.temperature = recommendedPreset.temperature;
        nextExecution.maxTokens = recommendedPreset.maxTokens;
      }

      if (recommendedSystemPromptPreset) {
        nextExecution.systemPrompt = recommendedSystemPromptPreset.content;
      }

      steps[index] = {
        ...steps[index],
        execution: nextExecution,
      };
      return { ...prev, steps };
    });
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    setEditedTemplate((prev) => {
      const steps = [...prev.steps];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= steps.length) return prev;

      [steps[index], steps[targetIndex]] = [steps[targetIndex], steps[index]];

      const nextCollapsed = { ...collapsedSteps };
      const temp = nextCollapsed[index];
      nextCollapsed[index] = nextCollapsed[targetIndex];
      nextCollapsed[targetIndex] = temp;
      setCollapsedSteps(nextCollapsed);

      return { ...prev, steps };
    });
  };

  const removeStep = (index: number) => {
    onRequestConfirm(t(language, 'templateEditor.deleteStepTitle'), t(language, 'templateEditor.deleteStepMessage'), () => {
      setEditedTemplate((prev) => ({
        ...prev,
        steps: prev.steps.filter((_, currentIndex) => currentIndex !== index),
      }));
    });
  };

  const toggleStep = (index: number) => {
    setCollapsedSteps((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const toggleStepSelection = (stepId: string) => {
    setSelectedStepIds((prev) =>
      prev.includes(stepId) ? prev.filter((currentId) => currentId !== stepId) : [...prev, stepId]
    );
  };

  const clearSelectedSteps = () => {
    setSelectedStepIds([]);
  };

  const selectAllSteps = () => {
    setSelectedStepIds(editedTemplate.steps.map((step) => step.id));
  };

  const selectStepsByModelRef = () => {
    if (!selectionModelRefId) return;
    setSelectedStepIds(
      editedTemplate.steps
        .filter((step) => normalizeExecution(step.execution).modelRefId === selectionModelRefId)
        .map((step) => step.id)
    );
  };

  const copyStepExecutionConfig = (step: TemplateStep) => {
    setCopiedExecutionConfig({
      sourceStepId: step.id,
      sourceStepName: step.name || t(language, 'templateEditor.untitledStep'),
      execution: { ...normalizeExecution(step.execution) },
    });
  };

  const pasteStepExecutionConfig = (index: number) => {
    if (!copiedExecutionConfig) return;
    setEditedTemplate((prev) => {
      const steps = [...prev.steps];
      steps[index] = {
        ...steps[index],
        execution: { ...copiedExecutionConfig.execution },
      };
      return { ...prev, steps };
    });
  };

  const applyCopiedExecutionConfigToSelectedSteps = () => {
    if (!copiedExecutionConfig || selectedStepIds.length === 0) return;
    setEditedTemplate((prev) => ({
      ...prev,
      steps: prev.steps.map((step) =>
        selectedStepIds.includes(step.id)
          ? {
              ...step,
              execution: { ...copiedExecutionConfig.execution },
            }
          : step
      ),
    }));
  };

  const applyAutocompleteItem = (stepIndex: number, stepId: string, item: VariableAutocompleteItem) => {
    if (!autocompleteState || autocompleteState.stepId !== stepId) return;

    const step = editedTemplate.steps[stepIndex];
    if (!step) return;

    const replacement = `{{${item.key}}}`;
    const nextContent =
      step.content.slice(0, autocompleteState.start) +
      replacement +
      step.content.slice(autocompleteState.end);

    updateStep(stepIndex, { content: nextContent });
    setAutocompleteState(null);

    requestAnimationFrame(() => {
      const textarea = getPromptTextarea(stepId);
      if (!textarea) return;
      const caret = autocompleteState.start + replacement.length;
      textarea.focus();
      textarea.setSelectionRange(caret, caret);
    });
  };

  const handlePromptKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
    stepIndex: number,
    stepId: string
  ) => {
    if (!autocompleteState || autocompleteState.stepId !== stepId) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      setAutocompleteState(null);
      return;
    }

    if (filteredAutocompleteItems.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setAutocompleteState((prev) =>
        prev
          ? { ...prev, selectedIndex: (prev.selectedIndex + 1) % filteredAutocompleteItems.length }
          : prev
      );
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setAutocompleteState((prev) =>
        prev
          ? {
              ...prev,
              selectedIndex:
                (prev.selectedIndex - 1 + filteredAutocompleteItems.length) % filteredAutocompleteItems.length,
            }
          : prev
      );
      return;
    }

    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      applyAutocompleteItem(stepIndex, stepId, filteredAutocompleteItems[autocompleteState.selectedIndex]);
    }
  };

  const handlePromptContentChange = (stepIndex: number, stepId: string, value: string) => {
    updateStep(stepIndex, { content: value });
    requestAnimationFrame(() => syncAutocomplete(stepId, value));
  };

  const toggleExecutionSection = (stepId: string) => {
    setExpandedExecutionByStepId((prev) => ({ ...prev, [stepId]: !prev[stepId] }));
  };

  const toggleBindingSection = (stepId: string) => {
    setExpandedBindingByStepId((prev) => ({ ...prev, [stepId]: !prev[stepId] }));
  };

  return (
    <div className="h-full w-full overflow-y-auto rounded-lg bg-slate-900 p-4 md:p-6">
      <div className="sticky top-0 z-10 mb-6 flex items-center justify-between border-b border-slate-800 bg-slate-900 py-2">
        <h2 className="text-xl font-bold text-white">{t(language, 'templateEditor.title')}</h2>
        <div className="space-x-2">
          <Button variant="secondary" onClick={onCancel}>
            {t(language, 'templateEditor.cancel')}
          </Button>
          <Button onClick={() => onSave(editedTemplate)}>{t(language, 'templateEditor.save')}</Button>
        </div>
      </div>
      <TemplateMetaPanel
        language={language}
        template={editedTemplate}
        onChange={setEditedTemplate}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-4">
          <div className="sticky top-24 space-y-6 rounded-lg border border-slate-800 bg-slate-950/50 p-4">
            <TemplateInputsPanel
              language={language}
              inputs={editedTemplate.inputs}
              onAdd={addInput}
              onUpdate={updateInput}
              onRemove={removeInput}
            />
            <TemplateModelRefsPanel
              language={language}
              modelRefs={modelRefs}
              modelCatalog={modelCatalog}
              onAdd={addModelRef}
              onUpdate={updateModelRef}
              onRemove={removeModelRef}
            />
          </div>
        </div>

        <div className="lg:col-span-8">
          <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-200">{t(language, 'templateEditor.stepsSection')}</h3>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  onClick={selectAllSteps}
                  className="rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-bold text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
                >
                  {t(language, 'templateEditor.selectAllSteps')}
                </button>
                {modelRefs.length > 0 && (
                  <>
                    <select
                      value={selectionModelRefId}
                      onChange={(event) => setSelectionModelRefId(event.target.value)}
                      className="rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-cyan-500"
                    >
                      <option value="">{t(language, 'templateEditor.selectByModelRef')}</option>
                      {modelRefs.map((modelRef) => (
                        <option key={modelRef.id} value={modelRef.id}>
                          {modelRef.label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={selectStepsByModelRef}
                      disabled={!selectionModelRefId}
                      className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                        selectionModelRefId
                          ? 'border border-cyan-500/20 bg-cyan-500/10 text-cyan-300 hover:border-cyan-400/40 hover:text-white'
                          : 'cursor-not-allowed border border-slate-800 bg-slate-900 text-slate-600'
                      }`}
                    >
                      {t(language, 'templateEditor.selectSameModelRef')}
                    </button>
                  </>
                )}
              {selectedStepIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="text-xs text-cyan-300">{t(language, 'templateEditor.selectedSteps', { count: selectedStepIds.length })}</div>
                  {copiedExecutionConfig && (
                    <button
                      onClick={applyCopiedExecutionConfigToSelectedSteps}
                      className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-300 transition-colors hover:border-emerald-400/40 hover:text-white"
                    >
                      {t(language, 'templateEditor.applyCopiedConfig')}
                    </button>
                  )}
                  <button
                    onClick={clearSelectedSteps}
                    className="rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-bold text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
                  >
                    {t(language, 'templateEditor.clearSelection')}
                  </button>
                </div>
              )}
            </div>
            </div>
            <div className="space-y-4">
              {editedTemplate.steps.map((step, index) => {
                const isCollapsed = Boolean(collapsedSteps[index]);
                const isSelected = selectedStepIds.includes(step.id);
                const binding = normalizeBinding(step.outputBinding);
                const execution = normalizeExecution(step.execution);
                const stepType: StepType =
                  step.stepType ||
                  (execution.modelRefId ? 'text_generation' : 'manual');
                const autoRunEnabled =
                  stepType === 'text_generation' && step.autoRunEnabled === true;
                const bindingKey = binding.variableKey?.trim() || '';
                const isKnownVariable = !bindingKey || knownVariableKeys.includes(bindingKey);
                const currentRef = modelRefs.find((item) => item.id === execution.modelRefId);
                const availability = resolveStepExecutionAvailability({
                  step,
                  template: editedTemplate,
                  modelCatalog,
                  providerConfigs,
                });
                const matchedPreset = DEEPSEEK_EXECUTION_PRESETS.find(
                  (preset) =>
                    preset.temperature === execution.temperature &&
                    preset.maxTokens === execution.maxTokens
                );
                const recommendedPreset = getRecommendedPresetForModelRef(
                  execution.modelRefId
                );
                const matchedSystemPromptPreset = DEEPSEEK_SYSTEM_PROMPT_PRESETS.find(
                  (preset) => preset.content === execution.systemPrompt
                );
                const recommendedSystemPromptPreset =
                  getRecommendedSystemPromptPresetForModelRef(execution.modelRefId);
                const isExecutionExpanded =
                  Boolean(expandedExecutionByStepId[step.id]) ||
                  savingExecutionPresetStepId === step.id;
                const isBindingExpanded = Boolean(expandedBindingByStepId[step.id]);
                const selectedExecutionPreset = enabledExecutionPresetTemplates.find(
                  (preset) => preset.id === selectedExecutionPresetByStepId[step.id]
                );
                const executionSummaryParts = [
                  getStepTypeLabel(language, stepType),
                  autoRunEnabled ? t(language, 'templateEditor.autoRunEnabled') : undefined,
                  currentRef?.label || t(language, 'step.manual'),
                  selectedExecutionPreset?.label,
                  execution.temperature !== undefined
                    ? `T ${execution.temperature}`
                    : undefined,
                  execution.maxTokens !== undefined
                    ? `Max ${execution.maxTokens}`
                    : undefined,
                  execution.systemPrompt.trim()
                    ? t(language, 'step.systemPrompt')
                    : t(language, 'step.notSet'),
                ].filter(Boolean) as string[];

                return (
                  <TemplateStepCard
                    key={step.id}
                    language={language}
                    step={step}
                    stepIndex={index}
                    editedTemplate={editedTemplate}
                    modelRefs={modelRefs}
                    isCollapsed={isCollapsed}
                    isSelected={isSelected}
                    isExecutionExpanded={isExecutionExpanded}
                    isBindingExpanded={isBindingExpanded}
                    availability={availability}
                    binding={binding}
                    execution={execution}
                    bindingKey={bindingKey}
                    isKnownVariable={isKnownVariable}
                    currentRef={currentRef}
                    matchedPreset={matchedPreset}
                    recommendedPreset={recommendedPreset}
                    matchedSystemPromptPreset={matchedSystemPromptPreset}
                    recommendedSystemPromptPreset={recommendedSystemPromptPreset}
                    selectedExecutionPreset={selectedExecutionPreset}
                    selectedExecutionPresetValue={
                      selectedExecutionPresetByStepId[step.id] || ''
                    }
                    enabledExecutionPresetTemplates={enabledExecutionPresetTemplates}
                    executionSummaryParts={executionSummaryParts}
                    copiedExecutionConfigSourceStepId={
                      copiedExecutionConfig?.sourceStepId
                    }
                    copiedExecutionConfigSourceStepName={
                      copiedExecutionConfig?.sourceStepName
                    }
                    savingExecutionPresetStepId={savingExecutionPresetStepId}
                    executionPresetDraft={executionPresetDraft}
                    autocompleteState={autocompleteState}
                    filteredAutocompleteItems={filteredAutocompleteItems}
                    onToggleSelection={() => toggleStepSelection(step.id)}
                    onToggleCollapse={() => toggleStep(index)}
                    onMoveStep={(direction) => moveStep(index, direction)}
                    onRemoveStep={() => removeStep(index)}
                    onToggleStepMenu={() =>
                      setOpenStepMenuId((current) =>
                        current === step.id ? null : step.id
                      )
                    }
                    isStepMenuOpen={openStepMenuId === step.id}
                    onCopyExecutionConfig={() => {
                      copyStepExecutionConfig(step);
                      setOpenStepMenuId(null);
                    }}
                    onPasteExecutionConfig={() => {
                      pasteStepExecutionConfig(index);
                      setOpenStepMenuId(null);
                    }}
                    onUpdateStep={(updates) => updateStep(index, updates)}
                    onPromptChange={(value) =>
                      handlePromptContentChange(index, step.id, value)
                    }
                    onPromptKeyDown={(event) =>
                      handlePromptKeyDown(event, index, step.id)
                    }
                    onSyncAutocomplete={() => syncAutocomplete(step.id, step.content)}
                    onClearAutocompleteLater={() =>
                      setTimeout(
                        () =>
                          setAutocompleteState((prev) =>
                            prev?.stepId === step.id ? null : prev
                          ),
                        120
                      )
                    }
                    onPromptTextareaRef={(node) => {
                      promptTextareaRefs.current[step.id] = node;
                    }}
                    onApplyAutocompleteItem={(item) =>
                      applyAutocompleteItem(index, step.id, item)
                    }
                    onToggleExecutionSection={() => toggleExecutionSection(step.id)}
                    onSelectedExecutionPresetChange={(value) =>
                      setSelectedExecutionPresetByStepId((prev) => ({
                        ...prev,
                        [step.id]: value,
                      }))
                    }
                    onApplyExecutionPreset={() =>
                      applyExecutionPresetToStep(
                        index,
                        selectedExecutionPresetByStepId[step.id] || ''
                      )
                    }
                    onStartSavingExecutionPreset={() =>
                      startSavingExecutionPreset(step)
                    }
                    onCancelSavingExecutionPreset={cancelSavingExecutionPreset}
                    onSaveCurrentExecutionPreset={() =>
                      saveCurrentExecutionPreset(step, currentRef)
                    }
                    onUpdateExecutionPresetDraft={updateExecutionPresetDraft}
                    onUpdateStepExecution={(updates) =>
                      updateStepExecution(index, updates)
                    }
                    onUpdateStepMeta={(updates) => updateStepMeta(index, updates)}
                    onApplyStepModelRef={(modelRefId) =>
                      applyStepModelRef(index, modelRefId)
                    }
                    onToggleBindingSection={() => toggleBindingSection(step.id)}
                    onUpdateStepBinding={(updates) =>
                      updateStepBinding(index, updates)
                    }
                    getExecutionBadgeClassName={getExecutionBadgeClassName}
                  />
                );
              })}

              <button
                onClick={addStep}
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-800 bg-slate-900/50 py-4 text-sm font-bold text-slate-500 transition-all hover:border-blue-500/50 hover:bg-slate-900 hover:text-blue-400"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                  <path
                    fillRule="evenodd"
                    d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2Z"
                    clipRule="evenodd"
                  />
                </svg>
                {t(language, 'templateEditor.addStep')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
