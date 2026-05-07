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
import { AutoResizeTextarea } from './common/AutoResizeTextarea';

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
  }, [autocompleteState?.query, filteredAutocompleteItems.length]);

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

      <div className="mb-8 space-y-4">
        <label className="block text-sm font-bold text-slate-300">{t(language, 'templateEditor.name')}</label>
        <input
          className="w-full rounded border border-slate-700 bg-slate-950 p-2 text-white"
          value={editedTemplate.name}
          onChange={(event) => setEditedTemplate({ ...editedTemplate, name: event.target.value })}
        />
      </div>

      <div className="mb-6 space-y-2">
        <label className="block text-sm font-bold text-slate-300">{t(language, 'templateEditor.tags')}</label>
        <div className="flex flex-wrap items-center gap-2">
          {(editedTemplate.tags || []).map((tag, idx) => (
            <span key={idx} className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] text-amber-400">
              {tag}
              <button
                onClick={() =>
                  setEditedTemplate({
                    ...editedTemplate,
                    tags: (editedTemplate.tags || []).filter((_, i) => i !== idx),
                  })
                }
                className="ml-0.5 text-amber-600 hover:text-red-400"
              >
                x
              </button>
            </span>
          ))}
          <input
            className="w-32 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-[11px] text-slate-200 outline-none focus:border-amber-500"
            placeholder={t(language, 'templateEditor.addTag')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const val = (e.target as HTMLInputElement).value.trim();
                if (val) {
                  setEditedTemplate({
                    ...editedTemplate,
                    tags: [...(editedTemplate.tags || []), val],
                  });
                  (e.target as HTMLInputElement).value = '';
                }
              }
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-4">
          <div className="sticky top-24 space-y-6 rounded-lg border border-slate-800 bg-slate-950/50 p-4">
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-200">{t(language, 'templateEditor.inputSection')}</h3>
                <Button size="sm" onClick={addInput}>
                  {t(language, 'templateEditor.add')}
                </Button>
              </div>
              <p className="mb-4 text-xs text-slate-500">
                {t(language, 'templateEditor.inputHelp')}
              </p>
              <div className="space-y-3">
                {editedTemplate.inputs.map((input, index) => (
                  <div key={input.id} className="relative rounded border border-slate-700 bg-slate-900 p-3">
                    <div className="absolute -left-2 -top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-slate-900 bg-emerald-600 text-xs font-bold text-white shadow-sm">
                      {index}
                    </div>
                    <div className="mt-1 space-y-2">
                      <input
                        className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200"
                        value={input.label}
                        onChange={(event) => updateInput(index, { label: event.target.value })}
                        placeholder={t(language, 'templateEditor.inputName')}
                      />
                    </div>
                    <button onClick={() => removeInput(index)} className="absolute right-1 top-1 p-1 text-slate-600 hover:text-red-400">
                      脳
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="border-t border-slate-800 pt-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-200">{t(language, 'templateEditor.modelRefSection')}</h3>
                <Button size="sm" onClick={addModelRef}>
                  {t(language, 'templateEditor.add')}
                </Button>
              </div>
              <p className="mb-4 text-xs text-slate-500">
                {t(language, 'templateEditor.modelRefHelp')}
              </p>
              <div className="space-y-3">
                {modelRefs.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-800 px-3 py-3 text-xs text-slate-500">
                    {t(language, 'templateEditor.noModelRef')}
                  </div>
                ) : (
                  modelRefs.map((modelRef, index) => {
                    const catalogItem = getCatalogItem(modelRef.modelCatalogItemId);
                    return (
                      <div key={modelRef.id} className="relative space-y-2 rounded border border-slate-700 bg-slate-900 p-3">
                        <input
                          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200"
                          value={modelRef.label}
                          onChange={(event) => updateModelRef(index, { label: event.target.value })}
                          placeholder={t(language, 'templateEditor.modelRefName')}
                        />
                        <select
                          value={modelRef.modelCatalogItemId || ''}
                          onChange={(event) => updateModelRef(index, { modelCatalogItemId: event.target.value || undefined })}
                          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                        >
                          <option value="">{t(language, 'templateEditor.unboundModel')}</option>
                          {modelCatalog.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.label}
                              {!item.enabled ? t(language, 'templateEditor.disabledSuffix') : ''}
                            </option>
                          ))}
                        </select>
                        {modelRef.modelCatalogItemId && !catalogItem && (
                          <div className="text-xs text-amber-400">{t(language, 'templateEditor.missingModelItem')}</div>
                        )}
                        {catalogItem && !catalogItem.enabled && (
                          <div className="text-xs text-amber-400">{t(language, 'templateEditor.disabledModelItem')}</div>
                        )}
                        <button onClick={() => removeModelRef(index)} className="absolute right-1 top-1 p-1 text-slate-600 hover:text-red-400">
                          脳
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
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
                const isCollapsed = collapsedSteps[index];
                const isSelected = selectedStepIds.includes(step.id);
                const binding = normalizeBinding(step.outputBinding);
                const execution = normalizeExecution(step.execution);
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
                  (preset) => preset.temperature === execution.temperature && preset.maxTokens === execution.maxTokens
                );
                const recommendedPreset = getRecommendedPresetForModelRef(execution.modelRefId);
                const matchedSystemPromptPreset = DEEPSEEK_SYSTEM_PROMPT_PRESETS.find(
                  (preset) => preset.content === execution.systemPrompt
                );
                const recommendedSystemPromptPreset = getRecommendedSystemPromptPresetForModelRef(execution.modelRefId);

                return (
                  <div
                    key={step.id}
                    className={`h-auto overflow-visible rounded-lg border bg-slate-900 ${
                      isSelected ? 'border-cyan-500/60 ring-1 ring-cyan-500/20' : 'border-slate-700'
                    }`}
                  >
                    <div
                      className="flex cursor-pointer select-none items-center justify-between rounded-t-lg bg-slate-800/50 p-4 transition-colors hover:bg-slate-800"
                      onClick={() => toggleStep(index)}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleStepSelection(step.id);
                          }}
                          className={`flex h-5 w-5 items-center justify-center rounded border text-[10px] font-bold transition-colors ${
                            isSelected
                              ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                              : 'border-slate-600 text-slate-500 hover:border-cyan-500 hover:text-cyan-300'
                          }`}
                          title={isSelected ? t(language, 'templateEditor.unselectStep') : t(language, 'templateEditor.selectStep')}
                        >
                          {isSelected ? '✓' : ''}
                        </button>
                        <span className="rounded bg-slate-700 px-2 py-0.5 text-xs font-bold text-slate-300">Step {index + 1}</span>
                        <span className="text-sm font-bold text-slate-200">{step.name || t(language, 'templateEditor.untitledStep')}</span>
                        {execution.modelRefId && (
                          <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-300">
                            {currentRef?.label || t(language, 'templateEditor.modelRef')}
                          </span>
                        )}
                        {copiedExecutionConfig?.sourceStepId === step.id && (
                          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                            {t(language, 'templateEditor.copiedExecutionConfig')}
                          </span>
                        )}
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] ${getExecutionBadgeClassName(availability)}`}>
                          {availability.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center overflow-hidden rounded-md border border-slate-700/50 bg-slate-950/40">
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              moveStep(index, 'up');
                            }}
                            disabled={index === 0}
                            className={`p-1.5 transition-colors ${
                              index === 0 ? 'cursor-not-allowed text-slate-800' : 'text-slate-500 hover:bg-slate-700 hover:text-blue-400'
                            }`}
                            title={t(language, 'templateEditor.moveUp')}
                          >
                            鈫?
                          </button>
                          <div className="h-4 w-px bg-slate-800" />
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              moveStep(index, 'down');
                            }}
                            disabled={index === editedTemplate.steps.length - 1}
                            className={`p-1.5 transition-colors ${
                              index === editedTemplate.steps.length - 1
                                ? 'cursor-not-allowed text-slate-800'
                                : 'text-slate-500 hover:bg-slate-700 hover:text-blue-400'
                            }`}
                            title={t(language, 'templateEditor.moveDown')}
                          >
                            鈫?
                          </button>
                        </div>

                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            removeStep(index);
                          }}
                          className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-red-400/10 hover:text-red-400"
                          title={t(language, 'templateEditor.deleteStep')}
                        >
                          {t(language, 'templateEditor.delete')}
                        </button>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            copyStepExecutionConfig(step);
                          }}
                          className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] font-bold text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
                          title={t(language, 'templateEditor.copyExecutionConfig')}
                        >
                          {t(language, 'templateEditor.copyExecutionConfig')}
                        </button>
                        {copiedExecutionConfig && copiedExecutionConfig.sourceStepId !== step.id && (
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              pasteStepExecutionConfig(index);
                            }}
                            className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-300 transition-colors hover:border-emerald-400/40 hover:text-white"
                            title={t(language, 'templateEditor.applyCopiedConfigFrom', { stepName: copiedExecutionConfig.sourceStepName })}
                          >
                            {t(language, 'templateEditor.applyCopiedConfig')}
                          </button>
                        )}

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
                            <label className="text-xs font-bold uppercase text-slate-500">{t(language, 'templateEditor.stepName')}</label>
                            <input
                              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                              value={step.name}
                              onChange={(event) => updateStep(index, { name: event.target.value })}
                              placeholder={t(language, 'templateEditor.stepName')}
                            />
                          </div>
                          <div className="flex-1 space-y-2">
                            <label className="text-xs font-bold uppercase text-slate-500">{t(language, 'templateEditor.description')}</label>
                            <input
                              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                              value={step.description || ''}
                              onChange={(event) => updateStep(index, { description: event.target.value })}
                              placeholder={t(language, 'templateEditor.optionalDescription')}
                            />
                          </div>
                        </div>

                        <div className="mb-4 space-y-2">
                          <label className="text-xs font-bold uppercase text-slate-400">{t(language, 'templateEditor.promptContent')}</label>
                          <div className="relative flex h-auto flex-col rounded border border-slate-700 bg-slate-950 p-4">
                            <AutoResizeTextarea
                              className="font-mono text-sm leading-relaxed text-slate-300"
                              value={step.content}
                              onChange={(value) => handlePromptContentChange(index, step.id, value)}
                              onKeyDown={(event) => handlePromptKeyDown(event, index, step.id)}
                              onClick={() => syncAutocomplete(step.id, step.content)}
                              onSelect={() => syncAutocomplete(step.id, step.content)}
                              onBlur={() => setTimeout(() => setAutocompleteState((prev) => (prev?.stepId === step.id ? null : prev)), 120)}
                              textareaRef={(node) => {
                                promptTextareaRefs.current[step.id] = node;
                              }}
                              placeholder={t(language, 'templateEditor.promptPlaceholder')}
                            />
                            {autocompleteState?.stepId === step.id && filteredAutocompleteItems.length > 0 && (
                              <div className="absolute left-4 right-4 top-full z-20 mt-2 rounded-xl border border-slate-700 bg-slate-900/95 p-2 shadow-2xl backdrop-blur">
                                <div className="mb-2 px-2 text-[11px] text-slate-500">
                                  {language === 'zh-CN' ? '变量补全' : 'Variable suggestions'}
                                </div>
                                <div className="max-h-56 space-y-1 overflow-y-auto">
                                  {filteredAutocompleteItems.map((item, itemIndex) => (
                                    <button
                                      key={`${step.id}_${item.key}_${itemIndex}`}
                                      type="button"
                                      onMouseDown={(event) => {
                                        event.preventDefault();
                                        applyAutocompleteItem(index, step.id, item);
                                      }}
                                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors ${
                                        autocompleteState.selectedIndex === itemIndex
                                          ? 'bg-cyan-500/15 text-cyan-200'
                                          : 'text-slate-300 hover:bg-slate-800'
                                      }`}
                                    >
                                      <div>
                                        <div className="font-mono text-xs">{`{{${item.key}}}`}</div>
                                        <div className="text-[11px] text-slate-500">{item.label}</div>
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

                        <div className="mb-4 space-y-3 border-t border-slate-800 pt-4">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold uppercase text-cyan-400">{t(language, 'templateEditor.modelRef')}</label>
                            {execution.modelRefId && (
                              <span className="font-mono text-[11px] text-cyan-300">{currentRef?.label || t(language, 'templateEditor.modelRef')}</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500">
                            {t(language, 'templateEditor.manualStepHint')}
                          </p>
                          <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <select
                                value={selectedExecutionPresetByStepId[step.id] || ''}
                                onChange={(event) =>
                                  setSelectedExecutionPresetByStepId((prev) => ({
                                    ...prev,
                                    [step.id]: event.target.value,
                                  }))
                                }
                                className="min-w-[220px] flex-1 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500"
                              >
                                <option value="">{language === 'zh-CN' ? '选择执行模板' : 'Select execution template'}</option>
                                {enabledExecutionPresetTemplates.map((preset) => (
                                  <option key={preset.id} value={preset.id}>
                                    {preset.label}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => applyExecutionPresetToStep(index, selectedExecutionPresetByStepId[step.id] || '')}
                                disabled={!selectedExecutionPresetByStepId[step.id]}
                                className={`rounded-md px-3 py-2 text-xs font-bold transition-colors ${
                                  selectedExecutionPresetByStepId[step.id]
                                    ? 'border border-cyan-500/20 bg-cyan-500/10 text-cyan-300 hover:border-cyan-400/40 hover:text-white'
                                    : 'cursor-not-allowed border border-slate-800 bg-slate-900 text-slate-600'
                                }`}
                              >
                                {language === 'zh-CN' ? '应用执行模板' : 'Apply preset'}
                              </button>
                              <button
                                type="button"
                                onClick={() => startSavingExecutionPreset(step)}
                                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
                              >
                                {language === 'zh-CN' ? '保存当前配置为模板' : 'Save as preset'}
                              </button>
                            </div>
                            {savingExecutionPresetStepId === step.id && (
                              <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/80 p-3">
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                  <div className="space-y-2">
                                    <label className="text-[11px] font-bold uppercase text-slate-500">
                                      {language === 'zh-CN' ? '模板名称' : 'Preset name'}
                                    </label>
                                    <input
                                      value={executionPresetDraft.label}
                                      onChange={(event) => updateExecutionPresetDraft({ label: event.target.value })}
                                      className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500"
                                      placeholder={language === 'zh-CN' ? '新执行模板' : 'New execution preset'}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-[11px] font-bold uppercase text-slate-500">
                                      {language === 'zh-CN' ? '模型策略' : 'Model strategy'}
                                    </label>
                                    <select
                                      value={executionPresetDraft.modelRefStrategy}
                                      onChange={(event) =>
                                        updateExecutionPresetDraft({
                                          modelRefStrategy: event.target.value as ExecutionPresetModelRefStrategy,
                                        })
                                      }
                                      className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500"
                                    >
                                      <option value="keep_current">
                                        {language === 'zh-CN' ? '保留当前模型' : 'Keep current model'}
                                      </option>
                                      <option
                                        value="bind_specific_model_catalog_item"
                                        disabled={!currentRef?.modelCatalogItemId}
                                      >
                                        {language === 'zh-CN' ? '记录当前模型目录项' : 'Bind current catalog model'}
                                      </option>
                                    </select>
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[11px] font-bold uppercase text-slate-500">
                                    {language === 'zh-CN' ? '备注' : 'Description'}
                                  </label>
                                  <input
                                    value={executionPresetDraft.description}
                                    onChange={(event) => updateExecutionPresetDraft({ description: event.target.value })}
                                    className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500"
                                    placeholder={language === 'zh-CN' ? '可选说明' : 'Optional note'}
                                  />
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {currentRef?.modelCatalogItemId
                                    ? executionPresetDraft.modelRefStrategy === 'bind_specific_model_catalog_item'
                                      ? language === 'zh-CN'
                                        ? '保存时会记录当前模型目录项，但应用模板时仍不会替换步骤模型引用。'
                                        : 'The current catalog model will be recorded, but applying the preset still keeps the step model ref.'
                                      : language === 'zh-CN'
                                      ? '默认保留当前步骤模型，只覆盖 temperature、max tokens 和 system prompt。'
                                      : 'The current step model stays unchanged; only temperature, max tokens, and system prompt are applied.'
                                    : language === 'zh-CN'
                                    ? '当前步骤没有模型引用，保存时将默认保留当前模型策略。'
                                    : 'This step has no model ref, so the preset will default to keep current model.'}
                                </div>
                                <div className="flex items-center justify-end gap-2">
                                  <Button variant="secondary" size="sm" onClick={cancelSavingExecutionPreset}>
                                    {language === 'zh-CN' ? '取消' : 'Cancel'}
                                  </Button>
                                  <Button size="sm" onClick={() => saveCurrentExecutionPreset(step, currentRef)}>
                                    {language === 'zh-CN' ? '保存模板' : 'Save preset'}
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                          {matchedPreset && (
                            <div className="text-[11px] text-cyan-300">
                              {t(language, 'templateEditor.currentPreset')}: {matchedPreset.label}
                            </div>
                          )}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-bold uppercase text-slate-500">{t(language, 'templateEditor.executionPreset')}</label>
                              <button
                                onClick={() =>
                                  updateStepExecution(index, {
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
                                  execution.temperature === preset.temperature && execution.maxTokens === preset.maxTokens;
                                return (
                                  <button
                                    key={preset.id}
                                    onClick={() =>
                                      updateStepExecution(index, {
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
                              <label className="text-[11px] font-bold uppercase text-slate-500">{t(language, 'templateEditor.modelRef')}</label>
                              <select
                                value={execution.modelRefId || ''}
                                onChange={(event) => applyStepModelRef(index, event.target.value || undefined)}
                                className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                              >
                                <option value="">{t(language, 'templateEditor.noModelRefOption')}</option>
                                {modelRefs.map((modelRef) => {
                                  const item = getCatalogItem(modelRef.modelCatalogItemId);
                                  return (
                                    <option key={modelRef.id} value={modelRef.id}>
                                      {modelRef.label}
                                      {item && !item.enabled ? t(language, 'templateEditor.disabledSuffix') : ''}
                                      {!item && modelRef.modelCatalogItemId ? t(language, 'templateEditor.missingSuffix') : ''}
                                    </option>
                                  );
                                })}
                              </select>
                              {recommendedPreset && (
                                <div className="text-[11px] text-slate-500">
                                  {t(language, 'templateEditor.recommendedPreset')}: {recommendedPreset.label}
                                  {execution.temperature === undefined && execution.maxTokens === undefined
                                    ? t(language, 'templateEditor.recommendedPresetAuto')
                                    : t(language, 'templateEditor.recommendedPresetManual')}
                                </div>
                              )}
                            </div>
                            <div className="space-y-2">
                              <label className="text-[11px] font-bold uppercase text-slate-500">{t(language, 'templateEditor.executionStatus')}</label>
                              <div className={`rounded border px-3 py-2 text-sm ${getExecutionBadgeClassName(availability)}`}>
                                {availability.label}
                              </div>
                            </div>
                          </div>
                          <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{t(language, 'templateEditor.statusNote')}</div>
                            <div className="mt-1 text-xs text-slate-300">{availability.message}</div>
                            {availability.modelCatalogItem && availability.providerConfig && (
                              <div className="mt-2 text-[11px] text-slate-500">
                                {availability.providerConfig.label} / {availability.modelCatalogItem.label}
                              </div>
                            )}
                          </div>
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                              <label className="text-[11px] font-bold uppercase text-slate-500">Temperature</label>
                              <input
                                type="number"
                                min="0"
                                max="2"
                                step="0.1"
                                value={execution.temperature ?? ''}
                                onChange={(event) =>
                                  updateStepExecution(index, {
                                    temperature: event.target.value === '' ? undefined : Number(event.target.value),
                                  })
                                }
                                className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                                placeholder={t(language, 'templateEditor.defaultPlaceholder')}
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[11px] font-bold uppercase text-slate-500">Max Tokens</label>
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={execution.maxTokens ?? ''}
                                onChange={(event) =>
                                  updateStepExecution(index, {
                                    maxTokens: event.target.value === '' ? undefined : Number(event.target.value),
                                  })
                                }
                                className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                                placeholder={t(language, 'templateEditor.defaultPlaceholder')}
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[11px] font-bold uppercase text-slate-500">System Prompt</label>
                            {matchedSystemPromptPreset && (
                              <div className="text-[11px] text-cyan-300">
                                {t(language, 'templateEditor.currentTemplate')}: {matchedSystemPromptPreset.label}
                              </div>
                            )}
                            {recommendedSystemPromptPreset && (
                              <div className="text-[11px] text-slate-500">
                                {t(language, 'templateEditor.recommendedTemplate')}: {recommendedSystemPromptPreset.label}
                                {!execution.systemPrompt.trim() ? t(language, 'templateEditor.systemPromptAuto') : t(language, 'templateEditor.systemPromptManual')}
                              </div>
                            )}
                            <div className="flex flex-wrap gap-2">
                              {DEEPSEEK_SYSTEM_PROMPT_PRESETS.map((preset) => {
                                const isActive = execution.systemPrompt === preset.content;
                                return (
                                  <button
                                    key={preset.id}
                                    onClick={() => updateStepExecution(index, { systemPrompt: preset.content })}
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
                                onClick={() => updateStepExecution(index, { systemPrompt: '' })}
                                className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-[10px] font-bold text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
                              >
                                {t(language, 'templateEditor.clearTemplate')}
                              </button>
                            </div>
                            <div className="rounded border border-slate-700 bg-slate-950 p-4">
                              <AutoResizeTextarea
                                className="text-sm leading-relaxed text-slate-300"
                                value={execution.systemPrompt}
                                onChange={(value) => updateStepExecution(index, { systemPrompt: value })}
                                placeholder={t(language, 'templateEditor.systemPromptPlaceholder')}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3 border-t border-slate-800 pt-4">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold uppercase text-violet-400">{t(language, 'templateEditor.outputToVar')}</label>
                            {bindingKey && <span className="font-mono text-[11px] text-violet-300">{`{{${bindingKey}}}`}</span>}
                          </div>
                          <p className="text-xs text-slate-500">
                            {t(language, 'templateEditor.bindingHelp')}
                          </p>
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                              <label className="text-[11px] font-bold uppercase text-slate-500">{t(language, 'templateEditor.varKey')}</label>
                              <input
                                value={binding.variableKey || ''}
                                onChange={(event) => updateStepBinding(index, { variableKey: event.target.value })}
                                className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                                placeholder="scene_description"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[11px] font-bold uppercase text-slate-500">{t(language, 'templateEditor.displayName')}</label>
                              <input
                                value={binding.variableLabel || ''}
                                onChange={(event) => updateStepBinding(index, { variableLabel: event.target.value })}
                                className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                                placeholder={t(language, 'templateEditor.displayName')}
                              />
                            </div>
                          </div>
                          {bindingKey && (
                            <div className={`text-xs ${isKnownVariable ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {isKnownVariable ? t(language, 'templateEditor.bindingKnown') : t(language, 'templateEditor.bindingNew')}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
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
