import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LibrarySelection, Project, SortKey, Template, TemplateGroup, TemplateSortKey, TemplateTableColumnWidths } from '../types';
import { Button } from './Button';
import { CreateProjectModal } from './CreateProjectModal';
import { MergeModal } from './MergeModal';
import { ioService } from '../services/ioService';
import { getProjectNameRule } from '../services/projectNamingService';
import { createTemplateJson } from '../services/templateJsonService';

interface FileLibraryProps {
  projects: Project[];
  templates: Template[];
  templateGroups: TemplateGroup[];
  selection: LibrarySelection;
  onSelectionChange: (selection: LibrarySelection) => void;
  onOpenProject: (projectId: string) => void;
  onCreateProject: (templateId: string, name: string) => void;
  onCreateTemplate: (groupId?: string) => void;
  onEditTemplate: (templateId: string) => void;
  onUpdateTemplate: (templateId: string, updates: Partial<Template>) => void;
  onDuplicateTemplate: (templateId: string) => void;
  onCreateTemplateFromProject: (projectId: string) => void;
  onDeleteProject: (id: string) => void;
  onDeleteProjects: (ids: string[]) => void;
  onDeleteTemplate: (id: string) => void;
  onImportBundle: (bundle: any) => void;
  onImportTemplates: (data: unknown) => number;
  onMergeData: (projects: Project[], templates: Template[]) => void;
  onOpenExport: () => void;
  onRequestAlert: (title: string, message: string) => void;
  cardScale: number;
  onCardScaleChange: (scale: number) => void;
  sortBy: SortKey;
  onSortChange: (key: SortKey) => void;
  templateSortBy: TemplateSortKey;
  onTemplateSortChange: (key: TemplateSortKey) => void;
  templateColumnWidths: TemplateTableColumnWidths;
  onTemplateColumnWidthsChange: (widths: TemplateTableColumnWidths) => void;
  collapsedProjectTemplateIds: string[];
  onCollapsedProjectTemplateIdsChange: (ids: string[]) => void;
}

const DEFAULT_TEMPLATE_COLUMN_WIDTHS: TemplateTableColumnWidths = { visibility: 48, name: 240, stats: 110, projectCount: 80, createdAt: 150, lastModifiedAt: 150, actions: 260 };
const TEMPLATE_COLUMN_KEYS: (keyof TemplateTableColumnWidths)[] = ['visibility', 'name', 'stats', 'projectCount', 'createdAt', 'lastModifiedAt', 'actions'];
const TEMPLATE_COLUMN_MIN_WIDTHS: TemplateTableColumnWidths = { visibility: 42, name: 130, stats: 90, projectCount: 64, createdAt: 110, lastModifiedAt: 110, actions: 200 };
const formatDate = (ts?: number) => ts ? new Date(ts).toLocaleString() : '未知';

export const FileLibrary: React.FC<FileLibraryProps> = ({
  projects,
  templates,
  templateGroups,
  selection,
  onSelectionChange,
  onOpenProject,
  onCreateProject,
  onCreateTemplate,
  onEditTemplate,
  onUpdateTemplate,
  onDuplicateTemplate,
  onCreateTemplateFromProject,
  onDeleteProject,
  onDeleteProjects,
  onDeleteTemplate,
  onImportBundle,
  onImportTemplates,
  onMergeData,
  onOpenExport,
  onRequestAlert,
  cardScale,
  onCardScaleChange,
  sortBy,
  onSortChange,
  templateSortBy,
  onTemplateSortChange,
  templateColumnWidths,
  onTemplateColumnWidthsChange,
  collapsedProjectTemplateIds,
  onCollapsedProjectTemplateIdsChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const templateInputRef = useRef<HTMLInputElement>(null);
  const templateTableRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const [createTemplateId, setCreateTemplateId] = useState<string | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [liveColumnWidths, setLiveColumnWidths] = useState(templateColumnWidths);
  const [templateTableWidth, setTemplateTableWidth] = useState(0);
  const [projectNamesModal, setProjectNamesModal] = useState<{ templateName: string; names: string[] } | null>(null);
  const selectedTemplateId = selection.startsWith('template:') ? selection.slice('template:'.length) : undefined;
  const selectedGroupId = selection.startsWith('group:') ? selection.slice('group:'.length) : undefined;
  const isTemplateView = selection === 'all-templates' || selection === 'ungrouped-templates';
  const selectedTemplate = selectedTemplateId ? templates.find(template => template.id === selectedTemplateId) : undefined;
  const selectedGroup = selectedGroupId ? templateGroups.find(group => group.id === selectedGroupId) : undefined;
  const createTemplate = createTemplateId ? templates.find(template => template.id === createTemplateId) : undefined;
  const createProjectNameRule = getProjectNameRule(createTemplate);
  const createProjectNameInput = createProjectNameRule ? createTemplate?.inputs.find(input => input.id === createProjectNameRule.inputId) : undefined;

  useEffect(() => setLiveColumnWidths(templateColumnWidths), [templateColumnWidths]);

  useLayoutEffect(() => {
    const element = templateTableRef.current;
    if (!element) return;
    const update = () => setTemplateTableWidth(element.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [isTemplateView]);

  const selectedGroupIds = useMemo(() => {
    const ids = new Set<string>();
    if (!selectedGroupId) return ids;
    const collect = (groupId: string) => {
      ids.add(groupId);
      templateGroups.filter(group => group.parentId === groupId).forEach(group => collect(group.id));
    };
    collect(selectedGroupId);
    return ids;
  }, [selectedGroupId, templateGroups]);

  const visibleProjects = useMemo(() => {
    const visibleTemplateIds = new Set(templates.filter(template => !template.hideProjects).map(template => template.id));
    const allTemplateIds = new Set(templates.map(template => template.id));
    let result = selection === 'all-projects' || selection === 'recent-projects'
      ? projects.filter(project => visibleTemplateIds.has(project.templateId) || !allTemplateIds.has(project.templateId))
      : [...projects];
    if (selection === 'recent-projects') {
      result.sort((a, b) => b.lastModifiedAt - a.lastModifiedAt);
      result = result.slice(0, 30);
    } else if (selectedTemplateId) {
      result = result.filter(project => project.templateId === selectedTemplateId);
    } else if (selectedGroupId) {
      const ids = new Set(templates.filter(template => template.groupId && selectedGroupIds.has(template.groupId)).map(template => template.id));
      result = result.filter(project => ids.has(project.templateId));
    }
    if (search.trim()) result = result.filter(project => project.name.toLowerCase().includes(search.trim().toLowerCase()));
    return result.sort((a, b) => {
      if (selection === 'recent-projects') return b.lastModifiedAt - a.lastModifiedAt;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'createdAt') return b.createdAt - a.createdAt;
      return b.lastModifiedAt - a.lastModifiedAt;
    });
  }, [projects, search, selectedGroupId, selectedGroupIds, selectedTemplateId, selection, sortBy, templates]);

  const visibleTemplates = useMemo(() => {
    let result = selection === 'ungrouped-templates' ? templates.filter(template => !template.groupId) : [...templates];
    if (search.trim()) result = result.filter(template => template.name.toLowerCase().includes(search.trim().toLowerCase()));
    return result.sort((a, b) => {
      if (templateSortBy === 'createdAt') return (b.createdAt || 0) - (a.createdAt || 0);
      if (templateSortBy === 'lastModified') return (b.lastModifiedAt || 0) - (a.lastModifiedAt || 0);
      if (templateSortBy === 'projectCount') return projects.filter(project => project.templateId === b.id).length - projects.filter(project => project.templateId === a.id).length;
      if (templateSortBy === 'stepCount') return b.steps.length - a.steps.length;
      return a.name.localeCompare(b.name);
    });
  }, [projects, search, selection, templateSortBy, templates]);

  const projectTemplateGroups = useMemo(() => {
    if (selection !== 'all-projects') return [];
    const groups = templates
      .filter(template => !template.hideProjects)
      .map(template => ({
        template,
        projects: visibleProjects.filter(project => project.templateId === template.id),
      }))
      .filter(group => group.projects.length > 0)
      .sort((a, b) => a.template.name.localeCompare(b.template.name));
    const missingTemplateProjects = visibleProjects.filter(project => !templates.some(template => template.id === project.templateId));
    if (missingTemplateProjects.length > 0) {
      groups.push({
        template: { id: '__missing__', name: '模板已失效', inputs: [], steps: [] },
        projects: missingTemplateProjects,
      });
    }
    return groups;
  }, [selection, templates, visibleProjects]);

  const viewTitle = isTemplateView
    ? selection === 'ungrouped-templates' ? '未分组模板' : '全部模板'
    : selectedTemplate?.name || selectedGroup?.name || (selection === 'recent-projects' ? '最近修改' : '全部项目');

  const requestCreateProject = () => {
    if (selectedTemplateId) {
      setCreateTemplateId(selectedTemplateId);
      return;
    }
    setIsTemplatePickerOpen(true);
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const content = await ioService.readFileAsText(file);
      const data = JSON.parse(content);
      if (!Array.isArray(data?.projects) || !Array.isArray(data?.templates)) throw new Error('invalid');
      onImportBundle(data);
    } catch {
      onRequestAlert('导入失败', '文件为空、格式不匹配或无法解析。');
    }
    event.target.value = '';
  };

  const handleImportTemplateFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const content = await ioService.readFileAsText(file);
      const count = onImportTemplates(JSON.parse(content));
      onRequestAlert('模板导入完成', `已导入 ${count} 个模板。`);
    } catch (error) {
      onRequestAlert('模板导入失败', error instanceof Error ? error.message : '文件为空、格式不匹配或无法解析。');
    }
    event.target.value = '';
  };

  const exportTemplateJson = (template: Template) => {
    const safeName = template.name.replace(/[\\/:*?"<>|]/g, '_');
    ioService.exportFile(`${safeName || 'template'}.pwc-template.json`, JSON.stringify(createTemplateJson(template), null, 2), 'application/json');
  };

  const toggleProject = (id: string) => {
    setSelectedIds(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleProjectTemplateGroup = (templateId: string) => {
    onCollapsedProjectTemplateIdsChange(
      collapsedProjectTemplateIds.includes(templateId)
        ? collapsedProjectTemplateIds.filter(id => id !== templateId)
        : [...collapsedProjectTemplateIds, templateId]
    );
  };

  const openProjectNamesModal = (template: Template, templateProjects: Project[]) => {
    const names = templateProjects.map(project => project.name.trim()).filter(Boolean);
    if (names.length === 0) {
      onRequestAlert('没有项目名称', '该模板下暂无可复制的项目名称。');
      return;
    }
    setProjectNamesModal({ templateName: template.name, names });
  };

  const fittedTemplateColumnWidths = useMemo(() => {
    const next = { ...liveColumnWidths };
    const total = TEMPLATE_COLUMN_KEYS.reduce((sum, key) => sum + next[key], 0);
    if (!templateTableWidth || total <= templateTableWidth) return next;
    let overflow = total - templateTableWidth;
    const shrinkableKeys = TEMPLATE_COLUMN_KEYS.filter(key => next[key] > TEMPLATE_COLUMN_MIN_WIDTHS[key]);
    while (overflow > 0.5 && shrinkableKeys.length > 0) {
      const share = overflow / shrinkableKeys.length;
      for (let index = shrinkableKeys.length - 1; index >= 0; index -= 1) {
        const key = shrinkableKeys[index];
        const shrink = Math.min(share, next[key] - TEMPLATE_COLUMN_MIN_WIDTHS[key]);
        next[key] -= shrink;
        overflow -= shrink;
        if (next[key] <= TEMPLATE_COLUMN_MIN_WIDTHS[key] + 0.5) shrinkableKeys.splice(index, 1);
      }
    }
    return next;
  }, [liveColumnWidths, templateTableWidth]);
  const templateGridColumns = TEMPLATE_COLUMN_KEYS.map(key => `${fittedTemplateColumnWidths[key]}px`).join(' ');
  const resizeTemplateColumn = (key: keyof TemplateTableColumnWidths, event: React.MouseEvent) => {
    event.preventDefault();
    const columnIndex = TEMPLATE_COLUMN_KEYS.indexOf(key);
    const nextKey = TEMPLATE_COLUMN_KEYS[columnIndex + 1];
    if (!nextKey) return;
    const startX = event.clientX;
    const startLeftWidth = liveColumnWidths[key];
    const startRightWidth = liveColumnWidths[nextKey];
    let finalWidths = liveColumnWidths;
    const handleMove = (moveEvent: MouseEvent) => {
      const requestedDelta = moveEvent.clientX - startX;
      const minDelta = TEMPLATE_COLUMN_MIN_WIDTHS[key] - startLeftWidth;
      const maxDelta = startRightWidth - TEMPLATE_COLUMN_MIN_WIDTHS[nextKey];
      const delta = Math.min(maxDelta, Math.max(minDelta, requestedDelta));
      finalWidths = {
        ...liveColumnWidths,
        [key]: startLeftWidth + delta,
        [nextKey]: startRightWidth - delta,
      };
      setLiveColumnWidths(finalWidths);
    };
    const handleUp = () => {
      onTemplateColumnWidthsChange(finalWidths);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  return (
    <div className="absolute inset-0 bg-slate-950 z-50 flex flex-col">
      <div className="h-14 shrink-0 flex items-center justify-between gap-4 px-5 border-b border-slate-800 bg-slate-900">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-white truncate">{viewTitle}</h2>
          <p className="text-[10px] text-slate-600">{isTemplateView ? `${visibleTemplates.length} 个模板` : `${visibleProjects.length} 个项目`}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder={isTemplateView ? '搜索模板' : '搜索项目'}
            className="w-48 bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500"
          />
          {isTemplateView ? (
            <>
              <select value={templateSortBy} onChange={event => onTemplateSortChange(event.target.value as TemplateSortKey)} className="bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-300">
                <option value="lastModified">最近修改</option><option value="createdAt">创建时间</option><option value="name">模板名称</option><option value="projectCount">项目数量</option><option value="stepCount">步骤数量</option>
              </select>
              <button
                onClick={() => templates.forEach(template => template.hideProjects && onUpdateTemplate(template.id, { hideProjects: false }))}
                className="px-2 py-1.5 text-[10px] border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 rounded hover:bg-emerald-600 hover:text-white"
              >显示所有模板项目</button>
              <button
                onClick={() => templates.forEach(template => !template.hideProjects && onUpdateTemplate(template.id, { hideProjects: true }))}
                className="px-2 py-1.5 text-[10px] border border-slate-700 text-slate-400 rounded hover:bg-slate-800 hover:text-white"
              >隐藏所有模板项目</button>
              <button onClick={() => onTemplateColumnWidthsChange(DEFAULT_TEMPLATE_COLUMN_WIDTHS)} className="px-2 py-1.5 text-[10px] border border-slate-700 rounded text-slate-400 hover:text-white">重置列宽</button>
              <input type="file" ref={templateInputRef} onChange={handleImportTemplateFile} className="hidden" accept=".json" />
              <button onClick={() => templateInputRef.current?.click()} className="px-2 py-1.5 text-[10px] border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 rounded hover:bg-cyan-600 hover:text-white">导入模板 JSON</button>
              <Button size="sm" onClick={() => onCreateTemplate(selection === 'ungrouped-templates' ? undefined : selectedGroupId)}>新建模板</Button>
            </>
          ) : (
            <>
              {selectedGroupId && <Button size="sm" variant="secondary" onClick={() => onCreateTemplate(selectedGroupId)}>在此分组新建模板</Button>}
              <Button size="sm" variant="success" onClick={requestCreateProject}>新建项目</Button>
            </>
          )}
          <input type="file" ref={fileInputRef} onChange={handleImportFile} className="hidden" accept=".json" />
          <button onClick={() => fileInputRef.current?.click()} className="px-2 py-1.5 text-[10px] border border-slate-700 rounded text-slate-400 hover:text-white">恢复</button>
          <button onClick={onOpenExport} className="px-2 py-1.5 text-[10px] border border-slate-700 rounded text-slate-400 hover:text-white">备份</button>
          <button onClick={() => setIsMergeModalOpen(true)} className="px-2 py-1.5 text-[10px] border border-slate-700 rounded text-slate-400 hover:text-white">合并</button>
        </div>
      </div>

      {!isTemplateView && (
        <div className="h-11 shrink-0 flex items-center justify-between px-5 border-b border-slate-800/70 bg-slate-950">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setIsSelectionMode(current => !current); setSelectedIds(new Set()); }}
              className={`px-2 py-1 text-[10px] border rounded ${isSelectionMode ? 'border-blue-500 text-blue-300 bg-blue-600/10' : 'border-slate-800 text-slate-500'}`}
            >{isSelectionMode ? '退出批量管理' : '批量管理'}</button>
            {isSelectionMode && <button onClick={() => setSelectedIds(new Set(visibleProjects.map(project => project.id)))} className="text-[10px] text-slate-500 hover:text-white">选择显示项目</button>}
            {isSelectionMode && selectedIds.size > 0 && <button onClick={() => onDeleteProjects([...selectedIds])} className="text-[10px] text-red-400">删除所选 ({selectedIds.size})</button>}
            {selection === 'all-projects' && (
              <>
                <button onClick={() => onCollapsedProjectTemplateIdsChange(projectTemplateGroups.map(group => group.template.id))} className="text-[10px] text-slate-500 hover:text-white">全部折叠</button>
                <button onClick={() => onCollapsedProjectTemplateIdsChange([])} className="text-[10px] text-slate-500 hover:text-white">全部展开</button>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-slate-600">卡片宽度</span>
            <input type="range" min="180" max="500" value={cardScale} onChange={event => onCardScaleChange(Number(event.target.value))} className="w-20 accent-blue-600" />
            <select value={sortBy} onChange={event => onSortChange(event.target.value as SortKey)} className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[10px] text-slate-400">
              <option value="lastModified">修改时间</option><option value="createdAt">创建时间</option><option value="name">名称</option>
            </select>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-5">
        {isTemplateView ? (
          <div ref={templateTableRef} className="border border-slate-800 rounded overflow-hidden">
            <div>
            <div className="grid bg-slate-900 text-xs font-bold text-slate-400" style={{ gridTemplateColumns: templateGridColumns }}>
              {([
                ['visibility', '显示'],
                ['name', '模板名称'],
                ['stats', '步骤 / 变量'],
                ['projectCount', '项目数'],
                ['createdAt', '创建时间'],
                ['lastModifiedAt', '最近修改'],
                ['actions', '操作'],
              ] as [keyof TemplateTableColumnWidths, string][]).map(([key, label]) => (
                <div key={key} className="relative px-3 py-3 border-r border-slate-800 last:border-r-0">
                  {label}
                  {key !== 'actions' && <div onMouseDown={event => resizeTemplateColumn(key, event)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500/60" />}
                </div>
              ))}
            </div>
            {visibleTemplates.map(template => (
              <div key={template.id} className="grid items-center border-t border-slate-800 hover:bg-slate-900/60 text-xs" style={{ gridTemplateColumns: templateGridColumns }}>
                <div className="flex items-center justify-center">
                  <button
                    onClick={() => onUpdateTemplate(template.id, { hideProjects: !template.hideProjects })}
                    className={`p-2 rounded transition-colors ${template.hideProjects ? 'text-slate-700 hover:text-blue-300' : 'text-emerald-400 hover:text-emerald-200'}`}
                    title={template.hideProjects ? '显示该模板下的项目' : '隐藏该模板下的项目'}
                  >
                    {template.hideProjects ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
                <button onClick={() => onSelectionChange(`template:${template.id}`)} className="px-3 py-3 text-left text-sm font-semibold text-slate-100 truncate hover:text-blue-300">{template.name}</button>
                <span className="px-3 py-3 text-slate-400">{template.steps.length} 步 / {template.inputs.length} 变量</span>
                <span className="px-3 py-3 text-slate-400">{projects.filter(project => project.templateId === template.id).length}</span>
                <span className="px-2 py-3 text-slate-500 truncate" title={formatDate(template.createdAt)}>{formatDate(template.createdAt)}</span>
                <span className="px-2 py-3 text-slate-400 truncate" title={formatDate(template.lastModifiedAt)}>{formatDate(template.lastModifiedAt)}</span>
                <div className="flex flex-wrap items-center gap-1 px-2 py-2">
                  <button onClick={() => { setCreateTemplateId(template.id); }} className="px-2 py-1.5 border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 rounded hover:bg-emerald-600 hover:text-white">新建项目</button>
                  <button onClick={() => openProjectNamesModal(template, projects.filter(project => project.templateId === template.id))} className="px-2 py-1.5 border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 rounded hover:bg-cyan-600 hover:text-white">项目名称</button>
                  <button onClick={() => onEditTemplate(template.id)} className="px-2 py-1.5 border border-blue-500/40 bg-blue-500/10 text-blue-300 rounded hover:bg-blue-600 hover:text-white">编辑</button>
                  <button onClick={() => exportTemplateJson(template)} className="px-2 py-1.5 border border-slate-600 text-slate-300 rounded hover:bg-slate-700">导出 JSON</button>
                  <button onClick={() => onDuplicateTemplate(template.id)} className="px-2 py-1.5 border border-slate-600 text-slate-300 rounded hover:bg-slate-700">复制</button>
                  <button onClick={() => onDeleteTemplate(template.id)} className="px-2 py-1.5 border border-red-500/30 text-red-400 rounded hover:bg-red-600 hover:text-white">删除</button>
                </div>
              </div>
            ))}
            </div>
          </div>
        ) : selection === 'all-projects' ? (
          <div className="space-y-5">
            {projectTemplateGroups.map(group => {
              const isCollapsed = collapsedProjectTemplateIds.includes(group.template.id);
              return (
                <section key={group.template.id} className="border border-slate-800 rounded overflow-hidden">
                  <div className="h-11 flex items-center justify-between gap-3 px-3 bg-slate-900">
                    <button onClick={() => toggleProjectTemplateGroup(group.template.id)} className="min-w-0 flex items-center gap-2 text-left">
                      <span className={`text-slate-500 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}>▼</span>
                      <span className="text-sm font-semibold text-slate-200 truncate">{group.template.name}</span>
                      <span className="text-[10px] text-slate-600">{group.projects.length} 个项目</span>
                    </button>
                    {group.template.id !== '__missing__' && (
                      <div className="flex items-center gap-2">
                        <button onClick={() => setCreateTemplateId(group.template.id)} className="px-2 py-1 text-[10px] border border-emerald-500/30 text-emerald-400 rounded hover:bg-emerald-600 hover:text-white">新建项目</button>
                        <button onClick={() => openProjectNamesModal(group.template, group.projects)} className="px-2 py-1 text-[10px] border border-cyan-500/30 text-cyan-400 rounded hover:bg-cyan-600 hover:text-white">项目名称</button>
                        <button onClick={() => group.projects.forEach(project => onOpenProject(project.id))} className="px-2 py-1 text-[10px] border border-slate-700 text-slate-400 rounded hover:text-white">打开此模板的所有项目</button>
                        <button onClick={() => onSelectionChange(`template:${group.template.id}`)} className="px-2 py-1 text-[10px] border border-slate-700 text-slate-400 rounded hover:text-white">查看模板项目</button>
                      </div>
                    )}
                  </div>
                  {!isCollapsed && (
                    <div className="grid gap-3 p-3" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${cardScale}px, 1fr))` }}>
                      {group.projects.map(project => renderProjectCard(project, templates, isSelectionMode, selectedIds, toggleProject, onOpenProject, onSelectionChange, onCreateTemplateFromProject, onDeleteProject))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${cardScale}px, 1fr))` }}>
            {visibleProjects.map(project => renderProjectCard(project, templates, isSelectionMode, selectedIds, toggleProject, onOpenProject, onSelectionChange, onCreateTemplateFromProject, onDeleteProject))}
          </div>
        )}

        {(isTemplateView ? visibleTemplates.length : visibleProjects.length) === 0 && (
          <div className="py-28 text-center text-xs text-slate-600">当前视图没有内容</div>
        )}
      </div>

      <TemplatePicker
        isOpen={isTemplatePickerOpen}
        templates={templates}
        groups={templateGroups}
        preferredGroupId={selectedGroupId}
        onCancel={() => setIsTemplatePickerOpen(false)}
        onSelect={templateId => { setIsTemplatePickerOpen(false); setCreateTemplateId(templateId); }}
      />
      <CreateProjectModal
        isOpen={Boolean(createTemplateId)}
        nameLabel={createProjectNameInput ? createProjectNameInput.label : '项目名称'}
        namePrefix={createProjectNameRule?.prefix}
        onConfirm={name => { if (createTemplateId) onCreateProject(createTemplateId, name); setCreateTemplateId(null); }}
        onCancel={() => setCreateTemplateId(null)}
      />
      <MergeModal isOpen={isMergeModalOpen} onClose={() => setIsMergeModalOpen(false)} currentProjects={projects} currentTemplates={templates} onConfirmMerge={onMergeData} onRequestAlert={onRequestAlert} />
      <ProjectNamesModal
        data={projectNamesModal}
        onClose={() => setProjectNamesModal(null)}
        onRequestAlert={onRequestAlert}
      />
    </div>
  );
};

const ProjectNamesModal: React.FC<{
  data: { templateName: string; names: string[] } | null;
  onClose: () => void;
  onRequestAlert: (title: string, message: string) => void;
}> = ({ data, onClose, onRequestAlert }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (data) setCopied(false);
  }, [data]);

  if (!data) return null;

  const text = data.names.join('\n');
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      onRequestAlert('复制失败', '无法写入剪贴板，请检查系统权限后重试。');
    }
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70">
      <div className="w-[520px] max-w-[90vw] max-h-[78vh] flex flex-col bg-slate-900 border border-slate-700 rounded shadow-2xl">
        <div className="p-4 border-b border-slate-800">
          <h3 className="text-sm font-bold text-white truncate">{data.templateName}</h3>
          <p className="mt-1 text-[10px] text-slate-500">{data.names.length} 个项目名称</p>
        </div>
        <textarea
          readOnly
          value={text}
          className="m-4 min-h-[220px] resize-none rounded border border-slate-700 bg-slate-950 p-3 font-mono text-sm leading-6 text-slate-200 outline-none"
        />
        <div className="flex justify-end gap-2 border-t border-slate-800 p-3">
          <Button variant="secondary" size="sm" onClick={onClose}>关闭</Button>
          <Button size="sm" onClick={handleCopy}>{copied ? '已复制' : '复制'}</Button>
        </div>
      </div>
    </div>
  );
};

const renderProjectCard = (
  project: Project,
  templates: Template[],
  isSelectionMode: boolean,
  selectedIds: Set<string>,
  toggleProject: (id: string) => void,
  onOpenProject: (id: string) => void,
  onSelectionChange: (selection: LibrarySelection) => void,
  onCreateTemplateFromProject: (id: string) => void,
  onDeleteProject: (id: string) => void,
) => {
  const template = templates.find(item => item.id === project.templateId);
  const selected = selectedIds.has(project.id);
  return (
    <div
      key={project.id}
      onClick={() => isSelectionMode ? toggleProject(project.id) : onOpenProject(project.id)}
      className={`group relative cursor-pointer border rounded p-3 bg-slate-900 hover:bg-slate-800 ${selected ? 'border-blue-500' : 'border-slate-800 hover:border-slate-600'}`}
    >
      <h3 className="pr-14 text-sm font-bold text-slate-200 truncate">{project.name}</h3>
      <button onClick={event => { event.stopPropagation(); onSelectionChange(`template:${project.templateId}`); }} className="mt-1 text-[10px] text-blue-500/70 hover:text-blue-300 truncate max-w-full">{template?.name || '模板已失效'}</button>
      <div className="mt-3 pt-2 border-t border-slate-800 text-[9px] text-slate-600">修改于 {formatDate(project.lastModifiedAt)}</div>
      {!isSelectionMode && (
        <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100">
          <button onClick={event => { event.stopPropagation(); onCreateTemplateFromProject(project.id); }} className="text-[10px] text-slate-500 hover:text-blue-300">提取模板</button>
          <button onClick={event => { event.stopPropagation(); onDeleteProject(project.id); }} className="text-[10px] text-slate-500 hover:text-red-400">删除</button>
        </div>
      )}
    </div>
  );
};

const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
    <path d="M8 3c-3.2 0-5.7 2.1-6.8 4.5a1.2 1.2 0 0 0 0 1C2.3 10.9 4.8 13 8 13s5.7-2.1 6.8-4.5a1.2 1.2 0 0 0 0-1C13.7 5.1 11.2 3 8 3Zm0 7.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z" />
  </svg>
);

const EyeOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
    <path d="M2.28 1.22a.75.75 0 0 0-1.06 1.06l12.5 12.5a.75.75 0 1 0 1.06-1.06l-1.95-1.95A8.2 8.2 0 0 0 14.8 8.5a1.2 1.2 0 0 0 0-1C13.7 5.1 11.2 3 8 3c-1.08 0-2.08.24-2.97.65L2.28 1.22Zm4.5 4.5a2.5 2.5 0 0 1 3.5 3.5l-3.5-3.5ZM3.2 5.2A8.1 8.1 0 0 0 1.2 7.5a1.2 1.2 0 0 0 0 1C2.3 10.9 4.8 13 8 13c.7 0 1.37-.1 2-.28l-1.44-1.44A3.5 3.5 0 0 1 4.72 7.44L3.2 5.2Z" />
  </svg>
);

const TemplatePicker: React.FC<{
  isOpen: boolean;
  templates: Template[];
  groups: TemplateGroup[];
  preferredGroupId?: string;
  onSelect: (templateId: string) => void;
  onCancel: () => void;
}> = ({ isOpen, templates, groups, preferredGroupId, onSelect, onCancel }) => {
  const [search, setSearch] = useState('');
  if (!isOpen) return null;
  const visible = templates.filter(template => (!preferredGroupId || template.groupId === preferredGroupId) && template.name.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70">
      <div className="w-[560px] max-w-[90vw] max-h-[75vh] flex flex-col bg-slate-900 border border-slate-700 rounded shadow-2xl">
        <div className="p-4 border-b border-slate-800">
          <h3 className="text-sm font-bold text-white">选择项目模板</h3>
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索模板" className="mt-3 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs text-white outline-none focus:border-blue-500" />
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {visible.map(template => (
            <button key={template.id} onClick={() => onSelect(template.id)} className="w-full flex items-center justify-between px-3 py-2.5 rounded hover:bg-slate-800 text-left">
              <span className="text-xs text-slate-200">{template.name}</span>
              <span className="text-[9px] text-slate-600">{groups.find(group => group.id === template.groupId)?.name || '未分组'} · {template.steps.length} 步骤</span>
            </button>
          ))}
          {visible.length === 0 && <div className="p-8 text-center text-xs text-slate-600">没有可用模板</div>}
        </div>
        <div className="p-3 border-t border-slate-800 flex justify-end"><Button variant="secondary" size="sm" onClick={onCancel}>取消</Button></div>
      </div>
    </div>
  );
};
