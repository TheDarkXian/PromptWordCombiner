
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { LibrarySelection, ModelPreset, Project, ProviderConfig, Template, TemplateGroup, TemplateInput } from '../types';
import { 
  VarsIcon, 
  NavIcon, 
  BuildIcon, 
  ExtractIcon,
  ChevronDownIcon, 
  DownloadIcon 
} from './Icons';
import { Button } from './Button';
import { VariableExtractionDraft, VariableExtractionTool } from './VariableExtractionTool';

type SidebarTab = 'vars' | 'nav' | 'extract' | 'build';

interface SidebarProps {
  isOpen: boolean;
  width: number;
  onWidthChange: (width: number) => void;
  isResizing: boolean;
  onResizingChange: (resizing: boolean) => void;
  activeProject: Project | null;
  activeProjectTemplate: Template | null;
  onInputChange: (inputId: string, value: string) => void;
  onAddLocalVariable: (name: string) => void;
  onDeleteLocalVariable: (varId: string) => void;
  onBakeDownload: () => void;
  onRequestAlert: (title: string, message: string) => void;
  providerConfigs: ProviderConfig[];
  modelPresets: ModelPreset[];
  onApplyInputValues: (projectId: string, values: Record<string, string>) => void;
  templates: Template[];
  templateGroups: TemplateGroup[];
  librarySelection: LibrarySelection;
  onLibrarySelectionChange: (selection: LibrarySelection) => void;
  onCreateTemplateGroup: (name: string, parentId?: string) => void;
  onRenameTemplateGroup: (groupId: string, name: string) => void;
  onDeleteTemplateGroup: (groupId: string) => void;
  onMoveTemplate: (templateId: string, groupId?: string, beforeTemplateId?: string) => void;
  onMoveTemplateGroup: (groupId: string, parentId?: string, beforeGroupId?: string) => void;
  collapsedTemplateGroupIds: string[];
  onCollapsedTemplateGroupIdsChange: (ids: string[]) => void;
}

const AutoResizeSidebarTextarea: React.FC<{
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
}> = ({ value, onChange, placeholder, className, readOnly = false }) => {
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
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const observer = new ResizeObserver(adjustHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      readOnly={readOnly}
      className={`block w-full resize-none overflow-hidden whitespace-pre-wrap break-words border rounded px-2 py-1.5 outline-none transition-all ${readOnly ? 'bg-slate-900/50 border-slate-800 text-slate-500 cursor-default' : 'bg-slate-950 border-slate-700 text-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'} ${className}`}
      rows={1}
      spellCheck={false}
    />
  );
};

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  width,
  onWidthChange,
  isResizing,
  onResizingChange,
  activeProject,
  activeProjectTemplate,
  onInputChange,
  onAddLocalVariable,
  onDeleteLocalVariable,
  onBakeDownload,
  onRequestAlert,
  providerConfigs,
  modelPresets,
  onApplyInputValues,
  templates,
  templateGroups,
  librarySelection,
  onLibrarySelectionChange,
  onCreateTemplateGroup,
  onRenameTemplateGroup,
  onDeleteTemplateGroup,
  onMoveTemplate,
  onMoveTemplateGroup,
  collapsedTemplateGroupIds,
  onCollapsedTemplateGroupIdsChange
}) => {
  const [activeTab, setActiveTab] = useState<SidebarTab>('vars');
  const [sections, setSections] = useState({ global: true, local: true });
  const [isAddingVariable, setIsAddingVariable] = useState(false);
  const [newVarName, setNewVarName] = useState("");
  const [groupContextMenu, setGroupContextMenu] = useState<{ x: number; y: number; groupId?: string } | null>(null);
  const [groupCreateDialog, setGroupCreateDialog] = useState<{ isOpen: boolean; parentId?: string; name: string }>({ isOpen: false, name: '' });
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");
  const [dragPayload, setActiveDragPayload] = useState<{ type: 'group' | 'template'; id: string } | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const dropTargetRef = useRef<string | null>(null);
  const [dragPointer, setDragPointer] = useState({ x: 0, y: 0 });
  const longPressTimerRef = useRef<number | null>(null);
  const longPressStartRef = useRef({ x: 0, y: 0 });
  const suppressClickRef = useRef(false);
  const [extractionDrafts, setExtractionDrafts] = useState<Record<string, VariableExtractionDraft>>({});
  const newVarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAddingVariable && newVarInputRef.current) {
      newVarInputRef.current.focus();
    }
  }, [isAddingVariable]);

  useEffect(() => {
    if (!groupContextMenu) return;
    const close = () => setGroupContextMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('blur', close);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('blur', close);
    };
  }, [groupContextMenu]);

  useEffect(() => {
    const cancel = () => cancelLongPress();
    window.addEventListener('mouseup', cancel);
    window.addEventListener('blur', cancel);
    return () => {
      window.removeEventListener('mouseup', cancel);
      window.removeEventListener('blur', cancel);
    };
  }, []);

  const handleAddVariable = () => {
    const trimmed = newVarName.trim();
    if (!trimmed) {
      setIsAddingVariable(false);
      return;
    }
    // 重名检查交由父组件或在此处预检查
    if (activeProject?.customInputs?.some(i => i.label === trimmed)) {
      onRequestAlert("重名警告", "该变量名称已存在。");
      return;
    }
    onAddLocalVariable(trimmed);
    setNewVarName("");
    setIsAddingVariable(false);
  };

  const createDefaultExtractionDraft = (template: Template): VariableExtractionDraft => {
    const extractableInputIds = template.inputs
      .filter(input => !input.isConst && !input.extractionDisabled)
      .map(input => input.id);
    const defaultModelRefId = (template.modelRefs || []).find(modelRef => {
      const preset = modelPresets.find(item => item.id === modelRef.modelPresetId);
      if (!preset?.enabled) return false;
      const provider = providerConfigs.find(item => item.id === preset.providerConfigId);
      return Boolean(provider?.enabled && provider.apiKey.trim());
    })?.id || '';

    return {
      sourceText: '',
      selectedInputIds: extractableInputIds,
      selectedModelRefId: defaultModelRefId,
      results: [],
      checkedInputIds: [],
      message: '',
      isExtracting: false,
    };
  };

  const openGroupCreateDialog = (parentId?: string) => {
    if (parentId && collapsedTemplateGroupIds.includes(parentId)) {
      onCollapsedTemplateGroupIdsChange(collapsedTemplateGroupIds.filter(id => id !== parentId));
    }
    setGroupContextMenu(null);
    setGroupCreateDialog({ isOpen: true, parentId, name: '' });
  };

  const commitNewGroup = () => {
    if (groupCreateDialog.name.trim()) onCreateTemplateGroup(groupCreateDialog.name, groupCreateDialog.parentId);
    setGroupCreateDialog({ isOpen: false, name: '' });
  };

  const startRenamingGroup = (group: TemplateGroup) => {
    setEditingGroupId(group.id);
    setEditingGroupName(group.name);
  };

  const commitGroupRename = () => {
    if (editingGroupId && editingGroupName.trim()) onRenameTemplateGroup(editingGroupId, editingGroupName);
    setEditingGroupId(null);
    setEditingGroupName('');
  };

  const beginLongPress = (event: React.MouseEvent, payload: { type: 'group' | 'template'; id: string }) => {
    if (event.button !== 0) return;
    longPressStartRef.current = { x: event.clientX, y: event.clientY };
    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = window.setTimeout(() => {
      suppressClickRef.current = true;
      setDragPointer({ x: longPressStartRef.current.x, y: longPressStartRef.current.y });
      setActiveDragPayload(payload);
    }, 350);
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  };

  const handleLongPressMove = (event: React.MouseEvent) => {
    if (dragPayload) return;
    if (Math.abs(event.clientX - longPressStartRef.current.x) > 5 || Math.abs(event.clientY - longPressStartRef.current.y) > 5) cancelLongPress();
  };

  const consumeSuppressedClick = (event: React.MouseEvent) => {
    if (!suppressClickRef.current) return false;
    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = false;
    return true;
  };

  const finishDrop = () => {
    dropTargetRef.current = null;
    setDropTarget(null);
    setActiveDragPayload(null);
  };

  const applyPointerDrop = (payload: { type: 'group' | 'template'; id: string }, target: string) => {
    if (target === 'root') {
      if (payload.type === 'template') onMoveTemplate(payload.id);
      if (payload.type === 'group') onMoveTemplateGroup(payload.id);
      return;
    }
    if (target.startsWith('group:')) {
      const groupId = target.slice('group:'.length);
      if (payload.type === 'template') onMoveTemplate(payload.id, groupId);
      if (payload.type === 'group') onMoveTemplateGroup(payload.id, groupId);
      return;
    }
    if (target.startsWith('before-group:') && payload.type === 'group') {
      const beforeGroupId = target.slice('before-group:'.length);
      const beforeGroup = templateGroups.find(group => group.id === beforeGroupId);
      onMoveTemplateGroup(payload.id, beforeGroup?.parentId, beforeGroupId);
      return;
    }
    if (target.startsWith('template:') && payload.type === 'template') {
      const beforeTemplateId = target.slice('template:'.length);
      const beforeTemplate = templates.find(template => template.id === beforeTemplateId);
      onMoveTemplate(payload.id, beforeTemplate?.groupId, beforeTemplateId);
    }
  };

  useEffect(() => {
    if (!dragPayload) return;
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (event: MouseEvent) => {
      setDragPointer({ x: event.clientX, y: event.clientY });
      const element = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
      const target = element?.closest<HTMLElement>('[data-library-drop]')?.dataset.libraryDrop || null;
      dropTargetRef.current = target;
      setDropTarget(target);
    };
    const handleMouseUp = () => {
      if (dropTargetRef.current) applyPointerDrop(dragPayload, dropTargetRef.current);
      finishDrop();
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.setTimeout(() => { suppressClickRef.current = false; }, 0);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [dragPayload, templateGroups, templates]);

  const toggleTemplateGroup = (groupId: string) => {
    onCollapsedTemplateGroupIdsChange(
      collapsedTemplateGroupIds.includes(groupId)
        ? collapsedTemplateGroupIds.filter(id => id !== groupId)
        : [...collapsedTemplateGroupIds, groupId]
    );
  };

  const draggedItemLabel = dragPayload?.type === 'group'
    ? templateGroups.find(group => group.id === dragPayload.id)?.name
    : templates.find(template => template.id === dragPayload?.id)?.name;

  const renderGroupTree = (parentId?: string, depth = 0): React.ReactNode => {
    const groups = templateGroups.filter(group => group.parentId === parentId).sort((a, b) => a.order - b.order);
    return groups.map(group => {
      const groupTemplates = templates.filter(template => template.groupId === group.id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const isCollapsed = collapsedTemplateGroupIds.includes(group.id);
      return (
        <div key={group.id} className={depth > 0 ? 'ml-3 border-l border-slate-800 pl-1' : ''}>
          <div
            data-library-drop={`before-group:${group.id}`}
            className={`h-2 -mb-1 relative z-10 transition-colors ${dropTarget === `before-group:${group.id}` ? 'bg-blue-500' : 'hover:bg-blue-500/50'}`}
          />
          <div
            data-library-drop={`group:${group.id}`}
            onMouseDown={event => beginLongPress(event, { type: 'group', id: group.id })}
            onMouseMove={handleLongPressMove}
            onMouseUp={cancelLongPress}
            onMouseLeave={cancelLongPress}
            onClick={event => { if (!consumeSuppressedClick(event)) toggleTemplateGroup(group.id); }}
            onContextMenu={event => {
              event.preventDefault();
              event.stopPropagation();
              setGroupContextMenu({ x: event.clientX, y: event.clientY, groupId: group.id });
            }}
            className={`group flex items-center rounded border cursor-default ${dropTarget === `group:${group.id}` ? 'border-blue-500 bg-blue-500/10' : 'border-transparent'} ${librarySelection === `group:${group.id}` ? 'bg-emerald-600/20' : 'hover:bg-slate-800'}`}
            title="点击展开或折叠，长按整行拖动"
          >
            <span className={`ml-2 text-[10px] text-slate-500 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}>▼</span>
            {editingGroupId === group.id ? (
              <input
                autoFocus
                value={editingGroupName}
                onClick={event => event.stopPropagation()}
                onMouseDown={event => event.stopPropagation()}
                onChange={event => setEditingGroupName(event.target.value)}
                onBlur={commitGroupRename}
                onKeyDown={event => { if (event.key === 'Enter') commitGroupRename(); if (event.key === 'Escape') setEditingGroupId(null); }}
                className="min-w-0 flex-1 mx-1 bg-slate-950 border border-blue-500 rounded px-2 py-1 text-xs text-white outline-none"
              />
            ) : (
              <span className="min-w-0 flex-1 px-2 py-2 text-left text-xs text-slate-300 truncate select-none">{group.name}</span>
            )}
            <span className="text-[9px] text-slate-600">{groupTemplates.length}</span>
            <button onMouseDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); onLibrarySelectionChange(`group:${group.id}`); }} className="px-1 text-[10px] text-slate-600 hover:text-emerald-300 opacity-0 group-hover:opacity-100" title="查看此分组及子分组项目">查看</button>
            <button onMouseDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); startRenamingGroup(group); }} className="px-1 text-[10px] text-slate-700 hover:text-blue-300 opacity-0 group-hover:opacity-100" title="重命名分组">改</button>
            <button onMouseDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); onDeleteTemplateGroup(group.id); }} className="pr-2 text-xs text-slate-700 hover:text-red-400 opacity-0 group-hover:opacity-100" title="删除分组">×</button>
          </div>
          {!isCollapsed && <div className="ml-3 border-l border-slate-800 pl-1">
            {groupTemplates.map(template => (
              <div
                key={template.id}
                data-library-drop={`template:${template.id}`}
                onMouseDown={event => beginLongPress(event, { type: 'template', id: template.id })}
                onMouseMove={handleLongPressMove}
                onMouseUp={cancelLongPress}
                onMouseLeave={cancelLongPress}
                className={`flex items-center rounded border cursor-default ${dropTarget === `template:${template.id}` ? 'border-blue-500 bg-blue-500/10' : 'border-transparent'} ${librarySelection === `template:${template.id}` ? 'text-blue-300 bg-blue-600/10' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}
                title="点击查看模板项目，长按整行拖动"
              >
                <button onClick={event => { if (!consumeSuppressedClick(event)) onLibrarySelectionChange(`template:${template.id}`); }} className="min-w-0 flex-1 px-2 py-1.5 text-left text-[11px] truncate">{template.name}</button>
              </div>
            ))}
          </div>}
          {!isCollapsed && renderGroupTree(group.id, depth + 1)}
        </div>
      );
    });
  };

  if (!isOpen) return null;

  return (
    <div 
      style={{ width: `var(--pwc-sidebar-live-width, ${width}px)` }}
      className={`bg-slate-900 flex flex-shrink-0 z-20 relative border-r border-slate-800 animate-in slide-in-from-left-2 ${isResizing ? '' : 'transition-[width] duration-150'}`}
    >
      {/* 左侧窄条图标导航 */}
      <div className="w-12 bg-slate-950 flex flex-col items-center py-6 border-r border-slate-800 gap-6 shrink-0">
        {activeProject ? (
          <>
            <button 
              onClick={() => setActiveTab('vars')} 
              title="变量配置" 
              className={`p-2 rounded-lg transition-colors ${activeTab === 'vars' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-slate-600 hover:text-slate-300'}`}
            >
              <VarsIcon className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setActiveTab('nav')} 
              title="步骤导航" 
              className={`p-2 rounded-lg transition-colors ${activeTab === 'nav' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30' : 'text-slate-600 hover:text-slate-300'}`}
            >
              <NavIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => setActiveTab('extract')}
              title="变量提取"
              className={`p-2 rounded-lg transition-colors ${activeTab === 'extract' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30' : 'text-slate-600 hover:text-slate-300'}`}
            >
              <ExtractIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => setActiveTab('build')} 
              title="导出烘焙" 
              className={`p-2 rounded-lg transition-colors ${activeTab === 'build' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30' : 'text-slate-600 hover:text-slate-300'}`}
            >
              <BuildIcon className="w-5 h-5" />
            </button>
          </>
        ) : (
          <button title="文件库导航" className="p-2 rounded-lg bg-blue-600 text-white shadow-lg shadow-blue-600/30">
            <NavIcon className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* 右侧内容区 */}
      <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden">
        <div className="flex-1 overflow-hidden flex flex-col">
          {activeProject && activeProjectTemplate ? (
            <>
              {activeTab === 'vars' && (
                <div className="flex flex-col h-full overflow-y-auto p-4 space-y-6 no-scrollbar">
                  {/* 全局变量 */}
                  <div className="space-y-3">
                    <div 
                      className="flex items-center justify-between cursor-pointer group" 
                      onClick={() => setSections(s => ({ ...s, global: !s.global }))}
                    >
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-slate-300 transition-colors">全局变量</span>
                      <ChevronDownIcon className={`w-3.5 h-3.5 text-slate-600 transition-transform ${sections.global ? 'rotate-180' : ''}`} />
                    </div>
                    {sections.global && activeProjectTemplate.inputs.map((input, idx) => (
                      <div key={input.id}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[10px] font-mono text-blue-400 font-bold">&lt;{idx}&gt;</span>
                          <label className="text-[10px] text-slate-500 block truncate font-medium">{input.label}</label>
                          {input.isConst && <span className="text-[9px] font-bold text-emerald-500/80">CONST</span>}
                        </div>
                        <AutoResizeSidebarTextarea 
                          value={input.isConst ? input.defaultValue || '' : activeProject.inputValues[input.id] || ''}
                          onChange={(val) => onInputChange(input.id, val)} 
                          placeholder={input.isConst ? '未设置常量值' : '...'}
                          readOnly={input.isConst}
                        />
                      </div>
                    ))}
                  </div>

                  {/* 本地变量 */}
                  <div className="space-y-3 border-t border-slate-800 pt-4">
                    <div 
                      className="flex items-center justify-between cursor-pointer group" 
                      onClick={() => setSections(s => ({ ...s, local: !s.local }))}
                    >
                      <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider group-hover:text-emerald-400 transition-colors">本地变量</span>
                      <ChevronDownIcon className={`w-3.5 h-3.5 text-emerald-600/50 transition-transform ${sections.local ? 'rotate-180' : ''}`} />
                    </div>
                    {sections.local && (
                      <>
                        {(activeProject.customInputs || []).map((input, idx) => (
                          <div key={input.id} className="group relative">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-[10px] font-mono text-emerald-400 font-bold">&lt;l{idx + 1}&gt;</span>
                              <label className="text-[10px] text-slate-500 block truncate font-medium">{input.label}</label>
                            </div>
                            <AutoResizeSidebarTextarea 
                              value={activeProject.inputValues[input.id] || ''} 
                              onChange={(val) => onInputChange(input.id, val)} 
                              placeholder="..." 
                            />
                            <button 
                              onClick={() => onDeleteLocalVariable(input.id)} 
                              className="absolute top-0 right-0 text-slate-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        {isAddingVariable ? (
                          <div className="bg-slate-950 border border-emerald-900/50 rounded-lg p-3 animate-in slide-in-from-top-1 duration-150">
                            <input 
                              ref={newVarInputRef} 
                              type="text" 
                              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-white focus:border-emerald-500 outline-none" 
                              placeholder="名称..." 
                              value={newVarName} 
                              onChange={(e) => setNewVarName(e.target.value)} 
                              onKeyDown={(e) => { 
                                if (e.key === 'Enter') handleAddVariable(); 
                                if (e.key === 'Escape') setIsAddingVariable(false); 
                              }} 
                            />
                            <div className="flex justify-end gap-2 mt-3">
                              <button onClick={() => setIsAddingVariable(false)} className="text-[10px] text-slate-500 px-2 py-1 hover:text-white">取消</button>
                              <button onClick={handleAddVariable} className="text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-md transition-colors">添加</button>
                            </div>
                          </div>
                        ) : (
                          <button 
                            onClick={() => setIsAddingVariable(true)} 
                            className="w-full py-2 border border-dashed border-slate-800 rounded-lg text-[10px] text-slate-500 hover:border-emerald-500/50 hover:text-emerald-500 transition-all"
                          >
                            + 新增本地变量
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'nav' && (
                <div className="h-full overflow-y-auto p-3 space-y-2 no-scrollbar">
                  {activeProjectTemplate.steps.map((step, idx) => (
                    <button 
                      key={step.id} 
                      onClick={() => {
                        const el = document.getElementById(step.id);
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }} 
                      className="w-full flex items-center gap-3 p-2.5 hover:bg-slate-800 rounded-lg text-left transition-all group"
                    >
                      <span className="w-5 h-5 flex items-center justify-center shrink-0 bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-500 group-hover:border-amber-500 group-hover:text-amber-500 rounded transition-all">{idx + 1}</span>
                      <span className="text-xs text-slate-300 truncate font-medium">{step.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {activeTab === 'extract' && (
                <VariableExtractionTool
                  key={activeProject.id}
                  project={activeProject}
                  template={activeProjectTemplate}
                  providerConfigs={providerConfigs}
                  modelPresets={modelPresets}
                  onApplyValues={onApplyInputValues}
                  draft={extractionDrafts[activeProject.id] || createDefaultExtractionDraft(activeProjectTemplate)}
                  onDraftChange={(projectId, updater) => {
                    setExtractionDrafts(prev => {
                      const targetProject = projectId === activeProject.id ? activeProject : null;
                      const targetTemplate = targetProject
                        ? activeProjectTemplate
                        : null;
                      const current = prev[projectId] || (targetTemplate ? createDefaultExtractionDraft(targetTemplate) : {
                        sourceText: '',
                        selectedInputIds: [],
                        selectedModelRefId: '',
                        results: [],
                        checkedInputIds: [],
                        message: '',
                        isExtracting: false,
                      });
                      const next = typeof updater === 'function' ? updater(current) : updater;
                      return { ...prev, [projectId]: next };
                    });
                  }}
                />
              )}

              {activeTab === 'build' && (
                <div className="p-6 flex flex-col items-center justify-center text-center h-full">
                  <div className="w-14 h-14 bg-purple-900/30 text-purple-400 rounded-2xl flex items-center justify-center mb-4 shadow-xl shadow-purple-950/20">
                    <DownloadIcon className="w-7 h-7" />
                  </div>
                  <h4 className="text-xs font-bold text-white mb-2 uppercase tracking-wider">提示词全量烘焙</h4>
                  <p className="text-[10px] text-slate-500 mb-6 px-4 leading-relaxed">一键合并所有步骤内容导出为 .txt 纯文本</p>
                  <Button 
                    variant="primary" 
                    size="sm" 
                    onClick={onBakeDownload} 
                    className="w-full bg-purple-600 hover:bg-purple-500 shadow-lg shadow-purple-600/30 font-bold"
                  >
                    开始导出
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="h-full overflow-y-auto p-3 no-scrollbar">
              <div className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-600">项目</div>
              {([
                ['all-projects', '全部项目'],
                ['recent-projects', '最近修改'],
              ] as [LibrarySelection, string][]).map(([selection, label]) => (
                <button
                  key={selection}
                  onClick={() => onLibrarySelectionChange(selection)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded text-left text-xs ${
                    librarySelection === selection ? 'bg-blue-600/20 text-blue-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <span>{label}</span>
                </button>
              ))}

              <div className="mt-5 mb-2 px-2 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">模板</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => onCollapsedTemplateGroupIdsChange(templateGroups.map(group => group.id))} className="text-[9px] text-slate-700 hover:text-slate-300" title="折叠全部分组">收</button>
                  <button onClick={() => onCollapsedTemplateGroupIdsChange([])} className="text-[9px] text-slate-700 hover:text-slate-300" title="展开全部分组">展</button>
                </div>
              </div>
              <button
                onClick={() => onLibrarySelectionChange('all-templates')}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded text-left text-xs ${
                  librarySelection === 'all-templates' ? 'bg-emerald-600/20 text-emerald-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span>全部模板</span><span className="text-[9px] text-slate-600">{templates.length}</span>
              </button>
              <button
                onClick={() => onLibrarySelectionChange('ungrouped-templates')}
                data-library-drop="root"
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded text-left text-xs ${
                  dropTarget === 'root' ? 'ring-1 ring-blue-500 bg-blue-500/10 text-blue-300' : librarySelection === 'ungrouped-templates' ? 'bg-emerald-600/20 text-emerald-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span>未分组模板</span><span className="text-[9px] text-slate-600">{templates.filter(template => !template.groupId).length}</span>
              </button>

              <div
                className="mt-2 min-h-24 space-y-1"
                onContextMenu={event => {
                  if ((event.target as HTMLElement).closest('[data-library-drop^="group:"]')) return;
                  event.preventDefault();
                  setGroupContextMenu({ x: event.clientX, y: event.clientY });
                }}
              >
                {templates.filter(template => !template.groupId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(template => (
                  <div
                    key={template.id}
                    data-library-drop={`template:${template.id}`}
                    onMouseDown={event => beginLongPress(event, { type: 'template', id: template.id })}
                    onMouseMove={handleLongPressMove}
                    onMouseUp={cancelLongPress}
                    onMouseLeave={cancelLongPress}
                    className={`flex items-center rounded border cursor-default ${dropTarget === `template:${template.id}` ? 'border-blue-500 bg-blue-500/10' : 'border-transparent'} ${librarySelection === `template:${template.id}` ? 'text-blue-300 bg-blue-600/10' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}
                    title="点击查看模板项目，长按整行拖动"
                  >
                    <button onClick={event => { if (!consumeSuppressedClick(event)) onLibrarySelectionChange(`template:${template.id}`); }} className="min-w-0 flex-1 px-2 py-1.5 text-left text-[11px] truncate">{template.name}</button>
                  </div>
                ))}
                {renderGroupTree()}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 调整宽度的拖拽条 */}
      <div 
        className="absolute right-0 top-0 bottom-0 w-1.5 bg-transparent hover:bg-blue-500/30 cursor-col-resize z-40 transition-colors" 
        onMouseDown={(e) => {
          e.preventDefault();
          onResizingChange(true);
        }} 
      />

      {dragPayload && (
        <div
          className="fixed z-[10000] pointer-events-none max-w-64 border border-blue-500 bg-slate-950/95 px-3 py-2 shadow-2xl"
          style={{ left: dragPointer.x + 14, top: dragPointer.y + 14 }}
        >
          <div className="text-[9px] font-bold text-blue-400">{dragPayload.type === 'group' ? '正在移动分组' : '正在移动模板'}</div>
          <div className="mt-0.5 truncate text-xs font-semibold text-slate-100">{draggedItemLabel || '未知项目'}</div>
          <div className="mt-1 text-[9px] text-slate-500">{dropTarget ? '松开以放置到蓝色目标' : '移动到分组或排序位置'}</div>
        </div>
      )}

      {groupContextMenu && (
        <div
          className="fixed z-[10000] min-w-40 border border-slate-700 bg-slate-900 py-1 shadow-2xl"
          style={{ left: Math.min(groupContextMenu.x, window.innerWidth - 180), top: Math.min(groupContextMenu.y, window.innerHeight - 150) }}
          onClick={event => event.stopPropagation()}
        >
          <button
            onClick={() => openGroupCreateDialog(groupContextMenu.groupId)}
            className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-800"
          >{groupContextMenu.groupId ? '新建子分组' : '新建根分组'}</button>
          {groupContextMenu.groupId && (
            <>
              <button
                onClick={() => {
                  const group = templateGroups.find(item => item.id === groupContextMenu.groupId);
                  if (group) startRenamingGroup(group);
                  setGroupContextMenu(null);
                }}
                className="w-full px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-800"
              >重命名分组</button>
              <button
                onClick={() => {
                  onDeleteTemplateGroup(groupContextMenu.groupId!);
                  setGroupContextMenu(null);
                }}
                className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-slate-800"
              >删除分组</button>
            </>
          )}
        </div>
      )}

      {groupCreateDialog.isOpen && (
        <div className="fixed inset-0 z-[10010] flex items-center justify-center bg-black/70" onMouseDown={() => setGroupCreateDialog({ isOpen: false, name: '' })}>
          <div className="w-80 border border-slate-700 bg-slate-900 p-4 shadow-2xl" onMouseDown={event => event.stopPropagation()}>
            <h3 className="text-sm font-bold text-white">{groupCreateDialog.parentId ? '新建子分组' : '新建模板分组'}</h3>
            <p className="mt-1 text-[10px] text-slate-500">{groupCreateDialog.parentId ? `父分组：${templateGroups.find(group => group.id === groupCreateDialog.parentId)?.name || '未知分组'}` : '创建在模板目录根级'}</p>
            <input
              autoFocus
              value={groupCreateDialog.name}
              onChange={event => setGroupCreateDialog(current => ({ ...current, name: event.target.value }))}
              onKeyDown={event => {
                if (event.key === 'Enter') commitNewGroup();
                if (event.key === 'Escape') setGroupCreateDialog({ isOpen: false, name: '' });
              }}
              placeholder="分组名称"
              className="mt-4 w-full bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setGroupCreateDialog({ isOpen: false, name: '' })} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white">取消</button>
              <button onClick={commitNewGroup} disabled={!groupCreateDialog.name.trim()} className="bg-blue-600 px-3 py-1.5 text-xs text-white disabled:opacity-40">创建</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
