import {
  Project,
  ProjectVariableTableValue,
  StepParameter,
  StepParameterSource,
  Template,
  TemplateStep,
} from '../types';
import {
  resolveConnectedValueByKey,
  resolveProjectValueByKey,
  resolveStepOutputValue,
} from './stepConnectionValueService';

export interface StepParameterResolvedValue {
  value?: string;
  tableValue?: ProjectVariableTableValue;
  sourceLabel?: string;
  missing: boolean;
}

const resolveByKey = (
  key: string,
  project: Project,
  template: Template,
  currentStep: TemplateStep
): StepParameterResolvedValue => resolveConnectedValueByKey(key, project, template, currentStep);

const resolveExplicitSource = (
  source: StepParameterSource,
  project: Project,
  template: Template
): StepParameterResolvedValue => {
  if (source.type === 'literal') {
    return { value: source.value, sourceLabel: '固定值', missing: false };
  }
  if (source.type === 'project_input') {
    return {
      value: project.inputValues?.[source.inputId] || '',
      sourceLabel: `项目入口 ${source.key}`,
      missing: false,
    };
  }
  if (source.type === 'project_variable') {
    return resolveProjectValueByKey(source.key, project, template);
  }
  if (source.type === 'step_return') {
    return resolveStepOutputValue(source.stepId, source.key, project, template);
  }
  return { missing: true };
};

const resolveDefaultValue = (parameter: StepParameter): StepParameterResolvedValue | undefined => {
  if (parameter.defaultValue === undefined || parameter.defaultValue === '') return undefined;
  return {
    value: parameter.defaultValue,
    sourceLabel: '默认值',
    missing: false,
  };
};

export const resolveStepParameterValue = (
  parameter: StepParameter,
  project: Project,
  template: Template,
  currentStep: TemplateStep
): StepParameterResolvedValue => {
  const source = parameter.source || { type: 'same_name' as const, key: parameter.name };
  const resolved =
    source.type === 'same_name'
      ? resolveByKey(source.key || parameter.name, project, template, currentStep)
      : resolveExplicitSource(source, project, template);

  if (!resolved.missing) return resolved;
  return resolveDefaultValue(parameter) || resolved;
};
