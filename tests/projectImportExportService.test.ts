import { describe, expect, it } from 'vitest';

import {
  applyImportedProjectVariableTable,
  buildBakedProjectExport,
  buildProjectVariableTableExport,
  mergeImportedData,
} from '../services/projectImportExportService';
import type { ModelCatalogItem, Project, Template } from '../types';

const modelCatalog: ModelCatalogItem[] = [
  {
    id: 'model-1',
    label: 'GPT 4.1',
    providerConfigId: 'provider-1',
    modelName: 'gpt-4.1',
    enabled: true,
  },
];

const template: Template = {
  id: 'template-1',
  name: 'Template 1',
  inputs: [{ id: 'topic', label: 'Topic' }],
  steps: [
    {
      id: 'step-1',
      name: 'Step 1',
      content: 'Outline {{topic}}',
      outputBinding: {
        variableKey: 'outline',
        variableLabel: 'Outline',
      },
      execution: {
        systemPrompt: '',
      },
    },
  ],
};

const project: Project = {
  id: 'project-1',
  templateId: 'template-1',
  name: 'Project/One',
  createdAt: 1,
  lastModifiedAt: 2,
  inputValues: { topic: 'Forest city', local_1: 'Side note' },
  customInputs: [{ id: 'local_1', label: 'Local 1' }],
  stepOutputs: { 'step-1': 'Rendered output' },
  stepOutputMeta: {},
  stepRunLogs: {},
  stepOverrides: {},
  variables: [
    {
      id: 'var-topic',
      key: 'topic',
      label: 'Topic',
      value: 'Forest city',
      sourceType: 'template_input',
      sourceRef: 'topic',
      createdAt: 1,
      updatedAt: 1,
    },
  ],
};

describe('projectImportExportService', () => {
  it('builds project variable table exports for json and csv', () => {
    const jsonExport = buildProjectVariableTableExport({
      project,
      template,
      format: 'json',
    });
    const csvExport = buildProjectVariableTableExport({
      project,
      template,
      format: 'csv',
    });

    expect(jsonExport.filename).toBe('Project_One_variables.json');
    expect(jsonExport.mimeType).toBe('application/json');
    expect(jsonExport.content).toContain('"project_name": "Project/One"');
    expect(csvExport.filename).toBe('Project_One_variables.csv');
    expect(csvExport.mimeType).toBe('text/csv');
    expect(csvExport.content).toContain('project_name');
  });

  it('applies imported variable table values and creates missing local inputs', () => {
    const content = JSON.stringify([
      {
        project_name: 'Imported Project',
        Topic: 'Updated topic',
        'local.LocalMissing': 'Fresh local value',
      },
    ]);

    const updates = applyImportedProjectVariableTable({
      project,
      template,
      content,
    });

    expect(updates.name).toBe('Imported Project');
    expect(updates.inputValues).toEqual(
      expect.objectContaining({
        topic: 'Updated topic',
      })
    );
    expect(updates.customInputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'LocalMissing' }),
      ])
    );
  });

  it('builds baked exports and merges imported projects/templates', () => {
    const baked = buildBakedProjectExport({ project, template });
    const merged = mergeImportedData({
      existingProjects: [project],
      existingTemplates: [template],
      newProjects: [{ ...project, id: 'project-2', name: 'Project 2' }],
      newTemplates: [{ ...template, id: 'template-2', name: 'Template 2' }],
      modelCatalog,
    });

    expect(baked.filename).toBe('Project/One_baked.txt');
    expect(baked.content).toContain('### Step 1');
    expect(baked.content).toContain('Outline Forest city');
    expect(merged.templates).toHaveLength(2);
    expect(merged.projects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'project-2', name: 'Project 2' }),
      ])
    );
  });
});
