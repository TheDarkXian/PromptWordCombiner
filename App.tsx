import React, { useEffect, useRef, useState } from 'react';
import { DEFAULT_TEMPLATES } from './constants';
import { ExportModal } from './components/ExportModal';
import { FileLibrary } from './components/FileLibrary';
import { ProjectRunner } from './components/ProjectRunner';
import { SettingsModal } from './components/SettingsModal';
import { Sidebar } from './components/Sidebar';
import { TemplateEditor } from './components/TemplateEditor';
import { TopNav } from './components/TopNav';
import { ConfirmationModal } from './components/ConfirmationModal';
import { BatchRunProgressState } from './components/BatchRunProgressModal';
import { ioService, STORAGE_KEYS } from './services/ioService';
import { executeModelText, resolveStepExecutionAvailability } from './services/modelService';
import { createInterpolator } from './services/interpolationService';
import {
  buildProjectVariableTableRow,
  parseBatchProjectSeeds,
  parseProjectVariableTable,
  stringifyRowsAsCsv,
} from './services/variableTableService';
import { validateSettings, validateProjectsArray, validateTemplatesArray } from './services/schemas';
import {
  appendStepRunLog,
  normalizeProject,
  syncProjectVariables,
  upsertVariable,
} from './domain/projectDomain';
import {
  createDefaultSettings,
  normalizeTemplate,
  normalizeSettings,
} from './domain/templateDomain';
import {
  AppSettings,
  Project,
  ProjectVariable,
  SortKey,
  StepRunLog,
  Template,
  TemplateInput,
} from './types';

type FontSize = AppSettings['fontSize'];
type UiScale = 8 | 11 | 14 | 16 | 18 | 19 | 20 | 22 | 24;

const App: React.FC = () => {
  const createEmptyBatchRunProgress = (): BatchRunProgressState => ({
    isOpen: false,
    isRunning: false,
    templateId: null,
    templateName: '',
    stepId: null,
    stepName: '',
    total: 0,
    processed: 0,
    successCount: 0,
    failures: [],
    results: [],
  });

  const [projects, setProjects] = useState<Project[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [settings, setSettings] = useState<AppSettings>(createDefaultSettings());
  const [openTabIds, setOpenTabIds] = useState<string[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>('library');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [batchRunProgress, setBatchRunProgress] = useState<BatchRunProgressState>(createEmptyBatchRunProgress());
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    isAlert: boolean;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', isAlert: false, onConfirm: () => {} });

  const hasLoadedRef = useRef(false);
  const persistTimers = useRef<Partial<Record<string, ReturnType<typeof setTimeout>>>>({});

  const debouncedSave = (key: string, data: unknown, delay = 500) => {
    if (persistTimers.current[key]) {
      clearTimeout(persistTimers.current[key]);
    }
    persistTimers.current[key] = setTimeout(() => {
      ioService.saveToDisk(key, data).catch(() => {
        showPersistError();
      });
    }, delay);
  };

  const runBatchStepWithProgress = async (projectIds: string[], templateId: string, stepId: string) => {
    const template = templates.find((item) => item.id === templateId);
    const step = template?.steps.find((item) => item.id === stepId);
    if (!template || !step) {
      openAlert('??????', '?????????????');
      return;
    }

    let successCount = 0;
    const failures: BatchRunProgressState['failures'] = [];
    const results: BatchRunProgressState['results'] = [];

    setBatchRunProgress({
      isOpen: true,
      isRunning: true,
      templateId,
      templateName: template.name,
      stepId,
      stepName: step.name,
      total: projectIds.length,
      processed: 0,
      successCount: 0,
      failures: [],
      results: [],
    });

    for (let index = 0; index < projectIds.length; index += 1) {
      const projectId = projectIds[index];
      const project = projects.find((item) => item.id === projectId);

      if (!project) {
        const message = '?????';
        failures.push({
          projectId,
          projectName: projectId,
          message,
        });
        results.push({
          projectId,
          projectName: projectId,
          status: 'error',
          message,
        });
      } else {
        try {
          await executeProjectStep(project.id, stepId);
          successCount += 1;
          results.push({
            projectId: project.id,
            projectName: project.name,
            status: 'success',
            message: '????',
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : '????';
          failures.push({
            projectId: project.id,
            projectName: project.name,
            message,
          });
          results.push({
            projectId: project.id,
            projectName: project.name,
            status: 'error',
            message,
          });
        }
      }

      setBatchRunProgress((prev) => ({
        ...prev,
        processed: index + 1,
        successCount,
        failures: [...failures],
        results: [...results],
      }));
    }

    setBatchRunProgress((prev) => ({
      ...prev,
      isRunning: false,
      processed: projectIds.length,
      successCount,
      failures: [...failures],
      results: [...results],
    }));
  };

  const handleBatchRunStepWithProgress = async (templateId: string, stepId: string) => {
    const matchedProjectIds = projects
      .filter((project) => project.templateId === templateId && !project.archived)
      .map((project) => project.id);

    if (matchedProjectIds.length === 0) {
      openAlert('无法批量执行', '这个模板下没有可执行的未归档项目。');
      return;
    }

    await runBatchStepWithProgress(matchedProjectIds, templateId, stepId);
  };

  const handleRetryFailedBatchRun = async () => {
    if (!batchRunProgress.templateId || !batchRunProgress.stepId || batchRunProgress.failures.length === 0) {
      return;
    }

    await runBatchStepWithProgress(
      batchRunProgress.failures.map((failure) => failure.projectId),
      batchRunProgress.templateId,
      batchRunProgress.stepId
    );
  };

  const handleCloseBatchRunProgress = () => {
    setBatchRunProgress((prev) => (prev.isRunning ? prev : createEmptyBatchRunProgress()));
  };

  const handleExportBatchRunResults = async (
    format: 'json' | 'csv',
    scope: 'all' | 'success' | 'error'
  ) => {
    const filteredResults =
      scope === 'all'
        ? batchRunProgress.results
        : batchRunProgress.results.filter((item) => item.status === scope);

    if (filteredResults.length === 0) {
      openAlert('无法导出', '当前筛选条件下没有可导出的结果。');
      return;
    }

    const rows = filteredResults.map((item) => ({
      template_name: batchRunProgress.templateName,
      step_name: batchRunProgress.stepName,
      project_id: item.projectId,
      project_name: item.projectName,
      status: item.status,
      message: item.message,
    }));

    const safeTemplateName = (batchRunProgress.templateName || 'batch_run').replace(/[\\/:*?"<>|]+/g, '_');
    const safeStepName = (batchRunProgress.stepName || 'step').replace(/[\\/:*?"<>|]+/g, '_');
    const scopeSuffix = scope === 'all' ? 'all' : scope;

    if (format === 'json') {
      await ioService.exportFile(
        `${safeTemplateName}_${safeStepName}_${scopeSuffix}.json`,
        JSON.stringify(rows, null, 2),
        'application/json'
      );
      return;
    }

    await ioService.exportFile(
      `${safeTemplateName}_${safeStepName}_${scopeSuffix}.csv`,
      stringifyRowsAsCsv(rows),
      'text/csv'
    );
  };

  const showPersistError = () => {
    if (persistErrorRef.current) return;
    persistErrorRef.current = true;
    openAlert('保存失败', '数据未能保存到本地，请检查磁盘空间和文件权限。');
    setTimeout(() => {
      persistErrorRef.current = false;
    }, 5000);
  };

  const persistErrorRef = useRef(false);

  const openConfirm = (title: string, message: string, onConfirm: () => void) => {
    setModalConfig({
      isOpen: true,
      title,
      message,
      isAlert: false,
      onConfirm: () => {
        onConfirm();
        closeModal();
      },
    });
  };

  const openAlert = (title: string, message: string) => {
    setModalConfig({ isOpen: true, title, message, isAlert: true, onConfirm: () => closeModal() });
  };

  const closeModal = () => setModalConfig((prev) => ({ ...prev, isOpen: false }));

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
      hasLoadedRef.current = true;
    };

    init();
  }, []);

  useEffect(() => {
    if (!hasLoadedRef.current) return;
    debouncedSave(STORAGE_KEYS.TEMPLATES, templates, 500);
  }, [templates]);

  useEffect(() => {
    if (!hasLoadedRef.current) return;
    debouncedSave(STORAGE_KEYS.PROJECTS, projects, 500);
  }, [projects]);

  useEffect(() => {
    if (!hasLoadedRef.current) return;
    debouncedSave(STORAGE_KEYS.SETTINGS, settings, 800);
    document.documentElement.style.fontSize = `${settings.uiScale}px`;
    document.documentElement.lang = settings.language;
  }, [settings]);

  useEffect(() => {
    document.documentElement.style.fontSize = `${settings.uiScale}px`;
  }, [settings.uiScale]);

  useEffect(() => {
    document.documentElement.lang = settings.language;
  }, [settings.language]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isResizingSidebar) return;
      const newWidth = event.clientX;
      if (newWidth > 180 && newWidth < 600) {
        setSettings((prev) => ({ ...prev, sidebarWidth: newWidth }));
      }
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
      document.body.style.cursor = 'default';
    };

    if (isResizingSidebar) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingSidebar]);

  const updateSettings = (updates: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  };

  const updateProjectWithSync = (projectId: string, recipe: (project: Project) => Project) => {
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
  };

  const buildProjectFromTemplate = (
    template: Template,
    name: string,
    inputValuesOverride: Record<string, string> = {},
    idSuffix = ''
  ): Project => {
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
  };

  const createProject = (templateId: string, name: string) => {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;

    const newProject = buildProjectFromTemplate(template, name);
    setProjects((prev) => [...prev, newProject]);
    openTab(newProject.id);
  };

  const createProjectsFromTable = (templateId: string, content: string) => {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;

    try {
      const seeds = parseBatchProjectSeeds(content, template);
      const newProjects = seeds.map((seed, index) =>
        buildProjectFromTemplate(template, seed.projectName, seed.inputValues, `_${index}`)
      );

      if (newProjects.length === 0) {
        openAlert('无法创建', '没有解析出任何可创建的项目。');
        return;
      }

      setProjects((prev) => [...prev, ...newProjects]);
      openTab(newProjects[0].id);
      openAlert('批量创建完成', `已创建 ${newProjects.length} 个项目。`);
    } catch (error) {
      openAlert('批量创建失败', error instanceof Error ? error.message : '批量创建失败。');
    }
  };

  const createTemplate = () => {
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
  };

  const openTab = (id: string) => {
    if (id === 'library') {
      setActiveTabId('library');
      return;
    }
    setOpenTabIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
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

  const handleInputChange = (inputId: string, value: string) => {
    if (!activeTabId || activeTabId === 'library') return;
    updateProjectWithSync(activeTabId, (project) => ({
      ...project,
      inputValues: { ...project.inputValues, [inputId]: value },
    }));
  };

  const handleUpdateTemplate = (id: string, updates: Partial<Template>) => {
    setTemplates((prev) => {
      const nextTemplates = prev.map((template) =>
        template.id === id ? normalizeTemplate({ ...template, ...updates }, settings.modelCatalog) : template
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
  };

  const handleSaveTemplateWithHistory = (template: Template) => {
    setTemplates((prev) => {
      const existing = prev.find((t) => t.id === template.id);
      const history = existing?.history || [];
      const version = (existing?.version || 1) + 1;
      const snapshot: Template = {
        ...existing!,
        history: undefined,
        version: existing?.version || 1,
      };
      return prev.map((t) =>
        t.id === template.id
          ? normalizeTemplate(
              { ...template, version, history: [...history.slice(-19), snapshot] },
              settings.modelCatalog
            )
          : t
      );
    });
    setEditingTemplateId(null);
  };

  const handleArchiveProject = (id: string) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, archived: true } : p))
    );
  };

  const handleUnarchiveProject = (id: string) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, archived: false } : p))
    );
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

  const handleExportProjectVariableTable = async (format: 'json' | 'csv') => {
    if (!activeProject || !activeProjectTemplate) return;

    const row = buildProjectVariableTableRow(activeProject, activeProjectTemplate);
    const safeName = activeProject.name.replace(/[\\/:*?"<>|]+/g, '_');

    if (format === 'json') {
      await ioService.exportFile(
        `${safeName}_variables.json`,
        JSON.stringify([row], null, 2),
        'application/json'
      );
      return;
    }

    await ioService.exportFile(
      `${safeName}_variables.csv`,
      stringifyRowsAsCsv([row]),
      'text/csv'
    );
  };

  const handleImportProjectVariableTable = (content: string) => {
    if (!activeProject || !activeProjectTemplate || !activeTabId || activeTabId === 'library') return;

    try {
      const parsed = parseProjectVariableTable(content, activeProjectTemplate);

      updateProjectWithSync(activeTabId, (project) => {
        const nextInputValues = { ...project.inputValues };
        const nextCustomInputs = [...(project.customInputs || [])];
        const localInputMap = new Map(nextCustomInputs.map((input) => [input.label, input]));

        activeProjectTemplate.inputs.forEach((input) => {
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
          ...project,
          name: parsed.projectName?.trim() || project.name,
          customInputs: nextCustomInputs,
          inputValues: nextInputValues,
        };
      });

      openAlert('导入完成', '变量表已导入到当前项目。');
    } catch (error) {
      openAlert('导入失败', error instanceof Error ? error.message : '变量表导入失败。');
    }
  };

  const executeProjectStep = async (projectId: string, stepId: string) => {
    const project = projects.find((item) => item.id === projectId);
    const template = templates.find((item) => item.id === project?.templateId);
    if (!project || !template) {
      throw new Error('当前项目或模板不存在。');
    }

    const step = template.steps.find((item) => item.id === stepId);
    if (!step) {
      throw new Error('未找到要执行的步骤。');
    }

    const availability = resolveStepExecutionAvailability({
      step,
      template,
      modelCatalog: settings.modelCatalog,
      providerConfigs: settings.providerConfigs,
    });

    if (!availability.isRunnable || !availability.modelCatalogItem || !availability.providerConfig) {
      throw new Error(availability.message);
    }

    const override = project.stepOverrides[step.id];
    const rawContent = override?.content !== undefined ? override.content : step.content || '';
    const interpolate = createInterpolator(project, template);
    const userPrompt = interpolate(rawContent).trim();
    const systemPrompt = step.execution?.systemPrompt || '';
    const temperature = step.execution?.temperature;
    const maxTokens = step.execution?.maxTokens;

    if (!userPrompt) {
      throw new Error('当前步骤的插值结果为空，无法执行。');
    }

    const logBase = {
      id: `run_${Date.now()}`,
      createdAt: Date.now(),
      providerType: availability.providerConfig.providerType,
      providerLabel: availability.providerConfig.label,
      modelName: availability.modelCatalogItem.modelName,
      modelLabel: availability.modelCatalogItem.label,
      systemPrompt,
      userPrompt,
      temperature,
      maxTokens,
    };

    try {
      const result = await executeModelText({
        providerType: availability.providerConfig.providerType,
        apiKey: availability.providerConfig.apiKey,
        baseUrl: availability.providerConfig.baseUrl,
        modelName: availability.modelCatalogItem.modelName,
        systemPrompt,
        userPrompt,
        temperature,
        maxTokens,
      });

      const nextLog: StepRunLog = {
        ...logBase,
        status: 'success',
        output: result.output,
        error: '',
        rawResponse: result.rawResponse,
      };

      const binding = step.outputBinding;
      const now = Date.now();

      updateProjectWithSync(project.id, (currentProject) => {
        let nextProject: Project = {
          ...currentProject,
          stepOutputs: {
            ...currentProject.stepOutputs,
            [step.id]: result.output,
          },
          stepOutputMeta: {
            ...currentProject.stepOutputMeta,
            [step.id]: {
              ...(currentProject.stepOutputMeta?.[step.id] || {}),
              updatedAt: now,
            },
          },
          stepRunLogs: {
            ...currentProject.stepRunLogs,
            [step.id]: appendStepRunLog(currentProject.stepRunLogs?.[step.id], nextLog),
          },
        };

        if (binding?.variableKey?.trim() && result.output.trim()) {
          const key = binding.variableKey.trim();
          const label = binding.variableLabel?.trim() || key;
          const existing = (nextProject.variables || []).find(
            (variable) => variable.sourceType === 'step_output' && variable.sourceRef === step.id
          );
          const nextVariable: ProjectVariable = {
            id: existing?.id || `var_step_${step.id}`,
            key,
            label,
            value: result.output,
            sourceType: 'step_output',
            sourceRef: step.id,
            createdAt: existing?.createdAt || now,
            updatedAt: now,
          };
          nextProject = {
            ...nextProject,
            stepOutputMeta: {
              ...nextProject.stepOutputMeta,
              [step.id]: {
                ...(nextProject.stepOutputMeta?.[step.id] || {}),
                lastSavedToVariableAt: now,
              },
            },
            variables: upsertVariable(nextProject.variables || [], nextVariable),
          };
        }

        return nextProject;
      });

      return result.output;
    } catch (error) {
      const message = error instanceof Error ? error.message : '执行失败';
      const nextLog: StepRunLog = {
        ...logBase,
        status: 'error',
        output: '',
        error: message,
      };

      updateProjectWithSync(project.id, (currentProject) => ({
        ...currentProject,
        stepRunLogs: {
          ...currentProject.stepRunLogs,
          [step.id]: appendStepRunLog(currentProject.stepRunLogs?.[step.id], nextLog),
        },
      }));

      throw error;
    }
  };

  const handleRunStep = async (stepId: string) => {
    if (!activeProject || !activeProjectTemplate) {
      throw new Error('当前没有可执行的项目。');
    }

    const step = activeProjectTemplate.steps.find((item) => item.id === stepId);
    if (!step) {
      throw new Error('未找到要执行的步骤。');
    }

    const availability = resolveStepExecutionAvailability({
      step,
      template: activeProjectTemplate,
      modelCatalog: settings.modelCatalog,
      providerConfigs: settings.providerConfigs,
    });

    if (!availability.isRunnable || !availability.modelCatalogItem || !availability.providerConfig) {
      throw new Error(availability.message);
    }

    const override = activeProject.stepOverrides[step.id];
    const rawContent = override?.content !== undefined ? override.content : step.content || '';
    const interpolate = createInterpolator(activeProject, activeProjectTemplate);
    const userPrompt = interpolate(rawContent).trim();
    const systemPrompt = step.execution?.systemPrompt || '';
    const temperature = step.execution?.temperature;
    const maxTokens = step.execution?.maxTokens;

    if (!userPrompt) {
      throw new Error('当前步骤的插值结果为空，无法执行。');
    }

    const logBase = {
      id: `run_${Date.now()}`,
      createdAt: Date.now(),
      providerType: availability.providerConfig.providerType,
      providerLabel: availability.providerConfig.label,
      modelName: availability.modelCatalogItem.modelName,
      modelLabel: availability.modelCatalogItem.label,
      systemPrompt,
      userPrompt,
      temperature,
      maxTokens,
    };

    try {
      const result = await executeModelText({
        providerType: availability.providerConfig.providerType,
        apiKey: availability.providerConfig.apiKey,
        baseUrl: availability.providerConfig.baseUrl,
        modelName: availability.modelCatalogItem.modelName,
        systemPrompt,
        userPrompt,
        temperature,
        maxTokens,
      });

      const nextLog: StepRunLog = {
        ...logBase,
        status: 'success',
        output: result.output,
        error: '',
        rawResponse: result.rawResponse,
      };

      const binding = step.outputBinding;
      const now = Date.now();

      updateProjectWithSync(activeProject.id, (project) => {
        let nextProject: Project = {
          ...project,
          stepOutputs: {
            ...project.stepOutputs,
            [step.id]: result.output,
          },
          stepOutputMeta: {
            ...project.stepOutputMeta,
            [step.id]: {
              ...(project.stepOutputMeta?.[step.id] || {}),
              updatedAt: now,
            },
          },
          stepRunLogs: {
            ...project.stepRunLogs,
            [step.id]: appendStepRunLog(project.stepRunLogs?.[step.id], nextLog),
          },
        };

        if (binding?.variableKey?.trim() && result.output.trim()) {
          const key = binding.variableKey.trim();
          const label = binding.variableLabel?.trim() || key;
          const existing = (nextProject.variables || []).find(
            (variable) => variable.sourceType === 'step_output' && variable.sourceRef === step.id
          );
          const nextVariable: ProjectVariable = {
            id: existing?.id || `var_step_${step.id}`,
            key,
            label,
            value: result.output,
            sourceType: 'step_output',
            sourceRef: step.id,
            createdAt: existing?.createdAt || now,
            updatedAt: now,
          };
          nextProject = {
            ...nextProject,
            stepOutputMeta: {
              ...nextProject.stepOutputMeta,
              [step.id]: {
                ...(nextProject.stepOutputMeta?.[step.id] || {}),
                lastSavedToVariableAt: now,
              },
            },
            variables: upsertVariable(nextProject.variables || [], nextVariable),
          };
        }

        return nextProject;
      });

      return result.output;
    } catch (error) {
      const message = error instanceof Error ? error.message : '执行失败';
      const nextLog: StepRunLog = {
        ...logBase,
        status: 'error',
        output: '',
        error: message,
      };

      updateProjectWithSync(activeProject.id, (project) => ({
        ...project,
        stepRunLogs: {
          ...project.stepRunLogs,
          [step.id]: appendStepRunLog(project.stepRunLogs?.[step.id], nextLog),
        },
      }));

      throw error;
    }
  };

  const handleBakeDownload = () => {
    const project = projects.find((item) => item.id === activeTabId);
    if (!project) return;
    const template = templates.find((item) => item.id === project.templateId);
    if (!template) return;

    const interpolate = createInterpolator(project, template);
    let fullText = `Project: ${project.name}\nExported At: ${new Date().toLocaleString()}\n\n`;
    template.steps.forEach((step) => {
      const override = project.stepOverrides[step.id];
      const rawContent = override?.content !== undefined ? override.content : step.content || '';
      fullText += `### ${step.name}\n${interpolate(rawContent)}\n\n`;
    });
    ioService.exportFile(`${project.name}_baked.txt`, fullText);
  };

  const handleBatchRunStep = async (templateId: string, stepId: string) => {
    const matchedProjects = projects.filter((project) => project.templateId === templateId && !project.archived);
    if (matchedProjects.length === 0) {
      openAlert('无法批量执行', '这个模板下没有可执行的未归档项目。');
      return;
    }

    let successCount = 0;
    const failures: string[] = [];

    for (const project of matchedProjects) {
      try {
        await executeProjectStep(project.id, stepId);
        successCount += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : '执行失败';
        failures.push(`${project.name}: ${message}`);
      }
    }

    const failureSummary =
      failures.length > 0 ? `\n失败 ${failures.length} 个：\n${failures.slice(0, 5).join('\n')}` : '';
    openAlert('批量执行完成', `成功 ${successCount} 个项目。${failureSummary}`);
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
    const normalizedTemplates = newTemplates.map((template) => normalizeTemplate(template, settings.modelCatalog));

    setTemplates((prev) => {
      const merged = [...prev];
      normalizedTemplates.forEach((nextTemplate) => {
        const index = merged.findIndex((template) => template.id === nextTemplate.id);
        if (index >= 0) merged[index] = nextTemplate;
        else merged.push(nextTemplate);
      });
      return merged;
    });

    setProjects((prev) => {
      const merged = [...prev];
      newProjects.forEach((nextProject) => {
        const normalizedProject = normalizeProject(nextProject, normalizedTemplates.length > 0 ? normalizedTemplates : templates);
        const index = merged.findIndex((project) => project.id === normalizedProject.id);
        if (index >= 0) merged[index] = normalizedProject;
        else merged.push(normalizedProject);
      });
      return merged;
    });
  };

  const handleDeleteProvider = (providerId: string) => {
    const isReferenced = settings.modelCatalog.some((item) => item.providerConfigId === providerId);
    if (isReferenced) {
      openAlert('无法删除提供商', '还有模型目录项在使用这个提供商。请先调整或删除相关模型目录项。');
      return;
    }

    openConfirm('删除提供商', '确认删除这个提供商配置吗？', () => {
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
      openAlert('无法删除模型目录项', '还有模板模型引用在使用这个模型目录项。请先调整模板里的模型引用。');
      return;
    }

    openConfirm('删除模型目录项', '确认删除这个模型目录项吗？', () => {
      updateSettings({
        modelCatalog: settings.modelCatalog.filter((item) => item.id !== modelCatalogItemId),
      });
    });
  };

  const editingTemplate = templates.find((template) => template.id === editingTemplateId);
  const activeProject = activeTabId !== 'library' ? projects.find((project) => project.id === activeTabId) : null;
  const activeProjectTemplate = activeProject ? templates.find((template) => template.id === activeProject.templateId) : null;

  return (
    <div className={`app-root flex h-screen flex-col overflow-hidden font-sans text-slate-200 ${settings.fontSize}`}>
      {editingTemplateId && editingTemplate && (
        <div className="fixed inset-0 z-[100] bg-slate-950 animate-in fade-in zoom-in-95 duration-200">
          <TemplateEditor
            language={settings.language}
            template={editingTemplate}
            modelCatalog={settings.modelCatalog}
            providerConfigs={settings.providerConfigs}
            onSave={(updatedTemplate) => {
              handleSaveTemplateWithHistory(updatedTemplate);
            }}
            onCancel={() => setEditingTemplateId(null)}
            onRequestConfirm={openConfirm}
          />
        </div>
      )}

      <TopNav
        isSidebarOpen={settings.isSidebarOpen}
        onToggleSidebar={() => updateSettings({ isSidebarOpen: !settings.isSidebarOpen })}
        onOpenSettings={() => setIsSettingsOpen(true)}
        activeTabId={activeTabId}
        openTabIds={openTabIds}
        projects={projects}
        onOpenTab={openTab}
        onCloseTab={closeTab}
      />

      <div className="relative flex flex-1 overflow-hidden">
        <Sidebar
          language={settings.language}
          isOpen={settings.isSidebarOpen}
          width={settings.sidebarWidth}
          onWidthChange={(width) => updateSettings({ sidebarWidth: width })}
          isResizing={isResizingSidebar}
          onResizingChange={setIsResizingSidebar}
          activeProject={activeProject || null}
          activeProjectTemplate={activeProjectTemplate || null}
          onInputChange={handleInputChange}
          onAddLocalVariable={handleAddLocalVariable}
          onDeleteLocalVariable={handleDeleteLocalVariable}
          onImportVariableTable={handleImportProjectVariableTable}
          onExportVariableTable={handleExportProjectVariableTable}
          onBakeDownload={handleBakeDownload}
          onRequestAlert={openAlert}
        />

        <div className="relative flex flex-1 flex-col overflow-hidden bg-slate-950">
          {activeTabId === 'library' ? (
            <FileLibrary
              language={settings.language}
              projects={projects}
              templates={templates}
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
                openConfirm('删除项目', '确认删除这个项目？', () => {
                  setProjects(projects.filter((project) => project.id !== id));
                  closeTab(id);
                })
              }
              onDeleteProjects={(ids) =>
                openConfirm('批量删除', '确认删除所选项目？', () => {
                  setProjects(projects.filter((project) => !ids.includes(project.id)));
                  ids.forEach((id) => closeTab(id));
                })
              }
              onDeleteTemplate={(id) =>
                openConfirm('删除模板', '确认删除这个模板？', () => {
                  setTemplates(templates.filter((template) => template.id !== id));
                })
              }
              onImportData={(nextProjects, nextTemplates) => {
                const normalizedTemplates = nextTemplates.map((template) => normalizeTemplate(template, settings.modelCatalog));
                setTemplates(normalizedTemplates);
                setProjects(nextProjects.map((project) => normalizeProject(project, normalizedTemplates)));
              }}
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
              rightPanelWidth={settings.rightPanelWidth}
              onRightPanelWidthChange={(rightPanelWidth) => updateSettings({ rightPanelWidth })}
              isRightPanelOpen={settings.isRightPanelOpen}
              onRightPanelOpenChange={(isRightPanelOpen) => updateSettings({ isRightPanelOpen })}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-700">请从文件库打开项目</div>
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
