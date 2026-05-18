import { normalizeProject } from '../domain/projectDomain';
import { normalizeTemplate } from '../domain/templateDomain';
import type {
  ImportMigrationReport,
  ImportWarningItem,
  ModelCatalogItem,
  PreparedImportBundle,
  Project,
  Template,
} from '../types';
import { validateBackupBundle } from './schemas';
import { detectImportPayload } from './importDetectionService';
import { decodeImportText } from './importEncodingService';
import { migrateImportBundle } from './importMigrationService';

const truncatePreview = (value: string, maxLength = 100) =>
  value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;

const SUSPICIOUS_GARBLED_REGEX = /(?:�|锟|Ã.|æ|å|ç|é|ö|ñ){2,}|(?:娑|鎴|妯|瀵煎叆|鐗堟湰){2,}/;

const collectSuspiciousWarnings = (projects: Project[], templates: Template[]): ImportWarningItem[] => {
  const warnings: ImportWarningItem[] = [];

  const scanText = (value: unknown, fieldPath: string) => {
    if (typeof value !== 'string' || !value.trim()) return;
    if (!SUSPICIOUS_GARBLED_REGEX.test(value)) return;
    warnings.push({
      code: 'suspicious_garbled_text',
      level: 'warning',
      message: `字段疑似乱码：${fieldPath}`,
      fieldPath,
      preview: truncatePreview(value),
    });
  };

  templates.forEach((template, templateIndex) => {
    scanText(template.name, `templates[${templateIndex}].name`);
    template.inputs.forEach((input, inputIndex) =>
      scanText(input.label, `templates[${templateIndex}].inputs[${inputIndex}].label`)
    );
    template.steps.forEach((step, stepIndex) => {
      scanText(step.name, `templates[${templateIndex}].steps[${stepIndex}].name`);
      scanText(step.content, `templates[${templateIndex}].steps[${stepIndex}].content`);
    });
  });

  projects.forEach((project, projectIndex) => {
    scanText(project.name, `projects[${projectIndex}].name`);
    Object.entries(project.inputValues).forEach(([key, value]) =>
      scanText(value, `projects[${projectIndex}].inputValues.${key}`)
    );
    project.variables.forEach((variable, variableIndex) => {
      scanText(variable.label, `projects[${projectIndex}].variables[${variableIndex}].label`);
      scanText(variable.value, `projects[${projectIndex}].variables[${variableIndex}].value`);
    });
  });

  return warnings;
};

const summarizeValidationError = (error: string) => {
  if (error.includes('Required')) {
    return `迁移后数据仍缺少必填字段：${error}`;
  }
  return error;
};

export const buildImportReportText = (report: ImportMigrationReport) => {
  const lines = [
    `导入报告`,
    `- 类型：${report.detectedKind}`,
    `- 版本迁移：${report.fromVersion} -> ${report.toVersion}`,
    `- 编码：${report.encoding}`,
    `- 数量：模板 ${report.stats.templateCount}，项目 ${report.stats.projectCount}`,
    `- 补齐字段：${report.stats.patchedFieldCount}`,
    `- 风险项：${report.warnings.length}`,
    `- 孤儿项目：${report.stats.orphanProjectCount}`,
    `- 未映射模型引用：${report.stats.unmappedModelRefCount}`,
  ];

  if (report.appliedMigrations.length > 0) {
    lines.push(`- 已执行迁移：${report.appliedMigrations.join('、')}`);
  }
  if (report.warnings.length > 0) {
    lines.push('', '风险详情:');
    report.warnings.forEach((warning, index) => {
      lines.push(`${index + 1}. [${warning.level}] ${warning.message}`);
      if (warning.fieldPath) lines.push(`   字段：${warning.fieldPath}`);
      if (warning.preview) lines.push(`   预览：${warning.preview}`);
    });
  }

  return lines.join('\n');
};

export function prepareImportedBackupBundle(
  input: Uint8Array | string,
  modelCatalog: ModelCatalogItem[]
): PreparedImportBundle {
  const decoded = decodeImportText(input);
  let raw: unknown;

  try {
    raw = JSON.parse(decoded.text);
  } catch {
    throw new Error('文件无法解析为有效 JSON。');
  }

  const detection = detectImportPayload(raw);

  if (detection.kind === 'project_variable_table') {
    throw new Error('当前入口仅支持全量备份导入，不支持表变量文件。');
  }
  if (detection.kind === 'unknown') {
    throw new Error('无法识别文件结构，这不是可导入的全量备份文件。');
  }

  const migrated = migrateImportBundle(raw, detection, modelCatalog, decoded.encoding);
  const validation = validateBackupBundle(migrated.bundle);
  if (validation.valid === false) {
    throw new Error(summarizeValidationError(validation.error));
  }

  const normalizedTemplates = (validation.data.templates as Template[]).map((template) =>
    normalizeTemplate(template, modelCatalog)
  );
  const normalizedProjects = (validation.data.projects as Project[]).map((project) =>
    normalizeProject(project, normalizedTemplates)
  );
  const suspiciousWarnings = collectSuspiciousWarnings(normalizedProjects, normalizedTemplates);
  migrated.report.warnings.push(...suspiciousWarnings);
  migrated.report.stats.suspiciousTextCount = suspiciousWarnings.length;
  migrated.report.allowForceImport =
    suspiciousWarnings.length > 0 || migrated.report.stats.orphanProjectCount > 0;

  return {
    projects: normalizedProjects,
    templates: normalizedTemplates,
    report: migrated.report,
  };
}
