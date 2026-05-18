import { LEGACY_MODEL_PRESET_MAP } from '../domain/templateDomain';
import type { ImportMigrationReport, ImportWarningItem, ModelCatalogItem } from '../types';
import type { ImportDetectionResult } from './importDetectionService';

export interface ImportedBackupBundle {
  projects: any[];
  templates: any[];
  version?: string;
  exportDate?: string;
}

export interface MigratedImportBundle {
  bundle: ImportedBackupBundle;
  report: ImportMigrationReport;
}

const isObject = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null;

const cloneUnknown = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const ensureArray = <T>(value: T[] | undefined) => (Array.isArray(value) ? value : []);
const pushWarning = (warnings: ImportWarningItem[], warning: ImportWarningItem) => warnings.push(warning);

const coerceToBackupBundle = (raw: unknown, detection: ImportDetectionResult): ImportedBackupBundle => {
  if (detection.kind === 'backup_bundle' && isObject(raw)) {
    return {
      projects: ensureArray(raw.projects as any[]),
      templates: ensureArray(raw.templates as any[]),
      version: typeof raw.version === 'string' ? raw.version : undefined,
      exportDate: typeof raw.exportDate === 'string' ? raw.exportDate : undefined,
    };
  }
  if (detection.kind === 'projects_array' && Array.isArray(raw)) {
    return { projects: cloneUnknown(raw), templates: [], version: undefined };
  }
  if (detection.kind === 'templates_array' && Array.isArray(raw)) {
    return { projects: [], templates: cloneUnknown(raw), version: undefined };
  }
  throw new Error('不支持的导入数据结构。');
};

export function migrateImportBundle(
  raw: unknown,
  detection: ImportDetectionResult,
  modelCatalog: ModelCatalogItem[],
  encoding: ImportMigrationReport['encoding']
): MigratedImportBundle {
  const bundle = coerceToBackupBundle(raw, detection);
  const warnings: ImportWarningItem[] = [];
  const appliedMigrations: string[] = [];
  let patchedFieldCount = 0;
  let unmappedModelRefCount = 0;

  if (detection.version === 'legacy-unknown') {
    bundle.version = '2.0';
    appliedMigrations.push('legacy-unknown -> 2.0');
    pushWarning(warnings, {
      code: 'legacy_version',
      level: 'info',
      message: '检测到该备份缺少版本号，已按 2.0 旧备份规则迁移。',
    });
  }

  if (bundle.version === '2.0') {
    appliedMigrations.push('2.0 -> 2.1');

    bundle.projects = bundle.projects.map((project) => {
      const next = isObject(project) ? { ...project } : project;
      if (!Array.isArray(next.customInputs)) {
        next.customInputs = [];
        patchedFieldCount += 1;
      }
      if (!isObject(next.stepOutputs)) {
        next.stepOutputs = {};
        patchedFieldCount += 1;
      }
      if (!isObject(next.stepStructuredOutputs)) {
        next.stepStructuredOutputs = {};
        patchedFieldCount += 1;
      }
      if (!Array.isArray(next.variableTables)) {
        next.variableTables = [];
        patchedFieldCount += 1;
      }
      if (!isObject(next.stepOutputMeta)) {
        next.stepOutputMeta = {};
        patchedFieldCount += 1;
      }
      if (!isObject(next.stepRunLogs)) {
        next.stepRunLogs = {};
        patchedFieldCount += 1;
      }
      if (!isObject(next.stepOverrides)) {
        next.stepOverrides = {};
        patchedFieldCount += 1;
      }
      if (!Array.isArray(next.variables)) {
        next.variables = [];
        patchedFieldCount += 1;
      }
      if (typeof next.lastOpenedAt !== 'number') {
        next.lastOpenedAt = next.lastModifiedAt || next.createdAt || Date.now();
        patchedFieldCount += 1;
      }
      return next;
    });

    bundle.templates = bundle.templates.map((template) => {
      const next = isObject(template) ? { ...template } : template;

      if (!Array.isArray(next.modelRefs)) {
        next.modelRefs = [];
        patchedFieldCount += 1;
      }

      next.modelRefs = next.modelRefs.map((modelRef: any) => {
        const nextModelRef = isObject(modelRef) ? { ...modelRef } : modelRef;
        const mappedId =
          nextModelRef?.modelCatalogItemId || LEGACY_MODEL_PRESET_MAP[nextModelRef?.presetId || ''];

        if (!nextModelRef?.modelCatalogItemId && mappedId) {
          nextModelRef.modelCatalogItemId = mappedId;
          patchedFieldCount += 1;
        }

        if (
          nextModelRef?.modelCatalogItemId &&
          !modelCatalog.some((item) => item.id === nextModelRef.modelCatalogItemId)
        ) {
          unmappedModelRefCount += 1;
          pushWarning(warnings, {
            code: 'unmapped_model_ref',
            level: 'warning',
            message: `模板“${next.name || next.id || '未知模板'}”存在未映射模型引用，请手动检查。`,
          });
        }

        return nextModelRef;
      });

      if (Array.isArray(next.steps)) {
        next.steps = next.steps.map((step: any) => {
          const nextStep = isObject(step) ? { ...step } : step;
          if (!Array.isArray(nextStep.structuredOutputFields)) {
            nextStep.structuredOutputFields = [];
            patchedFieldCount += 1;
          }
          if (!Array.isArray(nextStep.structuredOutputBindings)) {
            nextStep.structuredOutputBindings = [];
            patchedFieldCount += 1;
          }
          if (!isObject(nextStep.outputBinding)) {
            nextStep.outputBinding = {};
            patchedFieldCount += 1;
          }
          if (!isObject(nextStep.execution)) {
            nextStep.execution = { systemPrompt: '' };
            patchedFieldCount += 1;
          } else if (typeof nextStep.execution.systemPrompt !== 'string') {
            nextStep.execution = { ...nextStep.execution, systemPrompt: '' };
            patchedFieldCount += 1;
          }
          return nextStep;
        });
      }
      return next;
    });

    if (patchedFieldCount > 0) {
      pushWarning(warnings, {
        code: 'patched_missing_fields',
        level: 'info',
        message: `已自动补齐 ${patchedFieldCount} 个旧版本缺失字段。`,
      });
    }
  }

  const templateIds = new Set(
    bundle.templates
      .filter((template) => isObject(template) && typeof template.id === 'string')
      .map((template) => String(template.id))
  );

  const orphanProjectCount = bundle.projects.filter(
    (project) =>
      isObject(project) &&
      typeof project.templateId === 'string' &&
      !templateIds.has(project.templateId)
  ).length;

  if (orphanProjectCount > 0) {
    pushWarning(warnings, {
      code: 'orphan_project',
      level: 'warning',
      message: `检测到 ${orphanProjectCount} 个孤儿项目（引用模板缺失）。`,
    });
  }

  if (encoding === 'gb18030') {
    pushWarning(warnings, {
      code: 'encoding_fallback',
      level: 'info',
      message: 'UTF-8 解码可读性较差，已回退为 GB18030 解码。',
    });
  }

  return {
    bundle,
    report: {
      fromVersion: detection.version,
      toVersion: '2.1',
      detectedKind: detection.kind,
      encoding,
      appliedMigrations,
      warnings,
      stats: {
        projectCount: bundle.projects.length,
        templateCount: bundle.templates.length,
        orphanProjectCount,
        suspiciousTextCount: 0,
        patchedFieldCount,
        unmappedModelRefCount,
      },
      allowForceImport: false,
    },
  };
}
