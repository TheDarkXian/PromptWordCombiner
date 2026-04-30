import React, { useEffect, useRef, useState } from 'react';
import { DEFAULT_MODEL_CATALOG, DEFAULT_PROVIDER_CONFIGS, DEFAULT_TEMPLATES } from './constants';
import { ExportModal } from './components/ExportModal';
import { FileLibrary } from './components/FileLibrary';
import { ProjectRunner } from './components/ProjectRunner';
import { SettingsModal } from './components/SettingsModal';
import { Sidebar } from './components/Sidebar';
import { TemplateEditor } from './components/TemplateEditor';
import { TopNav } from './components/TopNav';
import { ConfirmationModal } from './components/ConfirmationModal';
import { ioService, STORAGE_KEYS } from './services/ioService';
import {
  AppSettings,
  ModelCatalogItem,
  Project,
  ProjectVariable,
  SortKey,
  StepOutputMeta,
  Template,
  TemplateInput,
  TemplateModelRef,
} from './types';

type FontSize = AppSettings['fontSize'];
type UiScale = 8 | 11 | 14 | 16 | 18 | 19 | 20 | 22 | 24;

const LEGACY_MODEL_PRESET_MAP: Record<string, string> = {
  'openai:gpt-4.1': 'model_openai_gpt_4_1',
  'openai:gpt-4.1-mini': 'model_openai_gpt_4_1_mini',
  'anthropic:claude-3-7-sonnet': 'model_anthropic_claude_3_7_sonnet',
  'google:gemini-2.5-pro': 'model_gemini_2_5_pro',
};

const createDefaultSettings = (): AppSettings => ({
  uiScale: 16,
  sidebarWidth: 300,
  isSidebarOpen: true,
  rightPanelWidth: 400,
  isRightPanelOpen: true,
  fontSize: 'text-sm',
  cardScale: 300,
  fileLibrarySortBy: 'name',
  providerConfigs: DEFAULT_PROVIDER_CONFIGS.map((item) => ({ ...item })),
  modelCatalog: DEFAULT_MODEL_CATALOG.map((item) => ({ ...item })),
});

const slugifyVariableKey = (label: string) => {
  const normalized = label
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || `var_${Date.now()}`;
};

const upsertVariable = (variables: ProjectVariable[], nextVariable: ProjectVariable) => {
  const next = [...variables];
  const index = next.findIndex((variable) => variable.id === nextVariable.id);
  if (index >= 0) next[index] = nextVariable;
  else next.push(nextVariable);
  return next;
};

const markStepOutputMeta = (
  stepOutputMeta: Record<string, StepOutputMeta>,
  stepId: string,
  updates: Partial<StepOutputMeta>
) => ({
  ...stepOutputMeta,
  [stepId]: {
    updatedAt: stepOutputMeta[stepId]?.updatedAt || Date.now(),
    ...stepOutputMeta[stepId],
    ...updates,
  },
});

const normalizeSettings = (raw: any): AppSettings => {
  const defaults = createDefaultSettings();
  const providerConfigs = Array.isArray(raw?.providerConfigs) && raw.providerConfigs.length > 0
    ? raw.providerConfigs.map((provider: any, index: number) => ({
        id: provider?.id || `provider_${Date.now()}_${index}`,
        label: provider?.label || `Provider ${index + 1}`,
        providerType: provider?.providerType || 'openai',
        apiKey: provider?.apiKey || '',
        baseUrl: provider?.baseUrl || '',
        enabled: provider?.enabled !== false,
      }))
    : defaults.providerConfigs;

  const modelCatalog = Array.isArray(raw?.modelCatalog) && raw.modelCatalog.length > 0
    ? raw.modelCatalog.map((item: any, index: number) => ({
        id: item?.id || `model_${Date.now()}_${index}`,
        label: item?.label || `Model ${index + 1}`,
        providerConfigId: item?.providerConfigId || providerConfigs[0]?.id || '',
        modelName: item?.modelName || '',
        enabled: item?.enabled !== false,
      }))
    : defaults.modelCatalog;

  return {
    uiScale: raw?.uiScale || defaults.uiScale,
    sidebarWidth: raw?.sidebarWidth || defaults.sidebarWidth,
    isSidebarOpen: raw?.isSidebarOpen ?? defaults.isSidebarOpen,
    rightPanelWidth: raw?.rightPanelWidth || defaults.rightPanelWidth,
    isRightPanelOpen: raw?.isRightPanelOpen ?? defaults.isRightPanelOpen,
    fontSize: raw?.fontSize || defaults.fontSize,
    cardScale: raw?.cardScale || defaults.cardScale,
    fileLibrarySortBy: raw?.fileLibrarySortBy || defaults.fileLibrarySortBy,
    providerConfigs,
    modelCatalog,
  };
};

const normalizeTemplateModelRefs = (template: Template, modelCatalog: ModelCatalogItem[]): TemplateModelRef[] =>
  (template.modelRefs || []).map((modelRef: any) => {
    const nextModelCatalogItemId =
      modelRef?.modelCatalogItemId ||
      LEGACY_MODEL_PRESET_MAP[modelRef?.presetId || ''] ||
      undefined;

    const modelCatalogItemExists = nextModelCatalogItemId
      ? modelCatalog.some((item) => item.id === nextModelCatalogItemId)
      : false;

    return {
      id: modelRef?.id || `model_ref_${Date.now()}`,
      label: modelRef?.label || 'Model Ref',
      modelCatalogItemId: modelCatalogItemExists ? nextModelCatalogItemId : undefined,
    };
  });

const normalizeTemplate = (template: Template, modelCatalog: ModelCatalogItem[]): Template => ({
  ...template,
  modelRefs: normalizeTemplateModelRefs(template, modelCatalog),
  steps: template.steps.map((step) => ({
    ...step,
    outputBinding: {
      variableKey: step.outputBinding?.variableKey || '',
      variableLabel: step.outputBinding?.variableLabel || '',
    },
    execution: {
      modelRefId: step.execution?.modelRefId,
      systemPrompt: step.execution?.systemPrompt || '',
    },
  })),
});

const createInterpolator = (project: Project, template: Template) => {
  return (templateStr: string): string => {
    if (!templateStr) return '';
    let result = templateStr;
    const variableMap = Object.fromEntries((project.variables || []).map((variable) => [variable.key, variable.value || '']));

    result = result.replace(/\{\{([^}]+)\}\}/g, (_, rawKey) => variableMap[String(rawKey).trim()] || '');

    template.inputs.forEach((input, index) => {
      const value = project.inputValues[input.id] || '';
      result = result.split(`<${index}>`).join(value);
      result = result.split(`<${input.label}>`).join(value);
    });

    (project.customInputs || []).forEach((input, index) => {
      const value = project.inputValues[input.id] || '';
      result = result.split(`<l${index + 1}>`).join(value);
      result = result.split(`<${input.label}>`).join(value);
    });

    template.steps.forEach((step, index) => {
      const output = project.stepOutputs[step.id] || '';
      result = result.split(`[[${index + 1}]]`).join(output);
      result = result.split(`[[${step.name}]]`).join(output);
    });

    return result;
  };
};

const syncProjectVariables = (project: Project, template?: Template): ProjectVariable[] => {
  const now = Date.now();
  const existing = project.variables || [];
  const synced: ProjectVariable[] = [];

  const findExisting = (sourceType: ProjectVariable['sourceType'], sourceRef?: string) =>
    existing.find((variable) => variable.sourceType === sourceType && variable.sourceRef === sourceRef);

  template?.inputs.forEach((input) => {
    const previous = findExisting('template_input', input.id);
    const nextValue = project.inputValues[input.id] || input.defaultValue || '';
    synced.push({
      id: previous?.id || `var_${input.id}`,
      key: previous?.key || slugifyVariableKey(input.label),
      label: input.label,
      value: nextValue,
      sourceType: 'template_input',
      sourceRef: input.id,
      createdAt: previous?.createdAt || now,
      updatedAt: previous && previous.value === nextValue && previous.label === input.label ? previous.updatedAt : now,
    });
  });

  (project.customInputs || []).forEach((input) => {
    const previous = findExisting('project_local', input.id);
    const nextValue = project.inputValues[input.id] || '';
    synced.push({
      id: previous?.id || `var_${input.id}`,
      key: previous?.key || slugifyVariableKey(input.label),
      label: input.label,
      value: nextValue,
      sourceType: 'project_local',
      sourceRef: input.id,
      createdAt: previous?.createdAt || now,
      updatedAt: previous && previous.value === nextValue && previous.label === input.label ? previous.updatedAt : now,
    });
  });

  existing
    .filter((variable) => variable.sourceType === 'step_output')
    .forEach((variable) => {
      const nextValue = variable.sourceRef ? project.stepOutputs[variable.sourceRef] || '' : variable.value;
      synced.push({
        ...variable,
        value: nextValue,
        updatedAt: variable.value === nextValue ? variable.updatedAt : now,
      });
    });

  existing
    .filter((variable) => !['template_input', 'project_local', 'step_output'].includes(variable.sourceType))
    .forEach((variable) => synced.push(variable));

  return synced;
};

const normalizeProject = (project: Project, templates: Template[]): Project => {
  const normalizedProject: Project = {
    ...project,
    inputValues: project.inputValues || {},
    customInputs: project.customInputs || [],
    stepOutputs: project.stepOutputs || {},
    stepOutputMeta: project.stepOutputMeta || {},
    stepOverrides: project.stepOverrides || {},
    variables: project.variables || [],
  };

  return {
    ...normalizedProject,
    variables: syncProjectVariables(
      normalizedProject,
      templates.find((template) => template.id === normalizedProject.templateId)
    ),
  };
};

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
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    isAlert: boolean;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', isAlert: false, onConfirm: () => {} });

  const hasLoadedRef = useRef(false);

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
      const nextSettings = normalizeSettings(loadedSettings);

      const loadedTemplates = await ioService.loadFromDisk<Template[]>(STORAGE_KEYS.TEMPLATES);
      const nextTemplates = (loadedTemplates || DEFAULT_TEMPLATES).map((template) =>
        normalizeTemplate(template, nextSettings.modelCatalog)
      );

      const loadedProjects = await ioService.loadFromDisk<Project[]>(STORAGE_KEYS.PROJECTS);
      const nextProjects = (loadedProjects || []).map((project) => normalizeProject(project, nextTemplates));

      setSettings(nextSettings);
      setTemplates(nextTemplates);
      setProjects(nextProjects);
      hasLoadedRef.current = true;
    };

    init();
  }, []);

  useEffect(() => {
    if (!hasLoadedRef.current) return;
    ioService.saveToDisk(STORAGE_KEYS.TEMPLATES, templates);
  }, [templates]);

  useEffect(() => {
    if (!hasLoadedRef.current) return;
    ioService.saveToDisk(STORAGE_KEYS.PROJECTS, projects);
  }, [projects]);

  useEffect(() => {
    if (!hasLoadedRef.current) return;
    ioService.saveToDisk(STORAGE_KEYS.SETTINGS, settings);
    document.documentElement.style.fontSize = `${settings.uiScale}px`;
  }, [settings]);

  useEffect(() => {
    document.documentElement.style.fontSize = `${settings.uiScale}px`;
  }, [settings.uiScale]);

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

  const createProject = (templateId: string, name: string) => {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;

    const now = Date.now();
    const newProjectBase: Project = {
      id: `proj_${now}`,
      templateId,
      name: name && name.trim() ? name.trim() : `proj_${now}`,
      createdAt: now,
      lastModifiedAt: now,
      lastOpenedAt: now,
      inputValues: {},
      customInputs: [],
      stepOutputs: {},
      stepOutputMeta: {},
      stepOverrides: {},
      variables: [],
    };

    const newProject: Project = {
      ...newProjectBase,
      variables: syncProjectVariables(newProjectBase, template),
    };

    setProjects((prev) => [...prev, newProject]);
    openTab(newProject.id);
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

  const handleSaveStepOutputAsVariable = (stepId: string) => {
    if (!activeTabId || activeTabId === 'library') return;
    const project = projects.find((item) => item.id === activeTabId);
    const template = templates.find((item) => item.id === project?.templateId);
    const step = template?.steps.find((item) => item.id === stepId);
    if (!project || !step) return;

    const output = project.stepOutputs[stepId] || '';
    if (!output.trim()) {
      openAlert('无法写入', '这个步骤的输出为空，请先填写内容再写入变量。');
      return;
    }

    const existing = (project.variables || []).find(
      (variable) => variable.sourceType === 'step_output' && variable.sourceRef === stepId
    );
    const binding = step.outputBinding;

    if (!binding?.variableKey?.trim()) {
      openAlert('无法写入', '这个步骤没有配置“输出到变量”，请先去模板里设置。');
      return;
    }

    const nextKey = binding.variableKey.trim();
    const nextLabel = binding.variableLabel?.trim() || binding.variableKey.trim();
    const now = Date.now();
    const nextVariable: ProjectVariable = {
      id: existing?.id || `var_step_${stepId}`,
      key: nextKey,
      label: nextLabel,
      value: output,
      sourceType: 'step_output',
      sourceRef: stepId,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    updateProjectWithSync(activeTabId, (currentProject) => ({
      ...currentProject,
      stepOutputMeta: markStepOutputMeta(currentProject.stepOutputMeta || {}, stepId, {
        lastSavedToVariableAt: now,
      }),
      variables: upsertVariable(currentProject.variables || [], nextVariable),
    }));
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
            template={editingTemplate}
            modelCatalog={settings.modelCatalog}
            onSave={(updatedTemplate) => {
              const normalizedTemplate = normalizeTemplate(updatedTemplate, settings.modelCatalog);
              setTemplates((prev) =>
                prev.map((template) => (template.id === normalizedTemplate.id ? normalizedTemplate : template))
              );
              setProjects((prev) =>
                prev.map((project) => {
                  if (project.templateId !== normalizedTemplate.id) return project;
                  return {
                    ...project,
                    variables: syncProjectVariables(project, normalizedTemplate),
                  };
                })
              );
              setEditingTemplateId(null);
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
          onBakeDownload={handleBakeDownload}
          onRequestAlert={openAlert}
        />

        <div className="relative flex flex-1 flex-col overflow-hidden bg-slate-950">
          {activeTabId === 'library' ? (
            <FileLibrary
              projects={projects}
              templates={templates}
              onOpenProject={openTab}
              onCreateProject={createProject}
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
              cardScale={settings.cardScale}
              onCardScaleChange={(cardScale) => updateSettings({ cardScale })}
              sortBy={settings.fileLibrarySortBy as SortKey}
              onSortChange={(fileLibrarySortBy) => updateSettings({ fileLibrarySortBy })}
            />
          ) : activeProject && activeProjectTemplate ? (
            <ProjectRunner
              project={activeProject}
              template={activeProjectTemplate}
              onUpdateProject={(id, updates) => updateProjectWithSync(id, (project) => ({ ...project, ...updates }))}
              onUpdateTemplate={(id, updates) =>
                setTemplates((prev) =>
                  prev.map((template) =>
                    template.id === id ? normalizeTemplate({ ...template, ...updates }, settings.modelCatalog) : template
                  )
                )
              }
              onSaveStepOutputAsVariable={handleSaveStepOutputAsVariable}
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
