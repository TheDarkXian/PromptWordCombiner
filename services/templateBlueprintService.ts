import {
  Template,
  TemplateBlueprint,
  TemplateBlueprintCommentBox,
  TemplateBlueprintNodePosition,
} from '../types';
import { buildStepGraph, extractTemplateVariableKeys } from './stepGraphService';

const NODE_W = 240;
const NODE_H = 112;
const H_GAP = 120;
const V_GAP = 44;
const PADDING_X = 40;
const PADDING_Y = 40;

export interface BlueprintEdgeChangeInput {
  fromStepId: string;
  toStepId: string;
  toVariableKey?: string;
  mode: 'add' | 'remove';
}

export interface BlueprintEdgeChangeResult {
  ok: boolean;
  template: Template;
  message?: string;
}

const removeVariableTokens = (content: string, variableKey: string) => {
  const escaped = variableKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`\\s*\\{\\{\\s*${escaped}\\s*\\}\\}\\s*`, 'g');
  const next = content.replace(pattern, ' ');
  return next.replace(/\s{2,}/g, ' ').trim();
};

export const buildBlueprintLayout = (template: Template): TemplateBlueprint => {
  const graph = buildStepGraph(template);
  const indegree = new Map<string, number>();
  const level = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  graph.nodes.forEach((node) => {
    indegree.set(node.stepId, 0);
    adjacency.set(node.stepId, []);
  });
  graph.edges.forEach((edge) => {
    indegree.set(edge.toStepId, (indegree.get(edge.toStepId) || 0) + 1);
    adjacency.set(edge.fromStepId, [...(adjacency.get(edge.fromStepId) || []), edge.toStepId]);
  });

  const queue = graph.nodes
    .map((n) => n.stepId)
    .filter((id) => (indegree.get(id) || 0) === 0);
  queue.forEach((id) => level.set(id, 0));

  while (queue.length > 0) {
    const current = queue.shift() as string;
    const currentLevel = level.get(current) || 0;
    (adjacency.get(current) || []).forEach((next) => {
      indegree.set(next, (indegree.get(next) || 1) - 1);
      level.set(next, Math.max(level.get(next) || 0, currentLevel + 1));
      if ((indegree.get(next) || 0) === 0) queue.push(next);
    });
  }

  const grouped = new Map<number, string[]>();
  graph.nodes.forEach((node, index) => {
    const lv = level.get(node.stepId) ?? 0;
    const list = grouped.get(lv) || [];
    list.push(node.stepId);
    grouped.set(lv, list);
    if (!level.has(node.stepId)) level.set(node.stepId, index % 3);
  });

  const nodes: Record<string, TemplateBlueprintNodePosition> = {};
  Array.from(grouped.entries())
    .sort((a, b) => a[0] - b[0])
    .forEach(([lv, ids]) => {
      ids.forEach((id, idx) => {
        nodes[id] = {
          x: PADDING_X + lv * (NODE_W + H_GAP),
          y: PADDING_Y + idx * (NODE_H + V_GAP),
        };
      });
    });

  return {
    version: 2,
    nodes,
    viewport: { x: 0, y: 0, zoom: 1 },
    comments: template.blueprint?.comments || [],
    selection: template.blueprint?.selection || { stepIds: [], edgeKeys: [], commentIds: [] },
  };
};

export const mergeBlueprintLayout = (template: Template): TemplateBlueprint => {
  const base =
    template.blueprint?.version === 1 || template.blueprint?.version === 2
      ? template.blueprint
      : undefined;
  const auto = buildBlueprintLayout(template);
  const stepIds = new Set(template.steps.map((s) => s.id));
  const nodes: Record<string, TemplateBlueprintNodePosition> = {};
  template.steps.forEach((step) => {
    if (base?.nodes?.[step.id]) {
      nodes[step.id] = base.nodes[step.id];
    } else {
      nodes[step.id] = auto.nodes[step.id] || { x: 0, y: 0 };
    }
  });
  Object.keys(nodes).forEach((stepId) => {
    if (!stepIds.has(stepId)) delete nodes[stepId];
  });
  return {
    version: 2,
    nodes,
    viewport: base?.viewport || auto.viewport,
    comments: base?.comments || [],
    selection: base?.selection || { stepIds: [], edgeKeys: [], commentIds: [] },
  };
};

export const applyBlueprintEdgeChange = (
  template: Template,
  input: BlueprintEdgeChangeInput
): BlueprintEdgeChangeResult => {
  const from = template.steps.find((step) => step.id === input.fromStepId);
  const toIndex = template.steps.findIndex((step) => step.id === input.toStepId);
  if (!from || toIndex < 0) {
    return { ok: false, template, message: 'Step not found.' };
  }
  if (from.id === input.toStepId) {
    return { ok: false, template, message: 'Cannot connect a step to itself.' };
  }
  const variableKey = from.outputBinding?.variableKey?.trim();
  if (!variableKey) {
    return { ok: false, template, message: 'Source step has no output variable key.' };
  }

  const toStep = template.steps[toIndex];
  const targetVariableKey = input.toVariableKey?.trim() || variableKey;
  const token = `{{${targetVariableKey}}}`;
  const currentKeys = extractTemplateVariableKeys(toStep.content || '');
  const hasToken = currentKeys.includes(targetVariableKey);
  let nextContent = toStep.content || '';
  if (input.mode === 'add') {
    if (hasToken) return { ok: true, template };
    nextContent = `${nextContent.trim()} ${token}`.trim();
  } else {
    if (!hasToken) return { ok: true, template };
    nextContent = removeVariableTokens(nextContent, targetVariableKey);
  }

  const steps = [...template.steps];
  steps[toIndex] = { ...toStep, content: nextContent };
  return {
    ok: true,
    template: {
      ...template,
      steps,
      blueprint: mergeBlueprintLayout({ ...template, steps }),
    },
  };
};

export const updateBlueprintNodePosition = (
  template: Template,
  stepId: string,
  nextPos: TemplateBlueprintNodePosition
): Template => {
  const merged = mergeBlueprintLayout(template);
  return {
    ...template,
    blueprint: {
      ...merged,
      nodes: {
        ...merged.nodes,
        [stepId]: { x: nextPos.x, y: nextPos.y },
      },
    },
  };
};

export const updateBlueprintViewport = (template: Template, x: number, y: number, zoom: number): Template => {
  const merged = mergeBlueprintLayout(template);
  return {
    ...template,
    blueprint: {
      ...merged,
      viewport: { x, y, zoom },
    },
  };
};

export const addBlueprintCommentBox = (template: Template, box?: Partial<TemplateBlueprintCommentBox>): Template => {
  const merged = mergeBlueprintLayout(template);
  const next: TemplateBlueprintCommentBox = {
    id: box?.id || `comment_${Date.now()}`,
    title: box?.title || 'Comment',
    x: box?.x ?? 80,
    y: box?.y ?? 80,
    width: box?.width ?? 360,
    height: box?.height ?? 240,
    collapsed: box?.collapsed === true,
  };
  return {
    ...template,
    blueprint: {
      ...merged,
      comments: [...(merged.comments || []), next],
    },
  };
};

export const updateBlueprintCommentBox = (
  template: Template,
  id: string,
  updates: Partial<TemplateBlueprintCommentBox>
): Template => {
  const merged = mergeBlueprintLayout(template);
  return {
    ...template,
    blueprint: {
      ...merged,
      comments: (merged.comments || []).map((item) => (item.id === id ? { ...item, ...updates } : item)),
    },
  };
};
