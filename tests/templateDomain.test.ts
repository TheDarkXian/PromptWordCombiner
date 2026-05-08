import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_MODEL_CATALOG } from '../constants';
import {
  createDefaultSettings,
  normalizeSettings,
  normalizeTemplate,
  normalizeTemplateModelRefs,
} from '../domain/templateDomain';
import type { Template } from '../types';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('templateDomain', () => {
  it('maps legacy preset ids to current model catalog items when available', () => {
    const refs = normalizeTemplateModelRefs(
      {
        modelRefs: [
          {
            id: 'legacy-ref',
            label: 'Legacy Ref',
            presetId: 'openai:gpt-4.1-mini',
          },
        ] as unknown as Template['modelRefs'],
      },
      DEFAULT_MODEL_CATALOG
    );

    expect(refs).toEqual([
      {
        id: 'legacy-ref',
        label: 'Legacy Ref',
        modelCatalogItemId: 'model_openai_gpt_4_1_mini',
      },
    ]);
  });

  it('normalizes template steps and missing execution fields', () => {
    const template = normalizeTemplate(
      {
        id: 'template-1',
        name: 'Template',
        inputs: [],
        modelRefs: [],
        steps: [
          {
            id: 'step-1',
            name: 'Step 1',
            content: 'hello',
          },
        ],
      },
      DEFAULT_MODEL_CATALOG
    );

    expect(template.steps[0]).toEqual(
      expect.objectContaining({
        outputBinding: {
          variableKey: '',
          variableLabel: '',
        },
        execution: {
          modelRefId: undefined,
          systemPrompt: '',
          temperature: undefined,
          maxTokens: undefined,
        },
      })
    );
  });

  it('creates default settings with default providers and model catalog', () => {
    const settings = createDefaultSettings();

    expect(settings.language).toBe('zh-CN');
    expect(settings.providerConfigs).toHaveLength(3);
    expect(settings.modelCatalog).toEqual(DEFAULT_MODEL_CATALOG);
    expect(settings.executionPresetTemplates).toEqual([]);
  });

  it('normalizes legacy deepseek models and fills missing ids with deterministic timestamps', () => {
    vi.spyOn(Date, 'now').mockReturnValue(123456);

    const settings = normalizeSettings({
      language: 'en-US',
      providerConfigs: [
        {
          label: 'Legacy Provider',
          providerType: 'deepseek',
          apiKey: '',
          enabled: true,
        },
      ],
      modelCatalog: [
        {
          modelName: 'deepseek-chat',
          providerConfigId: 'provider_legacy',
        },
      ],
      executionPresetTemplates: [
        {
          label: 'Preset',
          modelRefStrategy: 'bind_specific_model_catalog_item',
          modelCatalogItemId: 'model_deepseek_v4_flash',
          enabled: true,
        },
      ],
    });

    expect(settings.language).toBe('en-US');
    expect(settings.providerConfigs[0]?.id).toBe('provider_123456_0');
    expect(settings.modelCatalog[0]).toEqual(
      expect.objectContaining({
        id: 'model_deepseek_v4_flash',
        label: 'DeepSeek V4 Flash',
        modelName: 'deepseek-v4-flash',
      })
    );
    expect(settings.executionPresetTemplates[0]).toEqual(
      expect.objectContaining({
        id: 'execution_preset_123456_0',
        modelRefStrategy: 'bind_specific_model_catalog_item',
        modelCatalogItemId: 'model_deepseek_v4_flash',
      })
    );
  });
});
