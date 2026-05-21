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
    expect(addResult.template.steps.find((step) => step.id === 'b')?.content).toContain('[[var_a]]');

    const removeResult = applyBlueprintEdgeChange(addResult.template, {
      fromStepId: 'a',
      toStepId: 'b',
      mode: 'remove',
    });
    expect(removeResult.ok).toBe(true);
    expect(removeResult.template.steps.find((step) => step.id === 'b')?.content).not.toContain('[[var_a]]');
  });

  it('rejects add edge when source has no output variable', () => {
    const template = buildTemplate();
    template.steps[0].outputBinding = { variableKey: '' };
    const result = applyBlueprintEdgeChange(template, { fromStepId: 'a', toStepId: 'b', mode: 'add' });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('output variable');
  });

  it('connects source output to math input ports', () => {
    const template: Template = {
      ...buildTemplate(),
      steps: [
        buildTemplate().steps[0],
        {
          id: 'math',
          name: 'Math',
          kind: 'math_operation',
          content: '',
          math: { operation: 'add', leftKey: '', rightKey: '', outputKey: 'total' },
          outputBinding: { variableKey: 'total' },
        },
      ],
    };

    const addResult = applyBlueprintEdgeChange(template, {
      fromStepId: 'a',
      toStepId: 'math',
      fromOutputKey: 'var_a',
      toInputKey: 'right',
      mode: 'add',
    });

    expect(addResult.ok).toBe(true);
    expect(addResult.template.steps.find((step) => step.id === 'math')?.math?.rightKey).toBe('var_a');

    const removeResult = applyBlueprintEdgeChange(addResult.template, {
      fromStepId: 'a',
      toStepId: 'math',
      fromOutputKey: 'var_a',
      toInputKey: 'right',
      mode: 'remove',
    });

    expect(removeResult.template.steps.find((step) => step.id === 'math')?.math?.rightKey).toBe('');
  });

  it('connects source output to function parameter ports', () => {
    const template: Template = {
      ...buildTemplate(),
      steps: [
        buildTemplate().steps[0],
        {
          id: 'fn',
          name: 'Function',
          content: 'use [[topic]]',
          parameters: [{ id: 'param-topic', name: 'topic', type: 'text', defaultValue: '' }],
          outputBinding: { variableKey: 'result' },
        },
      ],
    };

    const result = applyBlueprintEdgeChange(template, {
      fromStepId: 'a',
      toStepId: 'fn',
      fromOutputKey: 'var_a',
      toInputKey: 'topic',
      mode: 'add',
    });

    expect(result.template.steps.find((step) => step.id === 'fn')?.parameters?.[0].source).toEqual({
      type: 'step_return',
      stepId: 'a',
      key: 'var_a',
    });
  });

  it('connects table outputs to table function parameters', () => {
    const template: Template = {
      ...buildTemplate(),
      steps: [
        {
          ...buildTemplate().steps[0],
          outputs: [
            {
              key: 'characters',
              label: 'Characters',
              type: 'table',
              tableSchema: { columns: [{ key: 'name', label: 'Name' }] },
            },
          ],
        },
        {
          id: 'fn',
          name: 'Function',
          content: 'use [[characters]]',
          parameters: [{ id: 'param-characters', name: 'characters', type: 'table', defaultValue: '' }],
          outputBinding: { variableKey: 'result' },
        },
      ],
    };

    const result = applyBlueprintEdgeChange(template, {
      fromStepId: 'a',
      toStepId: 'fn',
      fromOutputKey: 'characters',
      toInputKey: 'characters',
      mode: 'add',
    });

    expect(result.ok).toBe(true);
    expect(result.template.steps.find((step) => step.id === 'fn')?.parameters?.[0].source).toEqual({
      type: 'step_return',
      stepId: 'a',
      key: 'characters',
    });
  });

  it('connects model node output to function model port', () => {
    const template: Template = {
      ...buildTemplate(),
      steps: [
        {
          id: 'model-node',
          name: 'Model',
          kind: 'model',
          content: '',
          model: { modelRefId: 'ref-1' },
          execution: { systemPrompt: '' },
        },
        {
          id: 'fn',
          name: 'Function',
          kind: 'prompt_function',
          content: 'use',
          outputBinding: { variableKey: 'result' },
          execution: { modelRefId: 'fallback-ref', systemPrompt: '' },
        },
      ],
    };

    const result = applyBlueprintEdgeChange(template, {
      fromStepId: 'model-node',
      toStepId: 'fn',
      fromOutputKey: 'model-node:model',
      toInputKey: 'model',
      mode: 'add',
    });

    expect(result.ok).toBe(true);
    expect(result.template.steps.find((step) => step.id === 'fn')?.execution?.modelSourceStepId).toBe('model-node');
  });

  it('rejects non-model output connected to function model port', () => {
    const template = buildTemplate();
    const result = applyBlueprintEdgeChange(template, {
      fromStepId: 'a',
      toStepId: 'b',
      fromOutputKey: 'var_a',
      toInputKey: 'model',
      mode: 'add',
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain('端口类型不匹配');
  });

  it('rejects incompatible table/text/model port connections without mutating the template', () => {
    const originalTemplate: Template = {
      ...buildTemplate(),
      steps: [
        {
          id: 'table-source',
          name: 'Table Source',
          content: '',
          outputs: [
            {
              key: 'rows',
              label: 'Rows',
              type: 'table',
              tableSchema: { columns: [{ key: 'name', label: 'Name' }] },
            },
          ],
          execution: { systemPrompt: '' },
        },
        {
          id: 'model-source',
          name: 'Model Source',
          kind: 'model',
          content: '',
          model: { modelRefId: 'ref-1' },
          execution: { systemPrompt: '' },
        },
        {
          id: 'text-fn',
          name: 'Text Function',
          content: 'use [[topic]]',
          parameters: [{ id: 'param-topic', name: 'topic', type: 'text', defaultValue: '' }],
          outputBinding: { variableKey: 'text_result' },
          execution: { systemPrompt: '' },
        },
        {
          id: 'table-fn',
          name: 'Table Function',
          content: 'use [[rows]]',
          parameters: [{ id: 'param-rows', name: 'rows', type: 'table', defaultValue: '' }],
          outputBinding: { variableKey: 'table_result' },
          execution: { systemPrompt: '' },
        },
      ],
    };

    const tableToText = applyBlueprintEdgeChange(originalTemplate, {
      fromStepId: 'table-source',
      toStepId: 'text-fn',
      fromOutputKey: 'rows',
      toInputKey: 'topic',
      mode: 'add',
    });
    const textToTable = applyBlueprintEdgeChange(originalTemplate, {
      fromStepId: 'text-fn',
      toStepId: 'table-fn',
      fromOutputKey: 'text_result',
      toInputKey: 'rows',
      mode: 'add',
    });
    const modelToText = applyBlueprintEdgeChange(originalTemplate, {
      fromStepId: 'model-source',
      toStepId: 'text-fn',
      fromOutputKey: 'model-source:model',
      toInputKey: 'topic',
      mode: 'add',
    });

    expect(tableToText.ok).toBe(false);
    expect(textToTable.ok).toBe(false);
    expect(modelToText.ok).toBe(false);
    expect(tableToText.template).toEqual(originalTemplate);
    expect(textToTable.template).toEqual(originalTemplate);
    expect(modelToText.template).toEqual(originalTemplate);
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
