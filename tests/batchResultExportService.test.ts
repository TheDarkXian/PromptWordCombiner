import { describe, expect, it, vi } from 'vitest';

import { buildBatchResultExport } from '../services/batchResultExportService';
import type { Project, ProducerRunResultItem, Template } from '../types';

const template: Template = {
  id: 'template-1',
  name: 'Image Prompt Template',
  inputs: [],
  steps: [
    {
      id: 'step-1',
      name: 'Generate Description',
      content: 'Describe the image',
      structuredOutputFields: [
        { key: 'subject_description', label: '主体描述' },
        { key: 'style_keywords', label: '风格词' },
      ],
    },
    {
      id: 'step-2',
      name: 'Assemble Prompt',
      content: 'Combine fields',
    },
  ],
};

const project: Project = {
  id: 'project-1',
  templateId: 'template-1',
  name: 'Project One',
  createdAt: 1,
  lastModifiedAt: 2,
  inputValues: {},
  customInputs: [],
  stepOutputs: {
    'step-1': 'A woman in the rain, cyberpunk neon lights.',
    'step-2': 'Final prompt text',
  },
  stepStructuredOutputs: {
    'step-1': {
      subject_description: 'A woman in the rain',
      style_keywords: 'cyberpunk, neon',
    },
  },
  stepOutputMeta: {},
  stepRunLogs: {},
  stepOverrides: {},
  variables: [],
};

const results: ProducerRunResultItem[] = [
  {
    stepId: 'step-1',
    stepName: 'Generate Description',
    outputVariableKey: 'scene_desc',
    status: 'success',
    message: 'Updated {{scene_desc}}.',
  },
  {
    stepId: 'step-2',
    stepName: 'Assemble Prompt',
    outputVariableKey: 'final_prompt',
    status: 'skipped',
    message: 'Existing result was kept.',
  },
];

describe('batchResultExportService', () => {
  it('builds flat JSON export records with structured fields', () => {
    vi.setSystemTime(new Date('2026-05-13T14:50:00+08:00'));

    const exported = buildBatchResultExport({
      project,
      template,
      results,
      format: 'json',
      filter: 'all',
    });

    const parsed = JSON.parse(exported.content);
    expect(exported.filename).toBe('producer-run-results-20260513-145000.json');
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({
      project_id: 'project-1',
      step_id: 'step-1',
      result_status: 'success',
      step_output_raw: 'A woman in the rain, cyberpunk neon lights.',
      'field.subject_description': 'A woman in the rain',
      'field.style_keywords': 'cyberpunk, neon',
    });
    expect(parsed[1]).not.toHaveProperty('field.subject_description');
  });

  it('applies skipped filter to include stopped-equivalent export subset', () => {
    vi.setSystemTime(new Date('2026-05-13T14:50:00+08:00'));

    const exported = buildBatchResultExport({
      project,
      template,
      results: [
        ...results,
        {
          stepId: 'step-3',
          stepName: 'Stopped Step',
          outputVariableKey: 'stopped',
          status: 'stopped',
          message: 'Stopped before this node could run.',
        },
      ],
      format: 'csv',
      filter: 'skipped',
    });

    expect(exported.filename).toBe('producer-run-results-20260513-145000.csv');
    expect(exported.content).toContain('step-2');
    expect(exported.content).toContain('step-3');
    expect(exported.content).not.toContain('step-1');
  });
});

