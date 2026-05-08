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
      uiScale: 16,
      sidebarWidth: 300,
      isSidebarOpen: true,
      rightPanelWidth: 400,
      isRightPanelOpen: true,
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
});
