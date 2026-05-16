import type { ImportPayloadKind } from '../types';

export interface ImportDetectionResult {
  kind: ImportPayloadKind;
  version: string | 'legacy-unknown';
  warnings: string[];
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const looksLikeProject = (value: unknown) =>
  isObject(value) &&
  typeof value.id === 'string' &&
  typeof value.templateId === 'string' &&
  typeof value.name === 'string';

const looksLikeTemplate = (value: unknown) =>
  isObject(value) &&
  typeof value.id === 'string' &&
  typeof value.name === 'string' &&
  Array.isArray(value.inputs) &&
  Array.isArray(value.steps);

const looksLikeVariableTableRow = (value: unknown) =>
  isObject(value) &&
  Object.keys(value).some((key) => ['project_name', 'template_name'].includes(key));

export function detectImportPayload(raw: unknown): ImportDetectionResult {
  if (isObject(raw) && Array.isArray(raw.projects) && Array.isArray(raw.templates)) {
    return {
      kind: 'backup_bundle',
      version: typeof raw.version === 'string' ? raw.version : 'legacy-unknown',
      warnings: [],
    };
  }

  if (Array.isArray(raw) && raw.every(looksLikeProject)) {
    return {
      kind: 'projects_array',
      version: 'legacy-unknown',
      warnings: ['检测到仅包含项目数组，未包含模板数组。'],
    };
  }

  if (Array.isArray(raw) && raw.every(looksLikeTemplate)) {
    return {
      kind: 'templates_array',
      version: 'legacy-unknown',
      warnings: ['检测到仅包含模板数组，未包含项目数组。'],
    };
  }

  if (Array.isArray(raw) && raw.every(looksLikeVariableTableRow)) {
    return {
      kind: 'project_variable_table',
      version: 'legacy-unknown',
      warnings: ['检测到变量表数据，不是全量备份。'],
    };
  }

  return {
    kind: 'unknown',
    version: 'legacy-unknown',
    warnings: ['无法识别导入结构。'],
  };
}
