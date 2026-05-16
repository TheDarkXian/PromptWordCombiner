import {
  Project,
  ProjectVariable,
  StepOutputMeta,
  StepRunLog,
  Template,
  VariableSourceType,
} from '../types';

const MAX_STEP_RUN_LOGS = 20;

export const slugifyVariableKey = (label: string) => {
  const normalized = label
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || `var_${Date.now()}`;
};

export const upsertVariable = (
  variables: ProjectVariable[],
  nextVariable: ProjectVariable
) => {
  const next = [...variables];
  const index = next.findIndex((variable) => variable.id === nextVariable.id);
  if (index >= 0) next[index] = nextVariable;
  else next.push(nextVariable);
  return next;
};

export const markStepOutputMeta = (
  stepOutputMeta: Record<string, StepOutputMeta>,
  stepId: string,
  updates: Partial<StepOutputMeta>
) => ({
  ...stepOutputMeta,
  [stepId]: {
    updatedAt: stepOutputMeta[stepId]?.updatedAt || Date.now(),
    ...stepOutputMeta[stepId],
    ...updates,
  },
});

export const appendStepRunLog = (
  existingLogs: StepRunLog[] | undefined,
  nextLog: StepRunLog
) => {
  const nextLogs = [...(existingLogs || []), nextLog];
  return nextLogs.slice(-MAX_STEP_RUN_LOGS);
};

export const getVariableByKey = (project: Project, key: string) =>
  (project.variables || []).find((variable) => variable.key === key);

export const syncProjectVariables = (
  project: Pick<Project, 'variables' | 'inputValues' | 'customInputs' | 'stepOutputs' | 'stepStructuredOutputs'>,
  template?: Pick<Template, 'inputs' | 'steps'>
): ProjectVariable[] => {
  const now = Date.now();
  const existing = project.variables || [];
  const synced: ProjectVariable[] = [];

  const findExisting = (sourceType: ProjectVariable['sourceType'], sourceRef?: string) =>
    existing.find((variable) => variable.sourceType === sourceType && variable.sourceRef === sourceRef);

  template?.inputs.forEach((input) => {
    const previous = findExisting('template_input', input.id);
    const nextValue = project.inputValues[input.id] || '';
    synced.push({
      id: previous?.id || `var_${input.id}`,
      key: previous?.key || slugifyVariableKey(input.label),
      label: input.label,
      value: nextValue,
      sourceType: 'template_input' as VariableSourceType,
      sourceRef: input.id,
      createdAt: previous?.createdAt || now,
      updatedAt:
        previous && previous.value === nextValue && previous.label === input.label
          ? previous.updatedAt
          : now,
    });
  });

  (project.customInputs || []).forEach((input) => {
    const previous = findExisting('project_local', input.id);
    const nextValue = project.inputValues[input.id] || '';
    synced.push({
      id: previous?.id || `var_${input.id}`,
      key: previous?.key || slugifyVariableKey(input.label),
      label: input.label,
      value: nextValue,
      sourceType: 'project_local' as VariableSourceType,
      sourceRef: input.id,
      createdAt: previous?.createdAt || now,
      updatedAt:
        previous && previous.value === nextValue && previous.label === input.label
          ? previous.updatedAt
          : now,
    });
  });

  const stepOutputVariables = new Map<string, ProjectVariable>();

  existing
    .filter((variable) => variable.sourceType === 'step_output' && variable.sourceRef)
    .forEach((variable) => {
      stepOutputVariables.set(variable.sourceRef as string, variable);
    });

  template?.steps?.forEach((step) => {
    const bindingKey = step.outputBinding?.variableKey?.trim();
    if (!bindingKey) return;

    const previous = stepOutputVariables.get(step.id);
    const nextValue = project.stepOutputs[step.id] || '';
    synced.push({
      id: previous?.id || `var_step_${step.id}`,
      key: bindingKey,
      label: step.outputBinding?.variableLabel?.trim() || bindingKey,
      value: nextValue,
      sourceType: 'step_output' as VariableSourceType,
      sourceRef: step.id,
      createdAt: previous?.createdAt || now,
      updatedAt:
        previous &&
        previous.value === nextValue &&
        previous.key === bindingKey &&
        previous.label === (step.outputBinding?.variableLabel?.trim() || bindingKey)
          ? previous.updatedAt
          : now,
    });
  });

  const structuredOutputVariables = new Map<string, ProjectVariable>();

  existing
    .filter(
      (variable) =>
        variable.sourceType === 'structured_step_output' && variable.sourceRef
    )
    .forEach((variable) => {
      structuredOutputVariables.set(variable.sourceRef as string, variable);
    });

  template?.steps?.forEach((step) => {
    const bindings = step.structuredOutputBindings || [];
    bindings.forEach((binding) => {
      const fieldKey = binding.fieldKey?.trim();
      const variableKey = binding.variableKey?.trim();
      if (!fieldKey || !variableKey) return;

      const sourceRef = `${step.id}:${fieldKey}`;
      const previous = structuredOutputVariables.get(sourceRef);
      const nextValue = project.stepStructuredOutputs?.[step.id]?.[fieldKey] || '';
      const nextLabel = binding.variableLabel?.trim() || variableKey;

      synced.push({
        id: previous?.id || `var_structured_${step.id}_${fieldKey}`,
        key: variableKey,
        label: nextLabel,
        value: nextValue,
        sourceType: 'structured_step_output' as VariableSourceType,
        sourceRef,
        createdAt: previous?.createdAt || now,
        updatedAt:
          previous &&
          previous.value === nextValue &&
          previous.key === variableKey &&
          previous.label === nextLabel
            ? previous.updatedAt
            : now,
      });
    });
  });

  existing
    .filter(
      (variable) =>
        ![
          'template_input',
          'project_local',
          'step_output',
          'structured_step_output',
        ].includes(variable.sourceType)
    )
    .forEach((variable) => synced.push(variable));

  return synced;
};

export const normalizeProject = (
  project: Project,
  templates: Template[]
): Project => {
  const normalizedProject: Project = {
    ...project,
    inputValues: project.inputValues || {},
    customInputs: project.customInputs || [],
    stepOutputs: project.stepOutputs || {},
    stepStructuredOutputs: project.stepStructuredOutputs || {},
    stepOutputMeta: project.stepOutputMeta || {},
    stepRunLogs: project.stepRunLogs || {},
    stepOverrides: project.stepOverrides || {},
    variables: project.variables || [],
  };

  return {
    ...normalizedProject,
    variables: syncProjectVariables(
      normalizedProject,
      templates.find((template) => template.id === normalizedProject.templateId)
    ),
  };
};
