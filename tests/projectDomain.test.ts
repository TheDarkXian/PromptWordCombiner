import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  appendStepRunLog,
  normalizeProject,
  syncProjectVariables,
} from '../domain/projectDomain';
import type { Project, StepRunLog, Template } from '../types';

const baseTemplate: Template = {
  id: 'template-1',
  name: 'Template 1',
  inputs: [{ id: 'topic', label: 'Topic' }],
  steps: [
    {
      id: 'step-1',
      name: 'Step 1',
      content: 'content',
      outputBinding: {
        variableKey: 'final_result',
        variableLabel: 'Final Result',
      },
      execution: {
        systemPrompt: '',
      },
    },
  ],
};

const baseProject: Project = {
  id: 'project-1',
  templateId: 'template-1',
  name: 'Project 1',
  createdAt: 100,
  lastModifiedAt: 200,
  lastOpenedAt: 300,
  inputValues: {
    topic: 'Cyberpunk Forest',
    local_1: 'Local Value',
  },
  customInputs: [{ id: 'local_1', label: 'Local 1' }],
  stepOutputs: {
    'step-1': 'Rendered output',
  },
  stepOutputMeta: {},
  stepRunLogs: {},
  stepOverrides: {},
  variables: [
    {
      id: 'var_topic',
      key: 'topic',
      label: 'Topic',
      value: 'Old Topic',
      sourceType: 'template_input',
      sourceRef: 'topic',
      createdAt: 10,
      updatedAt: 20,
    },
    {
      id: 'var_local',
      key: 'local_1',
      label: 'Local 1',
      value: 'Local Value',
      sourceType: 'project_local',
      sourceRef: 'local_1',
      createdAt: 11,
      updatedAt: 21,
    },
    {
      id: 'var_step',
      key: 'old_result',
      label: 'Old Result',
      value: 'Old output',
      sourceType: 'step_output',
      sourceRef: 'step-1',
      createdAt: 12,
      updatedAt: 22,
    },
    {
      id: 'var_manual',
      key: 'manual_flag',
      label: 'Manual Flag',
      value: 'keep',
      sourceType: 'manual',
      createdAt: 13,
      updatedAt: 23,
    },
  ],
  archived: false,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('projectDomain', () => {
  it('syncProjectVariables keeps template, local, and step output variables in sync', () => {
    vi.spyOn(Date, 'now').mockReturnValue(500);

    const variables = syncProjectVariables(baseProject, baseTemplate);

    expect(variables).toHaveLength(4);
    expect(variables).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'var_topic',
          key: 'topic',
          value: 'Cyberpunk Forest',
          sourceType: 'template_input',
          createdAt: 10,
          updatedAt: 500,
        }),
        expect.objectContaining({
          id: 'var_local',
          key: 'local_1',
          value: 'Local Value',
          sourceType: 'project_local',
          createdAt: 11,
          updatedAt: 21,
        }),
        expect.objectContaining({
          id: 'var_step',
          key: 'final_result',
          label: 'Final Result',
          value: 'Rendered output',
          sourceType: 'step_output',
          createdAt: 12,
          updatedAt: 500,
        }),
        expect.objectContaining({
          id: 'var_manual',
          key: 'manual_flag',
          sourceType: 'manual',
          value: 'keep',
        }),
      ])
    );
  });

  it('normalizeProject fills missing collections and derives variables from the matching template', () => {
    vi.spyOn(Date, 'now').mockReturnValue(800);

    const project = normalizeProject(
      {
        ...baseProject,
        inputValues: undefined as unknown as Project['inputValues'],
        customInputs: undefined as unknown as Project['customInputs'],
        stepOutputs: undefined as unknown as Project['stepOutputs'],
        stepOutputMeta: undefined as unknown as Project['stepOutputMeta'],
        stepRunLogs: undefined as unknown as Project['stepRunLogs'],
        stepOverrides: undefined as unknown as Project['stepOverrides'],
        variables: undefined as unknown as Project['variables'],
      },
      [baseTemplate]
    );

    expect(project.inputValues).toEqual({});
    expect(project.customInputs).toEqual([]);
    expect(project.stepOutputs).toEqual({});
    expect(project.stepOutputMeta).toEqual({});
    expect(project.stepRunLogs).toEqual({});
    expect(project.stepOverrides).toEqual({});
    expect(project.variables).toEqual([
      expect.objectContaining({
        id: 'var_topic',
        key: 'topic',
        value: '',
      }),
      expect.objectContaining({
        id: 'var_step_step-1',
        key: 'final_result',
        value: '',
      }),
    ]);
  });

  it('appendStepRunLog keeps only the latest twenty records', () => {
    const logs = Array.from({ length: 20 }, (_, index) => ({
      id: `log-${index}`,
      createdAt: index,
      status: 'success',
      providerType: 'openai',
      providerLabel: 'OpenAI',
      modelName: 'gpt-4.1',
      modelLabel: 'GPT-4.1',
      systemPrompt: '',
      userPrompt: '',
      temperature: 0.7,
      maxTokens: 100,
      output: `${index}`,
      error: '',
    })) satisfies StepRunLog[];

    const nextLog: StepRunLog = {
      id: 'log-20',
      createdAt: 20,
      status: 'error',
      providerType: 'openai',
      providerLabel: 'OpenAI',
      modelName: 'gpt-4.1',
      modelLabel: 'GPT-4.1',
      systemPrompt: '',
      userPrompt: '',
      output: '',
      error: 'boom',
    };

    const result = appendStepRunLog(logs, nextLog);

    expect(result).toHaveLength(20);
    expect(result[0]?.id).toBe('log-1');
    expect(result[19]?.id).toBe('log-20');
  });
});
