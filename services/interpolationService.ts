import { Project, Template } from '../types';
import { getVariableTableCellValue } from './variableTableService.runtime';
import {
  STEP_PARAMETER_REFERENCE_PATTERN,
  extractStepParameterReferences,
  syncStepParametersFromContent,
} from './stepParameterService';
import { resolveStepParameterValue } from './stepParameterBindingService';
import { getBlockingDiagnosticsForStep } from './templateDiagnosticsService';

export const interpolateText = (
  text: string,
  project: Pick<Project, 'variables' | 'variableTables' | 'inputValues' | 'customInputs' | 'stepOutputs'>,
  template: Pick<Template, 'inputs' | 'steps'>
): string => {
  if (!text) return '';
  let result = text;

  const variableMap = Object.fromEntries(
    (project.variables || []).map((variable) => [variable.key, variable.value || ''])
  );
  result = result.replace(/--([^-]+)--/g, (_, rawKey) => {
    const key = String(rawKey).trim();
    const tableValue = getVariableTableCellValue(project, key);
    if (tableValue !== undefined) return tableValue;
    return variableMap[key] || '';
  });

  // Legacy compatibility for old saved prompts.
  result = result.replace(/\{\{([^}]+)\}\}/g, (_, rawKey) => {
    const key = String(rawKey).trim();
    const tableValue = getVariableTableCellValue(project, key);
    if (tableValue !== undefined) return tableValue;
    return variableMap[key] || '';
  });

  template.inputs.forEach((input, index) => {
    const value = project.inputValues[input.id] || '';
    result = result.split(`<${index}>`).join(value);
    result = result.split(`<${input.label}>`).join(value);
  });

  (project.customInputs || []).forEach((input, index) => {
    const value = project.inputValues[input.id] || '';
    result = result.split(`<l${index + 1}>`).join(value);
    result = result.split(`<${input.label}>`).join(value);
  });

  template.steps.forEach((step, index) => {
    const output = project.stepOutputs[step.id] || '';
    result = result.split(`[[${index + 1}]]`).join(output);
    result = result.split(`[[${step.name}]]`).join(output);
  });

  return result;
};

export const createInterpolator = (
  project: Project,
  template: Template
): ((text: string) => string) => {
  return (text: string) => interpolateText(text, project, template);
};

export interface StepInterpolationResult {
  text: string;
  diagnostics: ReturnType<typeof getBlockingDiagnosticsForStep>;
}

export const interpolateStepBody = (
  stepId: string,
  rawContent: string,
  project: Project,
  template: Template
): StepInterpolationResult => {
  const step = template.steps.find((item) => item.id === stepId);
  if (!step || !Array.isArray(step.parameters)) {
    return {
      text: interpolateText(rawContent, project, template),
      diagnostics: [],
    };
  }

  const diagnostics = getBlockingDiagnosticsForStep(template, step.id, project);
  if (diagnostics.length > 0) {
    return { text: '', diagnostics };
  }

  const parameterValues = new Map(
    syncStepParametersFromContent(step).map((parameter) => [
      parameter.name,
      resolveStepParameterValue(parameter, project, template, step),
    ])
  );

  const text = rawContent.replace(STEP_PARAMETER_REFERENCE_PATTERN, (_, rawKey) => {
    const key = String(rawKey).trim();
    const reference = extractStepParameterReferences(`[[${key}]]`)[0];
    if (!reference?.valid) return '';
    const resolved = parameterValues.get(reference.name);
    if (!resolved || resolved.missing) return '';
    return resolved.value || '';
  });

  return { text, diagnostics: [] };
};
