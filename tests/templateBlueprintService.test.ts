import { describe, expect, it } from 'vitest';

import { buildBlueprintLayout, mergeBlueprintLayout, applyBlueprintEdgeChange } from '../services/templateBlueprintService';
import type { Template } from '../types';

const buildTemplate = (): Template => ({
  id: 'tpl',
  name: 'Template',
  inputs: [],
  modelRefs: [],
  steps: [
    {
      id: 'a',
      name: 'A',
      content: 'produce',
      outputBinding: { variableKey: 'var_a' },
      stepType: 'text_generation',
      autoRunEnabled: true,
      execution: { systemPrompt: '' },
    },
    {
      id: 'b',
      name: 'B',
      content: 'use',
      outputBinding: { variableKey: 'var_b' },
      stepType: 'text_generation',
      autoRunEnabled: true,
      execution: { systemPrompt: '' },
    },
  ],
});

describe('templateBlueprintService', () => {
  it('builds and merges blueprint layout', () => {
    const template = buildTemplate();
    const layout = buildBlueprintLayout(template);
    expect(layout.version).toBe(2);
    expect(layout.nodes.a).toBeDefined();
    expect(layout.nodes.b).toBeDefined();

    const withManual = {
      ...template,
      blueprint: {
        version: 1 as const,
        nodes: {
          a: { x: 777, y: 888 },
        },
      },
    };
    const merged = mergeBlueprintLayout(withManual);
    expect(merged.nodes.a).toEqual({ x: 777, y: 888 });
    expect(merged.nodes.b).toBeDefined();
  });

  it('adds and removes edge by mutating variable token usage only', () => {
    const template = buildTemplate();
    const addResult = applyBlueprintEdgeChange(template, { fromStepId: 'a', toStepId: 'b', mode: 'add' });
    expect(addResult.ok).toBe(true);
    expect(addResult.template.steps.find((step) => step.id === 'b')?.content).toContain('{{var_a}}');

    const removeResult = applyBlueprintEdgeChange(addResult.template, {
      fromStepId: 'a',
      toStepId: 'b',
      mode: 'remove',
    });
    expect(removeResult.ok).toBe(true);
    expect(removeResult.template.steps.find((step) => step.id === 'b')?.content).not.toContain('{{var_a}}');
  });

  it('rejects add edge when source has no output variable', () => {
    const template = buildTemplate();
    template.steps[0].outputBinding = { variableKey: '' };
    const result = applyBlueprintEdgeChange(template, { fromStepId: 'a', toStepId: 'b', mode: 'add' });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('output variable');
  });
});
