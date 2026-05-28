import {
  ModelCatalogItem,
  ProviderConfig,
  ProviderType,
  StepExecutionAvailability,
  Template,
  TemplateStep,
} from '../types';

interface ResolveExecutionAvailabilityParams {
  step: TemplateStep;
  template: Template;
  modelCatalog: ModelCatalogItem[];
  providerConfigs: ProviderConfig[];
}

export const SUPPORTED_EXECUTION_PROVIDERS: ProviderType[] = ['openai', 'anthropic', 'deepseek', 'openai_compatible'];

const getConnectedModelSource = (step: TemplateStep, template: Template) => {
  const sourceStepId = step.execution?.modelSourceStepId?.trim();
  if (!sourceStepId) return undefined;
  const sourceStep = template.steps.find((item) => item.id === sourceStepId);
  return {
    sourceStepId,
    sourceStep,
    modelRefId: sourceStep?.kind === 'model' ? sourceStep.model?.modelRefId?.trim() : undefined,
  };
};

export const resolveStepExecutionAvailability = ({
  step,
  template,
  modelCatalog,
  providerConfigs,
}: ResolveExecutionAvailabilityParams): StepExecutionAvailability => {
  if (step.kind === 'model') {
    return {
      status: 'manual',
      label: '模型节点',
      message: '模型节点只提供模型引用，不需要单独执行。',
      isRunnable: false,
    };
  }

  if (step.kind === 'variable' || step.kind === 'math_operation' || step.kind === 'table_row') {
    const label =
      step.kind === 'variable'
        ? '本地变量节点'
        : step.kind === 'math_operation'
          ? '本地数学节点'
          : '本地表行节点';
    return {
      status: 'ready',
      label,
      message: '这个节点在本地执行，不需要模型引用。',
      isRunnable: true,
    };
  }

  const connectedModel = getConnectedModelSource(step, template);
  if (connectedModel && (!connectedModel.sourceStep || connectedModel.sourceStep.kind !== 'model')) {
    return {
      status: 'missing_model_ref',
      label: '模型节点缺失',
      message: '连接的模型节点不存在，请重新连接函数节点的模型输入端。',
      isRunnable: false,
    };
  }
  if (connectedModel && !connectedModel.modelRefId) {
    return {
      status: 'missing_model_ref',
      label: '模型节点未绑定',
      message: '连接的模型节点没有选择模型引用。',
      isRunnable: false,
    };
  }

  const modelRefId = connectedModel?.modelRefId || step.execution?.modelRefId;
  if (!modelRefId) {
    return {
      status: 'manual',
      label: '手动步骤',
      message: '当前步骤没有绑定模型引用，默认按手动步骤处理。',
      isRunnable: false,
    };
  }

  const modelRef = (template.modelRefs || []).find((item) => item.id === modelRefId);
  if (!modelRef) {
    return {
      status: 'missing_model_ref',
      label: '缺少模型引用',
      message: '当前步骤绑定的模型引用不存在，请回到模板里重新选择。',
      isRunnable: false,
    };
  }

  if (!modelRef.modelCatalogItemId) {
    return {
      status: 'missing_model_catalog_item',
      label: '未绑定具体模型',
      message: '这个模型引用还没有绑定模型目录项。',
      isRunnable: false,
      modelRef,
    };
  }

  const modelCatalogItem = modelCatalog.find((item) => item.id === modelRef.modelCatalogItemId);
  if (!modelCatalogItem) {
    return {
      status: 'missing_model_catalog_item',
      label: '模型目录项缺失',
      message: '当前步骤引用的模型目录项不存在，请检查设置页或模板引用。',
      isRunnable: false,
      modelRef,
    };
  }

  if (!modelCatalogItem.enabled) {
    return {
      status: 'model_disabled',
      label: '模型已禁用',
      message: '当前模型目录项已禁用，启用后才能执行。',
      isRunnable: false,
      modelRef,
      modelCatalogItem,
    };
  }

  const providerConfig = providerConfigs.find((item) => item.id === modelCatalogItem.providerConfigId);
  if (!providerConfig) {
    return {
      status: 'missing_provider',
      label: '提供商缺失',
      message: '当前模型绑定的提供商不存在，请检查设置页。',
      isRunnable: false,
      modelRef,
      modelCatalogItem,
    };
  }

  if (!providerConfig.enabled) {
    return {
      status: 'provider_disabled',
      label: '提供商已禁用',
      message: '当前提供商已禁用，启用后才能执行。',
      isRunnable: false,
      modelRef,
      modelCatalogItem,
      providerConfig,
    };
  }

  if (!providerConfig.apiKey.trim()) {
    return {
      status: 'missing_api_key',
      label: '缺少 API Key',
      message: '当前提供商还没有配置 API Key。',
      isRunnable: false,
      modelRef,
      modelCatalogItem,
      providerConfig,
    };
  }

  if (!SUPPORTED_EXECUTION_PROVIDERS.includes(providerConfig.providerType)) {
    return {
      status: 'unsupported_provider',
      label: '暂不支持执行',
      message: `当前版本还没有接入 ${providerConfig.providerType} 的执行能力。`,
      isRunnable: false,
      modelRef,
      modelCatalogItem,
      providerConfig,
    };
  }

  return {
    status: 'ready',
    label: '可执行',
    message: `将使用 ${providerConfig.label} / ${modelCatalogItem.label} 执行当前步骤。`,
    isRunnable: true,
    modelRef,
    modelCatalogItem,
    providerConfig,
  };
};
