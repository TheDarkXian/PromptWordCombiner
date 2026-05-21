import {
  Project,
  ProjectVariable,
  ProjectVariableTableValue,
  Template,
  TemplateStep,
} from '../types';
import { getStepOutputs } from './stepVariablePortsService';

export interface StepInputResolvedValue {
  value?: string;
  tableValue?: ProjectVariableTableValue;
  sourceLabel?: string;
  missing: boolean;
}

export const findProjectVariableByKey = (project: Project, key: string): ProjectVariable | undefined =>
  (project.variables || []).find((variable) => variable.key === key);

const valueFromVariable = (variable: ProjectVariable, sourceLabel: string): StepInputResolvedValue =>
  variable.type === 'table' && variable.tableValue
    ? { tableValue: variable.tableValue, sourceLabel, missing: false }
    : { value: variable.value || '', sourceLabel, missing: false };

export const resolveProjectValueByKey = (
  key: string,
  project: Project,
  template: Template
): StepInputResolvedValue => {
  const variable = findProjectVariableByKey(project, key);
  if (variable) return valueFromVariable(variable, `变量 ${key}`);

  const templateInput = template.inputs.find((input) => input.label === key);
  if (templateInput) {
    return {
      value: project.inputValues?.[templateInput.id] || '',
      sourceLabel: `项目入口 ${key}`,
      missing: false,
    };
  }

  const localInput = (project.customInputs || []).find((input) => input.label === key);
  if (localInput) {
    return {
      value: project.inputValues?.[localInput.id] || '',
      sourceLabel: `项目变量 ${key}`,
      missing: false,
    };
  }

  return { missing: true };
};

export const resolveStepOutputValue = (
  stepId: string,
  outputKey: string,
  project: Project,
  template: Template
): StepInputResolvedValue => {
  const step = template.steps.find((item) => item.id === stepId);
  if (!step || !getStepOutputs(step).some((output) => output.key === outputKey)) {
    return { missing: true };
  }

  const variable = findProjectVariableByKey(project, outputKey);
  const sourceLabel = `函数「${step.name || step.id}」`;
  if (variable) return valueFromVariable(variable, sourceLabel);

  const stepOutput = project.stepOutputs?.[step.id];
  return stepOutput !== undefined
    ? { value: stepOutput || '', sourceLabel, missing: false }
    : { missing: true };
};

export const resolveConnectedValueByKey = (
  key: string,
  project: Project,
  template: Template,
  currentStep?: TemplateStep
): StepInputResolvedValue => {
  const upstreamStep = template.steps.find(
    (step) => step.id !== currentStep?.id && getStepOutputs(step).some((output) => output.key === key)
  );
  if (upstreamStep) {
    const resolved = resolveStepOutputValue(upstreamStep.id, key, project, template);
    if (!resolved.missing) return resolved;
  }
  return resolveProjectValueByKey(key, project, template);
};

export const resolveTextValueByKey = (
  key: string,
  project: Project,
  template: Template,
  currentStep?: TemplateStep
): string | undefined => {
  const resolved = resolveConnectedValueByKey(key, project, template, currentStep);
  return resolved.missing || resolved.tableValue ? undefined : resolved.value || '';
};
