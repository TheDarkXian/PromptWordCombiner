
import React, { useState, useEffect, useRef } from 'react';
import { AppSettings, ModelPreset, Project, ProviderConfig, Template, TemplateInput, SortKey } from './types';
import { DEFAULT_TEMPLATES } from './constants';
import { ProjectRunner } from './components/ProjectRunner';
import { TemplateEditor } from './components/TemplateEditor';
import { FileLibrary } from './components/FileLibrary';
import { ConfirmationModal } from './components/ConfirmationModal';
import { ExportModal } from './components/ExportModal';
import { SettingsModal } from './components/SettingsModal';
import { Sidebar } from './components/Sidebar';
import { TopNav } from './components/TopNav';
import { StatusBar } from './components/StatusBar';
import { ioService, STORAGE_KEYS } from './services/ioService';
import { createBackupData, DEFAULT_APP_SETTINGS, normalizeAppSettings, normalizeBackupData } from './services/dataCompatibility';

type FontSize = 'text-xs' | 'text-sm' | 'text-base';
type UiScale = 8 | 11 | 14 | 16 | 18 | 19 | 20 | 22 | 24;

const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [openTabIds, setOpenTabIds] = useState<string[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>('library');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'interface' | 'ai'>('interface');

  const [fontSize, setFontSize] = useState<FontSize>('text-sm');
  const [uiScale, setUiScale] = useState<UiScale>(16);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [rightPanelWidth, setRightPanelWidth] = useState(400);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [cardScale, setCardScale] = useState<number>(300);
  const [fileLibrarySortBy, setFileLibrarySortBy] = useState<SortKey>('name');
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [isStorageHydrated, setIsStorageHydrated] = useState(false);
  const sidebarDragWidthRef = useRef(sidebarWidth);

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean; title: string; message: string; isAlert: boolean; onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', isAlert: false, onConfirm: () => {} });

  const openConfirm = (title: string, message: string, onConfirm: () => void) => {
    setModalConfig({ isOpen: true, title, message, isAlert: false, onConfirm: () => { onConfirm(); closeModal(); } });
  };
  const openAlert = (title: string, message: string) => {
    setModalConfig({ isOpen: true, title, message, isAlert: true, onConfirm: () => closeModal() });
  };
  const closeModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));

  // 初始化加载
  useEffect(() => {
    const init = async () => {
      try {
        const [storedProjects, storedTemplates, settings] = await Promise.all([
          ioService.loadFromDisk<Project[]>(STORAGE_KEYS.PROJECTS),
          ioService.loadFromDisk<Template[]>(STORAGE_KEYS.TEMPLATES),
          ioService.loadFromDisk<any>(STORAGE_KEYS.SETTINGS),
        ]);

        const normalized = normalizeBackupData({
          projects: storedProjects || [],
          templates: storedTemplates || DEFAULT_TEMPLATES,
        });
        setProjects(normalized.projects);
        setTemplates(normalized.templates);

        if (settings) {
          setAppSettings(normalizeAppSettings(settings));
          if (settings.uiScale) setUiScale(settings.uiScale);
          if (settings.sidebarWidth) setSidebarWidth(settings.sidebarWidth);
          if (settings.isSidebarOpen !== undefined) setIsSidebarOpen(settings.isSidebarOpen);
          if (settings.fontSize) setFontSize(settings.fontSize);
          if (settings.rightPanelWidth) setRightPanelWidth(settings.rightPanelWidth);
          if (settings.isRightPanelOpen !== undefined) setIsRightPanelOpen(settings.isRightPanelOpen);
          if (settings.cardScale) setCardScale(settings.cardScale);
          if (settings.fileLibrarySortBy) setFileLibrarySortBy(settings.fileLibrarySortBy);
        }
      } finally {
        setIsStorageHydrated(true);
      }
    };
    init();
  }, []);

  // 持久化保存
  useEffect(() => {
    if (isStorageHydrated) ioService.saveToDisk(STORAGE_KEYS.TEMPLATES, templates);
  }, [isStorageHydrated, templates]);
  useEffect(() => {
    if (isStorageHydrated) ioService.saveToDisk(STORAGE_KEYS.PROJECTS, projects);
  }, [isStorageHydrated, projects]);
  useEffect(() => {
    if (!isStorageHydrated) return;
    ioService.saveToDisk(STORAGE_KEYS.SETTINGS, { ...appSettings, uiScale, sidebarWidth, isSidebarOpen, rightPanelWidth, isRightPanelOpen, fontSize, cardScale, fileLibrarySortBy });
    document.documentElement.style.fontSize = `${uiScale}px`;
  }, [isStorageHydrated, appSettings, uiScale, sidebarWidth, isSidebarOpen, rightPanelWidth, isRightPanelOpen, fontSize, cardScale, fileLibrarySortBy]);

  useEffect(() => {
    document.documentElement.style.fontSize = `${uiScale}px`;
  }, [uiScale]);

  // 侧边栏宽度调整监听
  useEffect(() => {
    if (!isResizingSidebar) return;
    const root = document.documentElement;
    sidebarDragWidthRef.current = sidebarWidth;
    root.style.setProperty('--pwc-sidebar-live-width', `${sidebarWidth}px`);

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = e.clientX;
      if (newWidth > 180 && newWidth < 600) {
        sidebarDragWidthRef.current = newWidth;
        root.style.setProperty('--pwc-sidebar-live-width', `${newWidth}px`);
      }
    };
    const handleMouseUp = () => {
      const finalWidth = sidebarDragWidthRef.current;
      setSidebarWidth(finalWidth);
      setIsResizingSidebar(false);
      document.body.style.cursor = 'default';
      requestAnimationFrame(() => root.style.removeProperty('--pwc-sidebar-live-width'));
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingSidebar, sidebarWidth]);

  const createProject = (templateId: string, name: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;
    const now = Date.now();
    const inputValues = Object.fromEntries(
      template.inputs
        .filter(input => !input.isConst && input.defaultValue !== undefined && input.defaultValue !== '')
        .map(input => [input.id, input.defaultValue as string])
    );
    const newProject: Project = { 
        id: `proj_${now}`, templateId, name: name || `新项目`, createdAt: now, lastModifiedAt: now, lastOpenedAt: now,
        inputValues, customInputs: [], stepOutputs: {}, stepOverrides: {}
    };
    setProjects(prev => [...prev, newProject]);
    openTab(newProject.id);
  };

  const createTemplate = () => {
    const now = Date.now();
    const newId = `tmpl_${now}`;
    const newTemplate: Template = {
      id: newId,
      name: `新模版`,
      inputs: [{ id: `input_${now}_0`, label: '核心变量' }],
      steps: [{ id: `step_${now}_0`, name: '步骤1', content: '在此处输入模板内容...' }]
    };
    setTemplates(prev => [...prev, newTemplate]);
    setEditingTemplateId(newId);
  };

  const openTab = (id: string) => { 
    if (id === 'library') { setActiveTabId('library'); return; }
    setOpenTabIds(prev => prev.includes(id) ? prev : [...prev, id]); 
    setActiveTabId(id); 
  };

  const closeTab = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setOpenTabIds(prev => {
        const next = prev.filter(tid => tid !== id);
        if (activeTabId === id) setActiveTabId(next.length > 0 ? next[next.length - 1] : 'library');
        return next;
    });
  };

  const handleInputChange = (inputId: string, value: string) => {
    if (!activeTabId || activeTabId === 'library') return;
    const activeProject = projects.find(project => project.id === activeTabId);
    const activeTemplate = activeProject ? templates.find(template => template.id === activeProject.templateId) : undefined;
    if (activeTemplate?.inputs.some(input => input.id === inputId && input.isConst)) return;
    setProjects(prev => prev.map(p => p.id === activeTabId ? { ...p, lastModifiedAt: Date.now(), inputValues: { ...p.inputValues, [inputId]: value } } : p));
  };

  const handleUpdateTemplate = (id: string, updates: Partial<Template>) => {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const handleAddLocalVariable = (name: string) => {
    if (!activeTabId || activeTabId === 'library') return;
    const newInput: TemplateInput = { id: `local_${Date.now()}`, label: name };
    setProjects(prev => prev.map(p => p.id === activeTabId ? { 
      ...p, 
      lastModifiedAt: Date.now(), 
      customInputs: [...(p.customInputs || []), newInput] 
    } : p));
  };

  const handleDeleteLocalVariable = (varId: string) => {
    if (!activeTabId || activeTabId === 'library') return;
    setProjects(prev => prev.map(p => p.id === activeTabId ? { 
      ...p, 
      lastModifiedAt: Date.now(), 
      customInputs: (p.customInputs || []).filter(i => i.id !== varId) 
    } : p));
  };

  const handleBakeDownload = () => {
    const project = projects.find(p => p.id === activeTabId);
    if (!project) return;
    const template = templates.find(t => t.id === project.templateId);
    if (!template) return;
    
    const interpolate = (templateStr: string): string => {
        if (!templateStr) return "";
        let result = templateStr;
        template.inputs.forEach((input, index) => {
          const val = input.isConst ? input.defaultValue || "" : project.inputValues[input.id] || "";
          result = result.split(`<${index}>`).join(val);
          result = result.split(`<${input.label}>`).join(val);
        });
        (project.customInputs || []).forEach((input, index) => {
           const val = project.inputValues[input.id] || "";
           result = result.split(`<l${index + 1}>`).join(val);
           result = result.split(`<${input.label}>`).join(val);
        });
        return result;
    };

    let fullText = `项目：${project.name}\n导出时间：${new Date().toLocaleString()}\n\n`;
    template.steps.forEach((step) => {
       const override = project.stepOverrides[step.id];
       const rawContent = override?.content !== undefined ? override.content : (step.content || "");
       fullText += `### ${step.name}\n${interpolate(rawContent)}\n\n`;
    });
    ioService.exportFile(`${project.name}_烘焙结果.txt`, fullText);
  };
     
  const handleDownloadAllData = () => {
    const backupData = createBackupData(projects, templates, appSettings);
    const jsonString = JSON.stringify(backupData, null, 2);
    
    // 生成精确到时分秒的时间戳文件名
    const now = new Date();
    const YYYY = now.getFullYear();
    const MM = (now.getMonth() + 1).toString().padStart(2, '0');
    const DD = now.getDate().toString().padStart(2, '0');
    const HH = now.getHours().toString().padStart(2, '0');
    const mm = now.getMinutes().toString().padStart(2, '0');
    const ss = now.getSeconds().toString().padStart(2, '0');
    const dateStr = `${YYYY}${MM}${DD}_${HH}${mm}${ss}`;
    
    ioService.exportFile(`pwcBeta_backup_${dateStr}.json`, jsonString, 'application/json');
  };

  const handleMergeData = (newProjects: Project[], newTemplates: Template[]) => {
    // 处理合并逻辑
    setTemplates(prev => {
      const merged = [...prev];
      newTemplates.forEach(nt => {
        const idx = merged.findIndex(t => t.id === nt.id);
        if (idx !== -1) merged[idx] = nt; // 覆盖已有的ID（如果是overwrite操作）
        else merged.push(nt); // 否则新增
      });
      return merged;
    });

    setProjects(prev => {
      const merged = [...prev];
      newProjects.forEach(np => {
        const idx = merged.findIndex(p => p.id === np.id);
        if (idx !== -1) merged[idx] = np;
        else merged.push(np);
      });
      return merged;
    });
  };

  const handleApplyInputValues = (projectId: string, values: Record<string, string>) => {
    const targetProject = projects.find(project => project.id === projectId);
    const activeTemplate = targetProject ? templates.find(template => template.id === targetProject.templateId) : undefined;
    const writableInputIds = new Set(activeTemplate?.inputs.filter(input => !input.isConst && !input.extractionDisabled).map(input => input.id) || []);
    const safeValues = Object.fromEntries(Object.entries(values).filter(([inputId]) => writableInputIds.has(inputId)));
    if (Object.keys(safeValues).length === 0) return;
    setProjects(prev => prev.map(project => project.id === projectId ? {
      ...project,
      lastModifiedAt: Date.now(),
      inputValues: { ...project.inputValues, ...safeValues },
    } : project));
  };

  const updateProviderConfigs = (providerConfigs: ProviderConfig[]) => {
    setAppSettings(prev => ({ ...prev, providerConfigs }));
  };

  const updateModelPresets = (modelPresets: ModelPreset[]) => {
    setAppSettings(prev => ({ ...prev, modelPresets }));
  };

  const editingTemplate = templates.find(t => t.id === editingTemplateId);
  const activeProject = activeTabId !== 'library' ? projects.find(p => p.id === activeTabId) : null;
  const activeProjectTemplate = activeProject ? templates.find(t => t.id === activeProject.templateId) : null;
  const statusContextLabel = editingTemplate
    ? `编辑模板：${editingTemplate.name}`
    : activeTabId === 'library'
      ? '文件库'
      : activeProject?.name || '未打开项目';

  if (!isStorageHydrated) {
    return (
      <div className={`flex h-screen items-center justify-center bg-slate-950 text-sm text-slate-500 font-sans ${fontSize}`}>
        正在加载本地项目与模板...
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-screen overflow-hidden text-slate-200 font-sans ${fontSize} app-root`}>
      {/* 全屏模板编辑器覆盖层 */}
      {editingTemplateId && editingTemplate && (
        <div className="fixed inset-x-0 top-0 bottom-6 bg-slate-950 z-[100] animate-in fade-in zoom-in-95 duration-200">
           <TemplateEditor 
              template={editingTemplate} 
              onSave={(u) => { setTemplates(prev => prev.map(t => t.id === u.id ? u : t)); setEditingTemplateId(null); }} 
              onCancel={() => setEditingTemplateId(null)} 
              onRequestConfirm={openConfirm} 
              modelPresets={appSettings.modelPresets}
              providerConfigs={appSettings.providerConfigs}
              onOpenModelSettings={() => { setSettingsInitialTab('ai'); setIsSettingsOpen(true); }}
           />
        </div>
      )}

      {/* 顶部导航组件 */}
      <TopNav 
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        onOpenSettings={() => { setSettingsInitialTab('interface'); setIsSettingsOpen(true); }}
        activeTabId={activeTabId}
        openTabIds={openTabIds}
        projects={projects}
        onOpenTab={openTab}
        onCloseTab={closeTab}
      />

      <div className="flex-1 flex overflow-hidden relative">
        {/* 侧边栏组件 */}
        <Sidebar 
          isOpen={isSidebarOpen}
          width={sidebarWidth}
          onWidthChange={setSidebarWidth}
          isResizing={isResizingSidebar}
          onResizingChange={setIsResizingSidebar}
          activeProject={activeProject || null}
          activeProjectTemplate={activeProjectTemplate || null}
          onInputChange={handleInputChange}
          onAddLocalVariable={handleAddLocalVariable}
          onDeleteLocalVariable={handleDeleteLocalVariable}
          onBakeDownload={handleBakeDownload}
          onRequestAlert={openAlert}
          providerConfigs={appSettings.providerConfigs}
          modelPresets={appSettings.modelPresets}
          onApplyInputValues={handleApplyInputValues}
        />

        {/* 主内容区域 */}
        <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden relative">
           {activeTabId === 'library' ? (
             <FileLibrary 
                projects={projects} 
                templates={templates} 
                onOpenProject={openTab} 
                onCreateProject={createProject} 
                onCreateTemplate={createTemplate} 
                onEditTemplate={setEditingTemplateId} 
                onUpdateTemplate={handleUpdateTemplate}
                onDuplicateTemplate={(id) => { const t = templates.find(x => x.id === id); if(t) { const nid = `tmpl_${Date.now()}`; setTemplates([...templates, {...t, id: nid, name: t.name+' (副本)'}]); setEditingTemplateId(nid); } }} 
                onCreateTemplateFromProject={(id) => { const p = projects.find(x => x.id === id); const t = templates.find(x => x.id === p?.templateId); if(t) { const nid = `tmpl_${Date.now()}`; setTemplates([...templates, {...t, id: nid, name: p?.name+' 提取'}]); setEditingTemplateId(nid); } }} 
                onDeleteProject={(id) => openConfirm("删除项目", "确定删除？", () => { setProjects(projects.filter(p => p.id !== id)); closeTab(id); })} 
                onDeleteProjects={(ids) => openConfirm("批量删除", "确定删除？", () => { setProjects(projects.filter(p => !ids.includes(p.id))); ids.forEach(id => closeTab(id)); })}
                onDeleteTemplate={(id) => openConfirm("删除模版", "确定删除？", () => setTemplates(templates.filter(t => t.id !== id)))} 
                onImportData={(p, t) => {
                  const normalized = normalizeBackupData({ projects: p, templates: t });
                  setProjects(normalized.projects);
                  setTemplates(normalized.templates);
                }} 
                onImportBundle={(bundle) => {
                  const normalized = normalizeBackupData(bundle);
                  setProjects(normalized.projects);
                  setTemplates(normalized.templates);
                  if (normalized.settings) setAppSettings(normalizeAppSettings(normalized.settings));
                }}
                onMergeData={handleMergeData}
                onOpenExport={() => setIsExportModalOpen(true)} 
                onRequestAlert={openAlert} 
                cardScale={cardScale}
                onCardScaleChange={setCardScale}
                sortBy={fileLibrarySortBy}
                onSortChange={setFileLibrarySortBy}
             />
           ) : activeProject && activeProjectTemplate ? (
             <ProjectRunner 
                project={activeProject} 
                template={activeProjectTemplate} 
                onUpdateProject={(id, u) => setProjects(prev => prev.map(p => {
                  if (p.id !== id) return p;
                  const updates = typeof u === 'function' ? u(p) : u;
                  return { ...p, ...updates, lastModifiedAt: Date.now() };
                }))}
                onUpdateTemplate={(id, u) => setTemplates(prev => prev.map(t => t.id === id ? { ...t, ...u } : t))} 
                onRequestConfirm={openConfirm} 
                providerConfigs={appSettings.providerConfigs}
                modelPresets={appSettings.modelPresets}
                rightPanelWidth={rightPanelWidth} 
                onRightPanelWidthChange={setRightPanelWidth} 
                isRightPanelOpen={isRightPanelOpen} 
                onRightPanelOpenChange={setIsRightPanelOpen} 
             />
           ) : <div className="flex items-center justify-center h-full text-slate-700">请从文件库打开项目</div>}
        </div>
      </div>
      <StatusBar contextLabel={statusContextLabel} />
      
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        uiScale={uiScale}
        setUiScale={setUiScale}
        fontSize={fontSize}
        setFontSize={setFontSize}
        providerConfigs={appSettings.providerConfigs}
        modelPresets={appSettings.modelPresets}
        onProviderConfigsChange={updateProviderConfigs}
        onModelPresetsChange={updateModelPresets}
        initialTab={settingsInitialTab}
      />
      <ExportModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} data={createBackupData(projects, templates, appSettings)} onDownload={handleDownloadAllData} />
      <ConfirmationModal isOpen={modalConfig.isOpen} title={modalConfig.title} message={modalConfig.message} isAlert={modalConfig.isAlert} onConfirm={modalConfig.onConfirm} onCancel={closeModal} />
    </div>
  );
};

export default App;
