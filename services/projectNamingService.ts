import { Project, Template, TemplateProjectNameRule } from '../types';

export const getProjectNameRule = (template?: Template | null): TemplateProjectNameRule | undefined => {
  if (!template?.projectNameRule?.inputId) return undefined;
  const input = template.inputs.find(item => item.id === template.projectNameRule?.inputId);
  if (!input || input.isConst) return undefined;
  return {
    inputId: input.id,
    prefix: template.projectNameRule.prefix || '',
  };
};

export const buildProjectName = (template: Template | undefined, inputValues: Record<string, string>, fallbackName = '新项目') => {
  const rule = getProjectNameRule(template);
  if (!rule) return fallbackName || '新项目';
  const value = (inputValues[rule.inputId] || '').trim();
  if (!value) return fallbackName || '新项目';
  return `${rule.prefix || ''}${value}`;
};

export const syncProjectNameWithTemplate = (project: Project, template?: Template): Project => {
  const rule = getProjectNameRule(template);
  if (!rule) return project;
  const name = buildProjectName(template, project.inputValues, project.name);
  return name === project.name ? project : { ...project, name };
};

export const writeProjectNameValue = (project: Project, template: Template, value: string): Partial<Project> => {
  const rule = getProjectNameRule(template);
  if (!rule) return { name: value };
  const inputValues = { ...project.inputValues, [rule.inputId]: value };
  return {
    inputValues,
    name: buildProjectName(template, inputValues, value),
  };
};
