import { ModelCatalogItem, ProviderConfig, Template } from './types';

export const DEEPSEEK_EXECUTION_PRESETS = [
  {
    id: 'deepseek_balanced',
    label: '平衡',
    description: '通用文本生成',
    temperature: 0.7,
    maxTokens: 1200,
  },
  {
    id: 'deepseek_precise',
    label: '稳健',
    description: '更克制，适合结构化和改写',
    temperature: 0.2,
    maxTokens: 900,
  },
  {
    id: 'deepseek_creative',
    label: '发散',
    description: '更开放，适合创意描述',
    temperature: 1,
    maxTokens: 1400,
  },
  {
    id: 'deepseek_longform',
    label: '长输出',
    description: '适合长段落和展开说明',
    temperature: 0.6,
    maxTokens: 2200,
  },
] as const;

export const DEEPSEEK_SYSTEM_PROMPT_PRESETS = [
  {
    id: 'deepseek_scene_writer',
    label: '场景扩写',
    description: '适合把简短主题扩成细节丰富的描述',
    content: 'You expand short ideas into vivid, concrete scene descriptions. Keep the output focused, visual, and directly usable for downstream creative generation.',
  },
  {
    id: 'deepseek_precise_rewriter',
    label: '稳健改写',
    description: '适合结构化整理、规范表达和收束输出',
    content: 'You rewrite the input into a cleaner, more structured, and more precise version. Keep the meaning stable, reduce ambiguity, and avoid unnecessary flourish.',
  },
  {
    id: 'deepseek_prompt_optimizer',
    label: '提示词优化',
    description: '适合整理成更可执行的提示词',
    content: 'You turn the input into a concise, high-signal prompt that is easier for another model to execute. Preserve intent, remove noise, and improve clarity.',
  },
  {
    id: 'deepseek_reasoning_analyst',
    label: '推理分析',
    description: '适合分解问题、给出有条理的分析',
    content: 'You analyze the request carefully, break it into clear parts, and produce a rigorous, well-structured answer. Prefer explicit reasoning, consistent terminology, and actionable conclusions.',
  },
] as const;

export const getRecommendedDeepSeekPresetByModelName = (modelName?: string) => {
  const normalizedName = String(modelName || '').toLowerCase();
  if (normalizedName.includes('v4-pro')) {
    return DEEPSEEK_EXECUTION_PRESETS.find((preset) => preset.id === 'deepseek_precise');
  }
  if (normalizedName.includes('v4-flash')) {
    return DEEPSEEK_EXECUTION_PRESETS.find((preset) => preset.id === 'deepseek_balanced');
  }
  return undefined;
};

export const getRecommendedDeepSeekSystemPromptPresetByModelName = (modelName?: string) => {
  const normalizedName = String(modelName || '').toLowerCase();
  if (normalizedName.includes('v4-pro')) {
    return DEEPSEEK_SYSTEM_PROMPT_PRESETS.find((preset) => preset.id === 'deepseek_reasoning_analyst');
  }
  if (normalizedName.includes('v4-flash')) {
    return DEEPSEEK_SYSTEM_PROMPT_PRESETS.find((preset) => preset.id === 'deepseek_scene_writer');
  }
  return undefined;
};

export const DEFAULT_PROVIDER_CONFIGS: ProviderConfig[] = [
  {
    id: 'provider_deepseek_default',
    label: 'DeepSeek Default',
    providerType: 'deepseek',
    apiKey: '',
    baseUrl: 'https://api.deepseek.com/v1',
    enabled: true,
  },
  {
    id: 'provider_openai_default',
    label: 'OpenAI Default',
    providerType: 'openai',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    enabled: true,
  },
  {
    id: 'provider_anthropic_default',
    label: 'Anthropic Default',
    providerType: 'anthropic',
    apiKey: '',
    baseUrl: 'https://api.anthropic.com',
    enabled: true,
  },
];

export const DEFAULT_MODEL_CATALOG: ModelCatalogItem[] = [
  {
    id: 'model_deepseek_v4_pro',
    label: 'DeepSeek V4 Pro',
    providerConfigId: 'provider_deepseek_default',
    modelName: 'deepseek-v4-pro',
    enabled: true,
  },
  {
    id: 'model_deepseek_v4_flash',
    label: 'DeepSeek V4 Flash',
    providerConfigId: 'provider_deepseek_default',
    modelName: 'deepseek-v4-flash',
    enabled: true,
  },
  {
    id: 'model_openai_gpt_4_1',
    label: 'GPT-4.1',
    providerConfigId: 'provider_openai_default',
    modelName: 'gpt-4.1',
    enabled: true,
  },
  {
    id: 'model_openai_gpt_4_1_mini',
    label: 'GPT-4.1 Mini',
    providerConfigId: 'provider_openai_default',
    modelName: 'gpt-4.1-mini',
    enabled: true,
  },
  {
    id: 'model_anthropic_claude_3_7_sonnet',
    label: 'Claude 3.7 Sonnet',
    providerConfigId: 'provider_anthropic_default',
    modelName: 'claude-3-7-sonnet-latest',
    enabled: true,
  },
];

export const DEFAULT_TEMPLATE: Template = {
  id: 'pro_chain_demo',
  name: 'Prompt Chain Demo',
  inputs: [
    {
      id: 'topic',
      label: 'topic',
      defaultValue: 'cyberpunk forest',
    },
    {
      id: 'mood',
      label: 'mood',
      defaultValue: 'melancholic and mysterious',
    },
  ],
  modelRefs: [
    {
      id: 'model_ref_a',
      label: 'Description Model A',
      modelCatalogItemId: 'model_deepseek_v4_pro',
    },
  ],
  steps: [
    {
      id: 'step_concept',
      name: '1. Scene Description',
      description: 'Expand the topic into a detailed visual scene description.',
      content:
        'Write a detailed scene description for the topic "{{topic}}". Mood requirement: "{{mood}}". Include lighting, atmosphere, and a distinctive visual motif.',
      execution: {
        modelRefId: 'model_ref_a',
        systemPrompt: 'Expand short ideas into vivid scene descriptions suitable for downstream image generation.',
      },
      outputBinding: {
        variableKey: 'scene_description',
        variableLabel: 'Scene Description',
      },
    },
    {
      id: 'step_mj_prompt',
      name: '2. Image Prompt',
      description: 'Turn the scene description into an English image-generation prompt.',
      content:
        'Transform the following scene description into a professional English image prompt:\n---\n{{scene_description}}\n---\nAdd concise quality and lighting modifiers at the end.',
      outputBinding: {
        variableKey: 'image_prompt_en',
        variableLabel: 'Image Prompt',
      },
    },
    {
      id: 'step_sd_negative',
      name: '3. Negative Prompt',
      description: 'Generate a general negative prompt for the scene.',
      content:
        'Create a negative prompt that complements the following image prompt:\n---\n{{image_prompt_en}}\n---',
      outputBinding: {
        variableKey: 'negative_prompt',
        variableLabel: 'Negative Prompt',
      },
    },
  ],
};

export const DEFAULT_TEMPLATES = [DEFAULT_TEMPLATE];
