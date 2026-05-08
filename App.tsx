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
  Project,
  SortKey,
  Template,
  TemplateInput,
} from './types';
import { useAppPersistence } from './hooks/useAppPersistence';
import { useBatchRun } from './hooks/useBatchRun';
import { useModalState } from './hooks/useModalState';
import { useProjectTemplateActions } from './hooks/useProjectTemplateActions';

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

  const handleExportProjectVariableTable = async (format: 'json' | 'csv') => {
    if (!activeProject || !activeProjectTemplate) return;
    const exported = buildProjectVariableTableExport({
      project: activeProject,
      template: activeProjectTemplate,
      format,
    });
    await ioService.exportFile(exported.filename, exported.content, exported.mimeType);
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

      openAlert("Import complete", "The variable table has been imported into the current project.");
    } catch (error) {
      openAlert("Import failed", error instanceof Error ? error.message : "Variable table import failed.");
    }
  };

  const executeProjectStep = async (projectId: string, stepId: string) => {
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

      updateProjectWithSync(project.id, (currentProject) => {
        return applyProjectStepSuccess({
          project: currentProject,
          step: prepared.step,
          output: result.output,
          logBase: prepared.logBase,
          rawResponse: result.rawResponse,
        });
      });

      return result.output;
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
    executeProjectStep,
    openAlert,
  });

  const handleRunStep = async (stepId: string) => {
    if (!activeProject || !activeProjectTemplate) {
      throw new Error("There is no active project to run.");
    }
    return executeProjectStep(activeProject.id, stepId);
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
            onSave={(updatedTemplate) => {
              handleSaveTemplateWithHistory(updatedTemplate);
            }}
            onSaveExecutionPresetTemplate={saveExecutionPresetTemplate}
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
              rightPanelWidth={settings.rightPanelWidth}
              onRightPanelWidthChange={(rightPanelWidth) => updateSettings({ rightPanelWidth })}
              isRightPanelOpen={settings.isRightPanelOpen}
              onRightPanelOpenChange={(isRightPanelOpen) => updateSettings({ isRightPanelOpen })}
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
