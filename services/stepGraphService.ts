import {
  ModelCatalogItem,
  ProducerCandidate,
  ProducerPreflightItem,
  ProducerPreflightStatus,
  ProducerRunScope,
  Project,
  ProviderConfig,
  StepGraphEdge,
  StepGraphNode,
  Template,
  TemplateStep,
} from '../types';
import { resolveStepExecutionAvailability } from './modelService';
import {
  getStepInputs,
  getStepOutputs,
  getTableVariableKeyFromReference,
} from './stepVariablePortsService';

const VARIABLE_PATTERN = /\{\{([^}]+)\}\}/g;

export interface StepGraph {
  nodes: StepGraphNode[];
  edges: StepGraphEdge[];
}

export interface ProducerPreflight {
  graph: StepGraph;
  orderedStepIds: string[];
  items: ProducerPreflightItem[];
  readyStepIds: string[];
  existingResultStepIds: string[];
  blockedStepIds: string[];
}

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

export const extractTemplateVariableKeys = (content: string): string[] =>
  unique(
    Array.from(content.matchAll(VARIABLE_PATTERN))
      .map((match) => String(match[1]).trim())
      .map((key) => getTableVariableKeyFromReference(key) || key)
  );

export const buildStepGraph = (template: Template): StepGraph => {
  const producersByVariable = new Map<string, string[]>();

  template.steps.forEach((step) => {
    getStepOutputs(step).forEach((output) => {
      const outputVariableKey = output.key.trim();
      if (!outputVariableKey) return;
      const existing = producersByVariable.get(outputVariableKey) || [];
      existing.push(step.id);
      producersByVariable.set(outputVariableKey, existing);
    });
  });

  const nodeDrafts = template.steps.map((step) => {
    const inputVariableKeys = getStepInputs(step).map((input) => input.key);
    const outputVariableKeys = getStepOutputs(step).map((output) => output.key).filter(Boolean);
    const outputVariableKey = outputVariableKeys[0];
    const upstreamStepIds = unique(
      inputVariableKeys.flatMap((key) => producersByVariable.get(key) || [])
    ).filter((stepId) => stepId !== step.id);
    const nodeRole =
      outputVariableKey ? 'producer' : inputVariableKeys.length > 0 ? 'consumer' : 'passthrough';

    return {
      stepId: step.id,
      nodeRole,
      inputVariableKeys,
      outputVariableKey,
      outputVariableKeys,
      upstreamStepIds,
      downstreamStepIds: [] as string[],
    } satisfies StepGraphNode;
  });

  const nodeIndex = new Map(nodeDrafts.map((node) => [node.stepId, node]));
  const edges: StepGraphEdge[] = [];

  nodeDrafts.forEach((node) => {
    node.upstreamStepIds.forEach((upstreamStepId) => {
      const upstreamNode = nodeIndex.get(upstreamStepId);
      if (!upstreamNode?.outputVariableKey) return;
      upstreamNode.downstreamStepIds = unique([...upstreamNode.downstreamStepIds, node.stepId]);
      const matchedVariableKeys = (upstreamNode.outputVariableKeys || [upstreamNode.outputVariableKey]).filter((key) =>
        node.inputVariableKeys.includes(key)
      );
      matchedVariableKeys.forEach((matchedVariableKey) => {
        edges.push({
          fromStepId: upstreamStepId,
          toStepId: node.stepId,
          variableKey: matchedVariableKey,
        });
      });
    });
  });

  return { nodes: nodeDrafts, edges };
};

export const getProducerCandidates = (template: Template, graph?: StepGraph): ProducerCandidate[] => {
  const activeGraph = graph || buildStepGraph(template);
  const stepById = new Map(template.steps.map((step) => [step.id, step]));

  return activeGraph.nodes
    .filter((node) => {
      const step = stepById.get(node.stepId);
      return Boolean(
        step &&
          node.outputVariableKey &&
          step.stepType === 'text_generation' &&
          step.autoRunEnabled === true
      );
    })
    .map((node) => ({
      stepId: node.stepId,
      stepName: stepById.get(node.stepId)?.name || node.stepId,
      outputVariableKey: node.outputVariableKey as string,
      inputVariableKeys: node.inputVariableKeys,
      upstreamStepIds: node.upstreamStepIds,
      downstreamStepIds: node.downstreamStepIds,
    }));
};

const getStableProducerOrder = (
  candidates: ProducerCandidate[],
  template: Template
): { orderedStepIds: string[]; cyclicStepIds: string[] } => {
  const templateOrder = new Map(template.steps.map((step, index) => [step.id, index]));
  const candidateIds = new Set(candidates.map((item) => item.stepId));
  const adjacency = new Map<string, string[]>();
  const indegree = new Map<string, number>();

  candidates.forEach((candidate) => {
    adjacency.set(candidate.stepId, []);
    indegree.set(candidate.stepId, 0);
  });

  candidates.forEach((candidate) => {
    candidate.upstreamStepIds
      .filter((upstreamId) => candidateIds.has(upstreamId))
      .forEach((upstreamId) => {
        adjacency.set(upstreamId, [...(adjacency.get(upstreamId) || []), candidate.stepId]);
        indegree.set(candidate.stepId, (indegree.get(candidate.stepId) || 0) + 1);
      });
  });

  const ready = Array.from(indegree.entries())
    .filter(([, degree]) => degree === 0)
    .map(([stepId]) => stepId)
    .sort((left, right) => (templateOrder.get(left) || 0) - (templateOrder.get(right) || 0));

  const orderedStepIds: string[] = [];

  while (ready.length > 0) {
    const current = ready.shift() as string;
    orderedStepIds.push(current);
    const nextIds = adjacency.get(current) || [];

    nextIds.forEach((nextId) => {
      const nextDegree = (indegree.get(nextId) || 0) - 1;
      indegree.set(nextId, nextDegree);
      if (nextDegree === 0) {
        ready.push(nextId);
        ready.sort(
          (left, right) => (templateOrder.get(left) || 0) - (templateOrder.get(right) || 0)
        );
      }
    });
  }

  const cyclicStepIds = candidates
    .map((candidate) => candidate.stepId)
    .filter((stepId) => !orderedStepIds.includes(stepId));

  return { orderedStepIds, cyclicStepIds };
};

const hasExistingStepResult = (project: Project, stepId: string) =>
  Boolean(project.stepOutputs?.[stepId]?.trim());

const getStepAssetUpdatedAt = (project: Project, stepId: string) => {
  const latestLog = (project.stepRunLogs?.[stepId] || []).at(-1);
  return Math.max(project.stepOutputMeta?.[stepId]?.updatedAt || 0, latestLog?.createdAt || 0);
};

const hasMissingReferencedVariable = (project: Project, variableKey: string) => {
  const variable = (project.variables || []).find((item) => item.key === variableKey);
  return !variable || !String(variable.value || '').trim();
};

const getProducerChangeState = ({
  project,
  candidate,
}: {
  project: Project;
  candidate: ProducerCandidate;
}) => {
  const hasExistingResult = hasExistingStepResult(project, candidate.stepId);
  if (!hasExistingResult) {
    return {
      isChanged: true,
      reason: 'No current result yet.',
    };
  }

  const currentAssetUpdatedAt = getStepAssetUpdatedAt(project, candidate.stepId);
  const changedInputs = candidate.inputVariableKeys.filter((key) => {
    const variable = (project.variables || []).find((item) => item.key === key);
    return Boolean(variable && (variable.updatedAt || 0) > currentAssetUpdatedAt);
  });

  if (changedInputs.length > 0) {
    return {
      isChanged: true,
      reason: `Updated variables: ${changedInputs.map((key) => `{{${key}}}`).join(', ')}`,
    };
  }

  return {
    isChanged: false,
    reason: 'No upstream variable change detected.',
  };
};

export const buildProducerPreflight = ({
  project,
  template,
  modelCatalog,
  providerConfigs,
  scope = 'changed_only',
}: {
  project: Project;
  template: Template;
  modelCatalog: ModelCatalogItem[];
  providerConfigs: ProviderConfig[];
  scope?: ProducerRunScope;
}): ProducerPreflight => {
  const graph = buildStepGraph(template);
  const candidates = getProducerCandidates(template, graph);
  const stepById = new Map(template.steps.map((step) => [step.id, step]));
  const { orderedStepIds, cyclicStepIds } = getStableProducerOrder(candidates, template);
  const cycleSet = new Set(cyclicStepIds);

  const items = candidates.map((candidate) => {
    const step = stepById.get(candidate.stepId) as TemplateStep;
    const missingInputs = candidate.inputVariableKeys.filter((key) =>
      hasMissingReferencedVariable(project, key)
    );
    const hasExistingResult = hasExistingStepResult(project, candidate.stepId);
    const changeState = getProducerChangeState({ project, candidate });

    let status: ProducerPreflightStatus = 'ready';
    let reason = '';

    if (scope === 'empty_only' && hasExistingResult) {
      status = 'skipped';
      reason = 'Skipped because this scope only updates empty results.';
    } else if (scope === 'changed_only' && !changeState.isChanged) {
      status = 'skipped';
      reason = changeState.reason;
    }

    if (status === 'ready' && cycleSet.has(candidate.stepId)) {
      status = 'blocked';
      reason = 'Circular dependency detected between prompt functions.';
    } else if (status === 'ready' && missingInputs.length > 0) {
      status = 'blocked';
      reason = `Missing variables: ${missingInputs.map((key) => `{{${key}}}`).join(', ')}`;
    } else if (status === 'ready') {
      const availability = resolveStepExecutionAvailability({
        step,
        template,
        modelCatalog,
        providerConfigs,
      });

      if (!availability.isRunnable) {
        status = 'blocked';
        reason = availability.message;
      } else if (hasExistingResult) {
        status = 'existing_result';
        reason =
          scope === 'changed_only' && changeState.reason
            ? changeState.reason
            : `Existing result will be replaced for {{${candidate.outputVariableKey}}}.`;
      }
    }

    return {
      stepId: candidate.stepId,
      stepName: candidate.stepName,
      outputVariableKey: candidate.outputVariableKey,
      status,
      reason,
      willOverwrite: status === 'existing_result' ? false : undefined,
    } satisfies ProducerPreflightItem;
  });

  const itemById = new Map<string, ProducerPreflightItem>(
    items.map((item) => [item.stepId, item] as const)
  );
  const orderedItems: ProducerPreflightItem[] = [
    ...orderedStepIds
      .map((stepId) => itemById.get(stepId))
      .filter((item): item is ProducerPreflightItem => item !== undefined),
    ...items.filter((item) => !orderedStepIds.includes(item.stepId)),
  ];

  return {
    graph,
    orderedStepIds,
    items: orderedItems,
    readyStepIds: orderedItems.filter((item) => item.status === 'ready').map((item) => item.stepId),
    existingResultStepIds: orderedItems
      .filter((item) => item.status === 'existing_result')
      .map((item) => item.stepId),
    blockedStepIds: orderedItems
      .filter((item) => item.status === 'blocked')
      .map((item) => item.stepId),
  };
};
