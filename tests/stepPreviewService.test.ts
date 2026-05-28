import { describe, expect, it } from 'vitest';

import { buildStepInputPreviews, buildStepOutputPreviews } from '../services/stepPreviewService';
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
      id: 'var-topic',
      key: 'topic',
      label: 'Topic',
      type: 'text',
      value: 'Arcade clicker',
      sourceType: 'manual',
      createdAt: 1,
      updatedAt: 1,
    },
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
          { id: 'row-3', cells: { name: 'C', prompt: 'Third' } },
          { id: 'row-4', cells: { name: 'D', prompt: 'Fourth' } },
        ],
      },
      sourceType: 'manual',
      createdAt: 1,
      updatedAt: 1,
    },
  ],
};

const buildTemplate = (steps: Template['steps']): Template => ({
  id: 'template-1',
  name: 'Template',
  inputs: [],
  steps,
});

describe('stepPreviewService', () => {
  it('previews text inputs with source and value summary', () => {
    const step = {
      id: 'step-1',
      name: 'Step',
      content: 'Use [[topic]]',
      parameters: [{ id: 'param-topic', name: 'topic', type: 'text' as const, defaultValue: '' }],
      execution: { systemPrompt: '' },
    };
    const template = buildTemplate([step]);

    const previews = buildStepInputPreviews(baseProject, template, step);

    expect(previews[0]).toMatchObject({
      key: 'topic',
      label: 'topic',
      type: 'text',
      missing: false,
      value: 'Arcade clicker',
    });
  });

  it('previews table inputs with columns, total row count, and first three rows', () => {
    const step = {
      id: 'row-step',
      name: 'Row',
      kind: 'table_row' as const,
      content: '',
      tableRow: { tableKey: 'items', rowIndex: '2' },
      stepType: 'manual' as const,
    };
    const template = buildTemplate([step]);

    const previews = buildStepInputPreviews(baseProject, template, step);

    expect(previews[0].table?.columns.map((column) => column.key)).toEqual(['name', 'prompt']);
    expect(previews[0].table?.totalRows).toBe(4);
    expect(previews[0].table?.rows).toHaveLength(3);
    expect(previews[0].selectedRow?.row?.cells).toEqual({ name: 'B', prompt: 'Second' });
  });

  it('marks missing inputs without throwing', () => {
    const step = {
      id: 'step-1',
      name: 'Step',
      content: 'Use [[missing]]',
      parameters: [{ id: 'param-missing', name: 'missing', type: 'text' as const, defaultValue: '' }],
      execution: { systemPrompt: '' },
    };
    const template = buildTemplate([step]);

    const previews = buildStepInputPreviews(baseProject, template, step);

    expect(previews[0].missing).toBe(true);
  });

  it('marks out-of-range table row selections as missing', () => {
    const step = {
      id: 'row-step',
      name: 'Row',
      kind: 'table_row' as const,
      content: '',
      tableRow: { tableKey: 'items', rowIndex: '9' },
      stepType: 'manual' as const,
    };
    const template = buildTemplate([step]);

    const previews = buildStepInputPreviews(baseProject, template, step);

    expect(previews[0].selectedRow).toMatchObject({
      rowNumber: 9,
      missing: true,
    });
  });

  it('previews table and multi-field outputs', () => {
    const step = {
      id: 'producer',
      name: 'Producer',
      content: '',
      outputs: [
        {
          key: 'items',
          label: 'Items',
          type: 'table' as const,
          tableSchema: { columns: [{ key: 'name', label: 'Name' }] },
        },
        { key: 'summary', label: 'Summary', type: 'text' as const },
      ],
      execution: { systemPrompt: '' },
    };
    const project: Project = {
      ...baseProject,
      stepOutputs: { producer: JSON.stringify({ summary: 'Done' }) },
      variables: [
        ...baseProject.variables,
        {
          id: 'var-summary',
          key: 'summary',
          label: 'Summary',
          type: 'text',
          value: 'Done',
          sourceType: 'step_output',
          sourceRef: 'producer:summary',
          createdAt: 1,
          updatedAt: 2,
        },
      ],
    };

    const previews = buildStepOutputPreviews(project, step);

    expect(previews.find((item) => item.key === 'items')?.table?.totalRows).toBe(4);
    expect(previews.find((item) => item.key === 'summary')?.value).toBe('Done');
  });
});
