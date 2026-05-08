
import React, { useCallback, useRef, useState, useMemo, useEffect } from 'react';
import { Project, Template, SortKey, UiLanguage } from '../types';
import { t } from '../services/i18n';
import { Button } from './Button';
import { CreateProjectModal } from './CreateProjectModal';
import { BatchCreateProjectsModal } from './BatchCreateProjectsModal';
import { BatchRunStepModal } from './BatchRunStepModal';
import { BatchRunProgressModal, BatchRunProgressState } from './BatchRunProgressModal';
import { HighlightEffect } from './HighlightEffect';
import { MergeModal } from './MergeModal';
import { ioService } from '../services/ioService';
import { validateBackupBundle } from '../services/schemas';

interface FileLibraryProps {
  language: UiLanguage;
  projects: Project[];
  templates: Template[];
  onOpenProject: (projectId: string) => void;
  onCreateProject: (templateId: string, name: string) => void;
  onBatchCreateProjects: (templateId: string, content: string) => void;
  onBatchRunStep: (templateId: string, stepId: string) => void;
  batchRunProgress: BatchRunProgressState;
  onRetryFailedBatchRun: () => void;
  onCloseBatchRunProgress: () => void;
  onExportBatchRunResults: (format: 'json' | 'csv', scope: 'all' | 'success' | 'error') => void;
  onCreateTemplate: () => void;
  onEditTemplate: (templateId: string) => void;
  onUpdateTemplate: (templateId: string, updates: Partial<Template>) => void;
  onDuplicateTemplate: (templateId: string) => void;
  onCreateTemplateFromProject: (projectId: string) => void;
  onDeleteProject: (id: string) => void;
  onDeleteProjects: (ids: string[]) => void;
  onDeleteTemplate: (id: string) => void;
  onImportData: (projects: Project[], templates: Template[]) => void;
  onMergeData: (projects: Project[], templates: Template[]) => void;
  onOpenExport: () => void;
  onRequestAlert: (title: string, message: string) => void;
  onArchiveProject?: (id: string) => void;
  onUnarchiveProject?: (id: string) => void;
  cardScale: number;
  onCardScaleChange: (scale: number) => void;
  sortBy: SortKey;
  onSortChange: (key: SortKey) => void;
}

const formatFullDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.getFullYear()}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}`;
};

export const FileLibrary: React.FC<FileLibraryProps> = ({
  language,
  projects,
  templates,
  onOpenProject,
  onCreateProject,
  onBatchCreateProjects,
  onBatchRunStep,
  batchRunProgress,
  onRetryFailedBatchRun,
  onCloseBatchRunProgress,
  onExportBatchRunResults,
  onCreateTemplate,
  onEditTemplate,
  onUpdateTemplate,
  onDuplicateTemplate,
  onCreateTemplateFromProject,
  onDeleteProject,
  onDeleteProjects,
  onDeleteTemplate,
  onImportData,
  onMergeData,
  onOpenExport,
  onRequestAlert,
  onArchiveProject,
  onUnarchiveProject,
  cardScale,
  onCardScaleChange,
  sortBy,
  onSortChange
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isGrouped, setIsGrouped] = useState<boolean>(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [createModalInfo, setCreateModalInfo] = useState<{ isOpen: boolean; templateId: string | null }>({
    isOpen: false,
    templateId: null
  });
  const [batchCreateModalInfo, setBatchCreateModalInfo] = useState<{ isOpen: boolean; templateId: string | null }>({
    isOpen: false,
    templateId: null
  });
  const [selectedBatchTemplateId, setSelectedBatchTemplateId] = useState<string>('');
  const [isBatchRunModalOpen, setIsBatchRunModalOpen] = useState(false);
  const [lastCreatedId, setLastCreatedId] = useState<string | null>(null);
  
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const [tagSearch, setTagSearch] = useState('');

  const sortProjects = useCallback((projs: Project[]) => {
    return [...projs].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'createdAt') return (b.createdAt || 0) - (a.createdAt || 0);
      return (b.lastModifiedAt || 0) - (a.lastModifiedAt || 0);
    });
  }, [sortBy]);

  useEffect(() => {
    if (projects.length > 0) {
      const latest = [...projects].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
      if (Date.now() - (latest.createdAt || 0) < 5000) {
        setLastCreatedId(latest.id);
      }
    }
  }, [projects]);

  const groupedData = useMemo(() => {
    let visibleProjects = projects.filter(p => {
      const template = templates.find(t => t.id === p.templateId);
      if (template?.hideProjects) return false;
      if (!showArchived && p.archived) return false;
      if (tagSearch.trim()) {
        const searchLower = tagSearch.trim().toLowerCase();
        const tplTags = (template?.tags || []).map((t) => t.toLowerCase());
        const projectTags = (p as any).tags || [];
        if (
          !tplTags.some((t) => t.includes(searchLower)) &&
          !projectTags.some((t: string) => t.toLowerCase().includes(searchLower))
        ) {
          return false;
        }
      }
      return true;
    });

    const sorted = sortProjects(visibleProjects);
    
    if (!isGrouped) return { 'all': sorted };
    
    const groups: Record<string, Project[]> = {};
    sorted.forEach(p => {
      const template = templates.find(t => t.id === p.templateId);
      const groupName = template?.name || t(language, 'fileLibrary.ungroupedProjects');
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(p);
    });
    return groups;
  }, [isGrouped, language, projects, showArchived, sortProjects, tagSearch, templates]);

  const toggleGroup = (groupName: string) => {
    const next = new Set(collapsedGroups);
    if (next.has(groupName)) next.delete(groupName);
    else next.add(groupName);
    setCollapsedGroups(next);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const content = await ioService.readFileAsText(file);
      if (!content || content.trim() === "") {
        onRequestAlert(t(language, 'fileLibrary.importFailed'), t(language, 'fileLibrary.importEmpty'));
        return;
      }
      let raw: unknown;
      try {
        raw = JSON.parse(content);
      } catch {
        onRequestAlert(t(language, 'fileLibrary.importFailed'), t(language, 'fileLibrary.importInvalidJson'));
        return;
      }
      const validation = validateBackupBundle(raw);
      if (validation.valid === false) {
        onRequestAlert(
          t(language, 'fileLibrary.importFailed'),
          t(language, 'fileLibrary.importInvalidBundle', { error: String(validation.error) })
        );
        return;
      }
      onImportData(validation.data.projects, validation.data.templates);
    } catch {
      onRequestAlert(t(language, 'fileLibrary.importFailed'), t(language, 'fileLibrary.importReadFailed'));
    }
    e.target.value = '';
  };

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAll = () => {
    if (selectedIds.size === projects.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(projects.map(p => p.id)));
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    onDeleteProjects(Array.from(selectedIds));
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  };

  const renderProjectCard = (p: Project) => {
    const template = templates.find(t => t.id === p.templateId);
    const isSelected = selectedIds.has(p.id);

    return (
      <HighlightEffect key={p.id} isActive={lastCreatedId === p.id}>
        <div 
          onClick={() => isSelectionMode ? toggleSelection(p.id) : onOpenProject(p.id)} 
          className={`group bg-slate-900 hover:bg-slate-800 border transition-all relative rounded-xl p-4 cursor-pointer ${
            isSelected ? 'border-blue-500 ring-2 ring-blue-500/20 bg-slate-800' : 'border-slate-800 hover:border-blue-500/50'
          }`}
        >
          {isSelectionMode && (
            <div className={`absolute top-3 left-3 w-5 h-5 rounded border flex items-center justify-center transition-colors z-20 ${
              isSelected ? 'bg-blue-600 border-blue-500' : 'bg-slate-950 border-slate-700'
            }`}>
              {isSelected && (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-white">
                  <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                </svg>
              )}
            </div>
          )}

          <div className={`${isSelectionMode ? 'pl-7' : ''} mb-2`}>
              <h4 className="text-base font-bold text-slate-200 group-hover:text-white mb-1 truncate">{p.name}</h4>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-slate-950 text-slate-500 px-1.5 py-0.5 rounded border border-slate-800/50">
                  {t(language, 'project.template')}: {template?.name || t(language, 'fileLibrary.missingTemplate')}
                </span>
              </div>
          </div>
          <div className="flex flex-col gap-1 border-t border-slate-800/40 mt-3 pt-3">
              <div className="flex justify-between items-center text-[9px] font-mono text-slate-600"><span>{t(language, 'fileLibrary.created')}: {formatFullDate(p.createdAt)}</span></div>
              <div className="flex justify-between items-center text-[9px] font-mono text-blue-600/60"><span>{t(language, 'fileLibrary.modified')}: {formatFullDate(p.lastModifiedAt)}</span></div>
          </div>
          
          {!isSelectionMode && (
            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {p.archived ? (
                  <button onClick={(e) => { e.stopPropagation(); onUnarchiveProject?.(p.id); }} title={t(language, 'fileLibrary.unarchive')} className="text-slate-500 hover:text-amber-400">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3"><path d="M3.75 2a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5Z" /><path fillRule="evenodd" d="M3 5.25a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 .75.75v6.5A2.25 2.25 0 0 1 10.75 14h-5.5A2.25 2.25 0 0 1 3 11.75v-6.5Zm1.5.75v5.75c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75V6h-7Z" clipRule="evenodd" /></svg>
                  </button>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); onArchiveProject?.(p.id); }} title={t(language, 'fileLibrary.archive')} className="text-slate-500 hover:text-amber-400">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3"><path d="M3 2a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1H3Z" /><path fillRule="evenodd" d="M3 6.75A.75.75 0 0 1 3.75 6h8.5a.75.75 0 0 1 .75.75v6.5A1.75 1.75 0 0 1 11.25 15h-6.5A1.75 1.75 0 0 1 3 13.25v-6.5Zm1.5.75v5.75c0 .138.112.25.25.25h6.5a.25.25 0 0 0 .25-.25V7.5h-7Z" clipRule="evenodd" /></svg>
                  </button>
                )}
                <button onClick={(e) => { e.stopPropagation(); onCreateTemplateFromProject(p.id); }} title={t(language, 'fileLibrary.extractTemplate')} className="text-slate-500 hover:text-blue-400"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3"><path d="M8 2a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 8 2ZM4.25 5a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5H5v6.5h6v-6.5h-1.5a.75.75 0 0 1 0-1.5h1.5A1.5 1.5 0 0 1 12.5 5.75v6.5A1.5 1.5 0 0 1 11 13.75H5a1.5 1.5 0 0 1-1.5-1.5v-6.5A1.5 1.5 0 0 1 4.25 5Z" /></svg></button>
                <button onClick={(e) => { e.stopPropagation(); onDeleteProject(p.id); }} title={t(language, 'fileLibrary.deleteForever')} className="text-slate-500 hover:text-red-400"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5Z" clipRule="evenodd" /></svg></button>
            </div>
          )}
        </div>
      </HighlightEffect>
    );
  };

  return (
    <div className="absolute inset-0 bg-slate-950 z-50 flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex justify-between items-center p-6 border-b border-slate-800 bg-slate-900 shrink-0">
        <div className="flex items-center gap-4">
             <h2 className="text-xl font-bold text-white tracking-tight">{t(language, 'fileLibrary.title')}</h2>
             <span className="text-xs text-slate-500 border-l border-slate-700 pl-4 py-1">{t(language, 'fileLibrary.subtitle')}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 mr-4">
            <input type="file" ref={fileInputRef} onChange={handleImportFile} className="hidden" accept=".json" />
            <button onClick={() => fileInputRef.current?.click()} className="text-[11px] text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded">{t(language, 'fileLibrary.restoreAll')}</button>
            <button onClick={onOpenExport} className="text-[11px] text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded">{t(language, 'fileLibrary.backupData')}</button>
            <button onClick={() => setIsMergeModalOpen(true)} className="text-[11px] bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white border border-blue-500/30 px-3 py-1.5 rounded transition-all">{t(language, 'fileLibrary.mergeData')}</button>
          </div>
         
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-950 relative pb-24 no-scrollbar">
         <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 flex flex-col">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 pb-2 border-b border-slate-800/50">
                <div className="flex flex-col">
                  <h3 className="text-sm font-bold text-blue-400 uppercase tracking-widest">{t(language, 'fileLibrary.assetsTitle')}</h3>
                  <p className="text-[10px] text-slate-600 mt-1 uppercase font-bold tracking-tighter">
                    {t(language, 'fileLibrary.visibleProjects', { count: Object.values(groupedData).flat().length })}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-4 md:gap-6">
                  <button 
                    onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedIds(new Set()); }}
                    className={`flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold rounded-lg border transition-all ${
                      isSelectionMode ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-600/30' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5"><path d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" /></svg>
                    {isSelectionMode ? t(language, 'fileLibrary.exitManage') : t(language, 'fileLibrary.batchManage')}
                  </button>
                  <label className="flex items-center gap-1 text-[10px] text-slate-500 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showArchived}
                      onChange={(e) => setShowArchived(e.target.checked)}
                      className="rounded"
                    />
                    {t(language, 'fileLibrary.showArchived')}
                  </label>
                  <input
                    type="text"
                    value={tagSearch}
                    onChange={(e) => setTagSearch(e.target.value)}
                    placeholder={t(language, 'fileLibrary.searchTags')}
                    className="w-32 rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-[10px] text-slate-300 outline-none focus:border-blue-500"
                  />

                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-500 font-bold uppercase whitespace-nowrap">{t(language, 'fileLibrary.scale')}</span>
                    <input type="range" min="150" max="500" value={cardScale} onChange={(e) => onCardScaleChange(parseInt(e.target.value))} className="w-24 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600"/>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setIsGrouped(!isGrouped)} className={`flex items-center gap-2 px-3 py-1 text-[10px] font-bold rounded border transition-colors ${isGrouped ? 'bg-blue-600/20 border-blue-500/50 text-blue-400' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'}`}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3"><path d="M2 3.75A.75.75 0 0 1 2.75 3h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 3.75ZM2 8a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 8Zm.75 3.5a.75.75 0 0 0 0 1.5h10.5a.75.75 0 0 0 0-1.5H2.75Z" /></svg>{isGrouped ? t(language, 'fileLibrary.grouped') : t(language, 'fileLibrary.flat')}</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <select value={sortBy} onChange={(e) => onSortChange(e.target.value as SortKey)} className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[10px] text-slate-400 outline-none hover:border-slate-600 transition-colors"><option value="lastModified">{t(language, 'fileLibrary.sortByModified')}</option><option value="createdAt">{t(language, 'fileLibrary.sortByCreated')}</option><option value="name">{t(language, 'fileLibrary.sortByName')}</option></select>
                  </div>
                </div>
            </div>
            <div className="space-y-10">
              {Object.entries(groupedData).map(([groupName, projs]) => {
                const isCollapsed = collapsedGroups.has(groupName);
                if ((projs as Project[]).length === 0) return null;
                return (
                  <div key={groupName} className="space-y-4">
                    {isGrouped && (
                      <div 
                        className="flex items-center justify-between cursor-pointer group/header select-none p-1 -ml-1 rounded-lg hover:bg-slate-900/40 transition-colors"
                        onClick={() => toggleGroup(groupName)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`h-4 w-1 rounded-full transition-colors ${isCollapsed ? 'bg-slate-700' : 'bg-blue-500'}`}></div>
                          <h4 className={`text-xs font-black uppercase tracking-tighter transition-colors ${isCollapsed ? 'text-slate-600' : 'text-slate-500'}`}>
                            {groupName} 
                            <span className="ml-2 text-[10px] font-normal text-slate-700">({t(language, 'fileLibrary.projectCount', { count: (projs as Project[]).length })})</span>
                          </h4>
                        </div>
                        <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          viewBox="0 0 16 16" 
                          fill="currentColor" 
                          className={`w-4 h-4 text-slate-700 transition-transform duration-300 ${isCollapsed ? '' : 'rotate-180'}`}
                        >
                          <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                    
                    {!isCollapsed && (
                      <div className="grid gap-4 animate-in fade-in slide-in-from-top-1 duration-200" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${cardScale}px, 1fr))` }}>
                        {(projs as Project[]).map(p => renderProjectCard(p))}
                      </div>
                    )}
                  </div>
                );
              })}
              {Object.values(groupedData).flat().length === 0 && (
                <div className="flex flex-col items-center justify-center py-32 text-center opacity-30 grayscale scale-95">
                  <div className="w-16 h-16 border border-slate-700 rounded-full flex items-center justify-center mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">{t(language, 'fileLibrary.noVisibleAssets')}</h3>
                  <p className="text-[10px] mt-2 max-w-xs text-slate-500 font-bold uppercase">{t(language, 'fileLibrary.noVisibleAssetsHint')}</p>
                </div>
              )}
            </div>
          </div>
          <div className="lg:col-span-4">
             <div className="flex items-center justify-between mb-6 pb-2 border-b border-slate-800/50"><h3 className="text-sm font-bold text-emerald-400 uppercase tracking-widest">{t(language, 'fileLibrary.quickCreate')}</h3><button onClick={onCreateTemplate} className="text-[10px] text-slate-500 hover:text-white transition-colors underline underline-offset-4">{t(language, 'fileLibrary.newTemplate')}</button></div>
             <div className="mb-4 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">{t(language, 'fileLibrary.batchInstantiate')}</div>
              <div className="flex items-center gap-2">
                <select
                  value={selectedBatchTemplateId}
                  onChange={(event) => setSelectedBatchTemplateId(event.target.value)}
                  className="flex-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-300 outline-none focus:border-blue-500"
                >
                  <option value="">{t(language, 'fileLibrary.selectTemplate')}</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!selectedBatchTemplateId}
                  onClick={() => setBatchCreateModalInfo({ isOpen: true, templateId: selectedBatchTemplateId })}
                >
                  {t(language, 'fileLibrary.batchCreate')}
                </Button>
                <Button
                  size="sm"
                  variant="success"
                  onClick={() => setIsBatchRunModalOpen(true)}
                >
                  {t(language, 'fileLibrary.batchRun')}
                </Button>
              </div>
             </div>
             <div className="grid grid-cols-1 gap-3">
              {templates.map((templateItem) => (
                <div key={templateItem.id} className={`bg-slate-900/50 border rounded-lg p-4 transition-all relative group/tcard ${templateItem.hideProjects ? 'opacity-60 border-slate-800' : 'border-slate-800 hover:border-slate-700'}`}>
                   <div className="flex justify-between items-start mb-1">
                     <h4 className={`font-bold text-sm truncate pr-8 ${templateItem.hideProjects ? 'text-slate-500' : 'text-slate-200'}`}>{templateItem.name}</h4>
                      {/* tags */}
                      {templateItem.tags && templateItem.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {templateItem.tags.map((tag, idx) => (
                            <span key={idx} className="text-[9px] rounded-full border border-amber-500/20 bg-amber-500/5 px-2 py-0.5 text-amber-500/70">
                              {tag}
                            </span>
                         ))}
                       </div>
                     )}
                    {/* Toggle asset visibility for this template */}
                    <button 
                      onClick={(e) => { e.stopPropagation(); onUpdateTemplate(templateItem.id, { hideProjects: !templateItem.hideProjects }); }}
                      className={`absolute top-4 right-4 p-1 rounded-md transition-all ${templateItem.hideProjects ? 'text-slate-600 hover:text-blue-400' : 'text-slate-700 hover:text-blue-400 opacity-0 group-hover/tcard:opacity-100'}`}
                      title={templateItem.hideProjects ? t(language, 'fileLibrary.showTemplateAssets') : t(language, 'fileLibrary.hideTemplateAssets')}
                    >
                      {templateItem.hideProjects ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                          <path d="M12.44 11.38a6.47 6.47 0 0 1-8.88 0l-.06-.05a.75.75 0 0 1 1.01-1.11l.05.04c1.88 1.7 4.93 1.7 6.81 0l.05-.04a.75.75 0 0 1 1.01 1.11l-.05.05Z" />
                          <path d="M11.234 3.23a.75.75 0 0 0-1.06 0l-5.657 5.658a.75.75 0 1 0 1.06 1.06l5.657-5.657a.75.75 0 0 0 0-1.06Z" />
                          <path fillRule="evenodd" d="M14.97 10.47a.75.75 0 0 1 0 1.06l-3.5 3.5a.75.75 0 0 1-1.06-1.06l2.97-2.97-2.97-2.97a.75.75 0 0 1 1.06-1.06l3.5 3.5ZM1.03 5.53a.75.75 0 0 1 0-1.06l3.5-3.5a.75.75 0 0 1 1.06 1.06L2.62 5l2.97 2.97a.75.75 0 1 1-1.06 1.06l-3.5-3.5Z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                          <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
                          <path fillRule="evenodd" d="M1.38 8.28a.87.87 0 0 1 0-.56 6.33 6.33 0 0 1 13.24 0 .87.87 0 0 1 0 .56 6.33 6.33 0 0 1-13.24 0ZM8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <div className="flex gap-2 text-[9px] text-slate-600 mb-4 font-mono"><span>{templateItem.steps.length} STEPS</span><span>{templateItem.inputs.length} VARS</span></div>
                  <div className="flex gap-2">
                      <Button onClick={() => setCreateModalInfo({ isOpen: true, templateId: templateItem.id })} className="flex-1 h-8 text-[11px]" size="sm" variant="success">{t(language, 'fileLibrary.useTemplate')}</Button>
                      <button onClick={() => onDuplicateTemplate(templateItem.id)} className="px-2.5 bg-slate-950 border border-slate-800 text-slate-500 hover:text-blue-400 rounded transition-colors" title={t(language, 'fileLibrary.duplicateTemplate')}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                          <path d="M4 4c0-1.1.9-2 2-2h4.688c.265 0 .52.105.707.293l2.312 2.312c.188.188.293.442.293.707V12c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2V4Z" />
                          <path d="M2.5 6A1.5 1.5 0 0 0 1 7.5v6A1.5 1.5 0 0 0 2.5 15h6A1.5 1.5 0 0 0 10 13.5V13H2.5V6Z" />
                        </svg>
                      </button>
                      <button onClick={() => onEditTemplate(templateItem.id)} className="px-3 bg-slate-950 border border-slate-800 text-[10px] text-slate-500 hover:text-white rounded" title={t(language, 'fileLibrary.editTemplate')}>{t(language, 'fileLibrary.editTemplate')}</button>
                      <button onClick={() => onDeleteTemplate(templateItem.id)} className="px-2 bg-slate-950 border border-slate-800 text-slate-500 hover:text-red-400 rounded transition-colors" title={t(language, 'fileLibrary.deleteTemplate')}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5Z" clipRule="evenodd" /></svg></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {isSelectionMode && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur-xl border border-slate-700 rounded-2xl px-6 py-4 flex items-center gap-6 shadow-2xl z-[60] animate-in slide-in-from-bottom-4 duration-300 ring-1 ring-white/5">
              <div className="flex flex-col pr-6 border-r border-slate-800">
                <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{t(language, 'fileLibrary.selected')}</span>
                <span className="text-xl font-black text-blue-400">{selectedIds.size}</span>
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" size="sm" onClick={selectAll} className="text-slate-300 hover:bg-slate-800">
                  {selectedIds.size === projects.length ? t(language, 'fileLibrary.clearAll') : t(language, 'fileLibrary.selectAll')}
                </Button>
                <Button variant="danger" size="sm" onClick={handleBatchDelete} disabled={selectedIds.size === 0} className="shadow-lg shadow-red-500/20 px-6 font-bold">
                  {t(language, 'fileLibrary.batchDelete')}
                </Button>
                <button onClick={() => setIsSelectionMode(false)} className="text-[11px] text-slate-500 hover:text-white px-2">{t(language, 'fileLibrary.cancel')}</button>
              </div>
          </div>
        )}
      </div>
      <CreateProjectModal isOpen={createModalInfo.isOpen} onConfirm={(name) => { if (createModalInfo.templateId) { onCreateProject(createModalInfo.templateId, name); setCreateModalInfo({ isOpen: false, templateId: null }); } }} onCancel={() => setCreateModalInfo({ isOpen: false, templateId: null })} />
      <BatchCreateProjectsModal
        isOpen={batchCreateModalInfo.isOpen}
        template={templates.find((template) => template.id === batchCreateModalInfo.templateId) || null}
        onConfirm={(content) => {
          if (batchCreateModalInfo.templateId) {
            onBatchCreateProjects(batchCreateModalInfo.templateId, content);
            setBatchCreateModalInfo({ isOpen: false, templateId: null });
          }
        }}
        onCancel={() => setBatchCreateModalInfo({ isOpen: false, templateId: null })}
      />
      <BatchRunStepModal
        isOpen={isBatchRunModalOpen}
        templates={templates}
        projects={projects}
        onConfirm={(templateId, stepId) => {
          onBatchRunStep(templateId, stepId);
          setIsBatchRunModalOpen(false);
        }}
        onCancel={() => setIsBatchRunModalOpen(false)}
      />
      <BatchRunProgressModal
        state={batchRunProgress}
        onRetryFailed={onRetryFailedBatchRun}
        onClose={onCloseBatchRunProgress}
        onExportResults={onExportBatchRunResults}
      />
      <MergeModal 
        isOpen={isMergeModalOpen} 
        onClose={() => setIsMergeModalOpen(false)} 
        currentProjects={projects} 
        currentTemplates={templates} 
        onConfirmMerge={onMergeData}
        onRequestAlert={onRequestAlert}
      />
    </div>
  );
};
