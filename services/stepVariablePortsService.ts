import {
  ProjectVariableTableColumn,
  StepVariableInput,
  StepVariableOutput,
  TemplateStep,
} from '../types';

const TABLE_REFERENCE_PATTERN = /^(.+)\[\d+\]\.[^.[\]]+$/;
const VARIABLE_PATTERN = /\{\{([^}]+)\}\}/g;

export const getTableVariableKeyFromReference = (key: string) => {
  const match = key.trim().match(TABLE_REFERENCE_PATTERN);
  return match?.[1]?.trim();
};

export const normalizeStepVariableOutput = (output: Partial<StepVariableOutput>): StepVariableOutput | undefined => {
  const key = output.key?.trim();
  if (!key) return undefined;
  const type = output.type === 'table' ? 'table' : 'text';
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
      Array.from(content.matchAll(VARIABLE_PATTERN))
        .map((match) => String(match[1]).trim())
        .map((key) => getTableVariableKeyFromReference(key) || key)
        .filter(Boolean)
    )
  );
};

export const getStepInputs = (step: TemplateStep): StepVariableInput[] => {
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
        input.type === 'table' ? 'table' : input.type === 'text' ? 'text' : undefined;
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
  return Array.from(inputMap.values());
};
