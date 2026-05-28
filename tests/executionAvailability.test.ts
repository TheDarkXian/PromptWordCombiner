import { describe, expect, it } from 'vitest';

import { resolveStepExecutionAvailability } from '../services/executionAvailability';
import type {
  ModelCatalogItem,
  ProviderConfig,
  Template,
  TemplateStep,
} from '../types';

const modelCatalog: ModelCatalogItem[] = [
  {
    id: 'model-1',
    label: 'Model 1',
    providerConfigId: 'provider-1',
    modelName: 'gpt-4.1',
    enabled: true,
  },
];

const providerConfigs: ProviderConfig[] = [
  {
    id: 'provider-1',
    label: 'Provider 1',
    providerType: 'openai',
    apiKey: 'secret',
    baseUrl: 'https://api.openai.com/v1',
    enabled: true,
  },
];

const template: Template = {
  id: 'template-1',
  name: 'Template',
  inputs: [],
  modelRefs: [{ id: 'model-ref-1', label: 'Ref 1', modelCatalogItemId: 'model-1' }],
  steps: [],
};

const createStep = (execution?: TemplateStep['execution']): TemplateStep => ({
  id: 'step-1',
  name: 'Step 1',
  content: 'content',
  execution,
});

describe('executionAvailability', () => {
  it('returns manual when no model ref is bound', () => {
    const availability = resolveStepExecutionAvailability({
      step: createStep(),
      template,
      modelCatalog,
      providerConfigs,
    });

    expect(availability.status).toBe('manual');
    expect(availability.isRunnable).toBe(false);
  });

  it('returns missing_model_ref for a dangling model ref id', () => {
    const availability = resolveStepExecutionAvailability({
      step: createStep({ modelRefId: 'missing', systemPrompt: '' }),
      template,
      modelCatalog,
      providerConfigs,
    });

    expect(availability.status).toBe('missing_model_ref');
  });

  it('returns missing_model_catalog_item when the ref is not bound to a concrete model', () => {
    const availability = resolveStepExecutionAvailability({
      step: createStep({ modelRefId: 'model-ref-2', systemPrompt: '' }),
      template: {
        ...template,
        modelRefs: [{ id: 'model-ref-2', label: 'Ref 2' }],
      },
      modelCatalog,
      providerConfigs,
    });

    expect(availability.status).toBe('missing_model_catalog_item');
  });

  it('returns missing_provider when the model points to a nonexistent provider', () => {
    const availability = resolveStepExecutionAvailability({
      step: createStep({ modelRefId: 'model-ref-1', systemPrompt: '' }),
      template,
      modelCatalog: [
        {
          ...modelCatalog[0],
          providerConfigId: 'missing-provider',
        },
      ],
      providerConfigs,
    });

    expect(availability.status).toBe('missing_provider');
  });

  it('returns missing_api_key when the provider has no key', () => {
    const availability = resolveStepExecutionAvailability({
      step: createStep({ modelRefId: 'model-ref-1', systemPrompt: '' }),
      template,
      modelCatalog,
      providerConfigs: [
        {
          ...providerConfigs[0],
          apiKey: '   ',
        },
      ],
    });

    expect(availability.status).toBe('missing_api_key');
  });

  it('returns ready when model and provider are valid and enabled', () => {
    const availability = resolveStepExecutionAvailability({
      step: createStep({ modelRefId: 'model-ref-1', systemPrompt: '' }),
      template,
      modelCatalog,
      providerConfigs,
    });

    expect(availability.status).toBe('ready');
    expect(availability.isRunnable).toBe(true);
    expect(availability.modelCatalogItem?.id).toBe('model-1');
    expect(availability.providerConfig?.id).toBe('provider-1');
  });

  it('returns ready for local table row nodes without a model ref', () => {
    const availability = resolveStepExecutionAvailability({
      step: {
        id: 'row-step',
        name: 'Row',
        kind: 'table_row',
        content: '',
        tableRow: { tableKey: 'items', rowIndex: '1' },
        stepType: 'manual',
        execution: { systemPrompt: '' },
      },
      template,
      modelCatalog,
      providerConfigs,
    });

    expect(availability.status).toBe('ready');
    expect(availability.isRunnable).toBe(true);
  });

  it('uses a connected model node before the function fallback model ref', () => {
    const availability = resolveStepExecutionAvailability({
      step: createStep({
        modelRefId: 'fallback-missing',
        modelSourceStepId: 'model-node',
        systemPrompt: '',
      }),
      template: {
        ...template,
        steps: [
          {
            id: 'model-node',
            name: 'Model',
            kind: 'model',
            content: '',
            model: { modelRefId: 'model-ref-1' },
            execution: { systemPrompt: '' },
          },
        ],
      },
      modelCatalog,
      providerConfigs,
    });

    expect(availability.status).toBe('ready');
    expect(availability.modelRef?.id).toBe('model-ref-1');
  });

  it('blocks a function connected to an unbound model node', () => {
    const availability = resolveStepExecutionAvailability({
      step: createStep({ modelSourceStepId: 'model-node', systemPrompt: '' }),
      template: {
        ...template,
        steps: [
          {
            id: 'model-node',
            name: 'Model',
            kind: 'model',
            content: '',
            model: {},
            execution: { systemPrompt: '' },
          },
        ],
      },
      modelCatalog,
      providerConfigs,
    });

    expect(availability.status).toBe('missing_model_ref');
    expect(availability.isRunnable).toBe(false);
  });
});
