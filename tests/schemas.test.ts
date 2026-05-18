import { describe, expect, it } from 'vitest';

import {
  validateBackupBundle,
  validateProjectsArray,
  validateSettings,
  validateTemplatesArray,
} from '../services/schemas';

describe('schemas', () => {
  it('accepts valid settings payloads and keeps executionPresetTemplates optional', () => {
    const result = validateSettings({
      language: 'zh-CN',
      tabOpenMode: 'single',
      uiScale: 16,
      sidebarWidth: 300,
      isSidebarOpen: true,
      fontSize: 'text-sm',
      cardScale: 300,
      fileLibrarySortBy: 'name',
      providerConfigs: [],
      modelCatalog: [],
    });

    expect(result.valid).toBe(true);
  });

  it('returns readable errors for invalid projects payloads', () => {
    const result = validateProjectsArray([
      {
        id: 'project-1',
        templateId: 'template-1',
      },
    ]);

    if (!('error' in result)) {
      throw new Error('Expected invalid project payload');
    }

    expect(result.error).toContain('name');
  });

  it('accepts templates with optional execution and output binding fields omitted', () => {
    const result = validateTemplatesArray([
      {
        id: 'template-1',
        name: 'Template',
        inputs: [],
        steps: [
          {
            id: 'step-1',
            name: 'Step 1',
            content: 'content',
          },
        ],
      },
    ]);

    expect(result.valid).toBe(true);
  });

  it('validates backup bundles containing both projects and templates', () => {
    const result = validateBackupBundle({
      projects: [],
      templates: [],
    });

    expect(result.valid).toBe(true);
  });

  it('accepts legacy backup bundles that omit newer project runtime fields', () => {
    const result = validateBackupBundle({
      version: '2.0',
      exportDate: '2026-05-13T06:07:08.374Z',
      projects: [
        {
          id: 'project-1',
          templateId: 'template-1',
          name: 'Legacy Project',
          createdAt: 1,
          lastModifiedAt: 2,
          inputValues: {},
          customInputs: [],
          stepOutputs: {},
          stepOutputMeta: {},
          stepOverrides: {},
          variables: [],
        },
      ],
      templates: [
        {
          id: 'template-1',
          name: 'Legacy Template',
          inputs: [],
          modelRefs: [],
          steps: [
            {
              id: 'step-1',
              name: 'Step 1',
              content: 'content',
              execution: {
                systemPrompt: '',
              },
              outputBinding: {
                variableKey: '',
                variableLabel: '',
              },
            },
          ],
        },
      ],
    });

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.projects[0].stepRunLogs).toEqual({});
      expect(result.data.projects[0].stepStructuredOutputs).toEqual({});
      expect(result.data.projects[0].variableTables).toEqual([]);
    }
  });
});
