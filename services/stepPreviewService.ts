import {
  Project,
  ProjectVariableTableColumn,
  ProjectVariableTableRow,
  ProjectVariableTableValue,
  StepVariableInput,
  StepVariableOutput,
  Template,
  TemplateStep,
  VariableValueType,
} from '../types';
import { resolveConnectedValueByKey, resolveTextValueByKey } from './stepConnectionValueService';
import { getStepInputs, getStepOutputs, normalizePortValueType } from './stepVariablePortsService';

export interface TablePreviewSummary {
  columns: ProjectVariableTableColumn[];
  rows: ProjectVariableTableRow[];
  totalRows: number;
}

export interface StepInputPreviewItem {
  key: string;
  label: string;
  type: VariableValueType;
  sourceLabel?: string;
  missing: boolean;
  value: string;
  table?: TablePreviewSummary;
  selectedRow?: {
    rowNumber: number;
    row?: ProjectVariableTableRow;
    missing: boolean;
    message?: string;
  };
}

export interface StepOutputPreviewItem {
  key: string;
  label: string;
  type: VariableValueType;
  missing: boolean;
  value: string;
  table?: TablePreviewSummary;
}

const TABLE_PREVIEW_ROW_LIMIT = 3;

const makeTablePreview = (table: ProjectVariableTableValue): TablePreviewSummary => ({
  columns: table.columns,
  rows: table.rows.slice(0, TABLE_PREVIEW_ROW_LIMIT),
  totalRows: table.rows.length,
});

const parsePositiveInteger = (value: string): number | undefined => {
  const parsed = Number(value.trim());
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const getCanvasLikeStepInputs = (step: TemplateStep): StepVariableInput[] => {
  if (step.kind === 'table_row') {
    return [
      {
        key: step.tableRow?.tableKey?.trim() || '',
        label: 'table',
        type: 'table',
        portKey: 'table',
      },
    ];
  }
  return getStepInputs(step);
};

const resolveTableRowSelection = (
  project: Project,
  template: Template,
  step: TemplateStep,
  table?: ProjectVariableTableValue
): StepInputPreviewItem['selectedRow'] | undefined => {
  if (step.kind !== 'table_row') return undefined;

  const raw = step.tableRow?.rowIndex?.trim() || '1';
  const rowNumber =
    parsePositiveInteger(raw) ??
    parsePositiveInteger(resolveTextValueByKey(raw, project, template, step) || '');

  if (!rowNumber) {
    return {
      rowNumber: 0,
      missing: true,
      message: 'Invalid row number.',
    };
  }

  if (!table) {
    return {
      rowNumber,
      missing: true,
      message: 'Table is missing.',
    };
  }

  const row = table.rows[rowNumber - 1];
  return {
    rowNumber,
    row,
    missing: !row,
    message: row ? undefined : `Row ${rowNumber} is missing.`,
  };
};

export const buildStepInputPreviews = (
  project: Project,
  template: Template,
  step: TemplateStep
): StepInputPreviewItem[] =>
  getCanvasLikeStepInputs(step).map((input) => {
    const key = input.key?.trim() || '';
    const type = normalizePortValueType(input.type);
    const label = input.label || input.portKey || key || 'input';
    const resolved = key
      ? resolveConnectedValueByKey(key, project, template, step)
      : { missing: true as const };
    const table = resolved.tableValue ? makeTablePreview(resolved.tableValue) : undefined;

    return {
      key,
      label,
      type,
      sourceLabel: resolved.sourceLabel,
      missing: !key || resolved.missing,
      value: resolved.value || '',
      table,
      selectedRow: resolveTableRowSelection(project, template, step, resolved.tableValue),
    };
  });

const findOutputVariable = (project: Project, output: StepVariableOutput) =>
  (project.variables || []).find((variable) => variable.key === output.key);

const findLegacyTableOutput = (
  project: Project,
  step: TemplateStep,
  output: StepVariableOutput
): ProjectVariableTableValue | undefined => {
  const table = (project.variableTables || []).find(
    (item) => item.sourceStepId === step.id && item.key === output.key
  );
  if (!table) return undefined;
  return {
    columns: table.columns,
    rows: table.rows,
  };
};

const parseJsonObject = (value: string): Record<string, unknown> | undefined => {
  if (!value.trim()) return undefined;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
};

const normalizeOutputText = (
  project: Project,
  step: TemplateStep,
  output: StepVariableOutput,
  allOutputs: StepVariableOutput[]
) => {
  const variable = findOutputVariable(project, output);
  if (variable && variable.type !== 'table') return variable.value || '';

  const raw = project.stepOutputs?.[step.id] || '';
  if (allOutputs.length <= 1) return raw;

  const parsed = parseJsonObject(raw);
  const rawValue = parsed?.[output.key];
  return rawValue === undefined || rawValue === null
    ? ''
    : typeof rawValue === 'string'
      ? rawValue
      : JSON.stringify(rawValue);
};

export const buildStepOutputPreviews = (
  project: Project,
  step: TemplateStep
): StepOutputPreviewItem[] => {
  const outputs = getStepOutputs(step);
  return outputs.map((output) => {
    const type = normalizePortValueType(output.type);
    const variable = findOutputVariable(project, output);
    const tableValue =
      variable?.type === 'table' && variable.tableValue
        ? variable.tableValue
        : type === 'table'
          ? findLegacyTableOutput(project, step, output)
          : undefined;
    const value = type === 'table'
      ? ''
      : normalizeOutputText(project, step, output, outputs);

    return {
      key: output.key,
      label: output.label || output.key,
      type,
      missing: type === 'table' ? !tableValue : !value.trim(),
      value,
      table: tableValue ? makeTablePreview(tableValue) : undefined,
    };
  });
};
