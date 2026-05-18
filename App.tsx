﻿import React, { useEffect, useRef, useState } from 'react';
import { DEFAULT_TEMPLATES } from './constants';
import { ExportModal } from './components/ExportModal';
import { FileLibrary } from './components/FileLibrary';
import { ProjectRunner } from './components/ProjectRunner';
import { SettingsModal } from './components/SettingsModal';
import { Sidebar } from './components/Sidebar';
import { SidebarTab, VariableTab } from './components/Sidebar';
import { TemplateEditor } from './components/TemplateEditor';
import { TopNav } from './components/TopNav';
import { WorkbenchMenuBar, WorkbenchMenuGroup } from './components/workbench/WorkbenchMenuBar';
import { ConfirmationModal } from './components/ConfirmationModal';
import { ioService, STORAGE_KEYS } from './services/ioService';
import { executeModelText } from './services/modelService';
import {
  applyProjectStepError,
  applyProjectStepSuccess,
  prepareProjectStepExecution,
} from './services/projectExecutionService';
import {
  applyImportedProjectVariableTable,
  buildBakedProjectExport,
  buildProjectVariableTableExport,
  mergeImportedData,
} from './services/projectImportExportService';
import { validateSettings, validateProjectsArray, validateTemplatesArray } from './services/schemas';
import {
  normalizeProject,
} from './domain/projectDomain';
import {
  createDefaultSettings,
  normalizeTemplate,
  normalizeSettings,
} from './domain/templateDomain';
import {
  AppSettings,
  ExecuteProjectStepOptions,
  ExecuteProjectStepResult,
  Project,
  SortKey,
  StepStructuredParseSummary,
  Template,
  TemplateInput,
} from './types';
import { useAppPersistence } from './hooks/useAppPersistence';
import { useBatchRun } from './hooks/useBatchRun';
import { useModalState } from './hooks/useModalState';
import { useProjectTemplateActions } from './hooks/useProjectTemplateActions';
import {
  buildStructuredParsePrompt,
  hasStructuredFieldValues,
} from './services/structuredOutputService';
import {
  buildVariableTableFromStepRows,
  buildVariableTableColumnsForStep,
  parseVariableTableRowsFromResponse,
} from './services/variableTableService.runtime';
import { getStepOutputs } from './services/stepVariablePortsService';
import { mergeBlueprintLayout } from './services/templateBlueprintService';

const BLUEPRINT_NODE_WIDTH = 260;
const BLUEPRINT_NODE_HEIGHT = 130;

const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [settings, setSettings] = useState<AppSettings>(createDefaultSettings());
  const [openTabIds, setOpenTabIds] = useState<string[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>('library');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const persistErrorRef = useRef(false);
  const projectsRef = useRef<Project[]>([]);
  const templatesRef = useRef<Template[]>([]);
  const settingsRef = useRef<AppSettings>(createDefaultSettings());
  const { modalConfig, openAlert, openConfirm, closeModal } = useModalState();

  const showPersistError = React.useCallback(() => {
    if (persistErrorRef.current) return;
    persistErrorRef.current = true;
    openAlert("Save failed", "Data could not be saved locally. Please check disk space and file permissions.");
    setTimeout(() => {
      persistErrorRef.current = false;
    }, 5000);
  }, [openAlert]);

  useEffect(() => {
    const init = async () => {
      const loadedSettings = await ioService.loadFromDisk<any>(STORAGE_KEYS.SETTINGS);
      let nextSettings = normalizeSettings(loadedSettings);
      const settingsValidation = validateSettings(nextSettings);
      if (settingsValidation.valid) {
        nextSettings = settingsValidation.data as AppSettings;
      }

      const loadedTemplates = await ioService.loadFromDisk<any>(STORAGE_KEYS.TEMPLATES);
      let rawTemplates = (loadedTemplates || DEFAULT_TEMPLATES).map((template: any) =>
        normalizeTemplate(template, nextSettings.modelCatalog)
      );
      const templatesValidation = validateTemplatesArray(rawTemplates);
      if (templatesValidation.valid) {
        rawTemplates = templatesValidation.data;
      }
      const nextTemplates = rawTemplates;

      const loadedProjects = await ioService.loadFromDisk<any>(STORAGE_KEYS.PROJECTS);
      let rawProjects = (loadedProjects || []).map((project: any) => normalizeProject(project, nextTemplates));
      const projectsValidation = validateProjectsArray(rawProjects);
      if (projectsValidation.valid) {
        rawProjects = projectsValidation.data;
      }
      const nextProjects = rawProjects;

      setSettings(nextSettings);
      setTemplates(nextTemplates);
      setProjects(nextProjects);
      setHasLoaded(true);
    };

    init();
  }, []);

  useAppPersistence({
    projects,
    templates,
    settings,
    hasLoaded,
    ioService,
    storageKeys: STORAGE_KEYS,
    onPersistError: showPersistError,
  });

  useEffect(() => {
    document.documentElement.style.fontSize = `${settings.uiScale}px`;
  }, [settings.uiScale]);

  useEffect(() => {
    document.documentElement.lang = settings.language;
  }, [settings.language]);

  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  useEffect(() => {
    templatesRef.current = templates;
  }, [templates]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const openTab = (id: string, options?: { forceNew?: boolean }) => {
    if (id === 'library') {
      setActiveTabId('library');
      return;
    }
    setOpenTabIds((prev) => {
      if (settings.tabOpenMode === 'single' && !options?.forceNew) {
        return [id];
      }
      return prev.includes(id) ? prev : [...prev, id];
    });
    setActiveTabId(id);
  };

  const closeTab = (id: string, event?: React.MouseEvent) => {
    event?.stopPropagation();
    setOpenTabIds((prev) => {
      const next = prev.filter((tabId) => tabId !== id);
      if (activeTabId === id) {
        setActiveTabId(next.length > 0 ? next[next.length - 1] : 'library');
      }
      return next;
    });
  };

  const {
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
  } = useProjectTemplateActions({
    templates,
    modelCatalog: settings.modelCatalog,
    setProjects,
    setTemplates,
    setSettings,
    openAlert,
    openTab,
    setEditingTemplateId,
  });

  const handleInputChange = (inputId: string, value: string) => {
    if (!activeTabId || activeTabId === 'library') return;
    updateProjectWithSync(activeTabId, (project) => ({
      ...project,
      inputValues: { ...project.inputValues, [inputId]: value },
    }));
  };

  const handleAddLocalVariable = (name: string) => {
    if (!activeTabId || activeTabId === 'library') return;
    const newInput: TemplateInput = { id: `local_${Date.now()}`, label: name };
    updateProjectWithSync(activeTabId, (project) => ({
      ...project,
      customInputs: [...(project.customInputs || []), newInput],
    }));
  };

  const handleDeleteLocalVariable = (variableId: string) => {
    if (!activeTabId || activeTabId === 'library') return;
    updateProjectWithSync(activeTabId, (project) => ({
      ...project,
      customInputs: (project.customInputs || []).filter((input) => input.id !== variableId),
    }));
  };

  const handleUpdateVariableTableCell = (
    tableId: string,
    rowId: string,
    columnKey: string,
    value: string
  ) => {
    if (!activeTabId || activeTabId === 'library') return;
    updateProjectWithSync(activeTabId, (project) => {
      const now = Date.now();
      const matchingLegacyTable = (project.variableTables || []).find((table) => table.id === tableId);
      const nextVariables = (project.variables || []).map((variable) => {
        const isTargetVariable = variable.id === tableId;
        const isMatchingLegacyVariable =
          matchingLegacyTable && variable.type === 'table' && variable.key === matchingLegacyTable.key;
        if (!isTargetVariable && !isMatchingLegacyVariable) return variable;

        return {
          ...variable,
          tableValue: variable.tableValue
            ? {
                ...variable.tableValue,
                rows: variable.tableValue.rows.map((row) =>
                  row.id === rowId
                    ? {
                        ...row,
                        cells: {
                          ...row.cells,
                          [columnKey]: value,
                        },
                      }
                    : row
                ),
              }
            : variable.tableValue,
          updatedAt: now,
        };
      });

      return {
        ...project,
        variables: nextVariables,
        variableTables: (project.variableTables || []).map((table) =>
          table.id === tableId || table.key === nextVariables.find((variable) => variable.id === tableId)?.key
            ? {
                ...table,
                rows: table.rows.map((row) =>
                  row.id === rowId
                    ? {
                        ...row,
                        cells: {
                          ...row.cells,
                          [columnKey]: value,
                        },
                      }
                    : row
                ),
                updatedAt: now,
              }
            : table
        ),
      };
    });
  };

  const handleExportProjectVariableTable = async (format: 'json' | 'csv') => {
    if (!activeProject || !activeProjectTemplate) return;
    try {
      const exported = buildProjectVariableTableExport({
        project: activeProject,
        template: activeProjectTemplate,
        format,
      });
      await ioService.exportFile(exported.filename, exported.content, exported.mimeType);
    } catch (error) {
      openAlert('Export failed', error instanceof Error ? error.message : 'Variable data export failed.');
    }
  };

  const handleImportProjectVariableTable = (content: string) => {
    if (!activeProject || !activeProjectTemplate || !activeTabId || activeTabId === 'library') return;

    try {
      updateProjectWithSync(activeTabId, (project) => {
        return {
          ...project,
          ...applyImportedProjectVariableTable({
            project,
            template: activeProjectTemplate,
            content,
          }),
        };
      });

      openAlert("Import complete", "The variable data has been imported into the current project.");
    } catch (error) {
      openAlert("Import failed", error instanceof Error ? error.message : "Variable data import failed.");
    }
  };

  const runStructuredOutputParse = async ({
    project,
    step,
    rawOutput,
    providerType,
    apiKey,
    baseUrl,
    modelName,
    temperature,
    maxTokens,
    options,
  }: {
    project: Project;
    step: Template['steps'][number];
    rawOutput: string;
    providerType: AppSettings['providerConfigs'][number]['providerType'];
    apiKey: string;
    baseUrl?: string;
    modelName: string;
    temperature?: number;
    maxTokens?: number;
    options?: ExecuteProjectStepOptions;
  }): Promise<StepStructuredParseSummary> => {
    if (getStepOutputs(step).some((output) => output.type === 'table')) {
      return {
        status: 'skipped',
        message: 'Table variable output was parsed from the prompt function JSON result.',
      };
    }

    const structuredFields = (step.structuredOutputFields || []).filter(
      (field) => field.key.trim() && field.label.trim()
    );

    if (structuredFields.length === 0 || !rawOutput.trim()) {
      return {
        status: 'not_applicable',
        message: 'No variable table fields configured.',
      };
    }

    const existingValues = project.stepStructuredOutputs?.[step.id] || {};
    const existingTable = (project.variableTables || []).find(
      (table) => table.sourceStepId === step.id
    );
    const hasExistingValues = hasStructuredFieldValues({
      values: existingValues,
      fields: structuredFields,
    }) || Boolean(existingTable?.rows.some((row) =>
      Object.values(row.cells).some((value) => String(value || '').trim())
    ));

    if (hasExistingValues) {
      options?.onStructuredParseStateChange?.(
        'awaiting_confirm',
        'Table variable fields already have values and need overwrite confirmation.'
      );

      if (!options?.confirmStructuredOverwrite) {
        options?.onStructuredParseStateChange?.(
          'skipped',
          'Table variable parse skipped because no overwrite confirmation handler was available.'
        );
        return {
          status: 'skipped',
          message:
            'Table variable parse skipped because existing field values were kept.',
        };
      }

      const decision = await options.confirmStructuredOverwrite({
        stepId: step.id,
        stepName: step.name || step.id,
        fieldLabels: structuredFields.map((field) => field.label || field.key),
        mode: options.structuredParseMode === 'automation' ? 'automation' : 'single',
      });

      if (decision !== 'overwrite') {
        options?.onStructuredParseStateChange?.(
          'skipped',
          'Table variable parse skipped and existing field values were kept.'
        );
        return {
          status: 'skipped',
          message: 'Table variable parse skipped and existing field values were kept.',
        };
      }
    }

    options?.onStructuredParseStateChange?.(
      'running',
      'Parsing the generated result into variable table fields.'
    );

    try {
      const parsePrompt = buildStructuredParsePrompt({
        step,
        rawOutput,
      });

      const parseResult = await executeModelText({
        providerType,
        apiKey,
        baseUrl,
        modelName,
        systemPrompt: parsePrompt.systemPrompt,
        userPrompt: parsePrompt.userPrompt,
        temperature,
        maxTokens,
      });

      const tableColumns = buildVariableTableColumnsForStep(step);
      const parsedRows = parseVariableTableRowsFromResponse({
        responseText: parseResult.output,
        columns: tableColumns,
      });
      const previousTable = (project.variableTables || []).find(
        (table) => table.sourceStepId === step.id
      );
      const nextTable = buildVariableTableFromStepRows({
        step,
        rows: parsedRows,
        previous: previousTable,
      });
      const firstRow = parsedRows[0] || {};

      updateProjectWithSync(project.id, (currentProject) => ({
        ...currentProject,
        stepStructuredOutputs: {
          ...(currentProject.stepStructuredOutputs || {}),
          [step.id]: {
            ...(currentProject.stepStructuredOutputs?.[step.id] || {}),
            ...firstRow,
          },
        },
        variableTables: nextTable
          ? [
              ...(currentProject.variableTables || []).filter(
                (table) => table.sourceStepId !== step.id
              ),
              nextTable,
            ]
          : currentProject.variableTables || [],
      }));

      options?.onStructuredParseStateChange?.(
        'success',
        'Table variable fields were updated from the generated result.'
      );

      return {
        status: 'success',
        message: 'Table variable fields were updated from the generated result.',
        updatedFieldKeys: structuredFields.map((field) => field.key),
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Table variable parse failed.';
      options?.onStructuredParseStateChange?.('error', message);
      return {
        status: 'error',
        message,
      };
    }
  };

  const executeProjectStep = async (
    projectId: string,
    stepId: string,
    options?: ExecuteProjectStepOptions
  ): Promise<ExecuteProjectStepResult> => {
    const project = projectsRef.current.find((item) => item.id === projectId);
    const template = templatesRef.current.find((item) => item.id === project?.templateId);
    if (!project || !template) {
      throw new Error("Current project or template could not be found.");
    }
    const prepared = prepareProjectStepExecution({
      project,
      template,
      stepId,
      settings: settingsRef.current,
    });

    try {
      const result = await executeModelText({
        providerType: prepared.providerType,
        apiKey: prepared.apiKey,
        baseUrl: prepared.baseUrl,
        modelName: prepared.modelName,
        systemPrompt: prepared.systemPrompt,
        userPrompt: prepared.userPrompt,
        temperature: prepared.temperature,
        maxTokens: prepared.maxTokens,
      });

      let projectAfterSuccess = project;
      updateProjectWithSync(project.id, (currentProject) => {
        projectAfterSuccess = applyProjectStepSuccess({
          project: currentProject,
          step: prepared.step,
          output: result.output,
          logBase: prepared.logBase,
          rawResponse: result.rawResponse,
        });
        return projectAfterSuccess;
      });

      const structuredParse =
        options?.structuredParseMode === 'library_batch'
          ? ({
              status: 'skipped',
              message: 'Table variable parse is skipped for library batch execution.',
            } satisfies StepStructuredParseSummary)
          : await runStructuredOutputParse({
              project: projectAfterSuccess,
              step: prepared.step,
              rawOutput: result.output,
              providerType: prepared.providerType,
              apiKey: prepared.apiKey,
              baseUrl: prepared.baseUrl,
              modelName: prepared.modelName,
              temperature: prepared.temperature,
              maxTokens: prepared.maxTokens,
              options,
            });

      return {
        output: result.output,
        structuredParse,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Run failed";

      updateProjectWithSync(project.id, (currentProject) =>
        applyProjectStepError({
          project: currentProject,
          stepId,
          logBase: prepared.logBase,
          message,
        })
      );

      throw error;
    }
  };

  const {
    batchRunProgress,
    handleBatchRunStepWithProgress,
    handleRetryFailedBatchRun,
    handleCloseBatchRunProgress,
    handleExportBatchRunResults,
  } = useBatchRun({
    projects,
    templates,
    executeProjectStep: (projectId, stepId) =>
      executeProjectStep(projectId, stepId, {
        structuredParseMode: 'library_batch',
      }),
    openAlert,
  });

  const handleRunStep = async (
    stepId: string,
    options?: ExecuteProjectStepOptions
  ) => {
    if (!activeProject || !activeProjectTemplate) {
      throw new Error("There is no active project to run.");
    }
    return executeProjectStep(activeProject.id, stepId, options);
  };

  const handleBakeDownload = () => {
    const project = projects.find((item) => item.id === activeTabId);
    if (!project) return;
    const template = templates.find((item) => item.id === project.templateId);
    if (!template) return;
    const exported = buildBakedProjectExport({ project, template });
    ioService.exportFile(exported.filename, exported.content);
  };

  const handleClearStepRunLogs = (stepId: string) => {
    if (!activeProject) return;
    updateProjectWithSync(activeProject.id, (project) => {
      const nextStepRunLogs = { ...(project.stepRunLogs || {}) };
      delete nextStepRunLogs[stepId];
      return {
        ...project,
        stepRunLogs: nextStepRunLogs,
      };
    });
  };

  const handleClearProjectRunLogs = () => {
    if (!activeProject) return;
    updateProjectWithSync(activeProject.id, (project) => ({
      ...project,
      stepRunLogs: {},
    }));
  };

  const handleDownloadAllData = () => {
    const backupData = {
      projects,
      templates,
      exportDate: new Date().toISOString(),
      version: '2.1',
    };
    const jsonString = JSON.stringify(backupData, null, 2);
    const now = new Date();
    const YYYY = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const DD = String(now.getDate()).padStart(2, '0');
    const HH = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const dateStr = `${YYYY}${MM}${DD}_${HH}${mm}${ss}`;
    ioService.exportFile(`prompt_splicer_backup_${dateStr}.json`, jsonString, 'application/json');
  };

  const handleMergeData = (newProjects: Project[], newTemplates: Template[]) => {
    const merged = mergeImportedData({
      existingProjects: projects,
      existingTemplates: templates,
      newProjects,
      newTemplates,
      modelCatalog: settings.modelCatalog,
    });
    setTemplates(merged.templates);
    setProjects(merged.projects);
  };

  const handleDeleteProvider = (providerId: string) => {
    const isReferenced = settings.modelCatalog.some((item) => item.providerConfigId === providerId);
    if (isReferenced) {
      openAlert("Cannot delete provider", "Some model catalog items still use this provider. Remove or update them first.");
      return;
    }

    openConfirm("Delete provider", "Delete this provider configuration?", () => {
      updateSettings({
        providerConfigs: settings.providerConfigs.filter((provider) => provider.id !== providerId),
      });
    });
  };

  const handleDeleteModelCatalogItem = (modelCatalogItemId: string) => {
    const isReferenced = templates.some((template) =>
      (template.modelRefs || []).some((modelRef) => modelRef.modelCatalogItemId === modelCatalogItemId)
    );

    if (isReferenced) {
      openAlert("Cannot delete model", "Some template model refs still use this catalog item. Update the template first.");
      return;
    }

    openConfirm("Delete model", "Delete this model catalog item?", () => {
      updateSettings({
        modelCatalog: settings.modelCatalog.filter((item) => item.id !== modelCatalogItemId),
      });
    });
  };

  const handleDeleteExecutionPresetTemplate = (executionPresetTemplateId: string) => {
    openConfirm("Delete execution preset", "Delete this execution preset template?", () => {
      updateSettings({
        executionPresetTemplates: settings.executionPresetTemplates.filter(
          (item) => item.id !== executionPresetTemplateId
        ),
      });
    });
  };

  const editingTemplate = templates.find((template) => template.id === editingTemplateId);
  const activeProject = activeTabId !== 'library' ? projects.find((project) => project.id === activeTabId) : null;
  const activeProjectTemplate = activeProject ? templates.find((template) => template.id === activeProject.templateId) : null;
  const activeTemplateWorkspace =
    activeProjectTemplate
      ? settings.projectWorkspaceByTemplateId?.[activeProjectTemplate.id] || {}
      : {};
  const activeWorkspaceSelectedStepIds =
    activeProjectTemplate
      ? (activeTemplateWorkspace.selectedStepIds || []).filter((stepId) =>
          activeProjectTemplate.steps.some((step) => step.id === stepId)
        )
      : [];
  const updateActiveTemplateWorkspace = (
    updates: Partial<NonNullable<AppSettings['projectWorkspaceByTemplateId']>[string]>
  ) => {
    if (!activeProjectTemplate) return;
    updateSettings({
      projectWorkspaceByTemplateId: {
        ...(settings.projectWorkspaceByTemplateId || {}),
        [activeProjectTemplate.id]: {
          ...(settings.projectWorkspaceByTemplateId?.[activeProjectTemplate.id] || {}),
          ...updates,
        },
      },
    });
  };

  const focusBlueprintStep = (stepId: string) => {
    if (!activeProjectTemplate) return;
    const layout = mergeBlueprintLayout(activeProjectTemplate);
    const node = layout.nodes[stepId];
    if (!node) return;
    const currentViewport = activeTemplateWorkspace.blueprintViewport || layout.viewport || { x: 0, y: 0, zoom: 1 };
    const zoom = currentViewport.zoom || 1;
    const sceneWidth =
      activeTemplateWorkspace.scenePanelVisible === false
        ? 0
        : activeTemplateWorkspace.scenePanelWidth || settings.sidebarWidth;
    const detailsWidth =
      activeTemplateWorkspace.detailsPanelVisible === false
        ? 0
        : activeTemplateWorkspace.detailsPanelWidth ||
          activeTemplateWorkspace.inspectorWidth ||
          settings.projectRunnerInspectorWidth;
    const workspaceWidth = Math.max(480, window.innerWidth - sceneWidth - detailsWidth - 80);
    const workspaceHeight = Math.max(360, window.innerHeight - 190);
    updateActiveTemplateWorkspace({
      selectedStepIds: [stepId],
      detailsPanelVisible: true,
      blueprintViewport: {
        x: Math.round(workspaceWidth / 2 - (node.x + BLUEPRINT_NODE_WIDTH / 2) * zoom),
        y: Math.round(workspaceHeight / 2 - (node.y + BLUEPRINT_NODE_HEIGHT / 2) * zoom),
        zoom,
      },
    });
  };

  const activeProjectLogCount = activeProject
    ? (Object.values(activeProject.stepRunLogs || {}) as Array<unknown[]>).reduce(
        (total, logs) => total + (Array.isArray(logs) ? logs.length : 0),
        0
      )
    : 0;

  const appMenuGroups: WorkbenchMenuGroup[] =
    activeProject && activeProjectTemplate
      ? [
          {
            label: 'Project',
            commands: [
              {
                id: 'clear-project-logs',
                label: settings.language === 'zh-CN' ? '清空运行日志' : 'Clear Run Logs',
                enabled: activeProjectLogCount > 0,
                run: () =>
                  openConfirm(
                    settings.language === 'zh-CN' ? '清空运行日志' : 'Clear run logs',
                    settings.language === 'zh-CN'
                      ? '清空当前项目的全部运行日志？'
                      : 'Clear all run logs for this project?',
                    () => handleClearProjectRunLogs()
                  ),
              },
              {
                id: 'export',
                label: settings.language === 'zh-CN' ? '导出' : 'Export',
                run: () => setIsExportModalOpen(true),
              },
            ],
          },
          {
            label: 'Editor',
            commands: [
              {
                id: 'select-all-nodes',
                label: settings.language === 'zh-CN' ? '全选函数' : 'Select All Functions',
                shortcut: 'Ctrl+A',
                run: () =>
                  updateActiveTemplateWorkspace({ selectedStepIds: activeProjectTemplate.steps.map((step) => step.id) }),
              },
              {
                id: 'clear-selection',
                label: settings.language === 'zh-CN' ? '取消选择' : 'Clear Selection',
                enabled: activeWorkspaceSelectedStepIds.length > 0,
                run: () => updateActiveTemplateWorkspace({ selectedStepIds: [] }),
              },
            ],
          },
          {
            label: 'View',
            commands: [
              {
                id: 'toggle-minimap',
                label: settings.language === 'zh-CN' ? '切换小地图' : 'Toggle MiniMap',
                run: () =>
                  updateActiveTemplateWorkspace({ minimapCollapsed: !activeTemplateWorkspace.minimapCollapsed }),
              },
              {
                id: 'compact-view',
                label: settings.language === 'zh-CN' ? '紧凑模式' : 'Compact View',
                enabled: activeTemplateWorkspace.viewMode === 'detail',
                run: () => updateActiveTemplateWorkspace({ viewMode: 'compact' }),
              },
              {
                id: 'detail-view',
                label: settings.language === 'zh-CN' ? '详细模式' : 'Detail View',
                enabled: activeTemplateWorkspace.viewMode !== 'detail',
                run: () => updateActiveTemplateWorkspace({ viewMode: 'detail' }),
              },
            ],
          },
          {
            label: 'Window',
            commands: [
              {
                id: 'toggle-scene-panel',
                label: settings.language === 'zh-CN' ? '切换场景面板' : 'Toggle Scene Panel',
                run: () =>
                  updateActiveTemplateWorkspace({
                    scenePanelVisible: activeTemplateWorkspace.scenePanelVisible === false,
                  }),
              },
              {
                id: 'toggle-details-panel',
                label: settings.language === 'zh-CN' ? '切换详情面板' : 'Toggle Details Panel',
                run: () =>
                  updateActiveTemplateWorkspace({
                    detailsPanelVisible: activeTemplateWorkspace.detailsPanelVisible === false,
                  }),
              },
              {
                id: 'reset-layout',
                label: settings.language === 'zh-CN' ? '重置布局' : 'Reset Layout',
                run: () =>
                  updateActiveTemplateWorkspace({
                    scenePanelVisible: true,
                    detailsPanelVisible: true,
                    scenePanelWidth: settings.sidebarWidth,
                    detailsPanelWidth: settings.projectRunnerInspectorWidth,
                    inspectorWidth: settings.projectRunnerInspectorWidth,
                    activeTool: 'move',
                    minimapCollapsed: false,
                  }),
              },
            ],
          },
          {
            label: 'Help',
            commands: [
              {
                id: 'shortcuts',
                label:
                  settings.language === 'zh-CN'
                    ? '快捷键：Ctrl+A / Space / Tab'
                    : 'Shortcuts: Ctrl+A / Space / Tab',
                enabled: false,
                run: () => undefined,
              },
            ],
          },
        ]
      : [
          {
            label: 'Project',
            commands: [
              {
                id: 'export',
                label: settings.language === 'zh-CN' ? '导出' : 'Export',
                run: () => setIsExportModalOpen(true),
              },
            ],
          },
          {
            label: 'View',
            commands: [
              {
                id: 'settings',
                label: settings.language === 'zh-CN' ? '设置' : 'Settings',
                run: () => setIsSettingsOpen(true),
              },
            ],
          },
          {
            label: 'Window',
            commands: [
              {
                id: 'toggle-sidebar',
                label: settings.language === 'zh-CN' ? '切换侧边栏' : 'Toggle Sidebar',
                run: () => updateSettings({ isSidebarOpen: !settings.isSidebarOpen }),
              },
            ],
          },
          {
            label: 'Help',
            commands: [
              {
                id: 'about',
                label: settings.language === 'zh-CN' ? '提示词函数流 Pro' : 'Prompt Function Flow Pro',
                enabled: false,
                run: () => undefined,
              },
            ],
          },
        ];

  return (
    <div className={`app-root flex h-screen flex-col overflow-hidden font-sans text-slate-200 ${settings.fontSize}`}>
      {editingTemplateId && editingTemplate && (
        <div className="fixed inset-0 z-[100] bg-slate-950 animate-in fade-in zoom-in-95 duration-200">
          <TemplateEditor
            language={settings.language}
            template={editingTemplate}
            modelCatalog={settings.modelCatalog}
            providerConfigs={settings.providerConfigs}
            executionPresetTemplates={settings.executionPresetTemplates}
            leftPanelWidth={settings.templateEditorLeftWidth}
            onLeftPanelWidthChange={(templateEditorLeftWidth) => updateSettings({ templateEditorLeftWidth })}
            blueprintInspectorWidth={settings.templateBlueprintInspectorWidth}
            onBlueprintInspectorWidthChange={(templateBlueprintInspectorWidth) =>
              updateSettings({ templateBlueprintInspectorWidth })
            }
            onSave={(updatedTemplate) => {
              handleSaveTemplateWithHistory(updatedTemplate);
            }}
            onSaveExecutionPresetTemplate={saveExecutionPresetTemplate}
            onCancel={() => setEditingTemplateId(null)}
            onRequestConfirm={openConfirm}
          />
        </div>
      )}

      {!editingTemplateId && <WorkbenchMenuBar groups={appMenuGroups} />}

      <TopNav
        isSidebarOpen={
          activeProjectTemplate
            ? activeTemplateWorkspace.scenePanelVisible !== false
            : settings.isSidebarOpen
        }
        onToggleSidebar={() =>
          activeProjectTemplate
            ? updateActiveTemplateWorkspace({
                scenePanelVisible: activeTemplateWorkspace.scenePanelVisible === false,
              })
            : updateSettings({ isSidebarOpen: !settings.isSidebarOpen })
        }
        onOpenSettings={() => setIsSettingsOpen(true)}
        activeTabId={activeTabId}
        openTabIds={openTabIds}
        projects={projects}
        onOpenTab={openTab}
        tabOpenMode={settings.tabOpenMode}
        onCloseTab={closeTab}
      />

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <Sidebar
          language={settings.language}
          isOpen={
            activeProjectTemplate
              ? activeTemplateWorkspace.scenePanelVisible !== false
              : settings.isSidebarOpen
          }
          width={activeProjectTemplate ? activeTemplateWorkspace.scenePanelWidth || settings.sidebarWidth : settings.sidebarWidth}
          onWidthChange={(width) =>
            activeProjectTemplate ? updateActiveTemplateWorkspace({ scenePanelWidth: width }) : updateSettings({ sidebarWidth: width })
          }
          isResizing={isResizingSidebar}
          onResizingChange={setIsResizingSidebar}
          activeProject={activeProject || null}
          activeProjectTemplate={activeProjectTemplate || null}
          onInputChange={handleInputChange}
          onAddLocalVariable={handleAddLocalVariable}
          onDeleteLocalVariable={handleDeleteLocalVariable}
          onImportVariableTable={handleImportProjectVariableTable}
          onExportVariableTable={handleExportProjectVariableTable}
          onUpdateVariableTableCell={handleUpdateVariableTableCell}
          onBakeDownload={handleBakeDownload}
          onRequestAlert={openAlert}
          activeTab={(activeTemplateWorkspace.sidebarTab as SidebarTab) || 'vars'}
          onActiveTabChange={(sidebarTab) => updateActiveTemplateWorkspace({ sidebarTab })}
          activeVariableTab={(activeTemplateWorkspace.sidebarVariableTab as VariableTab) || 'input'}
          onActiveVariableTabChange={(sidebarVariableTab) =>
            updateActiveTemplateWorkspace({ sidebarVariableTab })
          }
          selectedStepIds={activeWorkspaceSelectedStepIds}
          onFocusStep={focusBlueprintStep}
        />

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-950">
          {activeTabId === 'library' ? (
            <FileLibrary
              language={settings.language}
              projects={projects}
              templates={templates}
              modelCatalog={settings.modelCatalog}
              onOpenProject={openTab}
              onCreateProject={createProject}
              onBatchCreateProjects={createProjectsFromTable}
              onBatchRunStep={handleBatchRunStepWithProgress}
              batchRunProgress={batchRunProgress}
              onRetryFailedBatchRun={handleRetryFailedBatchRun}
              onCloseBatchRunProgress={handleCloseBatchRunProgress}
              onExportBatchRunResults={handleExportBatchRunResults}
              onCreateTemplate={createTemplate}
              onEditTemplate={setEditingTemplateId}
              onUpdateTemplate={handleUpdateTemplate}
              onDuplicateTemplate={(id) => {
                const template = templates.find((item) => item.id === id);
                if (!template) return;
                const nextId = `tmpl_${Date.now()}`;
                const duplicate = normalizeTemplate(
                  { ...template, id: nextId, name: `${template.name} (copy)` },
                  settings.modelCatalog
                );
                setTemplates([...templates, duplicate]);
                setEditingTemplateId(nextId);
              }}
              onCreateTemplateFromProject={(id) => {
                const project = projects.find((item) => item.id === id);
                const template = templates.find((item) => item.id === project?.templateId);
                if (!template) return;
                const nextId = `tmpl_${Date.now()}`;
                const derivedTemplate = normalizeTemplate(
                  { ...template, id: nextId, name: `${project?.name || template.name} extract` },
                  settings.modelCatalog
                );
                setTemplates([...templates, derivedTemplate]);
                setEditingTemplateId(nextId);
              }}
              onDeleteProject={(id) =>
                openConfirm("Delete project", "Delete this project?", () => {
                  setProjects(projects.filter((project) => project.id !== id));
                  closeTab(id);
                })
              }
              onDeleteProjects={(ids) =>
                openConfirm("Delete selected projects", "Delete the selected projects?", () => {
                  setProjects(projects.filter((project) => !ids.includes(project.id)));
                  ids.forEach((id) => closeTab(id));
                })
              }
              onDeleteTemplate={(id) =>
                openConfirm("Delete template", "Delete this template?", () => {
                  setTemplates(templates.filter((template) => template.id !== id));
                })
              }
              onImportData={replaceImportedData}
              onMergeData={handleMergeData}
              onOpenExport={() => setIsExportModalOpen(true)}
              onRequestAlert={openAlert}
              onArchiveProject={handleArchiveProject}
              onUnarchiveProject={handleUnarchiveProject}
              cardScale={settings.cardScale}
              onCardScaleChange={(cardScale) => updateSettings({ cardScale })}
              sortBy={settings.fileLibrarySortBy as SortKey}
              onSortChange={(fileLibrarySortBy) => updateSettings({ fileLibrarySortBy })}
            />
          ) : activeProject && activeProjectTemplate ? (
            <ProjectRunner
              project={activeProject}
              template={activeProjectTemplate}
              language={settings.language}
              modelCatalog={settings.modelCatalog}
              providerConfigs={settings.providerConfigs}
              onUpdateProject={(id, updates) => updateProjectWithSync(id, (project) => ({ ...project, ...updates }))}
              onUpdateTemplate={(id, updates) =>
                setTemplates((prev) =>
                  prev.map((template) =>
                    template.id === id ? normalizeTemplate({ ...template, ...updates }, settings.modelCatalog) : template
                  )
                )
              }
              onRunStep={handleRunStep}
              onClearStepRunLogs={handleClearStepRunLogs}
              onClearProjectRunLogs={handleClearProjectRunLogs}
              onRequestConfirm={openConfirm}
              structuredOutputResultView={settings.structuredOutputResultView}
              onStructuredOutputResultViewChange={(structuredOutputResultView) =>
                updateSettings({ structuredOutputResultView })
              }
              selectedStepIds={activeWorkspaceSelectedStepIds}
              onSelectedStepIdsChange={(selectedStepIds) => updateActiveTemplateWorkspace({ selectedStepIds })}
              blueprintViewport={activeTemplateWorkspace.blueprintViewport || { x: 0, y: 0, zoom: 1 }}
              onBlueprintViewportChange={(blueprintViewport) => updateActiveTemplateWorkspace({ blueprintViewport })}
              viewMode={activeTemplateWorkspace.viewMode || 'compact'}
              onViewModeChange={(viewMode) => updateActiveTemplateWorkspace({ viewMode })}
              blueprintInspectorWidth={
                activeTemplateWorkspace.detailsPanelWidth ||
                activeTemplateWorkspace.inspectorWidth ||
                settings.projectRunnerInspectorWidth
              }
              onBlueprintInspectorWidthChange={(detailsPanelWidth) =>
                updateActiveTemplateWorkspace({ detailsPanelWidth, inspectorWidth: detailsPanelWidth })
              }
              blueprintActiveTool={activeTemplateWorkspace.activeTool || 'move'}
              onBlueprintActiveToolChange={(activeTool) => updateActiveTemplateWorkspace({ activeTool })}
              minimapCollapsed={Boolean(activeTemplateWorkspace.minimapCollapsed)}
              onMinimapCollapsedChange={(minimapCollapsed) => updateActiveTemplateWorkspace({ minimapCollapsed })}
              detailsPanelVisible={activeTemplateWorkspace.detailsPanelVisible !== false}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-700">Open a project from the library</div>
          )}
        </div>
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onChange={updateSettings}
        onDeleteProvider={handleDeleteProvider}
        onDeleteModelCatalogItem={handleDeleteModelCatalogItem}
        onDeleteExecutionPresetTemplate={handleDeleteExecutionPresetTemplate}
      />
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        data={{ projects, templates }}
        onDownload={handleDownloadAllData}
      />
      <ConfirmationModal
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        isAlert={modalConfig.isAlert}
        onConfirm={modalConfig.onConfirm}
        onCancel={closeModal}
      />
    </div>
  );
};

export default App;
