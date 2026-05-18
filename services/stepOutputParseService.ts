import {
  ProjectVariable,
  ProjectVariableTableRow,
  StepVariableOutput,
} from '../types';
import { parseVariableTableRowsFromResponse } from './variableTableService.runtime';

const JSON_FENCE_PATTERN = /```(?:json)?\s*([\s\S]*?)```/i;

const extractJsonObjectText = (value: string): string => {
  const trimmed = value.trim();
  const fenced = trimmed.match(JSON_FENCE_PATTERN);
  if (fenced?.[1]) return fenced[1].trim();

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
};

const normalizeCellValue = (value: unknown): string => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
};

const normalizeTextValue = (value: unknown): string => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
};

export const shouldParseStepOutputsDirectly = (outputs: StepVariableOutput[]) =>
  outputs.length > 1 || outputs.some((output) => output.type === 'table');

export const parseStepOutputVariablesFromResponse = ({
  responseText,
  outputs,
  stepId,
  existingVariables = [],
  now = Date.now(),
}: {
  responseText: string;
  outputs: StepVariableOutput[];
  stepId: string;
  existingVariables?: ProjectVariable[];
  now?: number;
}): ProjectVariable[] => {
  if (outputs.length === 1 && outputs[0].type === 'text') {
    const output = outputs[0];
    const previous = existingVariables.find(
      (variable) => variable.sourceType === 'step_output' && variable.sourceRef === stepId
    );
    return [
      {
        id: previous?.id || `var_step_${stepId}_${output.key}`,
        key: output.key,
        label: output.label || output.key,
        type: 'text',
        value: responseText,
        sourceType: 'step_output',
        sourceRef: stepId,
        createdAt: previous?.createdAt || now,
        updatedAt: now,
      },
    ];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObjectText(responseText));
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Step output parse returned invalid JSON: ${error.message}`
        : 'Step output parse returned invalid JSON.'
    );
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Step output parse must return a JSON object keyed by output variable key.');
  }

  const source = parsed as Record<string, unknown>;
  return outputs.map((output) => {
    const sourceRef = outputs.length === 1 ? stepId : `${stepId}:${output.key}`;
    const previous = existingVariables.find(
      (variable) =>
        variable.sourceType === 'step_output' &&
        (variable.sourceRef === sourceRef || (variable.sourceRef === stepId && variable.key === output.key))
    );

    if (output.type === 'table') {
      const rawTable = source[output.key];
      if (rawTable !== undefined && !Array.isArray(rawTable)) {
        throw new Error(`Table output "${output.key}" must be an array.`);
      }
      const rawRows = Array.isArray(rawTable) ? rawTable : [];

      const columns = output.tableSchema?.columns || [];
      const rows = rawRows.map<ProjectVariableTableRow>((rawRow, index) => {
        if (!rawRow || typeof rawRow !== 'object' || Array.isArray(rawRow)) {
          throw new Error(`Table output "${output.key}" row ${index + 1} is not an object.`);
        }
        const row = rawRow as Record<string, unknown>;
        return {
          id: previous?.tableValue?.rows[index]?.id || `row_${stepId}_${output.key}_${index + 1}`,
          cells: columns.reduce<Record<string, string>>((cells, column) => {
            cells[column.key] = normalizeCellValue(row[column.key]);
            return cells;
          }, {}),
        };
      });

      return {
        id: previous?.id || `var_step_${stepId}_${output.key}`,
        key: output.key,
        label: output.label || output.key,
        type: 'table',
        value: '',
        tableValue: { columns, rows },
        sourceType: 'step_output',
        sourceRef,
        createdAt: previous?.createdAt || now,
        updatedAt: now,
      };
    }

    return {
      id: previous?.id || `var_step_${stepId}_${output.key}`,
      key: output.key,
      label: output.label || output.key,
      type: 'text',
      value: normalizeTextValue(source[output.key]),
      sourceType: 'step_output',
      sourceRef,
      createdAt: previous?.createdAt || now,
      updatedAt: now,
    };
  });
};

export const parseSingleTableOutputRowsFromResponse = ({
  responseText,
  output,
}: {
  responseText: string;
  output: StepVariableOutput;
}) =>
  parseVariableTableRowsFromResponse({
    responseText,
    columns: output.tableSchema?.columns || [],
  });
