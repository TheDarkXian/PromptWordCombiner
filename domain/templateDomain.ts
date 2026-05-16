import { DEFAULT_MODEL_CATALOG, DEFAULT_PROVIDER_CONFIGS } from '../constants';
import {
  AppSettings,
  ExecutionPresetModelRefStrategy,
  ExecutionPresetTemplate,
  ModelCatalogItem,
  StepType,
  Template,
  TemplateModelRef,
} from '../types';

export const LEGACY_MODEL_PRESET_MAP: Record<string, string> = {
  'openai:gpt-4.1': 'model_openai_gpt_4_1',
  'openai:gpt-4.1-mini': 'model_openai_gpt_4_1_mini',
  'anthropic:claude-3-7-sonnet': 'model_anthropic_claude_3_7_sonnet',
  'deepseek:deepseek-chat': 'model_deepseek_v4_flash',
  'deepseek:deepseek-reasoner': 'model_deepseek_v4_pro',
};

const normalizeLegacyDeepSeekModel = (item: any) => {
  const modelName = String(item?.modelName || '');
  if (modelName === 'deepseek-chat') {
    return {
      ...item,
      id: item?.id || 'model_deepseek_v4_flash',
      label: 'DeepSeek V4 Flash',
      modelName: 'deepseek-v4-flash',
    };
  }
  if (modelName === 'deepseek-reasoner') {
    return {
      ...item,
      id: item?.id || 'model_deepseek_v4_pro',
      label: 'DeepSeek V4 Pro',
      modelName: 'deepseek-v4-pro',
    };
  }
  return item;
};

export const normalizeTemplateModelRefs = (
  template: Pick<Template, 'modelRefs'>,
  modelCatalog: ModelCatalogItem[]
): TemplateModelRef[] =>
  (template.modelRefs || []).map((modelRef: any) => {
    const nextModelCatalogItemId =
      modelRef?.modelCatalogItemId || LEGACY_MODEL_PRESET_MAP[modelRef?.presetId || ''] || undefined;
    const modelCatalogItemExists = nextModelCatalogItemId
      ? modelCatalog.some((item) => item.id === nextModelCatalogItemId)
      : false;
    return {
      id: modelRef?.id || `model_ref_${Date.now()}`,
      label: modelRef?.label || 'Model Ref',
      modelCatalogItemId: modelCatalogItemExists ? nextModelCatalogItemId : undefined,
    };
  });

export const normalizeTemplate = (template: Template, modelCatalog: ModelCatalogItem[]): Template => ({
  ...template,
  blueprint:
    template.blueprint && (template.blueprint.version === 1 || template.blueprint.version === 2)
      ? {
          version: 2,
          nodes: Object.fromEntries(
            Object.entries(template.blueprint.nodes || {}).map(([stepId, pos]) => [
              stepId,
              {
                x: Number.isFinite(pos?.x) ? pos.x : 0,
                y: Number.isFinite(pos?.y) ? pos.y : 0,
              },
            ])
          ),
          viewport: template.blueprint.viewport
            ? {
                x: Number.isFinite(template.blueprint.viewport.x) ? template.blueprint.viewport.x : 0,
                y: Number.isFinite(template.blueprint.viewport.y) ? template.blueprint.viewport.y : 0,
                zoom: Number.isFinite(template.blueprint.viewport.zoom)
                  ? template.blueprint.viewport.zoom
                  : 1,
              }
            : undefined,
          comments: Array.isArray(template.blueprint.comments)
            ? template.blueprint.comments.map((item) => ({
                id: item.id,
                title: item.title || '',
                x: Number.isFinite(item.x) ? item.x : 0,
                y: Number.isFinite(item.y) ? item.y : 0,
                width: Number.isFinite(item.width) ? item.width : 360,
                height: Number.isFinite(item.height) ? item.height : 240,
                collapsed: item.collapsed === true,
              }))
            : [],
          selection: {
            stepIds: template.blueprint.selection?.stepIds || [],
            edgeKeys: template.blueprint.selection?.edgeKeys || [],
            commentIds: template.blueprint.selection?.commentIds || [],
            expandedPromptStepIds: template.blueprint.selection?.expandedPromptStepIds || [],
          },
        }
      : undefined,
  modelRefs: normalizeTemplateModelRefs(template, modelCatalog),
  steps: template.steps.map((step) => {
    const normalizedStepType: StepType =
      step.stepType === 'text_generation' || step.stepType === 'manual' || step.stepType === 'external'
        ? step.stepType
        : step.execution?.modelRefId
          ? 'text_generation'
          : 'manual';

    return {
      ...step,
      stepType: normalizedStepType,
      autoRunEnabled: normalizedStepType === 'text_generation' ? step.autoRunEnabled === true : false,
      structuredOutputFields: Array.isArray((step as any).structuredOutputFields)
        ? (step as any).structuredOutputFields.map((field: any) => ({
            key: field?.key || '',
            label: field?.label || field?.key || '',
            description: field?.description || '',
          }))
        : [],
      structuredOutputBindings: Array.isArray((step as any).structuredOutputBindings)
        ? (step as any).structuredOutputBindings.map((binding: any) => ({
            fieldKey: binding?.fieldKey || '',
            variableKey: binding?.variableKey || '',
            variableLabel: binding?.variableLabel || '',
          }))
        : [],
      outputBinding: {
        variableKey: step.outputBinding?.variableKey || '',
        variableLabel: step.outputBinding?.variableLabel || '',
      },
      execution: {
        modelRefId: step.execution?.modelRefId,
        systemPrompt: step.execution?.systemPrompt || '',
        temperature: typeof step.execution?.temperature === 'number' ? step.execution.temperature : undefined,
        maxTokens: typeof step.execution?.maxTokens === 'number' ? step.execution.maxTokens : undefined,
      },
    };
  }),
});

export const createDefaultSettings = (): AppSettings => ({
  language: 'zh-CN',
  tabOpenMode: 'multi',
  uiScale: 16,
  sidebarWidth: 300,
  isSidebarOpen: true,
  templateEditorLeftWidth: 320,
  templateBlueprintInspectorWidth: 360,
  projectRunnerInspectorWidth: 360,
  fontSize: 'text-sm',
  cardScale: 300,
  fileLibrarySortBy: 'name',
  structuredOutputResultView: 'raw',
  projectWorkspaceByTemplateId: {},
  providerConfigs: DEFAULT_PROVIDER_CONFIGS.map((item) => ({ ...item })),
  modelCatalog: DEFAULT_MODEL_CATALOG.map((item) => ({ ...item })),
  executionPresetTemplates: [],
});

export const normalizeSettings = (raw: any): AppSettings => {
  const defaults = createDefaultSettings();
  const providerConfigs =
    Array.isArray(raw?.providerConfigs) && raw.providerConfigs.length > 0
      ? raw.providerConfigs.map((provider: any, index: number) => ({
          id: provider?.id || `provider_${Date.now()}_${index}`,
          label: provider?.label || `Provider ${index + 1}`,
          providerType: provider?.providerType || 'openai',
          apiKey: provider?.apiKey || '',
          baseUrl: provider?.baseUrl || '',
          enabled: provider?.enabled !== false,
        }))
      : defaults.providerConfigs;

  const modelCatalog =
    Array.isArray(raw?.modelCatalog) && raw.modelCatalog.length > 0
      ? raw.modelCatalog.map((rawItem: any, index: number) => {
          const item = normalizeLegacyDeepSeekModel(rawItem);
          return {
            id: item?.id || `model_${Date.now()}_${index}`,
            label: item?.label || `Model ${index + 1}`,
            providerConfigId: item?.providerConfigId || providerConfigs[0]?.id || '',
            modelName: item?.modelName || '',
            enabled: item?.enabled !== false,
          };
        })
      : defaults.modelCatalog;

  const executionPresetTemplates: ExecutionPresetTemplate[] = Array.isArray(raw?.executionPresetTemplates)
    ? raw.executionPresetTemplates.map((item: any, index: number) => {
        const now = Date.now();
        const modelRefStrategy: ExecutionPresetModelRefStrategy =
          item?.modelRefStrategy === 'bind_specific_model_catalog_item'
            ? 'bind_specific_model_catalog_item'
            : 'keep_current';
        return {
          id: item?.id || `execution_preset_${now}_${index}`,
          label: item?.label || `执行模板 ${index + 1}`,
          description: item?.description || '',
          modelRefStrategy,
          modelCatalogItemId:
            modelRefStrategy === 'bind_specific_model_catalog_item' ? item?.modelCatalogItemId || undefined : undefined,
          temperature: typeof item?.temperature === 'number' ? item.temperature : undefined,
          maxTokens: typeof item?.maxTokens === 'number' ? item.maxTokens : undefined,
          systemPrompt: item?.systemPrompt || '',
          enabled: item?.enabled !== false,
          createdAt: typeof item?.createdAt === 'number' ? item.createdAt : now,
          updatedAt: typeof item?.updatedAt === 'number' ? item.updatedAt : now,
        };
      })
    : defaults.executionPresetTemplates;

  return {
    language: raw?.language === 'en-US' ? 'en-US' : defaults.language,
    tabOpenMode: raw?.tabOpenMode === 'multi' ? 'multi' : defaults.tabOpenMode,
    uiScale: raw?.uiScale || defaults.uiScale,
    sidebarWidth: raw?.sidebarWidth || defaults.sidebarWidth,
    isSidebarOpen: raw?.isSidebarOpen ?? defaults.isSidebarOpen,
    templateEditorLeftWidth: raw?.templateEditorLeftWidth || defaults.templateEditorLeftWidth,
    templateBlueprintInspectorWidth:
      raw?.templateBlueprintInspectorWidth || defaults.templateBlueprintInspectorWidth,
    projectRunnerInspectorWidth: raw?.projectRunnerInspectorWidth || defaults.projectRunnerInspectorWidth,
    fontSize: raw?.fontSize || defaults.fontSize,
    cardScale: raw?.cardScale || defaults.cardScale,
    fileLibrarySortBy: raw?.fileLibrarySortBy || defaults.fileLibrarySortBy,
    structuredOutputResultView: raw?.structuredOutputResultView === 'structured' ? 'structured' : 'raw',
    projectWorkspaceByTemplateId:
      raw?.projectWorkspaceByTemplateId && typeof raw.projectWorkspaceByTemplateId === 'object'
        ? Object.fromEntries(
            Object.entries(raw.projectWorkspaceByTemplateId).map(([templateId, state]: [string, any]) => [
              templateId,
              {
                selectedStepIds: Array.isArray(state?.selectedStepIds) ? state.selectedStepIds : [],
                blueprintViewport: state?.blueprintViewport
                  ? {
                      x: Number.isFinite(state.blueprintViewport.x) ? state.blueprintViewport.x : 0,
                      y: Number.isFinite(state.blueprintViewport.y) ? state.blueprintViewport.y : 0,
                      zoom: Number.isFinite(state.blueprintViewport.zoom) ? state.blueprintViewport.zoom : 1,
                    }
                  : undefined,
                viewMode: state?.viewMode === 'detail' ? 'detail' : 'compact',
                sidebarTab:
                  state?.sidebarTab === 'preview' ||
                  state?.sidebarTab === 'nav' ||
                  state?.sidebarTab === 'build'
                    ? state.sidebarTab
                    : 'vars',
                sidebarVariableTab:
                  state?.sidebarVariableTab === 'local' || state?.sidebarVariableTab === 'result'
                    ? state.sidebarVariableTab
                    : 'input',
                inspectorWidth:
                  typeof state?.inspectorWidth === 'number' ? state.inspectorWidth : defaults.projectRunnerInspectorWidth,
              },
            ])
          )
        : defaults.projectWorkspaceByTemplateId,
    providerConfigs,
    modelCatalog,
    executionPresetTemplates,
  };
};
