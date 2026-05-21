import { describe, expect, it, vi } from 'vitest';

import {
  applyProjectStepError,
  applyProjectStepSuccess,
  prepareProjectStepExecution,
} from '../services/projectExecutionService';
import type { AppSettings, Project, Template } from '../types';

const settings: AppSettings = {
  language: 'en-US',
  tabOpenMode: 'single',
  uiScale: 16,
  sidebarWidth: 360,
  isSidebarOpen: true,
  templateEditorLeftWidth: 360,
  templateBlueprintInspectorWidth: 420,
  projectRunnerInspectorWidth: 460,
  fontSize: 'text-sm',
  cardScale: 1,
  fileLibrarySortBy: 'lastModified',
  structuredOutputResultView: 'raw',
  providerConfigs: [
    {
      id: 'provider-1',
      label: 'OpenAI Main',
      providerType: 'openai',
      apiKey: 'sk-test',
      enabled: true,
    },
  ],
  modelCatalog: [
    {
      id: 'model-1',
      label: 'GPT 4.1',
      providerConfigId: 'provider-1',
      modelName: 'gpt-4.1',
      enabled: true,
    },
  ],
  executionPresetTemplates: [],
};

const template: Template = {
  id: 'template-1',
  name: 'Template 1',
  inputs: [{ id: 'topic', label: 'Topic' }],
  modelRefs: [{ id: 'ref-1', label: 'Primary', modelCatalogItemId: 'model-1' }],
  steps: [
    {
      id: 'step-1',
      name: 'Draft',
      content: 'Write about {{topic}}',
      outputBinding: {
        variableKey: 'draft',
        variableLabel: 'Draft',
      },
      execution: {
        modelRefId: 'ref-1',
        systemPrompt: 'System',
        temperature: 0.7,
        maxTokens: 400,
      },
    },
  ],
};

const project: Project = {
  id: 'project-1',
  templateId: 'template-1',
  name: 'Project 1',
  createdAt: 1,
  lastModifiedAt: 2,
  inputValues: { topic: 'Moonlit market' },
  customInputs: [],
  stepOutputs: {},
  stepStructuredOutputs: {},
  stepOutputMeta: {},
  stepRunLogs: {},
  stepOverrides: {},
  variables: [
    {
      id: 'var-topic',
      key: 'topic',
      label: 'Topic',
      value: 'Moonlit market',
      sourceType: 'template_input',
      sourceRef: 'topic',
      createdAt: 1,
      updatedAt: 1,
    },
  ],
};

describe('projectExecutionService', () => {
  it('prepares an executable step with interpolated prompts and model config', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);

    const prepared = prepareProjectStepExecution({
      project,
      template,
      stepId: 'step-1',
      settings,
    });

    expect(prepared.step.id).toBe('step-1');
    expect(prepared.userPrompt).toBe('Write about Moonlit market');
    expect(prepared.systemPrompt).toBe('System');
    expect(prepared.modelName).toBe('gpt-4.1');
    expect(prepared.logBase).toEqual(
      expect.objectContaining({
        id: 'run_1000',
        providerLabel: 'OpenAI Main',
        modelLabel: 'GPT 4.1',
      })
    );
  });

  it('does not append return format instructions when there are no declared returns', () => {
    const prepared = prepareProjectStepExecution({
      project,
      template: {
        ...template,
        steps: [
          {
            ...template.steps[0],
            outputBinding: { variableKey: '' },
            outputs: [],
          },
        ],
      },
      stepId: 'step-1',
      settings,
    });

    expect(prepared.systemPrompt).toBe('System');
  });

  it('appends JSON return format instructions for table or multiple returns', () => {
    const prepared = prepareProjectStepExecution({
      project,
      template: {
        ...template,
        steps: [
          {
            ...template.steps[0],
            outputs: [
              { key: 'summary', label: 'Summary', type: 'text' },
              {
                key: 'characters',
                label: 'Characters',
                type: 'table',
                tableSchema: { columns: [{ key: 'name', label: 'Name' }] },
              },
            ],
          },
        ],
      },
      stepId: 'step-1',
      settings,
    });

    expect(prepared.systemPrompt).toContain('请严格按 JSON 对象返回');
    expect(prepared.systemPrompt).toContain('summary');
    expect(prepared.systemPrompt).toContain('characters');
    expect(prepared.systemPrompt).toContain('name');
  });

  it('writes step output, variable binding, and run log on success', () => {
    vi.spyOn(Date, 'now').mockReturnValue(2000);

    const nextProject = applyProjectStepSuccess({
      project,
      step: template.steps[0],
      output: 'Generated copy',
      logBase: {
        id: 'run_1',
        createdAt: 1000,
        providerType: 'openai',
        providerLabel: 'OpenAI Main',
        modelName: 'gpt-4.1',
        modelLabel: 'GPT 4.1',
        systemPrompt: 'System',
        userPrompt: 'Write about Moonlit market',
        temperature: 0.7,
        maxTokens: 400,
        rawResponse: undefined,
      },
      rawResponse: { ok: true },
    });

    expect(nextProject.stepOutputs['step-1']).toBe('Generated copy');
    expect(nextProject.stepOutputMeta['step-1']).toEqual({
      updatedAt: 2000,
      lastSavedToVariableAt: 2000,
    });
    expect(nextProject.variables).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'draft',
          value: 'Generated copy',
          sourceType: 'step_output',
          sourceRef: 'step-1',
        }),
      ])
    );
    expect(nextProject.stepRunLogs['step-1'][0]).toEqual(
      expect.objectContaining({
        status: 'success',
        output: 'Generated copy',
      })
    );
  });

  it('parses multiple typed outputs from a JSON object on success', () => {
    vi.spyOn(Date, 'now').mockReturnValue(2500);

    const nextProject = applyProjectStepSuccess({
      project,
      step: {
        ...template.steps[0],
        outputs: [
          { key: 'summary', label: 'Summary', type: 'text' },
          {
            key: 'characters',
            label: 'Characters',
            type: 'table',
            tableSchema: {
              columns: [
                { key: 'name', label: 'Name' },
                { key: 'job', label: 'Job' },
              ],
            },
          },
        ],
      },
      output: JSON.stringify({
        summary: 'A quiet cast.',
        characters: [
          { name: 'Lin', job: 'Engineer', ignored: 'extra' },
          { name: 'Mo', job: 42 },
        ],
      }),
      logBase: {
        id: 'run_multi',
        createdAt: 1000,
        providerType: 'openai',
        providerLabel: 'OpenAI Main',
        modelName: 'gpt-4.1',
        modelLabel: 'GPT 4.1',
        systemPrompt: 'System',
        userPrompt: 'Write about Moonlit market',
        temperature: 0.7,
        maxTokens: 400,
        rawResponse: undefined,
      },
    });

    expect(nextProject.variables).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'summary',
          type: 'text',
          value: 'A quiet cast.',
          sourceRef: 'step-1:summary',
        }),
        expect.objectContaining({
          key: 'characters',
          type: 'table',
          sourceRef: 'step-1:characters',
          tableValue: expect.objectContaining({
            rows: [
              { id: 'row_step-1_characters_1', cells: { name: 'Lin', job: 'Engineer' } },
              { id: 'row_step-1_characters_2', cells: { name: 'Mo', job: '42' } },
            ],
          }),
        }),
      ])
    );
    expect(nextProject.variableTables?.[0]).toEqual(
      expect.objectContaining({
        key: 'characters',
        sourceStepId: 'step-1',
        rows: [
          { id: 'row_step-1_characters_1', cells: { name: 'Lin', job: 'Engineer' } },
          { id: 'row_step-1_characters_2', cells: { name: 'Mo', job: '42' } },
        ],
      })
    );
  });

  it('appends an error log without mutating outputs on failure', () => {
    const nextProject = applyProjectStepError({
      project: {
        ...project,
        stepOutputs: { 'step-1': 'old output' },
      },
      stepId: 'step-1',
      logBase: {
        id: 'run_2',
        createdAt: 1000,
        providerType: 'openai',
        providerLabel: 'OpenAI Main',
        modelName: 'gpt-4.1',
        modelLabel: 'GPT 4.1',
        systemPrompt: 'System',
        userPrompt: 'Write about Moonlit market',
        temperature: 0.7,
        maxTokens: 400,
        rawResponse: undefined,
      },
      message: 'boom',
    });

    expect(nextProject.stepOutputs['step-1']).toBe('old output');
    expect(nextProject.stepRunLogs['step-1'][0]).toEqual(
      expect.objectContaining({
        status: 'error',
        error: 'boom',
      })
    );
  });
});
