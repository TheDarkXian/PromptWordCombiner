import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  StructuredOutputFieldDefinition,
  StructuredOutputVariableBinding,
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
import { TemplateModelRefsPanel } from './template-editor/TemplateModelRefsPanel';
import { TemplateBlueprintCanvas } from './template-editor/TemplateBlueprintCanvas';
import { TemplateStepCard } from './template-editor/TemplateStepCard';
import { BlueprintNodeInspector } from './template-editor/BlueprintNodeInspector';
import { SplitPane } from './common/SplitPane';
import { WorkbenchMenuBar, WorkbenchMenuGroup } from './workbench/WorkbenchMenuBar';
import { BlueprintActiveTool } from './template-editor/TemplateBlueprintCanvas';
import {
  applyBlueprintEdgeChange,
  buildBlueprintLayout,
  mergeBlueprintLayout,
  tidyBlueprintLayout,
  updateBlueprintNodePosition,
  updateBlueprintViewport,
} from '../services/templateBlueprintService';
import {
  createBlueprintCommandHistory,
  pushBlueprintCommand,
  redoBlueprintCommand,
  undoBlueprintCommand,
} from '../services/blueprintCommandService';

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
  leftPanelWidth: number;
  onLeftPanelWidthChange: (width: number) => void;
  blueprintInspectorWidth: number;
  onBlueprintInspectorWidthChange: (width: number) => void;
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

const isEditableEventTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
};

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
  leftPanelWidth,
  onLeftPanelWidthChange,
  blueprintInspectorWidth,
  onBlueprintInspectorWidthChange,
}) => {
  const [editedTemplate, setEditedTemplate] = useState<Template>(cloneTemplate(template));
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
  const [expandedStructuredByStepId, setExpandedStructuredByStepId] = useState<Record<string, boolean>>({});
  const [selectedExecutionPresetByStepId, setSelectedExecutionPresetByStepId] = useState<Record<string, string>>({});
  const [savingExecutionPresetStepId, setSavingExecutionPresetStepId] = useState<string | null>(null);
  const [executionPresetDraft, setExecutionPresetDraft] = useState<{
    label: string;
    description: string;
    modelRefStrategy: ExecutionPresetModelRefStrategy;
  }>({
    label: 'Default preset',
    description: '',
    modelRefStrategy: 'keep_current',
  });
  const [autocompleteState, setAutocompleteState] = useState<VariableAutocompleteState | null>(null);
  const [showBlueprintCreatePanel, setShowBlueprintCreatePanel] = useState(false);
  const [blueprintCommandHistory, setBlueprintCommandHistory] = useState(createBlueprintCommandHistory());
  const [scenePanelVisible, setScenePanelVisible] = useState(true);
  const [detailsPanelVisible, setDetailsPanelVisible] = useState(true);
  const [blueprintActiveTool, setBlueprintActiveTool] = useState<BlueprintActiveTool>('move');
  const [minimapCollapsed, setMinimapCollapsed] = useState(false);
  const promptTextareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  useEffect(() => {
    setEditedTemplate(cloneTemplate(template));
    setSelectedStepIds([]);
    setSelectionModelRefId('');
    setCopiedExecutionConfig(null);
    setOpenStepMenuId(null);
    setExpandedExecutionByStepId({});
    setExpandedBindingByStepId({});
    setExpandedStructuredByStepId({});
    setSelectedExecutionPresetByStepId({});
    setSavingExecutionPresetStepId(null);
    setAutocompleteState(null);
    setShowBlueprintCreatePanel(false);
    setBlueprintCommandHistory(createBlueprintCommandHistory());
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
          ...editedTemplate.steps
            .flatMap((step) =>
              (step.structuredOutputBindings || []).map(
                (binding) => binding.variableKey?.trim() || ''
              )
            )
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
          sourceLabel: language === 'zh-CN' ? 'Input' : 'Input',
        })),
      ...editedTemplate.steps
        .map((step) => {
          const key = step.outputBinding?.variableKey?.trim() || '';
          if (!key) return null;
          return {
            key,
            label: step.outputBinding?.variableLabel?.trim() || key,
            sourceType: 'step_output' as const,
            sourceLabel: 'Step output',
          };
        })
        .filter((item): item is VariableAutocompleteItem => Boolean(item)),
      ...editedTemplate.steps
        .flatMap((step) =>
          (step.structuredOutputBindings || []).map((binding) => {
            const key = binding.variableKey?.trim() || '';
            if (!key) return null;
            return {
              key,
              label: binding.variableLabel?.trim() || key,
              sourceType: 'step_output' as const,
              sourceLabel: 'Step output',
            };
          })
        )
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

  const updateStructuredOutputField = (
    index: number,
    fieldIndex: number,
    updates: Partial<StructuredOutputFieldDefinition>
  ) => {
    setEditedTemplate((prev) => {
      const steps = [...prev.steps];
      const currentStep = steps[index];
      const fields = [...(currentStep.structuredOutputFields || [])];
      fields[fieldIndex] = { ...fields[fieldIndex], ...updates };
      steps[index] = { ...currentStep, structuredOutputFields: fields };
      return { ...prev, steps };
    });
  };

  const addStructuredOutputField = (index: number) => {
    setEditedTemplate((prev) => {
      const steps = [...prev.steps];
      const currentStep = steps[index];
      const fields = [...(currentStep.structuredOutputFields || [])];
      fields.push({
        key: `field_${fields.length + 1}`,
        label: language === 'zh-CN' ? `闂傚倸鍊峰ù鍥敋瑜忛埀顒佺▓閺呮繄鍒掑▎鎾崇婵＄偛鐨烽崑鎾诲礃椤旂厧鑰垮┑鐐村灱妞存悂寮?${fields.length + 1}` : `Field ${fields.length + 1}`,
        description: '',
      });
      steps[index] = { ...currentStep, structuredOutputFields: fields };
      return { ...prev, steps };
    });
    setExpandedStructuredByStepId((prev) => ({ ...prev, [editedTemplate.steps[index].id]: true }));
  };

  const removeStructuredOutputField = (index: number, fieldIndex: number) => {
    setEditedTemplate((prev) => {
      const steps = [...prev.steps];
      const currentStep = steps[index];
      const fields = [...(currentStep.structuredOutputFields || [])];
      const removedField = fields[fieldIndex];
      const nextFields = fields.filter((_, currentIndex) => currentIndex !== fieldIndex);
      const nextBindings = (currentStep.structuredOutputBindings || []).filter(
        (binding) => binding.fieldKey !== removedField?.key
      );
      steps[index] = {
        ...currentStep,
        structuredOutputFields: nextFields,
        structuredOutputBindings: nextBindings,
      };
      return { ...prev, steps };
    });
  };

  const moveStructuredOutputField = (
    index: number,
    fieldIndex: number,
    direction: 'up' | 'down'
  ) => {
    setEditedTemplate((prev) => {
      const steps = [...prev.steps];
      const currentStep = steps[index];
      const fields = [...(currentStep.structuredOutputFields || [])];
      const targetIndex = direction === 'up' ? fieldIndex - 1 : fieldIndex + 1;
      if (targetIndex < 0 || targetIndex >= fields.length) return prev;
      [fields[fieldIndex], fields[targetIndex]] = [fields[targetIndex], fields[fieldIndex]];
      steps[index] = { ...currentStep, structuredOutputFields: fields };
      return { ...prev, steps };
    });
  };

  const updateStructuredOutputBinding = (
    index: number,
    fieldKey: string,
    updates: Partial<StructuredOutputVariableBinding>
  ) => {
    setEditedTemplate((prev) => {
      const steps = [...prev.steps];
      const currentStep = steps[index];
      const bindings = [...(currentStep.structuredOutputBindings || [])];
      const bindingIndex = bindings.findIndex((binding) => binding.fieldKey === fieldKey);
      const currentBinding =
        bindingIndex >= 0
          ? bindings[bindingIndex]
          : { fieldKey, variableKey: '', variableLabel: '' };
      const nextBinding = {
        ...currentBinding,
        ...updates,
      };

      if (!nextBinding.variableKey?.trim()) {
        if (bindingIndex >= 0) {
          bindings.splice(bindingIndex, 1);
        }
      } else if (bindingIndex >= 0) {
        bindings[bindingIndex] = {
          fieldKey,
          variableKey: nextBinding.variableKey.trim(),
          variableLabel: nextBinding.variableLabel || '',
        };
      } else {
        bindings.push({
          fieldKey,
          variableKey: nextBinding.variableKey.trim(),
          variableLabel: nextBinding.variableLabel || '',
        });
      }

      steps[index] = { ...currentStep, structuredOutputBindings: bindings };
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
      label: (step.name || t(language, 'templateEditor.untitledStep')) + ' Preset',
      description: '',
      modelRefStrategy: 'keep_current',
    });
  };

  const cancelSavingExecutionPreset = () => {
    setSavingExecutionPresetStepId(null);
    setExecutionPresetDraft({
      label: 'Default preset',
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

      return { ...prev, steps };
    });
  };

  const removeStep = (index: number) => {
    onRequestConfirm(t(language, 'templateEditor.deleteStepTitle'), t(language, 'templateEditor.deleteStepMessage'), () => {
      setEditedTemplate((prev) => {
        const next = {
          ...prev,
          steps: prev.steps.filter((_, currentIndex) => currentIndex !== index),
        };
        return { ...next, blueprint: mergeBlueprintLayout(next) };
      });
    });
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

  const deleteSelectedSteps = useCallback(() => {
    if (selectedStepIds.length === 0) return;
    onRequestConfirm(t(language, 'templateEditor.deleteStepTitle'), t(language, 'templateEditor.deleteStepMessage'), () => {
      setEditedTemplate((prev) => {
        const next = {
          ...prev,
          steps: prev.steps.filter((step) => !selectedStepIds.includes(step.id)),
        };
        const after = { ...next, blueprint: mergeBlueprintLayout(next) };
        setBlueprintCommandHistory((history) =>
          pushBlueprintCommand(history, {
            type: 'delete_step',
            before: prev,
            after,
            createdAt: Date.now(),
          })
        );
        return after;
      });
      setSelectedStepIds([]);
    });
  }, [language, onRequestConfirm, selectedStepIds]);
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

  const isPromptCollapsedByDefault = (stepId: string) => {
    const expandedStepIds = editedTemplate.blueprint?.selection?.expandedPromptStepIds || [];
    return !expandedStepIds.includes(stepId);
  };

  const togglePromptCollapsed = (stepId: string) => {
    setEditedTemplate((prev) => {
      const expandedStepIds = prev.blueprint?.selection?.expandedPromptStepIds || [];
      const isExpanded = expandedStepIds.includes(stepId);
      const nextExpanded = isExpanded
        ? expandedStepIds.filter((id) => id !== stepId)
        : [...expandedStepIds, stepId];
      return {
        ...prev,
        blueprint: {
          ...(prev.blueprint || mergeBlueprintLayout(prev)),
          version: 2,
          selection: {
            ...(prev.blueprint?.selection || {}),
            expandedPromptStepIds: nextExpanded,
          },
        },
      };
    });
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

  const toggleStructuredSection = (stepId: string) => {
    setExpandedStructuredByStepId((prev) => ({ ...prev, [stepId]: !prev[stepId] }));
  };

  const commitBlueprintCommand = (
    type:
      | 'move_nodes'
      | 'connect_pin'
      | 'disconnect_pin'
      | 'create_step'
      | 'delete_step'
      | 'update_step'
      | 'move_comment'
      | 'resize_comment'
      | 'auto_layout',
    updater: (prev: Template) => Template
  ) => {
    setEditedTemplate((prev) => {
      const next = updater(prev);
      if (next === prev) return prev;
      setBlueprintCommandHistory((history) =>
        pushBlueprintCommand(history, {
          type,
          before: prev,
          after: next,
          createdAt: Date.now(),
        })
      );
      return next;
    });
  };

  const handleBlueprintConnect = (fromStepId: string, toStepId: string, toVariableKey: string) => {
    commitBlueprintCommand('connect_pin', (prev) => {
      const result = applyBlueprintEdgeChange(prev, {
        fromStepId,
        toStepId,
        toVariableKey,
        mode: 'add',
      });
      if (!result.ok && result.message) {
        window.alert(t(language, 'templateEditor.blueprintConnectFailed', { reason: result.message }));
      }
      return result.template;
    });
  };

  const handleBlueprintRemoveEdge = (fromStepId: string, toStepId: string) => {
    commitBlueprintCommand('disconnect_pin', (prev) =>
      applyBlueprintEdgeChange(prev, { fromStepId, toStepId, mode: 'remove' }).template
    );
  };

  const undoBlueprint = () => {
    setBlueprintCommandHistory((history) => {
      const undone = undoBlueprintCommand(history);
      if (undone.template) setEditedTemplate(undone.template);
      return undone.history;
    });
  };

  const redoBlueprint = () => {
    setBlueprintCommandHistory((history) => {
      const redone = redoBlueprintCommand(history);
      if (redone.template) setEditedTemplate(redone.template);
      return redone.history;
    });
  };

  const resetWorkbenchLayout = () => {
    setScenePanelVisible(true);
    setDetailsPanelVisible(true);
    onLeftPanelWidthChange(320);
    onBlueprintInspectorWidthChange(360);
  };

  const resetBlueprintLayout = () => {
    commitBlueprintCommand('auto_layout', (prev) => ({ ...prev, blueprint: buildBlueprintLayout(prev) }));
  };

  const tidyBlueprint = () => {
    commitBlueprintCommand('auto_layout', (prev) => ({
      ...prev,
      blueprint: tidyBlueprintLayout(prev, { selectedStepIds }),
    }));
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableEventTarget(event.target)) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        undoBlueprint();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redoBlueprint();
      } else if (event.key === 'Tab') {
        event.preventDefault();
        setShowBlueprintCreatePanel(true);
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        deleteSelectedSteps();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedStepIds, deleteSelectedSteps]);

  const templateMenuGroups: WorkbenchMenuGroup[] = [
    {
      label: 'Project',
      commands: [
        { id: 'save-template', label: 'Save Template', shortcut: 'Ctrl+S', run: () => onSave(editedTemplate) },
        { id: 'cancel-template', label: 'Close Editor', run: onCancel },
      ],
    },
    {
      label: 'Editor',
      commands: [
        { id: 'undo', label: 'Undo', shortcut: 'Ctrl+Z', enabled: blueprintCommandHistory.undoStack.length > 0, run: undoBlueprint },
        { id: 'redo', label: 'Redo', shortcut: 'Ctrl+Y', enabled: blueprintCommandHistory.redoStack.length > 0, run: redoBlueprint },
        { id: 'create-node', label: 'Create Node', shortcut: 'Tab', run: () => setShowBlueprintCreatePanel(true) },
        { id: 'delete-selection', label: 'Delete Selection', shortcut: 'Del', enabled: selectedStepIds.length > 0, run: deleteSelectedSteps },
        { id: 'select-all', label: 'Select All Nodes', shortcut: 'Ctrl+A', run: selectAllSteps },
      ],
    },
    {
      label: 'View',
      commands: [
        { id: 'tidy-layout', label: 'Tidy Layout', run: tidyBlueprint },
        { id: 'reset-layout', label: 'Reset Layout', run: resetBlueprintLayout },
        { id: 'toggle-minimap', label: 'Toggle MiniMap', run: () => setMinimapCollapsed((value) => !value) },
      ],
    },
    {
      label: 'Window',
      commands: [
        { id: 'toggle-scene', label: 'Toggle Scene Panel', run: () => setScenePanelVisible((value) => !value) },
        { id: 'toggle-details', label: 'Toggle Details Panel', run: () => setDetailsPanelVisible((value) => !value) },
        { id: 'reset-layout', label: 'Reset Layout', run: resetWorkbenchLayout },
      ],
    },
    {
      label: 'Help',
      commands: [
        { id: 'shortcuts', label: 'Shortcuts: Tab / Ctrl+Z / Ctrl+Y / Del', enabled: false, run: () => undefined },
      ],
    },
  ];

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-slate-900">
      <WorkbenchMenuBar groups={templateMenuGroups} />
      <div className="flex min-h-0 flex-1 flex-col p-3 md:p-4">
      <div className="mb-3 flex shrink-0 items-center gap-3 border-b border-slate-800 bg-slate-900 pb-2">
        <h2 className="shrink-0 text-base font-bold text-white">{t(language, 'templateEditor.title')}</h2>
        <input
          className="min-w-[180px] max-w-md flex-1 rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm font-semibold text-white outline-none focus:border-cyan-500"
          value={editedTemplate.name}
          aria-label={t(language, 'templateEditor.name')}
          onChange={(event) => setEditedTemplate({ ...editedTemplate, name: event.target.value })}
        />
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto no-scrollbar">
          {(editedTemplate.tags || []).map((tag, idx) => (
            <span
              key={`${tag}_${idx}`}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300"
            >
              {tag}
              <button
                type="button"
                onClick={() =>
                  setEditedTemplate({
                    ...editedTemplate,
                    tags: (editedTemplate.tags || []).filter((_, i) => i !== idx),
                  })
                }
                className="text-amber-600 hover:text-red-400"
              >
                x
              </button>
            </span>
          ))}
          <input
            className="w-28 shrink-0 rounded border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] text-slate-300 outline-none focus:border-amber-500"
            placeholder={t(language, 'templateEditor.addTag')}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              const value = event.currentTarget.value.trim();
              if (!value) return;
              setEditedTemplate({
                ...editedTemplate,
                tags: [...(editedTemplate.tags || []), value],
              });
              event.currentTarget.value = '';
            }}
          />
        </div>
        <div className="shrink-0 space-x-2">
          <Button variant="secondary" onClick={onCancel}>
            {t(language, 'templateEditor.cancel')}
          </Button>
          <Button onClick={() => onSave(editedTemplate)}>{t(language, 'templateEditor.save')}</Button>
        </div>
      </div>

      <SplitPane
        className="min-h-0 w-full flex-1"
        direction="horizontal"
        size={scenePanelVisible ? leftPanelWidth : 0}
        minSize={scenePanelVisible ? 280 : 0}
        maxSize={scenePanelVisible ? 480 : 0}
        onSizeChange={onLeftPanelWidthChange}
        first={
          <div className="h-full min-h-0 w-full overflow-y-auto pr-2 no-scrollbar">
            <div className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
              {language === 'zh-CN' ? '场景面板' : 'Scene Panel'}
            </div>
            <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
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
        }
        second={
          <div className="flex h-full min-h-0 w-full flex-col rounded-lg border border-slate-800 bg-slate-950/50 p-2">
            <div className="mb-2 flex shrink-0 items-center justify-between">
              <h3 className="text-base font-bold text-slate-200">
                {language === 'zh-CN' ? 'Workspace' : 'Workspace'}
              </h3>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <div className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-400">
                  Undo {blueprintCommandHistory.undoStack.length} / Redo {blueprintCommandHistory.redoStack.length}
                </div>
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
            <SplitPane
              className="min-h-0 w-full flex-1"
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
                    template={
                      editedTemplate.blueprint
                        ? editedTemplate
                        : { ...editedTemplate, blueprint: mergeBlueprintLayout(editedTemplate) }
                    }
                    selectedStepIds={selectedStepIds}
                    onSelectSteps={setSelectedStepIds}
                    onMoveNodes={(stepIds, dx, dy) =>
                      commitBlueprintCommand('move_nodes', (prev) => {
                        let next = prev;
                        stepIds.forEach((stepId) => {
                          const current = (next.blueprint?.nodes || {})[stepId];
                          if (!current) return;
                          next = updateBlueprintNodePosition(next, stepId, {
                            x: current.x + dx,
                            y: current.y + dy,
                          });
                        });
                        return next;
                      })
                    }
                    onConnect={({ fromStepId, toStepId, toVariableKey }) =>
                      handleBlueprintConnect(fromStepId, toStepId, toVariableKey)
                    }
                    onRemoveEdge={(fromStepId, toStepId) => handleBlueprintRemoveEdge(fromStepId, toStepId)}
                    onViewportChange={(x, y, zoom) =>
                      commitBlueprintCommand('move_nodes', (prev) => updateBlueprintViewport(prev, x, y, zoom))
                    }
                    onTidyLayout={tidyBlueprint}
                    onResetLayout={resetBlueprintLayout}
                    onCreateStepRequest={() => setShowBlueprintCreatePanel(true)}
                    debugState={undefined}
                    activeTool={blueprintActiveTool}
                    onActiveToolChange={setBlueprintActiveTool}
                    minimapCollapsed={minimapCollapsed}
                    onMinimapCollapsedChange={setMinimapCollapsed}
                  />
                </div>
              }
              second={
                <div className="flex h-full min-h-0 w-full flex-col overflow-y-auto no-scrollbar">
                  <div className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                    {language === 'zh-CN' ? '璇︽儏闈㈡澘' : 'Details Panel'}
                  </div>
                  {showBlueprintCreatePanel && (
                    <div className="mb-3 rounded-lg border border-slate-700 bg-slate-950 p-3">
                      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                        {language === 'zh-CN' ? '鍒涘缓鑺傜偣' : 'Create node'}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(['text_generation', 'manual', 'external'] as const).map((stepType) => (
                          <button
                            key={stepType}
                            onClick={() => {
                              const nextStepId = `step_${Date.now()}`;
                              commitBlueprintCommand('create_step', (prev) => {
                                const next = {
                                  ...prev,
                                  steps: [
                                    ...prev.steps,
                                    {
                                      id: nextStepId,
                                      name:
                                        stepType === 'text_generation'
                                          ? language === 'zh-CN'
                                            ? 'Text Node'
                                            : 'Text Node'
                                          : stepType === 'manual'
                                            ? language === 'zh-CN'
                                              ? 'Manual Node'
                                              : 'Manual Node'
                                            : language === 'zh-CN'
                                              ? 'External Node'
                                              : 'External Node',
                                      content: '',
                                      outputBinding: { variableKey: '' },
                                      execution: { systemPrompt: '' },
                                      stepType,
                                      autoRunEnabled: stepType === 'text_generation',
                                    },
                                  ],
                                };
                                return { ...next, blueprint: mergeBlueprintLayout(next) };
                              });
                              setSelectedStepIds([nextStepId]);
                              setShowBlueprintCreatePanel(false);
                            }}
                            className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:border-cyan-500"
                          >
                            {stepType}
                          </button>
                        ))}
                        <button
                          onClick={() => setShowBlueprintCreatePanel(false)}
                          className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-400"
                        >
                          {language === 'zh-CN' ? 'Close' : 'Close'}
                        </button>
                      </div>
                    </div>
                  )}
                  <BlueprintNodeInspector language={language} selectedStepId={selectedStepIds[0]}>
                  {(() => {
                    const stepId = selectedStepIds[0];
                    const stepIndex = editedTemplate.steps.findIndex((item) => item.id === stepId);
                    if (!stepId || stepIndex < 0) return null;
                    const step = editedTemplate.steps[stepIndex];
                    const isCollapsed = false;
                    const isSelected = selectedStepIds.includes(step.id);
                    const binding = normalizeBinding(step.outputBinding);
                    const execution = normalizeExecution(step.execution);
                    const stepType: StepType = step.stepType || (execution.modelRefId ? 'text_generation' : 'manual');
                    const autoRunEnabled = stepType === 'text_generation' && step.autoRunEnabled === true;
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
                    const isExecutionExpanded =
                      Boolean(expandedExecutionByStepId[step.id]) || savingExecutionPresetStepId === step.id;
                    const isBindingExpanded = Boolean(expandedBindingByStepId[step.id]);
                    const isStructuredExpanded = Boolean(expandedStructuredByStepId[step.id]);
                    const selectedExecutionPreset = enabledExecutionPresetTemplates.find(
                      (preset) => preset.id === selectedExecutionPresetByStepId[step.id]
                    );
                    const structuredFields = step.structuredOutputFields || [];
                    const structuredBindings = step.structuredOutputBindings || [];
                    const structuredSummary = structuredBindings
                      .filter((entry) => entry.fieldKey.trim() && entry.variableKey.trim())
                      .map((entry) => `${entry.fieldKey} -> {{${entry.variableKey}}}`)
                      .join(' 闂?');
                    const executionSummaryParts = [
                      getStepTypeLabel(language, stepType),
                      autoRunEnabled ? t(language, 'templateEditor.autoRunEnabled') : undefined,
                      currentRef?.label || t(language, 'step.manual'),
                      selectedExecutionPreset?.label,
                      execution.temperature !== undefined ? `T ${execution.temperature}` : undefined,
                      execution.maxTokens !== undefined ? `Max ${execution.maxTokens}` : undefined,
                      execution.systemPrompt.trim() ? t(language, 'step.systemPrompt') : t(language, 'step.notSet'),
                    ].filter(Boolean) as string[];

                    return (
                      <TemplateStepCard
                        key={step.id}
                        language={language}
                        step={step}
                        stepIndex={stepIndex}
                        editedTemplate={editedTemplate}
                        modelRefs={modelRefs}
                        isCollapsed={isCollapsed}
                        isSelected={isSelected}
                        isExecutionExpanded={isExecutionExpanded}
                        isBindingExpanded={isBindingExpanded}
                        isStructuredExpanded={isStructuredExpanded}
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
                        selectedExecutionPresetValue={selectedExecutionPresetByStepId[step.id] || ''}
                        enabledExecutionPresetTemplates={enabledExecutionPresetTemplates}
                        executionSummaryParts={executionSummaryParts}
                        structuredFields={structuredFields}
                        structuredBindings={structuredBindings}
                        structuredSummary={structuredSummary}
                        copiedExecutionConfigSourceStepId={copiedExecutionConfig?.sourceStepId}
                        copiedExecutionConfigSourceStepName={copiedExecutionConfig?.sourceStepName}
                        savingExecutionPresetStepId={savingExecutionPresetStepId}
                        executionPresetDraft={executionPresetDraft}
                        autocompleteState={autocompleteState}
                        filteredAutocompleteItems={filteredAutocompleteItems}
                        onToggleSelection={() => toggleStepSelection(step.id)}
                        onToggleCollapse={() => undefined}
                        onMoveStep={(direction) => moveStep(stepIndex, direction)}
                        onRemoveStep={() => removeStep(stepIndex)}
                        onToggleStepMenu={() => setOpenStepMenuId((current) => (current === step.id ? null : step.id))}
                        isStepMenuOpen={openStepMenuId === step.id}
                        onCopyExecutionConfig={() => {
                          copyStepExecutionConfig(step);
                          setOpenStepMenuId(null);
                        }}
                        onPasteExecutionConfig={() => {
                          pasteStepExecutionConfig(stepIndex);
                          setOpenStepMenuId(null);
                        }}
                        onUpdateStep={(updates) => updateStep(stepIndex, updates)}
                        onPromptChange={(value) => handlePromptContentChange(stepIndex, step.id, value)}
                        isPromptCollapsed={isPromptCollapsedByDefault(step.id)}
                        onTogglePromptCollapsed={() => togglePromptCollapsed(step.id)}
                        onPromptKeyDown={(event) => handlePromptKeyDown(event, stepIndex, step.id)}
                        onSyncAutocomplete={() => syncAutocomplete(step.id, step.content)}
                        onClearAutocompleteLater={() =>
                          setTimeout(
                            () => setAutocompleteState((prev) => (prev?.stepId === step.id ? null : prev)),
                            120
                          )
                        }
                        onPromptTextareaRef={(node) => {
                          promptTextareaRefs.current[step.id] = node;
                        }}
                        onApplyAutocompleteItem={(item) => applyAutocompleteItem(stepIndex, step.id, item)}
                        onToggleExecutionSection={() => toggleExecutionSection(step.id)}
                        onSelectedExecutionPresetChange={(value) =>
                          setSelectedExecutionPresetByStepId((prev) => ({ ...prev, [step.id]: value }))
                        }
                        onApplyExecutionPreset={() => applyExecutionPresetToStep(stepIndex, selectedExecutionPresetByStepId[step.id] || '')}
                        onStartSavingExecutionPreset={() => startSavingExecutionPreset(step)}
                        onCancelSavingExecutionPreset={cancelSavingExecutionPreset}
                        onSaveCurrentExecutionPreset={() => saveCurrentExecutionPreset(step, currentRef)}
                        onUpdateExecutionPresetDraft={updateExecutionPresetDraft}
                        onUpdateStepExecution={(updates) => updateStepExecution(stepIndex, updates)}
                        onUpdateStepMeta={(updates) => updateStepMeta(stepIndex, updates)}
                        onApplyStepModelRef={(modelRefId) => applyStepModelRef(stepIndex, modelRefId)}
                        onToggleBindingSection={() => toggleBindingSection(step.id)}
                        onToggleStructuredSection={() => toggleStructuredSection(step.id)}
                        onUpdateStepBinding={(updates) => updateStepBinding(stepIndex, updates)}
                        onAddStructuredField={() => addStructuredOutputField(stepIndex)}
                        onUpdateStructuredField={(fieldIndex, updates) => updateStructuredOutputField(stepIndex, fieldIndex, updates)}
                        onMoveStructuredField={(fieldIndex, direction) => moveStructuredOutputField(stepIndex, fieldIndex, direction)}
                        onRemoveStructuredField={(fieldIndex) => removeStructuredOutputField(stepIndex, fieldIndex)}
                        onUpdateStructuredBinding={(fieldKey, updates) => updateStructuredOutputBinding(stepIndex, fieldKey, updates)}
                        getExecutionBadgeClassName={getExecutionBadgeClassName}
                      />
                    );
                  })()}
                  </BlueprintNodeInspector>
                </div>
              }
            />
          </div>
        }
      />
      </div>
    </div>
  );
};
