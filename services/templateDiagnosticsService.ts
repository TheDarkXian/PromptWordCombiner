import { Project, StaticDiagnostic, Template, TemplateStep } from '../types';
import {
  extractStepParameterReferences,
  syncStepParametersFromContent,
} from './stepParameterService';
import { resolveStepParameterValue } from './stepParameterBindingService';
import { getStepOutputs } from './stepVariablePortsService';
import { resolveTextValueByKey } from './stepConnectionValueService';

const makeId = (stepId: string, code: string, key = '') => `${stepId}:${code}:${key}`;
const isNumberLiteral = (value: string) => {
  const trimmed = value.trim();
  return trimmed !== '' && Number.isFinite(Number(trimmed));
};

const findProjectTextValue = (project: Project | undefined, template: Template, step: TemplateStep, key: string): string | undefined => {
  if (!project) return undefined;
  return resolveTextValueByKey(key, project, template, step);
};

const hasStrictParameters = (step: TemplateStep) => Array.isArray(step.parameters);

export const validateStepParameters = (
  step: TemplateStep,
  template: Template,
  project?: Project
): StaticDiagnostic[] => {
  if (!hasStrictParameters(step)) return [];

  const diagnostics: StaticDiagnostic[] = [];
  const references = extractStepParameterReferences(step.content || '');
  const parameters = syncStepParametersFromContent(step);
  const referenceNames = new Set(references.filter((reference) => reference.valid).map((reference) => reference.name));

  references
    .filter((reference) => !reference.valid)
    .forEach((reference) => {
      diagnostics.push({
        id: makeId(step.id, 'INVALID_PARAMETER_REFERENCE', reference.raw),
        level: 'error',
        code: 'INVALID_PARAMETER_REFERENCE',
        message: reference.raw
          ? `函数体引用格式不正确：[[${reference.raw}]]`
          : '函数体存在空的参数引用。',
        stepId: step.id,
        target: { kind: 'function_body', key: reference.raw },
      });
    });

  const names = new Set<string>();
  parameters.forEach((parameter) => {
    if (names.has(parameter.name)) {
      diagnostics.push({
        id: makeId(step.id, 'DUPLICATE_PARAMETER_NAME', parameter.name),
        level: 'error',
        code: 'DUPLICATE_PARAMETER_NAME',
        message: `入口参数重名：${parameter.name}`,
        stepId: step.id,
        target: { kind: 'parameter', key: parameter.name },
      });
    }
    names.add(parameter.name);

    if (!referenceNames.has(parameter.name)) {
      diagnostics.push({
        id: makeId(step.id, 'UNUSED_PARAMETER', parameter.name),
        level: 'warning',
        code: 'UNUSED_PARAMETER',
        message: `入口参数已声明但函数体未使用：${parameter.name}`,
        stepId: step.id,
        target: { kind: 'parameter', key: parameter.name },
      });
    }

    if (project && parameter.required !== false) {
      const resolved = resolveStepParameterValue(parameter, project, template, step);
      if (resolved.missing) {
        diagnostics.push({
          id: makeId(step.id, 'UNBOUND_PARAMETER', parameter.name),
          level: 'error',
          code: 'UNBOUND_PARAMETER',
          message: `入口参数未绑定来源：${parameter.name}`,
          stepId: step.id,
          target: { kind: 'parameter', key: parameter.name },
        });
      }
    }
  });

  if (/\{\{[^}]*\}\}|<[^>]+>/.test(step.content || '')) {
    diagnostics.push({
      id: makeId(step.id, 'LEGACY_PLACEHOLDER_IN_STRICT_STEP'),
      level: 'warning',
      code: 'LEGACY_PLACEHOLDER_IN_STRICT_STEP',
      message: '严格参数节点仍在使用旧占位符语法，建议入口参数改为 [[入口参数]]，全局变量改为 --变量名--。',
      stepId: step.id,
      target: { kind: 'function_body' },
    });
  }

  return diagnostics;
};

export const validateLocalNode = (
  step: TemplateStep,
  template: Template,
  project?: Project
): StaticDiagnostic[] => {
  const diagnostics: StaticDiagnostic[] = [];
  if (step.kind === 'variable') {
    const name = step.variable?.name?.trim() || '';
    if (!name) {
      diagnostics.push({
        id: makeId(step.id, 'EMPTY_VARIABLE_NODE_NAME'),
        level: 'error',
        code: 'EMPTY_VARIABLE_NODE_NAME',
        message: '变量节点需要填写变量名。',
        stepId: step.id,
        target: { kind: 'parameter' },
      });
    }
    const inputKey = step.variable?.inputKey?.trim() || name;
    if (project && inputKey && findProjectTextValue(project, template, step, inputKey) === undefined && step.variable?.defaultValue === undefined) {
      diagnostics.push({
        id: makeId(step.id, 'VARIABLE_NODE_UNBOUND_VALUE', inputKey),
        level: 'error',
        code: 'VARIABLE_NODE_UNBOUND_VALUE',
        message: `变量节点没有找到输入值，也没有默认值：${inputKey}`,
        stepId: step.id,
        target: { kind: 'parameter', key: inputKey },
      });
    }
  }
  if (step.kind === 'math_operation') {
    const leftKey = step.math?.leftKey?.trim() || '';
    const rightKey = step.math?.rightKey?.trim() || '';
    if (!leftKey) {
      diagnostics.push({
        id: makeId(step.id, 'EMPTY_MATH_LEFT'),
        level: 'error',
        code: 'EMPTY_MATH_LEFT',
        message: '数学节点需要填写输入 A。',
        stepId: step.id,
        target: { kind: 'parameter', key: 'leftKey' },
      });
    }
    if (!rightKey) {
      diagnostics.push({
        id: makeId(step.id, 'EMPTY_MATH_RIGHT'),
        level: 'error',
        code: 'EMPTY_MATH_RIGHT',
        message: '数学节点需要填写输入 B。',
        stepId: step.id,
        target: { kind: 'parameter', key: 'rightKey' },
      });
    }
    [
      { key: leftKey, label: 'A' },
      { key: rightKey, label: 'B' },
    ].forEach((operand) => {
      if (!project || !operand.key || isNumberLiteral(operand.key)) return;
      const value = findProjectTextValue(project, template, step, operand.key);
      if (value === undefined) {
        diagnostics.push({
          id: makeId(step.id, `MISSING_MATH_${operand.label}`, operand.key),
          level: 'error',
          code: 'MISSING_MATH_INPUT',
          message: `数学节点输入 ${operand.label} 找不到变量：${operand.key}`,
          stepId: step.id,
          target: { kind: 'parameter', key: operand.key },
        });
        return;
      }
      if (!isNumberLiteral(value)) {
        diagnostics.push({
          id: makeId(step.id, `NON_NUMERIC_MATH_${operand.label}`, operand.key),
          level: 'error',
          code: 'NON_NUMERIC_MATH_INPUT',
          message: `数学节点输入 ${operand.label} 不是数字：${operand.key}`,
          stepId: step.id,
          target: { kind: 'parameter', key: operand.key },
        });
      }
    });
  }
  if (step.kind === 'model') {
    const modelRefId = step.model?.modelRefId?.trim();
    if (!modelRefId) {
      diagnostics.push({
        id: makeId(step.id, 'MODEL_NODE_UNBOUND_REF'),
        level: 'warning',
        code: 'MODEL_NODE_UNBOUND_REF',
        message: '模型节点还没有选择模型引用。',
        stepId: step.id,
        target: { kind: 'parameter', key: 'modelRefId' },
      });
    } else if (!(template.modelRefs || []).some((item) => item.id === modelRefId)) {
      diagnostics.push({
        id: makeId(step.id, 'MODEL_NODE_INVALID_REF', modelRefId),
        level: 'error',
        code: 'MODEL_NODE_INVALID_REF',
        message: `模型节点引用不存在：${modelRefId}`,
        stepId: step.id,
        target: { kind: 'parameter', key: 'modelRefId' },
      });
    }
  }
  if ((step.kind === 'prompt_function' || !step.kind) && step.execution?.modelSourceStepId) {
    const sourceStepId = step.execution.modelSourceStepId;
    const sourceStep = template.steps.find((item) => item.id === sourceStepId);
    if (!sourceStep || sourceStep.kind !== 'model') {
      diagnostics.push({
        id: makeId(step.id, 'FUNCTION_MODEL_SOURCE_MISSING', sourceStepId),
        level: 'error',
        code: 'FUNCTION_MODEL_SOURCE_MISSING',
        message: '函数节点连接的模型节点不存在。',
        stepId: step.id,
        target: { kind: 'parameter', key: 'model' },
      });
    } else if (!sourceStep.model?.modelRefId?.trim()) {
      diagnostics.push({
        id: makeId(step.id, 'FUNCTION_MODEL_SOURCE_UNBOUND', sourceStepId),
        level: 'error',
        code: 'FUNCTION_MODEL_SOURCE_UNBOUND',
        message: '函数节点连接的模型节点没有选择模型引用。',
        stepId: step.id,
        target: { kind: 'parameter', key: 'model' },
      });
    }
  }
  return diagnostics;
};

export const validateStepReturns = (step: TemplateStep): StaticDiagnostic[] => {
  const diagnostics: StaticDiagnostic[] = [];
  if (step.kind && step.kind !== 'prompt_function') return diagnostics;
  const outputs = getStepOutputs(step);
  const outputNames = new Set<string>();

  outputs.forEach((output) => {
    if (!output.key.trim()) {
      diagnostics.push({
        id: makeId(step.id, 'EMPTY_RETURN_NAME'),
        level: 'error',
        code: 'EMPTY_RETURN_NAME',
        message: '输出端名称不能为空。',
        stepId: step.id,
        target: { kind: output.type === 'table' ? 'return_table' : 'return_text' },
      });
    }
    if (outputNames.has(output.key)) {
      diagnostics.push({
        id: makeId(step.id, 'DUPLICATE_RETURN_NAME', output.key),
        level: 'error',
        code: 'DUPLICATE_RETURN_NAME',
        message: `返回值重名：${output.key}`,
        stepId: step.id,
        target: { kind: output.type === 'table' ? 'return_table' : 'return_text', key: output.key },
      });
    }
    outputNames.add(output.key);
    if (output.type === 'table') {
      (output.tableSchema?.columns || []).forEach((column, index) => {
        if (!column.key.trim()) {
          diagnostics.push({
            id: makeId(step.id, 'EMPTY_TABLE_COLUMN_NAME', String(index)),
            level: 'error',
            code: 'EMPTY_TABLE_COLUMN_NAME',
            message: `返回表第 ${index + 1} 列变量名不能为空。`,
            stepId: step.id,
            target: { kind: 'table_column', key: String(index) },
          });
        }
      });
    }
  });

  return diagnostics;
};

export const validateTemplate = (template: Template, project?: Project): StaticDiagnostic[] =>
  template.steps.flatMap((step) => [
    ...validateStepParameters(step, template, project),
    ...validateStepReturns(step),
    ...validateLocalNode(step, template, project),
  ]);

export const getBlockingDiagnosticsForStep = (
  template: Template,
  stepId: string,
  project?: Project
): StaticDiagnostic[] =>
  validateTemplate(template, project).filter(
    (diagnostic) => diagnostic.stepId === stepId && diagnostic.level === 'error'
  );
