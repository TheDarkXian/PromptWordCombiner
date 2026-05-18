import { ProducerRunResultItem, Project, Template } from '../types';

export type BatchResultExportFormat = 'csv' | 'json';
export type BatchResultExportFilter = 'all' | 'success' | 'error' | 'skipped' | 'blocked';

interface BuildBatchResultExportParams {
  project: Project;
  template: Template;
  results: ProducerRunResultItem[];
  format: BatchResultExportFormat;
  filter: BatchResultExportFilter;
}

type BatchResultExportRecord = Record<string, string>;

const normalizeFilterResults = (
  results: ProducerRunResultItem[],
  filter: BatchResultExportFilter
) => {
  if (filter === 'all') return results;
  return results.filter((item) =>
    filter === 'skipped'
      ? item.status === 'skipped' || item.status === 'stopped'
      : item.status === filter
  );
};

const escapeCsvCell = (value: string) => {
  const normalized = String(value ?? '');
  if (!/[",\n\r]/.test(normalized)) {
    return normalized;
  }
  return `"${normalized.replace(/"/g, '""')}"`;
};

const toCsv = (records: BatchResultExportRecord[]) => {
  if (records.length === 0) {
    return '';
  }

  const keys = Array.from(
    records.reduce((set, record) => {
      Object.keys(record).forEach((key) => set.add(key));
      return set;
    }, new Set<string>())
  );

  const header = keys.join(',');
  const rows = records.map((record) =>
    keys.map((key) => escapeCsvCell(record[key] || '')).join(',')
  );

  return [header, ...rows].join('\n');
};

const buildTimestamp = () => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
    now.getHours()
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
};

const buildRecords = ({
  project,
  template,
  results,
  filter,
}: Omit<BuildBatchResultExportParams, 'format'>): BatchResultExportRecord[] => {
  const filteredResults = normalizeFilterResults(results, filter);

  return filteredResults.map((item) => {
    const step = template.steps.find((candidate) => candidate.id === item.stepId);
    const structuredFields = step?.structuredOutputFields || [];
    const structuredValues = project.stepStructuredOutputs?.[item.stepId] || {};

    const record: BatchResultExportRecord = {
      project_id: project.id,
      project_name: project.name,
      template_id: template.id,
      template_name: template.name,
      step_id: item.stepId,
      step_name: item.stepName,
      result_status: item.status,
      result_message: item.message,
      step_output_raw: project.stepOutputs[item.stepId] || '',
    };

    structuredFields.forEach((field) => {
      record[`field.${field.key}`] = structuredValues[field.key] || '';
    });

    const variableTable = (project.variableTables || []).find(
      (table) => table.sourceStepId === item.stepId
    );
    variableTable?.rows.forEach((row, rowIndex) => {
      variableTable.columns.forEach((column) => {
        record[`table.${variableTable.key}[${rowIndex}].${column.key}`] =
          row.cells[column.key] || '';
      });
    });

    return record;
  });
};

export const buildBatchResultExport = ({
  project,
  template,
  results,
  format,
  filter,
}: BuildBatchResultExportParams) => {
  const records = buildRecords({ project, template, results, filter });
  const timestamp = buildTimestamp();

  if (format === 'json') {
    return {
      filename: `producer-run-results-${timestamp}.json`,
      content: JSON.stringify(records, null, 2),
      mimeType: 'application/json',
    };
  }

  return {
    filename: `producer-run-results-${timestamp}.csv`,
    content: toCsv(records),
    mimeType: 'text/csv',
  };
};
