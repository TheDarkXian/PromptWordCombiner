import { describe, expect, it } from 'vitest';

import { buildProducerPreflight, buildStepGraph, getProducerCandidates } from '../services/stepGraphService';
import type { ModelCatalogItem, Project, ProviderConfig, Template, TemplateStep } from '../types';

const providerConfigs: ProviderConfig[] = [
  {
    id: 'provider-openai',
    label: 'OpenAI',
    providerType: 'openai',
    apiKey: 'sk-test',
    enabled: true,
  },
];

const modelCatalog: ModelCatalogItem[] = [
  {
    id: 'model-gpt',
    label: 'GPT',
    providerConfigId: 'provider-openai',
    modelName: 'gpt-4.1',
    enabled: true,
  },
];

const buildStep = (overrides: Partial<TemplateStep> & Pick<TemplateStep, 'id' | 'name' | 'content'>): TemplateStep => ({
  id: overrides.id,
  name: overrides.name,
  content: overrides.content,
  stepType: 'text_generation',
  autoRunEnabled: true,
  execution: {
    modelRefId: 'model-ref-main',
    systemPrompt: 'system',
  },
  ...overrides,
});

const buildTemplate = (steps: TemplateStep[]): Template => ({
  id: 'template-1',
  name: 'Template',
  inputs: [],
  modelRefs: [{ id: 'model-ref-main', label: 'Main', modelCatalogItemId: 'model-gpt' }],
  steps,
});

const buildProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'project-1',
  templateId: 'template-1',
  name: 'Project',
  createdAt: 1,
  lastModifiedAt: 1,
  inputValues: {},
  customInputs: [],
  stepOutputs: {},
  stepStructuredOutputs: {},
  stepOutputMeta: {},
  stepRunLogs: {},
  stepOverrides: {},
  variables: [],
  ...overrides,
});

describe('stepGraphService', () => {
  it('builds graph edges for linear and fan-in dependencies and sets node roles', () => {
    const template = buildTemplate([
      buildStep({
        id: 'step-a',
        name: 'A',
        content: 'produce',
        outputBinding: { variableKey: 'var_a' },
      }),
      buildStep({
        id: 'step-b',
        name: 'B',
        content: 'use {{var_a}} and produce',
        outputBinding: { variableKey: 'var_b' },
      }),
      buildStep({
        id: 'step-c',
        name: 'C',
        content: 'use {{var_a}} + {{var_b}}',
      }),
      buildStep({
        id: 'step-d',
        name: 'D',
        content: 'no refs',
      }),
    ]);

    const graph = buildStepGraph(template);
    const byId = new Map(graph.nodes.map((node) => [node.stepId, node] as const));

    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fromStepId: 'step-a', toStepId: 'step-b', variableKey: 'var_a' }),
        expect.objectContaining({ fromStepId: 'step-a', toStepId: 'step-c', variableKey: 'var_a' }),
        expect.objectContaining({ fromStepId: 'step-b', toStepId: 'step-c', variableKey: 'var_b' }),
      ])
    );
    expect(byId.get('step-a')?.nodeRole).toBe('producer');
    expect(byId.get('step-b')?.nodeRole).toBe('producer');
    expect(byId.get('step-c')?.nodeRole).toBe('consumer');
    expect(byId.get('step-d')?.nodeRole).toBe('passthrough');
    expect(byId.get('step-a')?.downstreamStepIds).toEqual(expect.arrayContaining(['step-b', 'step-c']));
    expect(byId.get('step-b')?.downstreamStepIds).toEqual(['step-c']);
  });

  it('maps variable table cell references to the table variable producer', () => {
    const template = buildTemplate([
      buildStep({
        id: 'step-a',
        name: 'A',
        content: 'produce',
        outputs: [
          {
            key: 'characters',
            label: 'Characters',
            type: 'table',
            tableSchema: { columns: [{ key: 'name', label: 'Name' }] },
          },
        ],
      }),
      buildStep({
        id: 'step-b',
        name: 'B',
        content: 'use {{characters[0].name}}',
      }),
    ]);

    const graph = buildStepGraph(template);
    expect(graph.edges).toEqual([
      expect.objectContaining({ fromStepId: 'step-a', toStepId: 'step-b', variableKey: 'characters' }),
    ]);
    expect(graph.nodes.find((node) => node.stepId === 'step-b')?.inputVariableKeys).toEqual(['characters']);
  });

  it('uses outputs[] as producer declarations for multiple outputs', () => {
    const template = buildTemplate([
      buildStep({
        id: 'step-a',
        name: 'A',
        content: 'produce',
        outputs: [
          { key: 'summary', label: 'Summary', type: 'text' },
          { key: 'characters', label: 'Characters', type: 'table', tableSchema: { columns: [] } },
        ],
      }),
      buildStep({
        id: 'step-b',
        name: 'B',
        content: 'use {{summary}} and {{characters[0].name}}',
      }),
    ]);

    const graph = buildStepGraph(template);
    const producer = graph.nodes.find((node) => node.stepId === 'step-a');

    expect(producer?.outputVariableKeys).toEqual(['summary', 'characters']);
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fromStepId: 'step-a', toStepId: 'step-b', variableKey: 'summary' }),
        expect.objectContaining({ fromStepId: 'step-a', toStepId: 'step-b', variableKey: 'characters' }),
      ])
    );
  });

  it('builds model edges from model nodes into function model ports', () => {
    const template = buildTemplate([
      {
        id: 'model-node',
        name: 'Model',
        kind: 'model',
        content: '',
        model: { modelRefId: 'model-ref-main' },
        execution: { systemPrompt: '' },
      },
      buildStep({
        id: 'step-fn',
        name: 'Function',
        content: 'produce',
        outputBinding: { variableKey: 'result' },
        execution: {
          modelRefId: 'model-ref-main',
          modelSourceStepId: 'model-node',
          systemPrompt: 'system',
        },
      }),
    ]);

    const graph = buildStepGraph(template);
    expect(graph.edges).toEqual([
      expect.objectContaining({
        fromStepId: 'model-node',
        toStepId: 'step-fn',
        variableKey: 'model-node:model',
        fromOutputKey: 'model-node:model',
        toInputKey: 'model',
      }),
    ]);
  });

  it('maps repeated producers of the same variable to one consumer', () => {
    const template = buildTemplate([
      buildStep({
        id: 'step-a1',
        name: 'A1',
        content: 'produce',
        outputBinding: { variableKey: 'same_key' },
      }),
      buildStep({
        id: 'step-a2',
        name: 'A2',
        content: 'produce again',
        outputBinding: { variableKey: 'same_key' },
      }),
      buildStep({
        id: 'step-b',
        name: 'B',
        content: 'use {{same_key}}',
      }),
    ]);

    const graph = buildStepGraph(template);
    const consumer = graph.nodes.find((node) => node.stepId === 'step-b');

    expect(consumer?.upstreamStepIds).toEqual(['step-a1', 'step-a2']);
    expect(
      graph.edges.filter((edge) => edge.toStepId === 'step-b' && edge.variableKey === 'same_key')
    ).toHaveLength(2);
  });

  it('filters producer candidates to runnable auto text_generation producer steps only', () => {
    const template = buildTemplate([
      buildStep({
        id: 'step-ok',
        name: 'OK',
        content: 'produce',
        outputBinding: { variableKey: 'out_ok' },
      }),
      buildStep({
        id: 'step-manual',
        name: 'Manual',
        content: 'produce',
        stepType: 'manual',
        outputBinding: { variableKey: 'out_manual' },
      }),
      buildStep({
        id: 'step-no-auto',
        name: 'NoAuto',
        content: 'produce',
        autoRunEnabled: false,
        outputBinding: { variableKey: 'out_no_auto' },
      }),
      buildStep({
        id: 'step-no-output',
        name: 'NoOutput',
        content: 'no output',
      }),
    ]);

    const candidates = getProducerCandidates(template);
    expect(candidates.map((item) => item.stepId)).toEqual(['step-ok']);
  });

  it('builds stable producer order and marks cyclic producers as blocked', () => {
    const template = buildTemplate([
      buildStep({
        id: 'step-a',
        name: 'A',
        content: '{{var_b}}',
        outputBinding: { variableKey: 'var_a' },
      }),
      buildStep({
        id: 'step-b',
        name: 'B',
        content: '{{var_a}}',
        outputBinding: { variableKey: 'var_b' },
      }),
      buildStep({
        id: 'step-c',
        name: 'C',
        content: 'independent',
        outputBinding: { variableKey: 'var_c' },
      }),
      buildStep({
        id: 'step-d',
        name: 'D',
        content: 'also independent',
        outputBinding: { variableKey: 'var_d' },
      }),
    ]);

    const preflight = buildProducerPreflight({
      project: buildProject(),
      template,
      modelCatalog,
      providerConfigs,
      scope: 'all',
    });

    expect(preflight.orderedStepIds).toEqual(['step-c', 'step-d']);
    const blocked = new Map(
      preflight.items.filter((item) => item.status === 'blocked').map((item) => [item.stepId, item] as const)
    );
    expect(blocked.get('step-a')?.reason).toContain('Circular dependency');
    expect(blocked.get('step-b')?.reason).toContain('Circular dependency');
  });

  it('applies preflight statuses across empty_only, changed_only and all scopes', () => {
    const template = buildTemplate([
      buildStep({
        id: 'step-source',
        name: 'Source',
        content: 'produce source',
        outputBinding: { variableKey: 'source_var' },
      }),
      buildStep({
        id: 'step-changed',
        name: 'Changed',
        content: '{{source_var}}',
        outputBinding: { variableKey: 'changed_var' },
      }),
      buildStep({
        id: 'step-stale',
        name: 'Stale',
        content: 'no dependency',
        outputBinding: { variableKey: 'stale_var' },
      }),
      buildStep({
        id: 'step-missing',
        name: 'MissingInput',
        content: '{{missing_var}}',
        outputBinding: { variableKey: 'missing_out' },
      }),
    ]);

    const project = buildProject({
      stepOutputs: {
        'step-changed': 'old changed',
        'step-stale': 'old stale',
      },
      stepOutputMeta: {
        'step-changed': { updatedAt: 20 },
        'step-stale': { updatedAt: 200 },
      },
      variables: [
        {
          id: 'var-source',
          key: 'source_var',
          label: 'Source',
          value: 'new value',
          sourceType: 'step_output',
          sourceRef: 'step-source',
          createdAt: 1,
          updatedAt: 100,
        },
      ],
    });

    const emptyOnly = buildProducerPreflight({
      project,
      template,
      modelCatalog,
      providerConfigs,
      scope: 'empty_only',
    });
    const emptyMap = new Map(emptyOnly.items.map((item) => [item.stepId, item] as const));
    expect(emptyMap.get('step-source')?.status).toBe('ready');
    expect(emptyMap.get('step-changed')?.status).toBe('skipped');
    expect(emptyMap.get('step-stale')?.status).toBe('skipped');
    expect(emptyMap.get('step-missing')?.status).toBe('blocked');

    const changedOnly = buildProducerPreflight({
      project,
      template,
      modelCatalog,
      providerConfigs,
      scope: 'changed_only',
    });
    const changedMap = new Map(changedOnly.items.map((item) => [item.stepId, item] as const));
    expect(changedMap.get('step-source')?.status).toBe('ready');
    expect(changedMap.get('step-changed')?.status).toBe('existing_result');
    expect(changedMap.get('step-stale')?.status).toBe('skipped');
    expect(changedMap.get('step-missing')?.status).toBe('blocked');

    const allScope = buildProducerPreflight({
      project,
      template,
      modelCatalog,
      providerConfigs,
      scope: 'all',
    });
    const allMap = new Map(allScope.items.map((item) => [item.stepId, item] as const));
    expect(allMap.get('step-source')?.status).toBe('ready');
    expect(allMap.get('step-changed')?.status).toBe('existing_result');
    expect(allMap.get('step-stale')?.status).toBe('existing_result');
    expect(allMap.get('step-missing')?.status).toBe('blocked');
  });
});
