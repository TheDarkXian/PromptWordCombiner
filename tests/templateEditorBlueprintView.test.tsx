import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { TemplateEditor } from '../components/TemplateEditor';
import type { Template } from '../types';

const template: Template = {
  id: 'tpl-1',
  name: 'Template 1',
  inputs: [],
  modelRefs: [],
  steps: [
    {
      id: 'step-1',
      name: 'Step 1',
      content: 'hello',
      outputBinding: { variableKey: 'out_1' },
      stepType: 'manual',
      autoRunEnabled: false,
      execution: { systemPrompt: '' },
    },
  ],
};

describe('TemplateEditor blueprint entry', () => {
  it('renders list and blueprint toggle buttons', () => {
    const html = renderToStaticMarkup(
      React.createElement(TemplateEditor, {
        language: 'en-US',
        template,
        modelCatalog: [],
        providerConfigs: [],
        executionPresetTemplates: [],
        onSave: vi.fn(),
        onSaveExecutionPresetTemplate: vi.fn(),
        onCancel: vi.fn(),
        onRequestConfirm: vi.fn(),
      })
    );

    expect(html).toContain('List');
    expect(html).toContain('Blueprint');
  });
});

