import { describe, expect, it } from 'vitest';

import { createInterpolator, interpolateText } from '../services/interpolationService';
import type { Project, Template } from '../types';

const template: Template = {
  id: 'template-1',
  name: 'Template',
  inputs: [{ id: 'topic', label: 'Topic' }],
  steps: [
    {
      id: 'step-1',
      name: 'Step One',
      content: '',
    },
  ],
};

const project: Project = {
  id: 'project-1',
  templateId: 'template-1',
  name: 'Project',
  createdAt: 1,
  lastModifiedAt: 2,
  inputValues: {
    topic: 'Neon City',
    local_1: 'Sidebar Note',
  },
  customInputs: [{ id: 'local_1', label: 'Local Label' }],
  stepOutputs: {
    'step-1': 'Rendered Text',
  },
  stepOutputMeta: {},
  stepRunLogs: {},
  stepOverrides: {},
  variables: [
    {
      id: 'var-topic',
      key: 'topic',
      label: 'Topic',
      value: 'Neon City',
      sourceType: 'template_input',
      sourceRef: 'topic',
      createdAt: 1,
      updatedAt: 1,
    },
  ],
};

describe('interpolationService', () => {
  it('interpolates variable, input, local input, and step output placeholders', () => {
    const result = interpolateText(
      '{{topic}}|<0>|<Topic>|<l1>|<Local Label>|[[1]]|[[Step One]]',
      project,
      template
    );

    expect(result).toBe(
      'Neon City|Neon City|Neon City|Sidebar Note|Sidebar Note|Rendered Text|Rendered Text'
    );
  });

  it('falls back to empty strings for missing values', () => {
    const result = interpolateText('{{missing}}|<Unknown>|[[Missing Step]]', project, template);

    expect(result).toBe('|<Unknown>|[[Missing Step]]');
  });

  it('createInterpolator returns a reusable interpolation function', () => {
    const interpolate = createInterpolator(project, template);

    expect(interpolate('Prompt: {{topic}} / [[1]]')).toBe('Prompt: Neon City / Rendered Text');
  });
});
