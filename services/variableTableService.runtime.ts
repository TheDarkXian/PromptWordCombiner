import {
  Project,
  ProjectVariable,
  ProjectVariableTable,
  ProjectVariableTableColumn,
  ProjectVariableTableRow,
  Template,
  TemplateStep,
} from '../types';

const TABLE_REFERENCE_PATTERN = /^(.+)\[(\d+)\]\.([^.[\]]+)$/;
const JSON_FENCE_PATTERN = /```(?:json)?\s*([\s\S]*?)```/i;

const extractJsonValueText = (value: string): string => {
  const trimmed = value.trim();
  const fenced = trimmed.match(JSON_FENCE_PATTERN);
  if (fenced?.[1]) return fenced[1].trim();

  const firstObjectBrace = trimmed.indexOf('{');
  const lastObjectBrace = trimmed.lastIndexOf('}');
  const firstArrayBracket = trimmed.indexOf('[');
  const lastArrayBracket = trimmed.lastIndexOf(']');

  const objectCandidate =
    firstObjectBrace >= 0 && lastObjectBrace > firstObjectBrace
      ? {
          start: firstObjectBrace,
          end: lastObjectBrace,
        }
      : undefined;
  const arrayCandidate =
    firstArrayBracket >= 0 && lastArrayBracket > firstArrayBracket
      ? {
          start: firstArrayBracket,
          end: lastArrayBracket,
        }
      : undefined;

  const candidate =
    objectCandidate && arrayCandidate
      ? objectCandidate.start < arrayCandidate.start
        ? objectCandidate
        : arrayCandidate
      : objectCandidate || arrayCandidate;

  return candidate ? trimmed.slice(candidate.start, candidate.end + 1) : trimmed;
};

const normalizeUnknownCellValue = (value: unknown): string => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
};

export const getVariableTableKeyForStep = (step: TemplateStep): string =>
  step.outputBinding?.variableKey?.trim() || `table_${step.id}`;

export const getVariableTableLabelForStep = (step: TemplateStep): string =>
  step.outputBinding?.variableLabel?.trim() || step.name || getVariableTableKeyForStep(step);

export const buildVariableTableColumnsForStep = (
  step: TemplateStep
): ProjectVariableTableColumn[] =>
  (step.structuredOutputFields || [])
    .filter((field) => field.key.trim() && field.label.trim())
    .map((field) => ({
      key: field.key.trim(),
      label: field.label.trim(),
      description: field.description?.trim() || undefined,
    }));

export const buildVariableTableIdForStep = (stepId: string): string => `table_step_${stepId}`;

export const buildVariableTableFromStepRows = ({
  step,
  rows,
  previous,
  updatedAt = Date.now(),
}: {
  step: TemplateStep;
  rows: Record<string, string>[];
  previous?: ProjectVariableTable;
  updatedAt?: number;
}): ProjectVariableTable | undefined => {
  const columns = buildVariableTableColumnsForStep(step);
  if (columns.length === 0) return undefined;

  return {
    id: previous?.id || buildVariableTableIdForStep(step.id),
    key: getVariableTableKeyForStep(step),
    label: getVariableTableLabelForStep(step),
    sourceStepId: step.id,
    columns,
    rows: rows.map<ProjectVariableTableRow>((row, index) => ({
      id: previous?.rows[index]?.id || `row_${step.id}_${index + 1}`,
      cells: columns.reduce<Record<string, string>>((cells, column) => {
        cells[column.key] = row[column.key] || '';
        return cells;
      }, {}),
    })),
    updatedAt,
  };
};

export const parseVariableTableRowsFromResponse = ({
  responseText,
  columns,
}: {
  responseText: string;
  columns: ProjectVariableTableColumn[];
}): Record<string, string>[] => {
  const trimmed = extractJsonValueText(responseText);
  let parsed: unknown;

  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Table variable parse returned invalid JSON: ${error.message}`
        : 'Table variable parse returned invalid JSON.'
    );
  }

  const rowsSource =
    Array.isArray(parsed)
      ? parsed
      : parsed &&
          typeof parsed === 'object' &&
          Array.isArray((parsed as { rows?: unknown }).rows)
        ? (parsed as { rows: unknown[] }).rows
        : undefined;

  if (!rowsSource) {
    throw new Error('Table variable parse must return an array or an object with rows.');
  }

  return rowsSource.map((row, rowIndex) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new Error(`Table variable row ${rowIndex + 1} is not an object.`);
    }

    const source = row as Record<string, unknown>;
    return columns.reduce<Record<string, string>>((result, column) => {
      result[column.key] = normalizeUnknownCellValue(source[column.key]);
      return result;
    }, {});
  });
};

export const getTypedVariableTableCellValue = (
  variables: ProjectVariable[] | undefined,
  rawReference: string
): string | undefined => {
  const match = rawReference.trim().match(TABLE_REFERENCE_PATTERN);
  if (!match) return undefined;

  const [, tableKey, rowIndexText, columnKey] = match;
  const variable = (variables || []).find(
    (item) => item.key === tableKey.trim() && item.type === 'table'
  );
  if (!variable) return undefined;

  const row = variable.tableValue?.rows[Number(rowIndexText)];
  if (!row) return '';

  return row.cells[columnKey.trim()] || '';
};

export const getVariableTableCellValue = (
  project: { variableTables?: ProjectVariableTable[]; variables?: ProjectVariable[] },
  rawReference: string
): string | undefined => {
  const match = rawReference.trim().match(TABLE_REFERENCE_PATTERN);
  if (!match) return undefined;

  const typedValue = getTypedVariableTableCellValue(project.variables, rawReference);
  if (typedValue !== undefined) return typedValue;

  const [, tableKey, rowIndexText, columnKey] = match;
  const table = (project.variableTables || []).find((item) => item.key === tableKey.trim());
  if (!table) return '';

  const rowIndex = Number(rowIndexText);
  const row = table.rows[rowIndex];
  if (!row) return '';

  return row.cells[columnKey.trim()] || '';
};

export const mergeVariableTablesForTemplate = (
  project: Pick<Project, 'variableTables' | 'stepStructuredOutputs'>,
  template?: Pick<Template, 'steps'>
): ProjectVariableTable[] => {
  const existing = project.variableTables || [];
  if (!template) return existing;

  const existingByStepId = new Map(
    existing.filter((table) => table.sourceStepId).map((table) => [table.sourceStepId as string, table])
  );
  const stepTableIds = new Set<string>();
  const generatedTables: ProjectVariableTable[] = [];

  template.steps.forEach((step) => {
    const columns = buildVariableTableColumnsForStep(step);
    if (columns.length === 0) return;

    const previous = existingByStepId.get(step.id);
    const existingRows = previous?.rows.map((row) => row.cells) || [];
    const legacyRow = project.stepStructuredOutputs?.[step.id];
    const rows =
      existingRows.length > 0
        ? existingRows
        : legacyRow && columns.some((column) => String(legacyRow[column.key] || '').trim())
          ? [legacyRow]
          : [];

    const table = buildVariableTableFromStepRows({
      step,
      rows,
      previous,
      updatedAt: previous?.updatedAt || Date.now(),
    });
    if (!table) return;
    stepTableIds.add(table.id);
    generatedTables.push(table);
  });

  const manualTables = existing.filter(
    (table) => !table.sourceStepId || !stepTableIds.has(table.id)
  );

  return [...manualTables, ...generatedTables];
};
