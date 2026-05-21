import { describe, expect, it } from 'vitest';

import { resolveStepParameterValue } from '../services/stepParameterBindingService';
import type { Project, Template } from '../types';

const template: Template = {
  id: 'template-1',
  name: 'Template',
  inputs: [{ id: 'topic', label: 'topic' }],
  steps: [
    {
      id: 'producer',
      name: 'Producer',
      content: '',
      outputs: [{ key: 'summary', label: 'summary', type: 'text' }],
    },
    {
      id: 'consumer',
      name: 'Consumer',
      content: '{{wqq}}',
      parameters: [],
      outputs: [{ key: 'result', label: 'result', type: 'text' }],
    },
  ],
};

const project: Project = {
  id: 'project-1',
  templateId: 'template-1',
  name: 'Project',
  createdAt: 1,
  lastModifiedAt: 1,
  inputValues: { topic: 'input topic' },
  customInputs: [],
  stepOutputs: { producer: 'legacy summary' },
  stepOutputMeta: {},
  stepRunLogs: {},
  stepOverrides: {},
  variables: [
    {
      id: 'var-wqq',
      key: 'wqq',
      label: 'wqq',
      type: 'text',
      value: 'global value',
      sourceType: 'manual',
      createdAt: 1,
      updatedAt: 1,
    },
    {
      id: 'var-summary',
      key: 'summary',
      label: 'summary',
      type: 'text',
      value: 'typed summary',
      sourceType: 'step_output',
      sourceRef: 'producer',
      createdAt: 1,
      updatedAt: 1,
    },
  ],
};

const currentStep = template.steps[1];

describe('stepParameterBindingService', () => {
  it('falls back to default values when no same-name value exists', () => {
    const result = resolveStepParameterValue(
      {
        id: 'param-1',
        name: 'missing',
        type: 'text',
        defaultValue: 'fixed',
      },
      project,
      template,
      currentStep
    );

    expect(result).toMatchObject({ value: 'fixed', missing: false });
  });

  it('resolves project inputs and step returns', () => {
    const input = resolveStepParameterValue(
      {
        id: 'param-input',
        name: 'topic',
        type: 'text',
        source: { type: 'project_input', inputId: 'topic', key: 'topic' },
      },
      project,
      template,
      currentStep
    );
    const stepReturn = resolveStepParameterValue(
      {
        id: 'param-return',
        name: 'summary',
        type: 'text',
        source: { type: 'step_return', stepId: 'producer', key: 'summary' },
      },
      project,
      template,
      currentStep
    );

    expect(input).toMatchObject({ value: 'input topic', missing: false });
    expect(stepReturn).toMatchObject({ value: 'typed summary', missing: false });
  });

  it('resolves connected step returns through the shared value resolver', () => {
    const result = resolveStepParameterValue(
      {
        id: 'param-connected',
        name: 'summary',
        type: 'text',
        source: { type: 'step_return', stepId: 'producer', key: 'summary' },
      },
      {
        ...project,
        variables: project.variables.filter((variable) => variable.key !== 'summary'),
      },
      template,
      currentStep
    );

    expect(result).toMatchObject({ value: 'legacy summary', missing: false });
    expect(result.sourceLabel).toContain('Producer');
  });

  it('lets same-name parameters read the named variable value', () => {
    const result = resolveStepParameterValue(
      {
        id: 'param-same',
        name: 'wqq',
        type: 'text',
      },
      project,
      template,
      currentStep
    );

    expect(result).toMatchObject({ value: 'global value', missing: false });
  });
});
