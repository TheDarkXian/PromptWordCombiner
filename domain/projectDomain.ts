import {
  Project,
  ProjectVariable,
  StepOutputMeta,
  StepRunLog,
  Template,
  VariableSourceType,
} from '../types';
import { mergeVariableTablesForTemplate } from '../services/variableTableService.runtime';
import { getStepOutputs } from '../services/stepVariablePortsService';

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
  project: Pick<
    Project,
    'variables' | 'inputValues' | 'customInputs' | 'stepOutputs' | 'stepStructuredOutputs' | 'variableTables'
  >,
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
      type: 'text',
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
      type: 'text',
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

  const generatedTableKeys = new Set<string>();

  const findExistingStepOutput = (sourceRef: string, key: string, type: ProjectVariable['type']) =>
    existing.find(
      (variable) =>
        variable.sourceType === 'step_output' &&
        (variable.sourceRef === sourceRef ||
          (variable.sourceRef === sourceRef.split(':')[0] && variable.key === key && (variable.type || 'text') === type))
    );

  template?.steps?.forEach((step) => {
    const outputs = getStepOutputs(step);
    outputs.forEach((output) => {
      const sourceRef = outputs.length === 1 ? step.id : `${step.id}:${output.key}`;

      if (output.type === 'table') {
        generatedTableKeys.add(output.key);
        const previous = findExistingStepOutput(sourceRef, output.key, 'table');
        const legacyTable = (project.variableTables || []).find(
          (table) => table.sourceStepId === step.id && table.key === output.key
        );
        const tableValue = previous?.tableValue || {
          columns: legacyTable?.columns || output.tableSchema?.columns || [],
          rows: legacyTable?.rows || [],
        };
        synced.push({
          id: previous?.id || `var_step_${step.id}_${output.key}`,
          key: output.key,
          label: output.label || output.key,
          type: 'table',
          value: '',
          tableValue,
          sourceType: 'step_output' as VariableSourceType,
          sourceRef,
          createdAt: previous?.createdAt || now,
          updatedAt: previous?.updatedAt || legacyTable?.updatedAt || now,
        });
        return;
      }

      const previous = findExistingStepOutput(sourceRef, output.key, 'text');
      const isLegacySingleTextOutput =
        outputs.length === 1 && step.outputBinding?.variableKey?.trim() === output.key;
      const nextValue = isLegacySingleTextOutput ? project.stepOutputs[step.id] || '' : previous?.value || '';
      synced.push({
        id: previous?.id || `var_step_${step.id}_${output.key}`,
        key: output.key,
        label: output.label || output.key,
        type: 'text',
        value: nextValue,
        sourceType: 'step_output' as VariableSourceType,
        sourceRef,
        createdAt: previous?.createdAt || now,
        updatedAt:
          previous &&
          previous.value === nextValue &&
          previous.key === output.key &&
          previous.label === (output.label || output.key)
            ? previous.updatedAt
            : now,
      });
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
        type: 'text',
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

  (project.variableTables || []).forEach((table) => {
    if (generatedTableKeys.has(table.key)) return;
    const sourceRef = table.sourceStepId ? `${table.sourceStepId}:${table.key}` : table.id;
    if (synced.some((variable) => variable.type === 'table' && variable.sourceRef === sourceRef)) return;
    const previous = existing.find(
      (variable) => variable.type === 'table' && variable.sourceRef === sourceRef
    );
    synced.push({
      id: previous?.id || `var_table_${table.id}`,
      key: table.key,
      label: table.label,
      type: 'table',
      value: '',
      tableValue: {
        columns: table.columns,
        rows: table.rows,
      },
      sourceType: table.sourceStepId ? 'step_output' : 'manual',
      sourceRef,
      createdAt: previous?.createdAt || now,
      updatedAt: previous?.updatedAt || table.updatedAt || now,
    });
  });

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
    variableTables: project.variableTables || [],
    stepOutputMeta: project.stepOutputMeta || {},
    stepRunLogs: project.stepRunLogs || {},
    stepOverrides: project.stepOverrides || {},
    variables: project.variables || [],
  };

  const template = templates.find((item) => item.id === normalizedProject.templateId);

  const projectWithMergedTables = {
    ...normalizedProject,
    variableTables: mergeVariableTablesForTemplate(normalizedProject, template),
  };

  return {
    ...projectWithMergedTables,
    variables: syncProjectVariables(projectWithMergedTables, template),
  };
};
