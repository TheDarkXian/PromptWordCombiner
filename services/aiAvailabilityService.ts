import { ModelPreset, ProviderConfig, Template, TemplateStep } from '../types';

export interface ModelPresetAvailability {
  isAvailable: boolean;
  label: string;
  message: string;
  modelPreset?: ModelPreset;
  providerConfig?: ProviderConfig;
}

export const resolveModelPresetAvailability = (
  modelPresetId: string | undefined,
  modelPresets: ModelPreset[],
  providerConfigs: ProviderConfig[]
): ModelPresetAvailability => {
  if (!modelPresetId) {
    return { isAvailable: false, label: '未绑定模型', message: '还没有绑定模型预设。' };
  }

  const modelPreset = modelPresets.find(item => item.id === modelPresetId);
  if (!modelPreset) {
    return { isAvailable: false, label: '模型预设缺失', message: '绑定的模型预设不存在。' };
  }
  if (!modelPreset.enabled) {
    return { isAvailable: false, label: '模型已禁用', message: `模型预设“${modelPreset.label}”已禁用。`, modelPreset };
  }

  const providerConfig = providerConfigs.find(item => item.id === modelPreset.providerConfigId);
  if (!providerConfig) {
    return { isAvailable: false, label: '提供商缺失', message: '模型预设绑定的提供商不存在。', modelPreset };
  }
  if (!providerConfig.apiKey.trim()) {
    return { isAvailable: false, label: '缺少 API Key', message: `提供商“${providerConfig.label}”还没有配置 API Key。`, modelPreset, providerConfig };
  }
  if (!providerConfig.enabled) {
    return { isAvailable: false, label: '提供商已禁用', message: `提供商“${providerConfig.label}”已禁用。`, modelPreset, providerConfig };
  }

  return {
    isAvailable: true,
    label: '可用',
    message: `${providerConfig.label} / ${modelPreset.label} 可用。`,
    modelPreset,
    providerConfig,
  };
};

export interface StepAiAvailability {
  status:
    | 'manual'
    | 'missing_output_target'
    | 'missing_model_ref'
    | 'missing_model_preset'
    | 'model_disabled'
    | 'missing_provider'
    | 'provider_disabled'
    | 'missing_api_key'
    | 'ready';
  label: string;
  message: string;
  isRunnable: boolean;
  modelPreset?: ModelPreset;
  providerConfig?: ProviderConfig;
}

export const resolveStepAiAvailability = (
  step: TemplateStep,
  template: Template,
  modelPresets: ModelPreset[],
  providerConfigs: ProviderConfig[]
): StepAiAvailability => {
  if (!step.execution?.modelRefId) {
    return { status: 'manual', label: '手动步骤', message: '当前步骤没有启用 AI 文本生成。', isRunnable: false };
  }

  const modelRef = (template.modelRefs || []).find((item) => item.id === step.execution?.modelRefId);
  if (!modelRef) {
    return { status: 'missing_model_ref', label: '缺少模型变量', message: '当前步骤没有绑定有效的模型变量。', isRunnable: false };
  }

  if (!modelRef.modelPresetId) {
    return { status: 'missing_model_preset', label: '模型变量未绑定', message: `模型变量“${modelRef.label}”还没有绑定模型预设。`, isRunnable: false };
  }

  const modelAvailability = resolveModelPresetAvailability(modelRef.modelPresetId, modelPresets, providerConfigs);
  if (!modelAvailability.isAvailable) {
    const status = modelAvailability.label === '模型已禁用'
      ? 'model_disabled'
      : modelAvailability.label === '提供商缺失'
        ? 'missing_provider'
        : modelAvailability.label === '缺少 API Key'
          ? 'missing_api_key'
          : modelAvailability.label === '提供商已禁用'
            ? 'provider_disabled'
            : 'missing_model_preset';
    return { status, label: modelAvailability.label, message: modelAvailability.message, isRunnable: false, modelPreset: modelAvailability.modelPreset, providerConfig: modelAvailability.providerConfig };
  }

  const modelPreset = modelAvailability.modelPreset!;
  const providerConfig = modelAvailability.providerConfig!;

  return {
    status: 'ready',
    label: '可生成',
    message: `使用 ${providerConfig.label} / ${modelPreset.label} 生成文本。`,
    isRunnable: true,
    modelPreset,
    providerConfig,
  };
};
