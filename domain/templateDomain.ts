import { DEFAULT_MODEL_CATALOG, DEFAULT_PROVIDER_CONFIGS } from '../constants';
import {
  AppSettings,
  ExecutionPresetModelRefStrategy,
  ExecutionPresetTemplate,
  ModelCatalogItem,
  Template,
  TemplateModelRef,
} from '../types';

const LEGACY_MODEL_PRESET_MAP: Record<string, string> = {
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
      modelRef?.modelCatalogItemId ||
      LEGACY_MODEL_PRESET_MAP[modelRef?.presetId || ''] ||
      undefined;

    const modelCatalogItemExists = nextModelCatalogItemId
      ? modelCatalog.some((item) => item.id === nextModelCatalogItemId)
      : false;

    return {
      id: modelRef?.id || `model_ref_${Date.now()}`,
      label: modelRef?.label || 'Model Ref',
      modelCatalogItemId: modelCatalogItemExists ? nextModelCatalogItemId : undefined,
    };
  });

export const normalizeTemplate = (
  template: Template,
  modelCatalog: ModelCatalogItem[]
): Template => ({
  ...template,
  modelRefs: normalizeTemplateModelRefs(template, modelCatalog),
  steps: template.steps.map((step) => ({
    ...step,
    outputBinding: {
      variableKey: step.outputBinding?.variableKey || '',
      variableLabel: step.outputBinding?.variableLabel || '',
    },
    execution: {
      modelRefId: step.execution?.modelRefId,
      systemPrompt: step.execution?.systemPrompt || '',
      temperature:
        typeof step.execution?.temperature === 'number'
          ? step.execution.temperature
          : undefined,
      maxTokens:
        typeof step.execution?.maxTokens === 'number'
          ? step.execution.maxTokens
          : undefined,
    },
  })),
});

export const createDefaultSettings = (): AppSettings => ({
  language: 'zh-CN',
  uiScale: 16,
  sidebarWidth: 300,
  isSidebarOpen: true,
  rightPanelWidth: 400,
  isRightPanelOpen: true,
  fontSize: 'text-sm',
  cardScale: 300,
  fileLibrarySortBy: 'name',
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

  const executionPresetTemplates: ExecutionPresetTemplate[] =
    Array.isArray(raw?.executionPresetTemplates)
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
              modelRefStrategy === 'bind_specific_model_catalog_item'
                ? item?.modelCatalogItemId || undefined
                : undefined,
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
    uiScale: raw?.uiScale || defaults.uiScale,
    sidebarWidth: raw?.sidebarWidth || defaults.sidebarWidth,
    isSidebarOpen: raw?.isSidebarOpen ?? defaults.isSidebarOpen,
    rightPanelWidth: raw?.rightPanelWidth || defaults.rightPanelWidth,
    isRightPanelOpen: raw?.isRightPanelOpen ?? defaults.isRightPanelOpen,
    fontSize: raw?.fontSize || defaults.fontSize,
    cardScale: raw?.cardScale || defaults.cardScale,
    fileLibrarySortBy: raw?.fileLibrarySortBy || defaults.fileLibrarySortBy,
    providerConfigs,
    modelCatalog,
    executionPresetTemplates,
  };
};
