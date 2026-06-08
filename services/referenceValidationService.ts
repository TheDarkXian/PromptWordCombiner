import { Project, Template, TemplateStep } from '../types';

export interface ReferenceIssue {
  reference: string;
  severity: 'error' | 'warning';
  message: string;
}

const uniqueIssues = (issues: ReferenceIssue[]) => {
  const seen = new Set<string>();
  return issues.filter(issue => {
    const key = `${issue.reference}:${issue.severity}:${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const hasText = (value: unknown) => typeof value === 'string' && value.trim().length > 0;

export const validateStepReferences = (
  content: string,
  step: TemplateStep,
  template: Template,
  project?: Project
): ReferenceIssue[] => {
  const issues: ReferenceIssue[] = [];
  const currentStepIndex = template.steps.findIndex(item => item.id === step.id);

  for (const match of content.matchAll(/<([^<>\[\]]+)>/g)) {
    const raw = match[1];
    const reference = match[0];

    if (/^\d+$/.test(raw)) {
      const input = template.inputs[Number(raw)];
      if (!input) issues.push({ reference, severity: 'error', message: '输入变量序号超出范围。' });
      else if (project && !hasText(input.isConst ? input.defaultValue : project.inputValues[input.id])) issues.push({ reference, severity: 'warning', message: `变量“${input.label}”尚未填写。` });
      continue;
    }

    const localMatch = raw.match(/^l(\d+)$/);
    if (localMatch) {
      if (!project) issues.push({ reference, severity: 'warning', message: '项目本地变量需要在项目运行时确认。' });
      else {
        const localInput = (project.customInputs || [])[Number(localMatch[1]) - 1];
        if (!localInput) issues.push({ reference, severity: 'error', message: '本地变量序号超出范围。' });
        else if (!hasText(project.inputValues[localInput.id])) issues.push({ reference, severity: 'warning', message: `本地变量“${localInput.label}”尚未填写。` });
      }
      continue;
    }

    const input = template.inputs.find(item => item.label === raw);
    const localInput = project?.customInputs?.find(item => item.label === raw);
    if (!input && !localInput) issues.push({ reference, severity: 'error', message: '不存在对应的输入变量。' });
    else if (project) {
      const matchedInput = input || localInput;
      const value = input?.isConst ? input.defaultValue : matchedInput ? project.inputValues[matchedInput.id] : '';
      if (matchedInput && !hasText(value)) {
        issues.push({ reference, severity: 'warning', message: `变量“${matchedInput.label}”尚未填写。` });
      }
    }
  }

  for (const match of content.matchAll(/\[\[([^\[\]]+)\]\]/g)) {
    const raw = match[1];
    const reference = match[0];
    const referencedIndex = /^\d+$/.test(raw)
      ? Number(raw) - 1
      : template.steps.findIndex(item => item.name === raw);
    const referencedStep = template.steps[referencedIndex];

    if (!referencedStep) {
      issues.push({ reference, severity: 'error', message: '不存在对应的步骤。' });
      continue;
    }
    if (referencedIndex >= currentStepIndex) {
      issues.push({ reference, severity: 'warning', message: referencedIndex === currentStepIndex ? '引用了当前步骤，执行时可能没有结果。' : '引用了后续步骤，执行时可能没有结果。' });
    } else if (project && !hasText(project.stepOutputs[referencedStep.id])) {
      issues.push({ reference, severity: 'warning', message: `步骤“${referencedStep.name}”尚无输出。` });
    }
  }

  return uniqueIssues(issues);
};

export const countReferenceErrors = (issues: ReferenceIssue[]) => issues.filter(issue => issue.severity === 'error').length;
