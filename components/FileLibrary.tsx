
import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Project, Template } from '../types';
import { Button } from './Button';
import { CreateProjectModal } from './CreateProjectModal';
import { HighlightEffect } from './HighlightEffect';

interface FileLibraryProps {
  projects: Project[];
  templates: Template[];
  onOpenProject: (projectId: string) => void;
  onCreateProject: (templateId: string, name: string) => void;
  onCreateTemplate: () => void;
  onEditTemplate: (templateId: string) => void;
  onDuplicateTemplate: (templateId: string) => void;
  onCreateTemplateFromProject: (projectId: string) => void;
  onDeleteProject: (id: string) => void;
  onDeleteTemplate: (id: string) => void;
  onClose: () => void;
  onImportData: (projects: Project[], templates: Template[]) => void;
  onOpenExport: () => void;
  onRequestAlert: (title: string, message: string) => void;
}

const formatFullDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.getFullYear()}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}`;
};

type SortKey = 'lastModified' | 'createdAt' | 'name';

export const FileLibrary: React.FC<FileLibraryProps> = ({
  projects,
  templates,
  onOpenProject,
  onCreateProject,
  onCreateTemplate,
  onEditTemplate,
  onDuplicateTemplate,
  onCreateTemplateFromProject,
  onDeleteProject,
  onDeleteTemplate,
  onClose,
  onImportData,
  onOpenExport,
  onRequestAlert
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Library specific view settings
  const [sortBy, setSortBy] = useState<SortKey>('lastModified');
  const [cardScale, setCardScale] = useState<number>(300); // Min-width in pixels
  const [isGrouped, setIsGrouped] = useState<boolean>(false);

  // New project creation state
  const [createModalInfo, setCreateModalInfo] = useState<{ isOpen: boolean; templateId: string | null }>({
    isOpen: false,
    templateId: null
  });

  // Track the ID of the project created in THIS session for highlighting
  const [lastCreatedId, setLastCreatedId] = useState<string | null>(null);

  // Sorting logic
  const sortProjects = (projs: Project[]) => {
    return [...projs].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'createdAt') return (b.createdAt || 0) - (a.createdAt || 0);
      return (b.lastModifiedAt || 0) - (a.lastModifiedAt || 0);
    });
  };

  // Logic to detect newly added project and trigger highlight
  useEffect(() => {
    if (projects.length > 0) {
      // If we just added a project, find the one with the latest createdAt timestamp
      const latest = [...projects].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
      // Only highlight if it was created within the last 5 seconds (to avoid highlighting old projects on library open)
      if (Date.now() - (latest.createdAt || 0) < 5000) {
        setLastCreatedId(latest.id);
      }
    }
  }, [projects.length]);

  // Grouping logic
  const groupedData = useMemo(() => {
    const sorted = sortProjects(projects);
    if (!isGrouped) return { 'all': sorted };

    const groups: Record<string, Project[]> = {};
    sorted.forEach(p => {
      const template = templates.find(t => t.id === p.templateId);
      const groupName = template?.name || '未分类项目';
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(p);
    });
    return groups;
  }, [projects, sortBy, isGrouped, templates]);

  const handleCreateClick = (templateId: string) => {
    setCreateModalInfo({ isOpen: true, templateId });
  };

  const handleConfirmCreation = (name: string) => {
    if (createModalInfo.templateId) {
      onCreateProject(createModalInfo.templateId, name);
      setCreateModalInfo({ isOpen: false, templateId: null });
    }
  };

  const renderProjectCard = (p: Project) => {
    const template = templates.find(t => t.id === p.templateId);
    const cardContent = (
      <div key={p.id} onClick={() => onOpenProject(p.id)} className="group bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-blue-500/50 rounded-xl p-4 cursor-pointer transition-all relative">
        <div className="mb-2">
            <h4 className="text-base font-bold text-slate-200 group-hover:text-white mb-1 truncate">{p.name}</h4>
            <div className="flex items-center gap-2">
                 <span className="text-[10px] bg-slate-950 text-slate-500 px-1.5 py-0.5 rounded border border-slate-800/50">模版: {template?.name || '已失效'}</span>
            </div>
        </div>
        <div className="flex flex-col gap-1 border-t border-slate-800/40 mt-3 pt-3">
            <div className="flex justify-between items-center text-[9px] font-mono text-slate-600">
                <span>创建: {formatFullDate(p.createdAt)}</span>
            </div>
            <div className="flex justify-between items-center text-[9px] font-mono text-blue-600/60">
                <span>最后修改: {formatFullDate(p.lastModifiedAt)}</span>
            </div>
        </div>
        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={(e) => { e.stopPropagation(); onCreateTemplateFromProject(p.id); }} title="提取模版" className="text-slate-500 hover:text-blue-400"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3"><path d="M8 2a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 8 2ZM4.25 5a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5H5v6.5h6v-6.5h-1.5a.75.75 0 0 1 0-1.5h1.5A1.5 1.5 0 0 1 12.5 5.75v6.5A1.5 1.5 0 0 1 11 13.75H5a1.5 1.5 0 0 1-1.5-1.5v-6.5A1.5 1.5 0 0 1 4.25 5Z" /></svg></button>
            <button onClick={(e) => { e.stopPropagation(); onDeleteProject(p.id); }} title="彻底删除" className="text-slate-500 hover:text-red-400"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5Z" clipRule="evenodd" /></svg></button>
        </div>
      </div>
    );

    return (
      <HighlightEffect key={p.id} isActive={lastCreatedId === p.id}>
        {cardContent}
      </HighlightEffect>
    );
  };

  return (
    <div className="absolute inset-0 bg-slate-950 z-50 flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex justify-between items-center p-6 border-b border-slate-800 bg-slate-900 shrink-0">
        <div className="flex items-center gap-4">
             <h2 className="text-xl font-bold text-white tracking-tight">文件库</h2>
             <span className="text-xs text-slate-500 border-l border-slate-700 pl-4 py-1">本地项目管理器</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 mr-4">
            <input type="file" ref={fileInputRef} onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (event) => {
                  try {
                    const data = JSON.parse(event.target?.result as string);
                    if (data && Array.isArray(data.projects) && Array.isArray(data.templates)) onImportData(data.projects, data.templates);
                    else onRequestAlert('失败', '文件格式不匹配。');
                  } catch (err) { onRequestAlert('失败', '解析 JSON 失败。'); }
                };
                reader.readAsText(file);
                e.target.value = '';
            }} className="hidden" accept=".json" />
            <button onClick={() => fileInputRef.current?.click()} className="text-[11px] text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded">恢复数据</button>
            <button onClick={onOpenExport} className="text-[11px] text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded">备份数据</button>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 bg-slate-950">
         <div className="max-w-screen-2xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 flex flex-col">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 pb-2 border-b border-slate-800/50">
                <h3 className="text-sm font-bold text-blue-400 uppercase tracking-widest">我的游戏项目</h3>
                
                {/* Control Toolbar */}
                <div className="flex flex-wrap items-center gap-6">
                  {/* Scaling Slider */}
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-500 font-bold uppercase whitespace-nowrap">卡片缩放</span>
                    <input 
                      type="range" 
                      min="150" 
                      max="500" 
                      value={cardScale} 
                      onChange={(e) => setCardScale(parseInt(e.target.value))}
                      className="w-32 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>

                  {/* Grouping Toggle */}
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setIsGrouped(!isGrouped)}
                      className={`flex items-center gap-2 px-3 py-1 text-[10px] font-bold rounded border transition-colors ${isGrouped ? 'bg-blue-600/20 border-blue-500/50 text-blue-400' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3"><path d="M2 3.75A.75.75 0 0 1 2.75 3h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 3.75ZM2 8a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 8Zm.75 3.5a.75.75 0 0 0 0 1.5h10.5a.75.75 0 0 0 0-1.5H2.75Z" /></svg>
                      {isGrouped ? '已分类显示' : '平铺显示'}
                    </button>
                  </div>

                  {/* Sorting Dropdown */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">排序</span>
                    <select 
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as SortKey)}
                      className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[10px] text-slate-400 outline-none hover:border-slate-600 transition-colors"
                    >
                      <option value="lastModified">最后修改时间</option>
                      <option value="createdAt">创建时间</option>
                      <option value="name">项目名称</option>
                    </select>
                  </div>
                </div>
            </div>

            <div className="space-y-10">
              {Object.entries(groupedData).map(([groupName, projs]) => (
                <div key={groupName} className="space-y-4">
                  {isGrouped && (
                    <div className="flex items-center gap-3">
                      <div className="h-4 w-1 bg-blue-500 rounded-full"></div>
                      <h4 className="text-xs font-black text-slate-500 uppercase tracking-tighter">
                        {/* Fix: Explicitly cast 'projs' to 'Project[]' to avoid 'unknown' type error */}
                        {groupName} <span className="ml-2 text-[10px] font-normal text-slate-700">({(projs as Project[]).length} 个项目)</span>
                      </h4>
                    </div>
                  )}
                  <div 
                    className="grid gap-4" 
                    style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${cardScale}px, 1fr))` }}
                  >
                    {/* Fix: Explicitly cast 'projs' to 'Project[]' to avoid 'unknown' type error */}
                    {(projs as Project[]).map(p => renderProjectCard(p))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-4">
             <div className="flex items-center justify-between mb-6 pb-2 border-b border-slate-800/50">
                 <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-widest">快速创建</h3>
                 <button onClick={onCreateTemplate} className="text-[10px] text-slate-500 hover:text-white transition-colors underline underline-offset-4">新建模版</button>
             </div>
             <div className="grid grid-cols-1 gap-3">
              {templates.map(t => (
                <div key={t.id} className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 transition-colors">
                  <h4 className="font-bold text-slate-200 text-sm mb-1">{t.name}</h4>
                  <div className="flex gap-2 text-[9px] text-slate-600 mb-4 font-mono">
                     <span>{t.steps.length} STEPS</span>
                     <span>{t.inputs.length} VARS</span>
                  </div>
                  <div className="flex gap-2">
                      <Button onClick={() => handleCreateClick(t.id)} className="flex-1 h-8 text-[11px]" size="sm" variant="success">使用此模版</Button>
                      <button onClick={() => onEditTemplate(t.id)} className="px-3 bg-slate-950 border border-slate-800 text-[10px] text-slate-500 hover:text-white rounded" title="编辑模版结构">编辑</button>
                      <button onClick={() => onDeleteTemplate(t.id)} className="px-2 bg-slate-950 border border-slate-800 text-slate-500 hover:text-red-400 rounded transition-colors" title="删除模版">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5Z" clipRule="evenodd" /></svg>
                      </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      <CreateProjectModal 
        isOpen={createModalInfo.isOpen}
        onConfirm={handleConfirmCreation}
        onCancel={() => setCreateModalInfo({ isOpen: false, templateId: null })}
      />
    </div>
  );
};
