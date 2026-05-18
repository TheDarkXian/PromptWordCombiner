import { Project, Template } from '../types';
import { getVariableTableCellValue } from './variableTableService.runtime';

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
