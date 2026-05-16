import { describe, expect, it } from 'vitest';

import { buildImportReportText, prepareImportedBackupBundle } from '../services/importCompatibilityService';
import type { ModelCatalogItem } from '../types';

const modelCatalog: ModelCatalogItem[] = [
  {
    id: 'model_openai_gpt_4_1',
    label: 'GPT-4.1',
    providerConfigId: 'provider-1',
    modelName: 'gpt-4.1',
    enabled: true,
  },
];

describe('importCompatibilityService', () => {
  it('passes through valid 2.1 bundles', () => {
    const prepared = prepareImportedBackupBundle(
      JSON.stringify({
        version: '2.1',
        projects: [
          {
            id: 'project-1',
            templateId: 'template-1',
            name: 'Project',
            createdAt: 1,
            lastModifiedAt: 2,
            inputValues: {},
            customInputs: [],
            stepOutputs: {},
            stepStructuredOutputs: {},
            stepOutputMeta: {},
            stepRunLogs: {},
            stepOverrides: {},
            variables: [],
          },
        ],
        templates: [{ id: 'template-1', name: 'Template', inputs: [], steps: [] }],
      }),
      modelCatalog
    );
    expect(prepared.report.fromVersion).toBe('2.1');
    expect(prepared.report.toVersion).toBe('2.1');
  });

  it('migrates legacy unknown version through 2.0 to 2.1', () => {
    const prepared = prepareImportedBackupBundle(
      JSON.stringify({
        projects: [
          {
            id: 'project-1',
            templateId: 'template-1',
            name: 'Legacy Project',
            createdAt: 1,
            lastModifiedAt: 2,
            inputValues: {},
          },
        ],
        templates: [
          {
            id: 'template-1',
            name: 'Legacy Template',
            inputs: [],
            modelRefs: [{ id: 'ref-1', label: 'Legacy Ref', presetId: 'openai:gpt-4.1' }],
            steps: [{ id: 'step-1', name: 'Step 1', content: 'content' }],
          },
        ],
      }),
      modelCatalog
    );

    expect(prepared.report.fromVersion).toBe('legacy-unknown');
    expect(prepared.report.appliedMigrations).toEqual(['legacy-unknown -> 2.0', '2.0 -> 2.1']);
    expect(prepared.projects[0].stepRunLogs).toEqual({});
    expect(prepared.projects[0].stepStructuredOutputs).toEqual({});
    expect(prepared.templates[0].modelRefs?.[0].modelCatalogItemId).toBe('model_openai_gpt_4_1');
  });

  it('warns orphan project and allows force import', () => {
    const prepared = prepareImportedBackupBundle(
      JSON.stringify({
        version: '2.0',
        projects: [
          {
            id: 'project-1',
            templateId: 'missing-template',
            name: 'Orphan Project',
            createdAt: 1,
            lastModifiedAt: 2,
            inputValues: {},
          },
        ],
        templates: [],
      }),
      modelCatalog
    );
    expect(prepared.report.stats.orphanProjectCount).toBe(1);
    expect(prepared.report.allowForceImport).toBe(true);
  });

  it('warns unmapped model refs but does not reject import', () => {
    const prepared = prepareImportedBackupBundle(
      JSON.stringify({
        version: '2.0',
        projects: [],
        templates: [
          {
            id: 'template-1',
            name: 'Template',
            inputs: [],
            modelRefs: [{ id: 'ref-1', label: 'Unknown', modelCatalogItemId: 'not-exists' }],
            steps: [{ id: 'step-1', name: 'Step 1', content: 'content' }],
          },
        ],
      }),
      modelCatalog
    );
    expect(prepared.report.stats.unmappedModelRefCount).toBe(1);
    expect(prepared.templates).toHaveLength(1);
  });

  it('rejects unknown payload shape', () => {
    expect(() => prepareImportedBackupBundle(JSON.stringify({ foo: 'bar' }), modelCatalog)).toThrow(
      '无法识别文件结构'
    );
  });

  it('builds chinese report text', () => {
    const prepared = prepareImportedBackupBundle(
      JSON.stringify({
        version: '2.0',
        projects: [],
        templates: [],
      }),
      modelCatalog
    );
    const text = buildImportReportText(prepared.report);
    expect(text).toContain('导入报告');
    expect(text).toContain('版本迁移');
  });
});
