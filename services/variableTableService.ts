import { Project, Template, TemplateInput } from '../types';

export const PROJECT_NAME_COLUMN = 'project_name';
export const LOCAL_VARIABLE_PREFIX = 'local.';

export interface ParsedRowsResult {
  format: 'json' | 'csv';
  rows: Record<string, string>[];
}

export interface ParsedProjectVariableTable {
  projectName?: string;
  templateInputValues: Record<string, string>;
  localVariableValues: Record<string, string>;
}

export interface BatchProjectSeed {
  projectName: string;
  inputValues: Record<string, string>;
}

const normalizeCellValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
};

const parseCsvLine = (line: string): string[] => {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map((value) => value.replace(/\r/g, '').trim());
};

const parseCsvRows = (content: string): Record<string, string>[] => {
  const lines = content
    .replace(/^\uFEFF/, '')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== '');

  if (lines.length === 0) {
    throw new Error('表格内容为空。');
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.trim());
  if (headers.length === 0 || headers.every((header) => !header)) {
    throw new Error('CSV 表头为空。');
  }

  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return headers.reduce<Record<string, string>>((record, header, index) => {
      if (!header) return record;
      record[header] = cells[index] ?? '';
      return record;
    }, {});
  });
};

export const parseVariableTableRows = (content: string): ParsedRowsResult => {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error('内容为空。');
  }

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error('JSON 解析失败。');
    }

    const rowsSource = Array.isArray(parsed)
      ? parsed
      : typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as { rows?: unknown[] }).rows)
        ? (parsed as { rows: unknown[] }).rows
        : [parsed];

    const rows = rowsSource.map((row, rowIndex) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        throw new Error(`第 ${rowIndex + 1} 行不是对象。`);
      }
      return Object.entries(row).reduce<Record<string, string>>((record, [key, value]) => {
        record[key] = normalizeCellValue(value);
        return record;
      }, {});
    });

    return { format: 'json', rows };
  }

  return { format: 'csv', rows: parseCsvRows(trimmed) };
};

export const stringifyRowsAsCsv = (rows: Record<string, string>[]) => {
  if (rows.length === 0) return '';

  const headers = Array.from(
    new Set(rows.flatMap((row) => Object.keys(row)))
  );

  const escapeCell = (value: string) => {
    if (/[",\n]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const lines = [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => headers.map((header) => escapeCell(row[header] || '')).join(',')),
  ];

  return lines.join('\n');
};

const labelToValueMap = (inputs: TemplateInput[], inputValues: Record<string, string>) =>
  inputs.reduce<Record<string, string>>((result, input) => {
    result[input.label] = inputValues[input.id] || '';
    return result;
  }, {});

export const buildProjectVariableTableRow = (
  project: Pick<Project, 'name' | 'customInputs' | 'inputValues'>,
  template: Pick<Template, 'inputs'>
): Record<string, string> => {
  const row: Record<string, string> = {
    [PROJECT_NAME_COLUMN]: project.name,
    ...labelToValueMap(template.inputs, project.inputValues),
  };

  (project.customInputs || []).forEach((input) => {
    row[`${LOCAL_VARIABLE_PREFIX}${input.label}`] = project.inputValues[input.id] || '';
  });

  return row;
};

export const parseProjectVariableTable = (
  content: string,
  template: Pick<Template, 'inputs'>
): ParsedProjectVariableTable => {
  const { rows } = parseVariableTableRows(content);
  if (rows.length === 0) {
    throw new Error('没有可导入的数据行。');
  }

  const firstRow = rows[0];
  const templateInputLabels = new Set(template.inputs.map((input) => input.label));
  const templateInputValues: Record<string, string> = {};
  const localVariableValues: Record<string, string> = {};

  Object.entries(firstRow).forEach(([key, value]) => {
    if (key === PROJECT_NAME_COLUMN) return;
    if (key.startsWith(LOCAL_VARIABLE_PREFIX)) {
      const localName = key.slice(LOCAL_VARIABLE_PREFIX.length).trim();
      if (localName) localVariableValues[localName] = value;
      return;
    }
    if (templateInputLabels.has(key)) {
      templateInputValues[key] = value;
    }
  });

  return {
    projectName: firstRow[PROJECT_NAME_COLUMN]?.trim() || undefined,
    templateInputValues,
    localVariableValues,
  };
};

export const parseBatchProjectSeeds = (
  content: string,
  template: Pick<Template, 'name' | 'inputs'>
): BatchProjectSeed[] => {
  const { rows } = parseVariableTableRows(content);
  if (rows.length === 0) {
    throw new Error('没有可批量创建的数据行。');
  }

  return rows.map((row, index) => {
    const inputValues = template.inputs.reduce<Record<string, string>>((result, input) => {
      result[input.id] = row[input.label] || '';
      return result;
    }, {});

    const defaultName = `${template.name} ${index + 1}`;
    const projectName = row[PROJECT_NAME_COLUMN]?.trim() || defaultName;

    return {
      projectName,
      inputValues,
    };
  });
};
