import {
  ProjectVariableTableColumn,
  StepVariableInput,
  StepVariableOutput,
  TemplateStep,
  VariableValueType,
} from '../types';
import { syncStepParametersFromContent } from './stepParameterService';

const TABLE_REFERENCE_PATTERN = /^(.+)\[\d+\]\.[^.[\]]+$/;
const GLOBAL_VARIABLE_PATTERN = /--([^-]+)--/g;
const LEGACY_VARIABLE_PATTERN = /\{\{([^}]+)\}\}/g;
const isNumberLiteral = (value: string) => {
  const trimmed = value.trim();
  return trimmed !== '' && Number.isFinite(Number(trimmed));
};

export type PortValueType = VariableValueType;

export interface PortCompatibilityResult {
  ok: boolean;
  fromType: PortValueType;
  toType: PortValueType;
  message?: string;
}

export const normalizePortValueType = (type?: VariableValueType): PortValueType =>
  type === 'table' || type === 'model' ? type : 'text';

export const getPortTypeLabel = (type?: VariableValueType) => {
  const normalized = normalizePortValueType(type);
  if (normalized === 'table') return '表';
  if (normalized === 'model') return '模型';
  return '文本';
};

export const checkPortCompatibility = (
  fromType?: VariableValueType,
  toType?: VariableValueType
): PortCompatibilityResult => {
  const normalizedFrom = normalizePortValueType(fromType);
  const normalizedTo = normalizePortValueType(toType);
  if (normalizedFrom === normalizedTo) {
    return { ok: true, fromType: normalizedFrom, toType: normalizedTo };
  }
  return {
    ok: false,
    fromType: normalizedFrom,
    toType: normalizedTo,
    message: `端口类型不匹配：${getPortTypeLabel(normalizedFrom)}不能连接到${getPortTypeLabel(normalizedTo)}。`,
  };
};

export const getTableVariableKeyFromReference = (key: string) => {
  const match = key.trim().match(TABLE_REFERENCE_PATTERN);
  return match?.[1]?.trim();
};

export const normalizeStepVariableOutput = (output: Partial<StepVariableOutput>): StepVariableOutput | undefined => {
  const key = output.key?.trim();
  if (!key) return undefined;
  const type = output.type === 'table' ? 'table' : output.type === 'model' ? 'model' : 'text';
  return {
    key,
    label: output.label?.trim() || key,
    type,
    tableSchema:
      type === 'table'
        ? {
            columns: (output.tableSchema?.columns || [])
              .map((column) => ({
                key: column.key?.trim() || '',
                label: column.label?.trim() || column.key?.trim() || '',
                description: column.description?.trim() || undefined,
              }))
              .filter((column) => column.key && column.label),
          }
        : undefined,
  };
};

export const getStepOutputs = (step: TemplateStep): StepVariableOutput[] => {
  if (step.kind === 'variable') {
    const key = step.variable?.outputKey?.trim() || `${step.id}:value`;
    return [{ key, label: 'value', type: 'text' }];
  }

  if (step.kind === 'math_operation') {
    const key = step.math?.outputKey?.trim() || `${step.id}:result`;
    return [{ key, label: 'result', type: 'text' }];
  }

  if (step.kind === 'model') {
    return [{ key: `${step.id}:model`, label: 'model', type: 'model' }];
  }

  if (step.kind === 'table_row') {
    const outputs = (step.outputs || [])
      .map((output) => normalizeStepVariableOutput({ ...output, type: 'text' }))
      .filter((output): output is StepVariableOutput => Boolean(output));
    return outputs;
  }

  const explicitOutputs = (step.outputs || [])
    .map((output) => normalizeStepVariableOutput(output))
    .filter((output): output is StepVariableOutput => Boolean(output));
  if (explicitOutputs.length > 0) return explicitOutputs;

  const outputs: StepVariableOutput[] = [];
  const bindingKey = step.outputBinding?.variableKey?.trim();
  if (bindingKey) {
    outputs.push({
      key: bindingKey,
      label: step.outputBinding?.variableLabel?.trim() || bindingKey,
      type: 'text',
    });
  }

  const columns: ProjectVariableTableColumn[] = (step.structuredOutputFields || [])
    .map((field) => ({
      key: field.key?.trim() || '',
      label: field.label?.trim() || field.key?.trim() || '',
      description: field.description?.trim() || undefined,
    }))
    .filter((field) => field.key && field.label);

  if (columns.length > 0) {
    const tableKey =
      bindingKey && !outputs.some((output) => output.key === bindingKey)
        ? bindingKey
        : `table_${step.id}`;
    const tableOutputExists = outputs.some((output) => output.key === tableKey && output.type === 'table');
    if (!tableOutputExists) {
      outputs.push({
        key: tableKey,
        label: step.outputBinding?.variableLabel?.trim() || step.name || tableKey,
        type: 'table',
        tableSchema: { columns },
      });
    }
  }

  return outputs;
};

export const inferStepInputKeysFromContent = (content: string): string[] => {
  if (!content) return [];
  return Array.from(
    new Set(
      [
        ...Array.from(content.matchAll(GLOBAL_VARIABLE_PATTERN)),
        ...Array.from(content.matchAll(LEGACY_VARIABLE_PATTERN)),
      ]
        .map((match) => String(match[1]).trim())
        .map((key) => getTableVariableKeyFromReference(key) || key)
        .filter(Boolean)
    )
  );
};

export const getStepInputs = (step: TemplateStep): StepVariableInput[] => {
  if (step.kind === 'variable') {
    const inputKey = step.variable?.inputKey?.trim();
    return inputKey ? [{ key: inputKey, label: 'value', type: 'text', portKey: 'value' }] : [];
  }

  if (step.kind === 'math_operation') {
    return [
      { key: step.math?.leftKey?.trim() || '', label: 'A', portKey: 'left' },
      { key: step.math?.rightKey?.trim() || '', label: 'B', portKey: 'right' },
    ]
      .filter((input) => Boolean(input.key) && !isNumberLiteral(input.key))
      .map((input) => ({ ...input, type: 'text' as const }));
  }

  if (step.kind === 'table_row') {
    const tableKey = step.tableRow?.tableKey?.trim() || '';
    return tableKey ? [{ key: tableKey, label: 'table', type: 'table', portKey: 'table' }] : [];
  }

  const modelSourceStepId = step.execution?.modelSourceStepId?.trim();
  const modelInputs: StepVariableInput[] = modelSourceStepId
    ? [{ key: `${modelSourceStepId}:model`, label: 'model', type: 'model', portKey: 'model' }]
    : [];

  if (Array.isArray(step.parameters)) {
    const parameterInputs = syncStepParametersFromContent(step)
      .map<StepVariableInput | undefined>((parameter) => {
        const key =
          parameter.source?.type === 'step_return' || parameter.source?.type === 'project_variable'
            ? parameter.source.key?.trim()
            : parameter.source?.type === 'same_name'
              ? parameter.source.key?.trim() || parameter.name?.trim()
              : parameter.name?.trim();
        if (!key) return undefined;
        return {
          key,
          label: parameter.name?.trim() || key,
          type: parameter.type === 'table' ? 'table' : 'text',
          portKey: parameter.name?.trim() || key,
        };
      })
      .filter((input): input is StepVariableInput => Boolean(input));
    return [
      ...modelInputs,
      ...parameterInputs,
    ];
  }

  const inferred = inferStepInputKeysFromContent(step.content || '').map((key) => ({
    key,
    label: key,
    type: undefined,
  }));
  const explicit = (step.inputs || [])
    .map((input) => {
      const key = input.key?.trim();
      if (!key) return undefined;
      const type =
        input.type === 'table'
          ? 'table'
          : input.type === 'model'
            ? 'model'
            : input.type === 'text'
              ? 'text'
              : undefined;
      return {
        key,
        label: input.label?.trim() || key,
        type,
      } satisfies StepVariableInput;
    })
    .filter(Boolean) as StepVariableInput[];

  const inputMap = new Map<string, StepVariableInput>();
  inferred.forEach((input) => inputMap.set(input.key, input));
  explicit.forEach((input) => inputMap.set(input.key, input));
  return [...modelInputs, ...Array.from(inputMap.values())];
};
