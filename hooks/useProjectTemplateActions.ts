import { Dispatch, SetStateAction, useCallback } from 'react';
import { normalizeProject, syncProjectVariables } from '../domain/projectDomain';
import { normalizeTemplate } from '../domain/templateDomain';
import { parseBatchProjectSeeds } from '../services/variableTableService';
import {
  AppSettings,
  ExecutionPresetModelRefStrategy,
  ExecutionPresetTemplate,
  Project,
  Template,
} from '../types';

interface UseProjectTemplateActionsOptions {
  templates: Template[];
  modelCatalog: AppSettings['modelCatalog'];
  setProjects: Dispatch<SetStateAction<Project[]>>;
  setTemplates: Dispatch<SetStateAction<Template[]>>;
  setSettings: Dispatch<SetStateAction<AppSettings>>;
  openAlert: (title: string, message: string) => void;
  openTab: (id: string) => void;
  setEditingTemplateId: Dispatch<SetStateAction<string | null>>;
}

export const useProjectTemplateActions = ({
  templates,
  modelCatalog,
  setProjects,
  setTemplates,
  setSettings,
  openAlert,
  openTab,
  setEditingTemplateId,
}: UseProjectTemplateActionsOptions) => {
  const updateSettings = useCallback(
    (updates: Partial<AppSettings>) => {
      setSettings((prev) => ({ ...prev, ...updates }));
    },
    [setSettings]
  );

  const saveExecutionPresetTemplate = useCallback(
    (input: {
      id?: string;
      label: string;
      description?: string;
      modelRefStrategy: ExecutionPresetModelRefStrategy;
      modelCatalogItemId?: string;
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
    }) => {
      const now = Date.now();
      const nextPreset: ExecutionPresetTemplate = {
        id: input.id || `execution_preset_${now}`,
        label: input.label.trim() || '新执行模板',
        description: input.description?.trim() || '',
        modelRefStrategy: input.modelRefStrategy,
        modelCatalogItemId:
          input.modelRefStrategy === 'bind_specific_model_catalog_item' ? input.modelCatalogItemId || undefined : undefined,
        temperature: input.temperature,
        maxTokens: input.maxTokens,
        systemPrompt: input.systemPrompt || '',
        enabled: true,
        createdAt: now,
        updatedAt: now,
      };

      setSettings((prev) => {
        const existingIndex = prev.executionPresetTemplates.findIndex((item) => item.id === nextPreset.id);
        if (existingIndex >= 0) {
          const current = prev.executionPresetTemplates[existingIndex];
          const merged: ExecutionPresetTemplate = {
            ...current,
            ...nextPreset,
            enabled: current.enabled,
            createdAt: current.createdAt,
            updatedAt: now,
          };
          const executionPresetTemplates = [...prev.executionPresetTemplates];
          executionPresetTemplates[existingIndex] = merged;
          return { ...prev, executionPresetTemplates };
        }

        return {
          ...prev,
          executionPresetTemplates: [...prev.executionPresetTemplates, nextPreset],
        };
      });
    },
    [setSettings]
  );

  const updateProjectWithSync = useCallback(
    (projectId: string, recipe: (project: Project) => Project) => {
      setProjects((prev) =>
        prev.map((project) => {
          if (project.id !== projectId) return project;
          const updatedProject = recipe(project);
          const template = templates.find((item) => item.id === updatedProject.templateId);
          return {
            ...updatedProject,
            lastModifiedAt: Date.now(),
            variables: syncProjectVariables(updatedProject, template),
          };
        })
      );
    },
    [setProjects, templates]
  );

  const buildProjectFromTemplate = useCallback(
    (template: Template, name: string, inputValuesOverride: Record<string, string> = {}, idSuffix = ''): Project => {
      const now = Date.now();
      const newProjectBase: Project = {
        id: `proj_${now}${idSuffix}`,
        templateId: template.id,
        name: name && name.trim() ? name.trim() : `proj_${now}`,
        createdAt: now,
        lastModifiedAt: now,
        lastOpenedAt: now,
        inputValues: template.inputs.reduce<Record<string, string>>((result, input) => {
          result[input.id] = inputValuesOverride[input.id] ?? input.defaultValue ?? '';
          return result;
        }, {}),
        customInputs: [],
        stepOutputs: {},
        stepOutputMeta: {},
        stepRunLogs: {},
        stepOverrides: {},
        variables: [],
      };

      return {
        ...newProjectBase,
        variables: syncProjectVariables(newProjectBase, template),
      };
    },
    []
  );

  const createProject = useCallback(
    (templateId: string, name: string) => {
      const template = templates.find((item) => item.id === templateId);
      if (!template) return;

      const newProject = buildProjectFromTemplate(template, name);
      setProjects((prev) => [...prev, newProject]);
      openTab(newProject.id);
    },
    [buildProjectFromTemplate, openTab, setProjects, templates]
  );

  const createProjectsFromTable = useCallback(
    (templateId: string, content: string) => {
      const template = templates.find((item) => item.id === templateId);
      if (!template) return;

      try {
        const seeds = parseBatchProjectSeeds(content, template);
        const newProjects = seeds.map((seed, index) =>
          buildProjectFromTemplate(template, seed.projectName, seed.inputValues, `_${index}`)
        );

        if (newProjects.length === 0) {
          openAlert('Cannot create', 'No projects could be created from the imported rows.');
          return;
        }

        setProjects((prev) => [...prev, ...newProjects]);
        openTab(newProjects[0].id);
        openAlert('Batch create complete', `Created ${newProjects.length} projects.`);
      } catch (error) {
        openAlert('Batch create failed', error instanceof Error ? error.message : 'Batch create failed.');
      }
    },
    [buildProjectFromTemplate, openAlert, openTab, setProjects, templates]
  );

  const createTemplate = useCallback(() => {
    const now = Date.now();
    const newId = `tmpl_${now}`;
    const newTemplate: Template = {
      id: newId,
      name: `Template ${templates.length + 1}`,
      inputs: [{ id: `input_${now}_0`, label: 'core_topic' }],
      modelRefs: [],
      steps: [
        {
          id: `step_${now}_0`,
          name: 'Step 1',
          content: 'Write your prompt template here...',
          outputBinding: {},
          execution: {
            modelRefId: undefined,
            systemPrompt: '',
            temperature: undefined,
            maxTokens: undefined,
          },
        },
      ],
    };
    setTemplates((prev) => [...prev, newTemplate]);
    setEditingTemplateId(newId);
  }, [setEditingTemplateId, setTemplates, templates.length]);

  const handleUpdateTemplate = useCallback(
    (id: string, updates: Partial<Template>) => {
      setTemplates((prev) => {
        const nextTemplates = prev.map((template) =>
          template.id === id ? normalizeTemplate({ ...template, ...updates }, modelCatalog) : template
        );
        const changedTemplate = nextTemplates.find((template) => template.id === id);
        if (changedTemplate) {
          setProjects((currentProjects) =>
            currentProjects.map((project) => {
              if (project.templateId !== id) return project;
              return {
                ...project,
                variables: syncProjectVariables(project, changedTemplate),
              };
            })
          );
        }
        return nextTemplates;
      });
    },
    [modelCatalog, setProjects, setTemplates]
  );

  const handleSaveTemplateWithHistory = useCallback(
    (template: Template) => {
      setTemplates((prev) => {
        const existing = prev.find((item) => item.id === template.id);
        const history = existing?.history || [];
        const version = (existing?.version || 1) + 1;
        const snapshot: Template = {
          ...existing!,
          history: undefined,
          version: existing?.version || 1,
        };
        return prev.map((item) =>
          item.id === template.id
            ? normalizeTemplate(
                { ...template, version, history: [...history.slice(-19), snapshot] },
                modelCatalog
              )
            : item
        );
      });
      setEditingTemplateId(null);
    },
    [modelCatalog, setEditingTemplateId, setTemplates]
  );

  const handleArchiveProject = useCallback(
    (id: string) => {
      setProjects((prev) => prev.map((project) => (project.id === id ? { ...project, archived: true } : project)));
    },
    [setProjects]
  );

  const handleUnarchiveProject = useCallback(
    (id: string) => {
      setProjects((prev) => prev.map((project) => (project.id === id ? { ...project, archived: false } : project)));
    },
    [setProjects]
  );

  const replaceImportedData = useCallback(
    (newProjects: Project[], newTemplates: Template[]) => {
      const normalizedTemplates = newTemplates.map((template) => normalizeTemplate(template, modelCatalog));
      setTemplates(normalizedTemplates);
      setProjects(newProjects.map((project) => normalizeProject(project, normalizedTemplates)));
    },
    [modelCatalog, setProjects, setTemplates]
  );

  return {
    updateSettings,
    saveExecutionPresetTemplate,
    updateProjectWithSync,
    createProject,
    createProjectsFromTable,
    createTemplate,
    handleUpdateTemplate,
    handleSaveTemplateWithHistory,
    handleArchiveProject,
    handleUnarchiveProject,
    replaceImportedData,
  };
};
