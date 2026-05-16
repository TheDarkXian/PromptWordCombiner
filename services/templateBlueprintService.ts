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

export interface TidyBlueprintLayoutOptions {
  selectedStepIds?: string[];
  gridSize?: number;
  nodeWidth?: number;
  nodeHeight?: number;
  gapX?: number;
  gapY?: number;
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

const roundToGrid = (value: number, gridSize: number) => Math.round(value / gridSize) * gridSize;

export const tidyBlueprintLayout = (
  template: Template,
  options: TidyBlueprintLayoutOptions = {}
): TemplateBlueprint => {
  const merged = mergeBlueprintLayout(template);
  const gridSize = options.gridSize ?? 20;
  const nodeWidth = options.nodeWidth ?? NODE_W;
  const nodeHeight = options.nodeHeight ?? NODE_H;
  const gapX = options.gapX ?? H_GAP;
  const gapY = options.gapY ?? V_GAP;
  const validStepIds = new Set(template.steps.map((step) => step.id));
  const requestedIds = options.selectedStepIds?.filter((stepId) => validStepIds.has(stepId)) || [];
  const targetIds = requestedIds.length > 0 ? requestedIds : template.steps.map((step) => step.id);

  if (targetIds.length <= 1) {
    const nodes = { ...merged.nodes };
    targetIds.forEach((stepId) => {
      const pos = nodes[stepId];
      if (!pos) return;
      nodes[stepId] = { x: roundToGrid(pos.x, gridSize), y: roundToGrid(pos.y, gridSize) };
    });
    return {
      ...merged,
      nodes,
    };
  }

  const targetPositions = targetIds.map((stepId) => merged.nodes[stepId]).filter(Boolean);
  const minX = Math.min(...targetPositions.map((pos) => pos.x));
  const maxX = Math.max(...targetPositions.map((pos) => pos.x));
  const minY = Math.min(...targetPositions.map((pos) => pos.y));
  const maxY = Math.max(...targetPositions.map((pos) => pos.y));
  const centerX = (minX + maxX + nodeWidth) / 2;
  const centerY = (minY + maxY + nodeHeight) / 2;
  const horizontal = maxX - minX >= maxY - minY;
  const sortedIds = [...targetIds].sort((a, b) => {
    const pa = merged.nodes[a];
    const pb = merged.nodes[b];
    if (!pa || !pb) return 0;
    return horizontal ? pa.x - pb.x || pa.y - pb.y : pa.y - pb.y || pa.x - pb.x;
  });
  const totalMain = horizontal
    ? sortedIds.length * nodeWidth + (sortedIds.length - 1) * gapX
    : sortedIds.length * nodeHeight + (sortedIds.length - 1) * gapY;
  const startMain = horizontal ? centerX - totalMain / 2 : centerY - totalMain / 2;
  const alignedCross = horizontal
    ? roundToGrid(targetPositions.reduce((sum, pos) => sum + pos.y, 0) / targetPositions.length, gridSize)
    : roundToGrid(targetPositions.reduce((sum, pos) => sum + pos.x, 0) / targetPositions.length, gridSize);

  const nodes = { ...merged.nodes };
  sortedIds.forEach((stepId, index) => {
    nodes[stepId] = horizontal
      ? {
          x: roundToGrid(startMain + index * (nodeWidth + gapX), gridSize),
          y: alignedCross,
        }
      : {
          x: alignedCross,
          y: roundToGrid(startMain + index * (nodeHeight + gapY), gridSize),
        };
  });

  return {
    ...merged,
    nodes,
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
