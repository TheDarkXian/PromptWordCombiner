import { ModelPreset, ProviderConfig, Template, TemplateStep } from '../types';

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
  if (!step.execution?.enabled) {
    return { status: 'manual', label: '手动步骤', message: '当前步骤没有启用 AI 文本生成。', isRunnable: false };
  }

  if (step.execution.outputTarget === 'templateInput' && !step.execution.outputInputId) {
    return { status: 'missing_output_target', label: '缺少目标变量', message: '当前步骤设置为写入变量，但还没有选择目标变量。', isRunnable: false };
  }

  const modelRef = (template.modelRefs || []).find((item) => item.id === step.execution?.modelRefId);
  if (!modelRef) {
    return { status: 'missing_model_ref', label: '缺少模型变量', message: '当前步骤没有绑定有效的模型变量。', isRunnable: false };
  }

  if (!modelRef.modelPresetId) {
    return { status: 'missing_model_preset', label: '模型变量未绑定', message: `模型变量“${modelRef.label}”还没有绑定模型预设。`, isRunnable: false };
  }

  const modelPreset = modelPresets.find((item) => item.id === modelRef.modelPresetId);
  if (!modelPreset) {
    return { status: 'missing_model_preset', label: '模型预设缺失', message: '模型变量绑定的模型预设不存在。', isRunnable: false };
  }

  if (!modelPreset.enabled) {
    return { status: 'model_disabled', label: '模型已禁用', message: `模型预设“${modelPreset.label}”已禁用。`, isRunnable: false, modelPreset };
  }

  const providerConfig = providerConfigs.find((item) => item.id === modelPreset.providerConfigId);
  if (!providerConfig) {
    return { status: 'missing_provider', label: '提供商缺失', message: '模型预设绑定的提供商不存在。', isRunnable: false, modelPreset };
  }

  if (!providerConfig.enabled) {
    return { status: 'provider_disabled', label: '提供商已禁用', message: `提供商“${providerConfig.label}”已禁用。`, isRunnable: false, modelPreset, providerConfig };
  }

  if (!providerConfig.apiKey.trim()) {
    return { status: 'missing_api_key', label: '缺少 API Key', message: `提供商“${providerConfig.label}”还没有配置 API Key。`, isRunnable: false, modelPreset, providerConfig };
  }

  return {
    status: 'ready',
    label: '可生成',
    message: `使用 ${providerConfig.label} / ${modelPreset.label} 生成文本。`,
    isRunnable: true,
    modelPreset,
    providerConfig,
  };
};
