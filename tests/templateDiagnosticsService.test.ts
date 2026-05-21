import { describe, expect, it } from 'vitest';

import { validateTemplate } from '../services/templateDiagnosticsService';
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
  variables: [],
};

const buildTemplate = (overrides: Partial<Template> = {}): Template => ({
  id: 'template-1',
  name: 'Template',
  inputs: [],
  steps: [
    {
      id: 'step-1',
      name: 'Step',
      content: '[[declared]] [[missing]] [[roles.name]]',
      parameters: [
        {
          id: 'param-declared',
          name: 'declared',
          type: 'text',
          required: true,
          source: { type: 'same_name', key: 'declared' },
        },
        {
          id: 'param-unused',
          name: 'unused',
          type: 'text',
          required: false,
          source: { type: 'same_name', key: 'unused' },
        },
      ],
      outputBinding: { variableKey: 'result' },
    },
  ],
  ...overrides,
});

describe('templateDiagnosticsService', () => {
  it('reports invalid and unbound parameter diagnostics from parsed references', () => {
    const diagnostics = validateTemplate(buildTemplate(), baseProject);
    const codes = diagnostics.map((diagnostic) => diagnostic.code);

    expect(codes).not.toContain('UNDECLARED_PARAMETER_REFERENCE');
    expect(codes).toContain('INVALID_PARAMETER_REFERENCE');
    expect(codes).not.toContain('UNUSED_PARAMETER');
    expect(codes).toContain('UNBOUND_PARAMETER');
  });

  it('does not enforce parameter declarations for legacy steps', () => {
    const diagnostics = validateTemplate({
      id: 'template-1',
      name: 'Template',
      inputs: [],
      steps: [
        {
          id: 'legacy',
          name: 'Legacy',
          content: '[[missing]]',
          outputBinding: { variableKey: 'result' },
        },
      ],
    });

    expect(diagnostics.some((diagnostic) => diagnostic.code === 'UNDECLARED_PARAMETER_REFERENCE')).toBe(false);
  });

  it('does not warn when a function node has no declared return values', () => {
    const diagnostics = validateTemplate({
      id: 'template-1',
      name: 'Template',
      inputs: [],
      steps: [
        {
          id: 'no-return',
          name: 'No Return',
          content: 'free form',
          outputBinding: { variableKey: '' },
          outputs: [],
        },
      ],
    });

    expect(diagnostics.some((diagnostic) => diagnostic.code === 'NO_RETURN_DECLARED')).toBe(false);
  });

  it('accepts numeric literals in math node inputs', () => {
    const diagnostics = validateTemplate(
      {
        id: 'template-1',
        name: 'Template',
        inputs: [],
        steps: [
          {
            id: 'math',
            name: 'Math',
            kind: 'math_operation',
            content: '',
            math: { operation: 'add', leftKey: '1', rightKey: '2', outputKey: 'total' },
            outputBinding: { variableKey: 'total' },
          },
        ],
      },
      baseProject
    );

    expect(diagnostics.some((diagnostic) => diagnostic.code === 'MISSING_MATH_INPUT')).toBe(false);
    expect(diagnostics.some((diagnostic) => diagnostic.code === 'NON_NUMERIC_MATH_INPUT')).toBe(false);
  });

  it('reports missing math variables when project context is available', () => {
    const diagnostics = validateTemplate(
      {
        id: 'template-1',
        name: 'Template',
        inputs: [],
        steps: [
          {
            id: 'math',
            name: 'Math',
            kind: 'math_operation',
            content: '',
            math: { operation: 'add', leftKey: 'missing', rightKey: '2', outputKey: 'total' },
            outputBinding: { variableKey: 'total' },
          },
        ],
      },
      baseProject
    );

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain('MISSING_MATH_INPUT');
  });
});
