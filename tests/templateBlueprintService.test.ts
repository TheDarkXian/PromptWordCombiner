import { describe, expect, it } from 'vitest';

import {
  applyBlueprintEdgeChange,
  buildBlueprintLayout,
  mergeBlueprintLayout,
  tidyBlueprintLayout,
} from '../services/templateBlueprintService';
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

  it('tidies horizontal layouts without resetting their direction', () => {
    const template: Template = {
      ...buildTemplate(),
      steps: [
        ...buildTemplate().steps,
        {
          id: 'c',
          name: 'C',
          content: '',
          outputBinding: { variableKey: 'var_c' },
          stepType: 'manual',
          autoRunEnabled: false,
          execution: { systemPrompt: '' },
        },
      ],
      blueprint: {
        version: 2,
        nodes: {
          a: { x: 100, y: 120 },
          b: { x: 450, y: 148 },
          c: { x: 800, y: 110 },
        },
      },
    };

    const layout = tidyBlueprintLayout(template);
    expect(layout.nodes.a.x).toBeLessThan(layout.nodes.b.x);
    expect(layout.nodes.b.x).toBeLessThan(layout.nodes.c.x);
    expect(layout.nodes.a.y).toBe(layout.nodes.b.y);
    expect(layout.nodes.b.y).toBe(layout.nodes.c.y);
  });

  it('tidies vertical layouts without resetting their direction', () => {
    const template: Template = {
      ...buildTemplate(),
      steps: [
        ...buildTemplate().steps,
        {
          id: 'c',
          name: 'C',
          content: '',
          outputBinding: { variableKey: 'var_c' },
          stepType: 'manual',
          autoRunEnabled: false,
          execution: { systemPrompt: '' },
        },
      ],
      blueprint: {
        version: 2,
        nodes: {
          a: { x: 100, y: 120 },
          b: { x: 126, y: 390 },
          c: { x: 92, y: 660 },
        },
      },
    };

    const layout = tidyBlueprintLayout(template);
    expect(layout.nodes.a.y).toBeLessThan(layout.nodes.b.y);
    expect(layout.nodes.b.y).toBeLessThan(layout.nodes.c.y);
    expect(layout.nodes.a.x).toBe(layout.nodes.b.x);
    expect(layout.nodes.b.x).toBe(layout.nodes.c.x);
  });

  it('tidies only selected nodes when a selection is provided', () => {
    const template: Template = {
      ...buildTemplate(),
      blueprint: {
        version: 2,
        nodes: {
          a: { x: 100, y: 120 },
          b: { x: 450, y: 148 },
        },
      },
    };

    const layout = tidyBlueprintLayout(template, { selectedStepIds: ['a'] });
    expect(layout.nodes.a).toEqual({ x: 100, y: 120 });
    expect(layout.nodes.b).toEqual({ x: 450, y: 148 });
  });
});
