import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ProjectStepCard } from '../components/project-runner/ProjectStepCard';
import type { Project, Template } from '../types';

const step: Template['steps'][number] = {
  id: 'row-step',
  name: 'Pick Row',
  kind: 'table_row',
  content: '',
  tableRow: { tableKey: 'items', rowIndex: '1' },
  outputs: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'prompt', label: 'Prompt', type: 'text' },
  ],
  stepType: 'manual',
  execution: { systemPrompt: '' },
};

const template: Template = {
  id: 'template-1',
  name: 'Template',
  inputs: [],
  steps: [step],
};

const project: Project = {
  id: 'project-1',
  templateId: 'template-1',
  name: 'Project',
  createdAt: 1,
  lastModifiedAt: 1,
  inputValues: {},
  customInputs: [],
  stepOutputs: {
    'row-step': JSON.stringify({ name: 'Button', prompt: 'Click fast' }),
  },
  stepOutputMeta: {},
  stepRunLogs: {},
  stepOverrides: {},
  variables: [
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
        rows: [{ id: 'row-1', cells: { name: 'Button', prompt: 'Click fast' } }],
      },
      sourceType: 'manual',
      createdAt: 1,
      updatedAt: 1,
    },
    {
      id: 'var-name',
      key: 'name',
      label: 'Name',
      type: 'text',
      value: 'Button',
      sourceType: 'step_output',
      sourceRef: 'row-step:name',
      createdAt: 1,
      updatedAt: 2,
    },
    {
      id: 'var-prompt',
      key: 'prompt',
      label: 'Prompt',
      type: 'text',
      value: 'Click fast',
      sourceType: 'step_output',
      sourceRef: 'row-step:prompt',
      createdAt: 1,
      updatedAt: 2,
    },
  ],
};

describe('ProjectStepCard previews', () => {
  it('renders input and output previews in detail mode', () => {
    const html = renderToStaticMarkup(
      React.createElement(ProjectStepCard, {
        index: 0,
        language: 'en-US',
        project,
        template,
        step,
        modelCatalog: [],
        providerConfigs: [],
        viewMode: 'detail',
        isCollapsed: false,
        isLogsExpanded: false,
        isResultExpanded: false,
        runState: 'idle',
        producerState: 'idle',
        structuredParseState: 'idle',
        onToggleCollapse: vi.fn(),
        onToggleLogs: vi.fn(),
        onToggleResults: vi.fn(),
        onRunStep: vi.fn(),
        onUpdateProject: vi.fn(),
        onUpdateTemplate: vi.fn(),
        onClearStepRunLogs: vi.fn(),
        onRequestConfirm: vi.fn(),
        onQuickCopy: vi.fn(),
        onCopyLogText: vi.fn(),
        onRestoreLogOutput: vi.fn(),
        structuredOutputResultView: 'raw',
        onStructuredOutputResultViewChange: vi.fn(),
        interpolate: (value: string) => value,
        getVariableByKey: (key: string) => project.variables.find((variable) => variable.key === key),
        getStepStatus: () => 'saved',
        getStatusMeta: () => ({ label: 'Saved', className: 'text-emerald-300' }),
        getRunStateMeta: () => ({ label: 'Idle', className: 'text-slate-300' }),
        scrollToStep: vi.fn(),
      })
    );

    expect(html).toContain('Input preview');
    expect(html).toContain('Output preview');
    expect(html).toContain('Selected row 1');
    expect(html).toContain('Click fast');
  });
});
