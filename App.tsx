
import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Project, Template, TemplateInput } from './types';
import { DEFAULT_TEMPLATES } from './constants';
import { Button } from './components/Button';
import { ProjectRunner } from './components/ProjectRunner';
import { TemplateEditor } from './components/TemplateEditor';
import { FileLibrary } from './components/FileLibrary';
import { ConfirmationModal } from './components/ConfirmationModal';
import { ExportModal } from './components/ExportModal';
import { SettingsModal } from './components/SettingsModal';
import { 
  MenuIcon, 
  SettingsIcon, 
  CloseIcon, 
  VarsIcon, 
  NavIcon, 
  BuildIcon, 
  ChevronDownIcon, 
  DownloadIcon, 
  ProjectEmptyIcon 
} from './components/Icons';

const STORAGE_PROJECTS = 'prompt-splicer-projects-v2';
const STORAGE_TEMPLATES = 'prompt-splicer-templates-v2';
const STORAGE_SETTINGS = 'prompt-splicer-settings-v2';

type SidebarTab = 'vars' | 'nav' | 'build';
type FontSize = 'text-xs' | 'text-sm' | 'text-base';
type UiScale = 8 | 11 | 14 | 16 | 18 | 19 | 20 | 22 | 24;

const AutoResizeSidebarTextarea: React.FC<{
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}> = ({ value, onChange, placeholder, className }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const adjustHeight = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.max(32, el.scrollHeight)}px`;
    }
  };
  useLayoutEffect(() => {
    const timeout = setTimeout(adjustHeight, 0);
    return () => clearTimeout(timeout);
  }, [value]);
  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`block w-full resize-none overflow-hidden bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all ${className}`}
      rows={1}
      spellCheck={false}
    />
  );
};

const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [openTabIds, setOpenTabIds] = useState<string[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // 设置相关 - 调整初始比例为 8 (50%)
  const [fontSize, setFontSize] = useState<FontSize>('text-sm');
  const [uiScale, setUiScale] = useState<UiScale>(8);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [rightPanelWidth, setRightPanelWidth] = useState(400);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>('vars');
  
  const [sidebarSections, setSidebarSections] = useState({ global: true, local: true });
  const [isAddingVariable, setIsAddingVariable] = useState(false);
  const [newVarName, setNewVarName] = useState("");
  const newVarInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    // 1. 加载项目
    const savedProjects = localStorage.getItem(STORAGE_PROJECTS);
    if (savedProjects) {
       try {
         const loaded = JSON.parse(savedProjects);
         setProjects(loaded.map((p: any) => ({ ...p, customInputs: p.customInputs || [] })));
       } catch (e) {
         console.warn("Failed to load projects, clearing corrupted data...", e);
         localStorage.removeItem(STORAGE_PROJECTS);
         setProjects([]);
       }
    }

    // 2. 加载模版
    const savedTemplates = localStorage.getItem(STORAGE_TEMPLATES);
    if (savedTemplates) {
      try {
        const loadedTemplates = JSON.parse(savedTemplates);
        setTemplates(loadedTemplates);
      } catch (e) {
        console.warn("Failed to load templates, resetting...", e);
        localStorage.removeItem(STORAGE_TEMPLATES);
        setTemplates(DEFAULT_TEMPLATES);
      }
    } else {
      setTemplates(DEFAULT_TEMPLATES);
    }

    // 3. 加载设置
    const savedSettings = localStorage.getItem(STORAGE_SETTINGS);
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        if (settings.uiScale) setUiScale(settings.uiScale);
        if (settings.sidebarWidth) setSidebarWidth(settings.sidebarWidth);
        if (settings.isSidebarOpen !== undefined) setIsSidebarOpen(settings.isSidebarOpen);
        if (settings.fontSize) setFontSize(settings.fontSize);
        if (settings.rightPanelWidth) setRightPanelWidth(settings.rightPanelWidth);
      } catch (e) {
        console.warn("Failed to load settings, resetting...", e);
        localStorage.removeItem(STORAGE_SETTINGS);
      }
    }

    if (!activeTabId && !openTabIds.length) setIsLibraryOpen(true);
  }, []);

  useEffect(() => { localStorage.setItem(STORAGE_TEMPLATES, JSON.stringify(templates)); }, [templates]);
  useEffect(() => { localStorage.setItem(STORAGE_PROJECTS, JSON.stringify(projects)); }, [projects]);
  useEffect(() => {
    localStorage.setItem(STORAGE_SETTINGS, JSON.stringify({ uiScale, sidebarWidth, isSidebarOpen, rightPanelWidth, isRightPanelOpen, fontSize }));
    document.documentElement.style.fontSize = `${uiScale}px`;
  }, [uiScale, sidebarWidth, isSidebarOpen, rightPanelWidth, isRightPanelOpen, fontSize]);

  useEffect(() => { if (isAddingVariable && newVarInputRef.current) newVarInputRef.current.focus(); }, [isAddingVariable]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingSidebar) return;
      const newWidth = e.clientX;
      if (newWidth > 180 && newWidth < 600) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => { setIsResizingSidebar(false); document.body.style.cursor = 'default'; };
    if (isResizingSidebar) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
    }
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [isResizingSidebar]);

  const createProject = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;
    const now = Date.now();
    const defaultInputs: Record<string, string> = {};
    template.inputs.forEach(inp => { if (inp.defaultValue) defaultInputs[inp.id] = inp.defaultValue; });
    const newProject: Project = { 
        id: `proj_${now}`, templateId, name: `新项目`, createdAt: now, lastModifiedAt: now, lastOpenedAt: now,
        inputValues: defaultInputs, customInputs: [], stepOutputs: {}, stepOverrides: {} 
    };
    setProjects([...projects, newProject]);
    openTab(newProject.id);
  };

  const updateProjectTimestamp = (projectId: string, isModification: boolean = true) => {
    const now = Date.now();
    setProjects(prev => prev.map(p => {
        if (p.id === projectId) {
            return {
                ...p,
                lastOpenedAt: now,
                ...(isModification ? { lastModifiedAt: now } : {})
            };
        }
        return p;
    }));
  };

  const handleInputChange = (projectId: string, inputId: string, value: string) => {
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, lastModifiedAt: Date.now(), inputValues: { ...p.inputValues, [inputId]: value } } : p));
  };

  const confirmAddLocalVariable = (projectId: string) => {
    const trimmed = newVarName.trim();
    if (!trimmed) { setIsAddingVariable(false); return; }
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    if (project.customInputs?.some(i => i.label === trimmed)) { openAlert("重名警告", "该变量名称已存在。"); return; }
    const newInput: TemplateInput = { id: `local_${Date.now()}`, label: trimmed };
    setProjects(prev => prev.map(p => {
      if (p.id === projectId) {
        return { 
          ...p, 
          lastModifiedAt: Date.now(), 
          customInputs: [...(p.customInputs || []), newInput] 
        };
      }
      return p;
    }));
    setNewVarName("");
    setIsAddingVariable(false);
  };

  const handleBakeDownload = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const template = templates.find(t => t.id === project.templateId);
    if (!template) return;
    
    const interpolate = (templateStr: string): string => {
        if (!templateStr) return "";
        let result = templateStr;
        template.inputs.forEach((input, index) => {
          const val = project.inputValues[input.id] || "";
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
    
    const blob = new Blob([fullText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name}_烘焙结果.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const createTemplate = () => {
    const now = Date.now();
    const newTemplate: Template = {
      id: `tmpl_${now}`,
      name: `新模版`,
      inputs: [{ id: `input_${now}_0`, label: '变量1' }],
      steps: [{ id: `step_${now}_0`, name: '步骤1', content: '内容 <0>' }]
    };
    setTemplates(prev => [...prev, newTemplate]);
    setEditingTemplateId(newTemplate.id);
    setIsLibraryOpen(false);
  };

  const handleDownloadBackup = () => {
    const data = { projects, templates };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompt_splicer_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCreateTemplateFromProject = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const sourceTemplate = templates.find(t => t.id === project.templateId);
    if (!sourceTemplate) return;

    const now = Date.now();
    const newTemplate: Template = {
      id: `tmpl_${now}`,
      name: `${project.name} (从项目提取)`,
      inputs: [
        ...sourceTemplate.inputs.map(i => ({ ...i, defaultValue: project.inputValues[i.id] || i.defaultValue })),
        ...(project.customInputs || []).map(i => ({ ...i, defaultValue: project.inputValues[i.id] }))
      ],
      steps: sourceTemplate.steps.map(s => {
        const override = project.stepOverrides[s.id];
        return {
          ...s,
          content: override?.content !== undefined ? override.content : (s.content || "")
        };
      })
    };
    setTemplates(prev => [...prev, newTemplate]);
    setEditingTemplateId(newTemplate.id);
    setIsLibraryOpen(false);
  };

  const openTab = (id: string) => { 
    if (!openTabIds.includes(id)) setOpenTabIds([...openTabIds, id]); 
    setActiveTabId(id); 
    setIsLibraryOpen(false); 
    updateProjectTimestamp(id, false);
  };

  const closeTab = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const newTabs = openTabIds.filter(tid => tid !== id);
    setOpenTabIds(newTabs);
    if (activeTabId === id) {
      if (newTabs.length > 0) setActiveTabId(newTabs[newTabs.length - 1]);
      else { setActiveTabId(null); setIsLibraryOpen(true); }
    }
  };

  const sortedProjects = [...projects].sort((a, b) => (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0));

  const activeProject = projects.find(p => p.id === activeTabId);
  const activeProjectTemplate = activeProject ? templates.find(t => t.id === activeProject.templateId) : null;

  return (
    <div className={`flex flex-col h-screen overflow-hidden text-slate-200 font-sans ${fontSize} app-root`}>
      {/* Top Header - Fixed vertical scrolling by adding overflow-hidden */}
      <div className="flex items-center bg-slate-900 h-12 border-b border-slate-800 shrink-0 pr-4 z-30 relative shadow-sm overflow-hidden">
           <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`w-12 h-full flex items-center justify-center text-slate-400 hover:text-white border-r border-slate-800 hover:bg-slate-800 transition-colors shrink-0 ${isSidebarOpen ? 'bg-slate-800 text-white' : ''}`}>
             <MenuIcon className="w-5 h-5" />
           </button>
           
           <div className="px-4 font-bold text-slate-400 text-sm hidden sm:flex items-center gap-3 shrink-0">
              <span>提示词拼接器 Pro</span>
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-1.5 text-slate-600 hover:text-blue-400 transition-colors"
                title="应用设置"
              >
                <SettingsIcon className="w-4 h-4" />
              </button>
           </div>

           {/* Tab area - Added overflow-y-hidden to prevent vertical scrollbar */}
           <div className="flex-1 flex overflow-x-auto overflow-y-hidden no-scrollbar items-end h-full px-3 gap-0.5">
             {openTabIds.map(id => {
               const p = projects.find(proj => proj.id === id);
               if (!p) return null;
               const isActive = activeTabId === id;
               return (
                 <div key={id} onClick={() => openTab(id)} className={`group relative flex items-center gap-2 px-4 py-2 min-w-[120px] max-w-[200px] cursor-pointer border-t border-r border-l rounded-t text-sm transition-colors h-[90%] ${isActive ? 'bg-slate-950 border-slate-800 text-white z-10 border-b-slate-950' : 'bg-slate-900 border-transparent text-slate-500 border-b-slate-800'}`} style={{ marginBottom: '-1px' }}>
                   <span className="truncate flex-1">{p.name}</span>
                   <button onClick={(e) => closeTab(id, e)} className="p-1 rounded-full hover:bg-slate-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                     <CloseIcon className="w-3 h-3" />
                   </button>
                 </div>
               );
             })}
           </div>
           <button onClick={() => setIsLibraryOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-bold shadow-lg shadow-blue-500/20 transition-all shrink-0">文件库</button>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar */}
        <div ref={sidebarRef} style={{ width: isSidebarOpen ? sidebarWidth : 0 }} className={`bg-slate-900 flex flex-shrink-0 z-20 transition-all duration-75 relative border-r border-slate-800 ${!isSidebarOpen && 'opacity-0 overflow-hidden'}`}>
          <div className="w-12 bg-slate-950 flex flex-col items-center py-6 border-r border-slate-800 gap-6 shrink-0">
             {activeProject && (
               <>
                 <button onClick={() => setActiveSidebarTab('vars')} title="变量配置" className={`p-2 rounded-lg transition-colors ${activeSidebarTab === 'vars' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-slate-600 hover:text-slate-300'}`}>
                   <VarsIcon className="w-5 h-5" />
                 </button>
                 <button onClick={() => setActiveSidebarTab('nav')} title="步骤导航" className={`p-2 rounded-lg transition-colors ${activeSidebarTab === 'nav' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30' : 'text-slate-600 hover:text-slate-300'}`}>
                   <NavIcon className="w-5 h-5" />
                 </button>
                 <button onClick={() => setActiveSidebarTab('build')} title="导出烘焙" className={`p-2 rounded-lg transition-colors ${activeSidebarTab === 'build' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30' : 'text-slate-600 hover:text-slate-300'}`}>
                   <BuildIcon className="w-5 h-5" />
                 </button>
               </>
             )}
          </div>
          <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden relative">
             <div className="flex-1 overflow-hidden flex flex-col">
                {activeProject && activeProjectTemplate && (
                <>
                    {activeSidebarTab === 'vars' && (
                    <div className="flex flex-col h-full overflow-y-auto p-4 space-y-6">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between cursor-pointer group" onClick={() => setSidebarSections(s => ({...s, global: !s.global}))}>
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider group-hover:text-slate-300 transition-colors">全局变量</span>
                                <ChevronDownIcon className={`w-4 h-4 text-slate-600 transition-transform ${sidebarSections.global ? 'rotate-180' : ''}`} />
                            </div>
                            {sidebarSections.global && activeProjectTemplate.inputs.map((input, idx) => (
                            <div key={input.id}>
                                <div className="flex items-center gap-2 mb-1.5">
                                    <span className="text-[11px] font-mono text-blue-400 font-bold">&lt;{idx}&gt;</span>
                                    <label className="text-[11px] text-slate-500 block truncate font-medium">{input.label}</label>
                                </div>
                                <AutoResizeSidebarTextarea value={activeProject.inputValues[input.id] || ''} onChange={(val) => handleInputChange(activeProject.id, input.id, val)} placeholder="..." />
                            </div>
                            ))}
                        </div>
                        <div className="space-y-3 border-t border-slate-800 pt-4">
                            <div className="flex items-center justify-between cursor-pointer group" onClick={() => setSidebarSections(s => ({...s, local: !s.local}))}>
                                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider group-hover:text-emerald-400 transition-colors">本地变量</span>
                                <ChevronDownIcon className={`w-4 h-4 text-emerald-600/50 transition-transform ${sidebarSections.local ? 'rotate-180' : ''}`} />
                            </div>
                            {sidebarSections.local && (
                            <>
                                {(activeProject.customInputs || []).map((input, idx) => (
                                <div key={input.id} className="group relative">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <span className="text-[11px] font-mono text-emerald-400 font-bold">&lt;l{idx+1}&gt;</span>
                                        <label className="text-[11px] text-slate-500 block truncate font-medium">{input.label}</label>
                                    </div>
                                    <AutoResizeSidebarTextarea value={activeProject.inputValues[input.id] || ''} onChange={(val) => handleInputChange(activeProject.id, input.id, val)} placeholder="..." />
                                    <button onClick={() => setProjects(prev => prev.map(p => p.id === activeProject.id ? { ...p, lastModifiedAt: Date.now(), customInputs: (p.customInputs || []).filter(i => i.id !== input.id) } : p))} className="absolute top-0 right-0 text-slate-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1">×</button>
                                </div>
                                ))}
                                {isAddingVariable ? (
                                <div className="bg-slate-950 border border-emerald-900/50 rounded-lg p-3 animate-in slide-in-from-top-1 duration-150">
                                    <input ref={newVarInputRef} type="text" className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none" placeholder="输入变量名称..." value={newVarName} onChange={(e) => setNewVarName(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter') confirmAddLocalVariable(activeProject.id); if(e.key === 'Escape') setIsAddingVariable(false); }} />
                                    <div className="flex justify-end gap-2 mt-3">
                                    <button onClick={() => setIsAddingVariable(false)} className="text-xs text-slate-500 px-2 py-1 hover:text-white">取消</button>
                                    <button onClick={() => confirmAddLocalVariable(activeProject.id)} className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-md transition-colors">添加</button>
                                    </div>
                                </div>
                                ) : (
                                <button onClick={() => setIsAddingVariable(true)} className="w-full py-2 border-2 border-dashed border-slate-700 rounded-lg text-xs text-slate-500 hover:border-emerald-500/50 hover:text-emerald-500 hover:bg-emerald-500/5 transition-all">+ 新增本地变量</button>
                                )}
                            </>
                            )}
                        </div>
                    </div>
                    )}

                    {activeSidebarTab === 'nav' && (
                        <div className="h-full overflow-y-auto p-3 space-y-2">
                            {activeProjectTemplate.steps.map((step, idx) => (
                                <button key={step.id} onClick={() => {
                                    const el = document.getElementById(step.id);
                                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }} className="w-full flex items-center gap-4 p-3 hover:bg-slate-800 rounded-lg text-left transition-all group active:scale-[0.98]">
                                    <span className="w-6 h-6 flex items-center justify-center shrink-0 bg-slate-800 border border-slate-700 text-xs font-bold text-slate-500 group-hover:border-amber-500 group-hover:text-amber-500 rounded-md transition-all">{idx+1}</span>
                                    <span className="text-sm text-slate-300 truncate font-medium">{step.name}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {activeSidebarTab === 'build' && (
                        <div className="p-6 flex flex-col items-center justify-center text-center h-full">
                            <div className="w-16 h-16 bg-purple-900/30 text-purple-400 rounded-2xl flex items-center justify-center mb-4 shadow-xl shadow-purple-950/20">
                                <DownloadIcon className="w-8 h-8" />
                            </div>
                            <h4 className="text-sm font-bold text-white mb-2">提示词全量烘焙</h4>
                            <p className="text-xs text-slate-500 mb-6 px-4 leading-relaxed">将当前项目的所有步骤一键导出为格式化纯文本，方便直接粘贴使用。</p>
                            <Button variant="primary" size="md" onClick={() => handleBakeDownload(activeProject.id)} className="w-full bg-purple-600 hover:bg-purple-500 shadow-lg shadow-purple-600/30">导出 .txt 烘焙文件</Button>
                        </div>
                    )}
                </>
                )}
             </div>
          </div>
          {isSidebarOpen && <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-transparent hover:bg-blue-500 cursor-col-resize z-40 transition-colors" onMouseDown={() => setIsResizingSidebar(true)} />}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
           {activeProject && activeProjectTemplate ? (
             <div className="w-full h-full flex flex-col">
                <div className="px-8 pt-6 shrink-0 flex items-center justify-between">
                    <input 
                      type="text" 
                      value={activeProject.name} 
                      onChange={(e) => setProjects(prev => prev.map(p => p.id === activeProject.id ? { ...p, lastModifiedAt: Date.now(), name: e.target.value } : p))} 
                      className="text-2xl font-black bg-transparent text-white border-none focus:ring-0 w-full p-0 tracking-tight" 
                    />
                </div>
                <div className="flex-1 overflow-hidden">
                    <ProjectRunner project={activeProject} template={activeProjectTemplate} 
                        onUpdateProject={(id, u) => {
                            setProjects(prev => prev.map(p => p.id === id ? { ...p, ...u, lastModifiedAt: Date.now() } : p));
                        }} 
                        onUpdateTemplate={(id, u) => setTemplates(prev => prev.map(t => t.id === id ? { ...t, ...u } : t))} 
                        onRequestConfirm={openConfirm} 
                        rightPanelWidth={rightPanelWidth} 
                        onRightPanelWidthChange={setRightPanelWidth} 
                        isRightPanelOpen={isRightPanelOpen} 
                        onRightPanelOpenChange={setIsRightPanelOpen} 
                        fontSizeClass={fontSize}
                    />
                </div>
             </div>
           ) : (
             <div className="w-full h-full flex items-center justify-center flex-col text-slate-700">
               <div className="w-20 h-20 bg-slate-900 rounded-3xl flex items-center justify-center mb-4 text-slate-800">
                 <ProjectEmptyIcon className="w-10 h-10" />
               </div>
               <p className="text-sm font-medium">当前未打开任何项目</p>
               <Button variant="ghost" onClick={() => setIsLibraryOpen(true)} className="mt-4 text-slate-400 hover:text-blue-400" size="md">打开项目库</Button>
             </div>
           )}

           {isLibraryOpen && <FileLibrary projects={sortedProjects} templates={templates} onOpenProject={openTab} onCreateProject={createProject} onCreateTemplate={createTemplate} onEditTemplate={(id) => { setEditingTemplateId(id); setIsLibraryOpen(false); }} onDuplicateTemplate={(id) => setTemplates([...templates, { ...JSON.parse(JSON.stringify(templates.find(t => t.id === id))), id: `tmpl_${Date.now()}_copy`, name: `副本` }])} onCreateTemplateFromProject={(id) => openConfirm("提取模版", "从该项目状态提取出新的模版结构？", () => handleCreateTemplateFromProject(id))} onDeleteProject={(id) => openConfirm("删除项目", "确定要彻底删除该项目吗？数据将无法挽回。", () => { setProjects(projects.filter(p => p.id !== id)); closeTab(id); })} onDeleteTemplate={(id) => openConfirm("删除模版", "确定要删除此模版吗？基于此模版的项目可能会出现显示异常。", () => setTemplates(templates.filter(t => t.id !== id)))} onImportData={(p, t) => { setProjects([...p]); setTemplates([...t]); }} onOpenExport={() => setIsExportModalOpen(true)} onRequestAlert={openAlert} onClose={() => setIsLibraryOpen(false)} />}
           {editingTemplateId && <div className="absolute inset-0 bg-slate-950 z-50 p-8 overflow-hidden animate-in zoom-in-95 duration-200"><TemplateEditor template={templates.find(t => t.id === editingTemplateId)!} onSave={(updated) => { setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t)); setEditingTemplateId(null); setIsLibraryOpen(true); }} onCancel={() => { setEditingTemplateId(null); setIsLibraryOpen(true); }} onRequestConfirm={openConfirm} /></div>}
        </div>
      </div>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} uiScale={uiScale} setUiScale={setUiScale} fontSize={fontSize} setFontSize={setFontSize} />
      <ExportModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} data={{ projects, templates }} onDownload={handleDownloadBackup} />
      <ConfirmationModal isOpen={modalConfig.isOpen} title={modalConfig.title} message={modalConfig.message} isAlert={modalConfig.isAlert} onConfirm={modalConfig.onConfirm} onCancel={closeModal} />
    </div>
  );
};

export default App;
