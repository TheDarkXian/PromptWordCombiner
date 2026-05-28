import { describe, expect, it } from 'vitest';

import { executeLocalProjectStep } from '../services/projectExecutionService';
import type { Project, Template } from '../types';

const baseProject: Project = {
  id: 'project-1',
  templateId: 'template-1',
  name: 'Project',
  createdAt: 1,
  lastModifiedAt: 1,
  inputValues: {},
  customInputs: [],
  stepOutputs: {},
  stepOutputMeta: {},
  stepRunLogs: {},
  stepOverrides: {},
  variables: [
    {
      id: 'var-a',
      key: 'a',
      label: 'a',
      type: 'text',
      value: '8',
      sourceType: 'manual',
      createdAt: 1,
      updatedAt: 1,
    },
    {
      id: 'var-b',
      key: 'b',
      label: 'b',
      type: 'text',
      value: '2',
      sourceType: 'manual',
      createdAt: 1,
      updatedAt: 1,
    },
  ],
};

const buildTemplate = (step: Template['steps'][number]): Template => ({
  id: 'template-1',
  name: 'Template',
  inputs: [],
  steps: [step],
});

const buildTemplateWithSteps = (steps: Template['steps']): Template => ({
  id: 'template-1',
  name: 'Template',
  inputs: [],
  steps,
});

describe('local node execution', () => {
  it('executes variable nodes with defaults', () => {
    const template = buildTemplate({
      id: 'var-step',
      name: 'Variable',
      kind: 'variable',
      content: '',
      variable: { name: 'missing', defaultValue: 'hello', outputKey: 'topic' },
      outputBinding: { variableKey: 'topic' },
      stepType: 'manual',
    });

    const { project, result } = executeLocalProjectStep({
      project: baseProject,
      template,
      stepId: 'var-step',
    });

    expect(result.output).toBe('hello');
    expect(project.variables.find((variable) => variable.key === 'topic')?.value).toBe('hello');
  });

  it('executes math nodes', () => {
    const template = buildTemplate({
      id: 'math-step',
      name: 'Math',
      kind: 'math_operation',
      content: '',
      math: { operation: 'multiply', leftKey: 'a', rightKey: 'b', outputKey: 'total' },
      outputBinding: { variableKey: 'total' },
      stepType: 'manual',
    });

    const { project, result } = executeLocalProjectStep({
      project: baseProject,
      template,
      stepId: 'math-step',
    });

    expect(result.output).toBe('16');
    expect(project.variables.find((variable) => variable.key === 'total')?.value).toBe('16');
  });

  it('executes math nodes from connected upstream output keys', () => {
    const template = buildTemplateWithSteps([
      {
        id: 'source-step',
        name: 'Source',
        kind: 'variable',
        content: '',
        variable: { name: 'a', defaultValue: '8', outputKey: 'source-step:value' },
        stepType: 'manual',
      },
      {
        id: 'math-step',
        name: 'Math',
        kind: 'math_operation',
        content: '',
        math: { operation: 'add', leftKey: 'source-step:value', rightKey: 'b', outputKey: 'total' },
        outputBinding: { variableKey: 'total' },
        stepType: 'manual',
      },
    ]);

    const { project, result } = executeLocalProjectStep({
      project: {
        ...baseProject,
        stepOutputs: { 'source-step': '6' },
        variables: baseProject.variables.filter((variable) => variable.key !== 'source-step:value'),
      },
      template,
      stepId: 'math-step',
    });

    expect(result.output).toBe('8');
    expect(project.variables.find((variable) => variable.key === 'total')?.value).toBe('8');
  });

  it('executes math nodes with numeric literals', () => {
    const template = buildTemplate({
      id: 'math-step',
      name: 'Math',
      kind: 'math_operation',
      content: '',
      math: { operation: 'add', leftKey: '8', rightKey: '2.5', outputKey: 'total' },
      outputBinding: { variableKey: 'total' },
      stepType: 'manual',
    });

    const { project, result } = executeLocalProjectStep({
      project: baseProject,
      template,
      stepId: 'math-step',
    });

    expect(result.output).toBe('10.5');
    expect(project.variables.find((variable) => variable.key === 'total')?.value).toBe('10.5');
  });

  it('allows an empty string as an explicit variable node default', () => {
    const template = buildTemplate({
      id: 'var-step',
      name: 'Variable',
      kind: 'variable',
      content: '',
      variable: { name: 'missing', defaultValue: '', outputKey: 'topic' },
      outputBinding: { variableKey: 'topic' },
      stepType: 'manual',
    });

    const { project, result } = executeLocalProjectStep({
      project: baseProject,
      template,
      stepId: 'var-step',
    });

    expect(result.output).toBe('');
    expect(project.variables.find((variable) => variable.key === 'topic')?.value).toBe('');
  });

  it('executes variable nodes from connected input keys', () => {
    const template = buildTemplate({
      id: 'var-step',
      name: 'Variable',
      kind: 'variable',
      content: '',
      variable: { name: 'topic', inputKey: 'a', defaultValue: 'fallback', outputKey: 'topic' },
      outputBinding: { variableKey: 'topic' },
      stepType: 'manual',
    });

    const { project, result } = executeLocalProjectStep({
      project: baseProject,
      template,
      stepId: 'var-step',
    });

    expect(result.output).toBe('8');
    expect(project.variables.find((variable) => variable.key === 'topic')?.value).toBe('8');
  });

  it('uses internal output ports when local nodes have no output variable key', () => {
    const variableTemplate = buildTemplate({
      id: 'var-step',
      name: 'Variable',
      kind: 'variable',
      content: '',
      variable: { name: 'missing', defaultValue: 'hello' },
      stepType: 'manual',
    });
    const variableRun = executeLocalProjectStep({
      project: baseProject,
      template: variableTemplate,
      stepId: 'var-step',
    });
    expect(variableRun.project.variables.find((variable) => variable.key === 'var-step:value')?.value).toBe('hello');

    const mathTemplate = buildTemplate({
      id: 'math-step',
      name: 'Math',
      kind: 'math_operation',
      content: '',
      math: { operation: 'add', leftKey: '1', rightKey: '2', outputKey: '' },
      stepType: 'manual',
    });
    const mathRun = executeLocalProjectStep({
      project: baseProject,
      template: mathTemplate,
      stepId: 'math-step',
    });
    expect(mathRun.project.variables.find((variable) => variable.key === 'math-step:result')?.value).toBe('3');
  });

  it('executes table row nodes by publishing selected row fields', () => {
    const template = buildTemplate({
      id: 'row-step',
      name: 'Row',
      kind: 'table_row',
      content: '',
      tableRow: { tableKey: 'items', rowIndex: '2' },
      outputs: [
        { key: 'name', label: 'Name', type: 'text' },
        { key: 'prompt', label: 'Prompt', type: 'text' },
      ],
      stepType: 'manual',
    });

    const { project, result } = executeLocalProjectStep({
      project: {
        ...baseProject,
        variables: [
          ...baseProject.variables,
          {
            id: 'var-items',
            key: 'items',
            label: 'Items',
            type: 'table',
            value: '',
            tableValue: {
              columns: [
                { key: 'name', label: 'Name' },
                { key: 'prompt', label: 'Prompt' },
              ],
              rows: [
                { id: 'row-1', cells: { name: 'A', prompt: 'First' } },
                { id: 'row-2', cells: { name: 'B', prompt: 'Second' } },
              ],
            },
            sourceType: 'manual',
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      },
      template,
      stepId: 'row-step',
    });

    expect(JSON.parse(result.output)).toEqual({ name: 'B', prompt: 'Second' });
    expect(project.variables.find((variable) => variable.key === 'name')?.value).toBe('B');
    expect(project.variables.find((variable) => variable.key === 'prompt')?.value).toBe('Second');
  });

  it('rejects divide by zero', () => {
    const template = buildTemplate({
      id: 'math-step',
      name: 'Math',
      kind: 'math_operation',
      content: '',
      math: { operation: 'divide', leftKey: 'a', rightKey: 'zero', outputKey: 'total' },
      outputBinding: { variableKey: 'total' },
      stepType: 'manual',
    });

    expect(() =>
      executeLocalProjectStep({
        project: {
          ...baseProject,
          variables: [
            ...baseProject.variables,
            {
              id: 'var-zero',
              key: 'zero',
              label: 'zero',
              type: 'text',
              value: '0',
              sourceType: 'manual',
              createdAt: 1,
              updatedAt: 1,
            },
          ],
        },
        template,
        stepId: 'math-step',
      })
    ).toThrow(/除以 0/);
  });
});
