import { ModelCatalogItem, ProviderConfig, Template } from './types';

export const DEFAULT_PROVIDER_CONFIGS: ProviderConfig[] = [
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
  {
    id: 'provider_gemini_default',
    label: 'Gemini Default',
    providerType: 'gemini',
    apiKey: '',
    baseUrl: 'https://generativelanguage.googleapis.com',
    enabled: true,
  },
];

export const DEFAULT_MODEL_CATALOG: ModelCatalogItem[] = [
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
  {
    id: 'model_gemini_2_5_pro',
    label: 'Gemini 2.5 Pro',
    providerConfigId: 'provider_gemini_default',
    modelName: 'gemini-2.5-pro',
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
      modelCatalogItemId: 'model_openai_gpt_4_1',
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
