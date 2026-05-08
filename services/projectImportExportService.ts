import { buildProjectVariableTableRow, parseProjectVariableTable, stringifyRowsAsCsv } from './variableTableService';
import { normalizeProject } from '../domain/projectDomain';
import { normalizeTemplate } from '../domain/templateDomain';
import { createInterpolator } from './interpolationService';
import { ModelCatalogItem, Project, Template } from '../types';

export const buildProjectVariableTableExport = ({
  project,
  template,
  format,
}: {
  project: Project;
  template: Template;
  format: 'json' | 'csv';
}) => {
  const row = buildProjectVariableTableRow(project, template);
  const safeName = project.name.replace(/[\\/:*?"<>|]+/g, '_');

  if (format === 'json') {
    return {
      filename: `${safeName}_variables.json`,
      content: JSON.stringify([row], null, 2),
      mimeType: 'application/json',
    };
  }

  return {
    filename: `${safeName}_variables.csv`,
    content: stringifyRowsAsCsv([row]),
    mimeType: 'text/csv',
  };
};

export const applyImportedProjectVariableTable = ({
  project,
  template,
  content,
}: {
  project: Project;
  template: Template;
  content: string;
}): Partial<Project> => {
  const parsed = parseProjectVariableTable(content, template);
  const nextInputValues = { ...project.inputValues };
  const nextCustomInputs = [...(project.customInputs || [])];
  const localInputMap = new Map(nextCustomInputs.map((input) => [input.label, input]));

  template.inputs.forEach((input) => {
    if (Object.prototype.hasOwnProperty.call(parsed.templateInputValues, input.label)) {
      nextInputValues[input.id] = parsed.templateInputValues[input.label];
    }
  });

  Object.entries(parsed.localVariableValues).forEach(([label, value], index) => {
    let localInput = localInputMap.get(label);
    if (!localInput) {
      localInput = { id: `local_${Date.now()}_${index}`, label };
      localInputMap.set(label, localInput);
      nextCustomInputs.push(localInput);
    }
    nextInputValues[localInput.id] = value;
  });

  return {
    name: parsed.projectName?.trim() || project.name,
    customInputs: nextCustomInputs,
    inputValues: nextInputValues,
  };
};

export const buildBakedProjectExport = ({
  project,
  template,
}: {
  project: Project;
  template: Template;
}) => {
  const interpolate = createInterpolator(project, template);
  let fullText = `Project: ${project.name}\nExported At: ${new Date().toLocaleString()}\n\n`;
  template.steps.forEach((step) => {
    const override = project.stepOverrides[step.id];
    const rawContent =
      override?.content !== undefined ? override.content : step.content || '';
    fullText += `### ${step.name}\n${interpolate(rawContent)}\n\n`;
  });
  return {
    filename: `${project.name}_baked.txt`,
    content: fullText,
  };
};

export const mergeImportedData = ({
  existingProjects,
  existingTemplates,
  newProjects,
  newTemplates,
  modelCatalog,
}: {
  existingProjects: Project[];
  existingTemplates: Template[];
  newProjects: Project[];
  newTemplates: Template[];
  modelCatalog: ModelCatalogItem[];
}) => {
  const normalizedTemplates = newTemplates.map((template) =>
    normalizeTemplate(template, modelCatalog)
  );
  const mergedTemplates = [...existingTemplates];
  normalizedTemplates.forEach((nextTemplate) => {
    const index = mergedTemplates.findIndex((template) => template.id === nextTemplate.id);
    if (index >= 0) mergedTemplates[index] = nextTemplate;
    else mergedTemplates.push(nextTemplate);
  });

  const mergedProjects = [...existingProjects];
  newProjects.forEach((nextProject) => {
    const normalizedProject = normalizeProject(nextProject, mergedTemplates);
    const index = mergedProjects.findIndex((project) => project.id === normalizedProject.id);
    if (index >= 0) mergedProjects[index] = normalizedProject;
    else mergedProjects.push(normalizedProject);
  });

  return {
    projects: mergedProjects,
    templates: mergedTemplates,
  };
};
