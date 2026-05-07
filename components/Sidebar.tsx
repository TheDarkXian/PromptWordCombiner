import React, { useEffect, useRef, useState } from 'react';
import { Project, StepFlowStatus, Template, UiLanguage } from '../types';
import { t } from '../services/i18n';
import { VarsIcon, NavIcon, BuildIcon, ChevronDownIcon, DownloadIcon } from './Icons';
import { Button } from './Button';
import { AutoResizeTextarea } from './common/AutoResizeTextarea';

type SidebarTab = 'vars' | 'nav' | 'build';

interface SidebarProps {
  language: UiLanguage;
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
  onImportVariableTable: (content: string) => void;
  onExportVariableTable: (format: 'json' | 'csv') => void;
  onBakeDownload: () => void;
  onRequestAlert: (title: string, message: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  language,
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
  onImportVariableTable,
  onExportVariableTable,
  onBakeDownload,
  onRequestAlert,
}) => {
  const [activeTab, setActiveTab] = useState<SidebarTab>('vars');
  const [sections, setSections] = useState({ global: true, local: true, result: true });
  const [isAddingVariable, setIsAddingVariable] = useState(false);
  const [newVarName, setNewVarName] = useState('');
  const [isVarTableMenuOpen, setIsVarTableMenuOpen] = useState(false);
  const [expandedResultVariableIds, setExpandedResultVariableIds] = useState<Record<string, boolean>>({});
  const newVarInputRef = useRef<HTMLInputElement>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  const resultVariables = (activeProject?.variables || []).filter((variable) =>
    ['step_output', 'derived', 'manual'].includes(variable.sourceType)
  );

  const getStepName = (stepId?: string) => activeProjectTemplate?.steps.find((step) => step.id === stepId)?.name;

  const getStepStatus = (stepId: string): StepFlowStatus => {
    const output = activeProject?.stepOutputs?.[stepId] || '';
    if (!output.trim()) return 'empty';

    const meta = activeProject?.stepOutputMeta?.[stepId];
    const boundVariable = (activeProject?.variables || []).find(
      (variable) => variable.sourceType === 'step_output' && variable.sourceRef === stepId
    );
    if (!boundVariable) return 'draft';

    const lastSavedAt = meta?.lastSavedToVariableAt || 0;
    const updatedAt = meta?.updatedAt || 0;
    if (lastSavedAt >= updatedAt && boundVariable.updatedAt >= updatedAt) return 'saved';
    return 'stale';
  };

  const getStatusDotClass = (status: StepFlowStatus) => {
    switch (status) {
      case 'saved':
        return 'bg-emerald-400';
      case 'stale':
        return 'bg-amber-400';
      case 'draft':
        return 'bg-blue-400';
      default:
        return 'bg-slate-700';
    }
  };

  const getStatusLabel = (status: StepFlowStatus) => {
    switch (status) {
      case 'saved':
        return language === 'zh-CN' ? '已写入' : 'Synced';
      case 'stale':
        return language === 'zh-CN' ? '待更新' : 'Stale';
      case 'draft':
        return language === 'zh-CN' ? '未写入' : 'Draft';
      default:
        return language === 'zh-CN' ? '未填写' : 'Empty';
    }
  };

  const scrollToStep = (stepId?: string) => {
    if (!stepId) return;
    const el = document.getElementById(stepId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const copyVariableValue = async (value: string) => {
    if (!value.trim()) {
      onRequestAlert(t(language, 'sidebar.duplicateVar'), t(language, 'sidebar.duplicateVarMessage'));
      return;
    }
    await navigator.clipboard.writeText(value);
  };

  const toggleResultVariable = (variableId: string) => {
    setExpandedResultVariableIds((prev) => ({ ...prev, [variableId]: !prev[variableId] }));
  };

  useEffect(() => {
    if (isAddingVariable && newVarInputRef.current) {
      newVarInputRef.current.focus();
    }
  }, [isAddingVariable]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (event: MouseEvent) => {
      const newWidth = event.clientX;
      if (newWidth > 220 && newWidth < 640) onWidthChange(newWidth);
    };

    const handleMouseUp = () => {
      onResizingChange(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, onResizingChange, onWidthChange]);

  const handleAddVariable = () => {
    const trimmed = newVarName.trim();
    if (!trimmed) {
      setIsAddingVariable(false);
      return;
    }
    if (activeProject?.customInputs?.some((input) => input.label === trimmed)) {
      onRequestAlert(language === 'zh-CN' ? '重名警告' : 'Duplicate name', language === 'zh-CN' ? '该变量名称已经存在。' : 'A variable with this name already exists.');
      return;
    }
    onAddLocalVariable(trimmed);
    setNewVarName('');
    setIsAddingVariable(false);
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    onImportVariableTable(content);
    event.target.value = '';
  };

  if (!isOpen) return null;

  return (
    <div
      style={{ width }}
      className="bg-slate-900 flex flex-shrink-0 z-20 transition-all duration-75 relative border-r border-slate-800 animate-in slide-in-from-left-2"
    >
      <div className="w-12 bg-slate-950 flex flex-col items-center py-6 border-r border-slate-800 gap-6 shrink-0">
        {activeProject && (
          <>
            <button
              onClick={() => setActiveTab('vars')}
              title={t(language, 'sidebar.vars')}
              className={`p-2 rounded-lg transition-colors ${activeTab === 'vars' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-slate-600 hover:text-slate-300'}`}
            >
              <VarsIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => setActiveTab('nav')}
              title={t(language, 'sidebar.nav')}
              className={`p-2 rounded-lg transition-colors ${activeTab === 'nav' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30' : 'text-slate-600 hover:text-slate-300'}`}
            >
              <NavIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => setActiveTab('build')}
              title={t(language, 'sidebar.build')}
              className={`p-2 rounded-lg transition-colors ${activeTab === 'build' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30' : 'text-slate-600 hover:text-slate-300'}`}
            >
              <BuildIcon className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden">
        <div className="flex-1 overflow-hidden flex flex-col">
          {activeProject && activeProjectTemplate ? (
            <>
              {activeTab === 'vars' && (
                <div className="flex flex-col h-full overflow-y-auto p-4 space-y-6 no-scrollbar">
                  <input
                    ref={importFileInputRef}
                    type="file"
                    accept=".json,.csv,text/csv,application/json"
                    onChange={handleImportFile}
                    className="hidden"
                  />
                  <div className="relative rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                    <button
                      onClick={() => setIsVarTableMenuOpen((prev) => !prev)}
                      className="flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
                    >
                      <span>{language === 'zh-CN' ? '变量表' : 'Variable table'}</span>
                      <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${isVarTableMenuOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isVarTableMenuOpen && (
                      <div className="mt-2 space-y-1 rounded-lg border border-slate-800 bg-slate-900/95 p-2 shadow-xl">
                        <button
                          onClick={() => {
                            setIsVarTableMenuOpen(false);
                            importFileInputRef.current?.click();
                          }}
                          className="block w-full rounded-md px-3 py-2 text-left text-[10px] font-bold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
                        >
                          {t(language, 'sidebar.importVarTable')}
                        </button>
                        <button
                          onClick={() => {
                            setIsVarTableMenuOpen(false);
                            void onExportVariableTable('json');
                          }}
                          className="block w-full rounded-md px-3 py-2 text-left text-[10px] font-bold text-blue-300 transition-colors hover:bg-slate-800 hover:text-white"
                        >
                          {t(language, 'sidebar.exportJson')}
                        </button>
                        <button
                          onClick={() => {
                            setIsVarTableMenuOpen(false);
                            void onExportVariableTable('csv');
                          }}
                          className="block w-full rounded-md px-3 py-2 text-left text-[10px] font-bold text-emerald-300 transition-colors hover:bg-slate-800 hover:text-white"
                        >
                          {t(language, 'sidebar.exportCsv')}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between cursor-pointer group" onClick={() => setSections((prev) => ({ ...prev, global: !prev.global }))}>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-slate-300 transition-colors">{t(language, 'sidebar.inputVars')}</span>
                      <ChevronDownIcon className={`w-3.5 h-3.5 text-slate-600 transition-transform ${sections.global ? 'rotate-180' : ''}`} />
                    </div>
                    {sections.global &&
                      activeProjectTemplate.inputs.map((input, idx) => (
                        <div key={input.id}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[10px] font-mono text-blue-400 font-bold">&lt;{idx}&gt;</span>
                            <label className="text-[10px] text-slate-500 block truncate font-medium">{input.label}</label>
                          </div>
                          <AutoResizeTextarea
                            value={activeProject.inputValues[input.id] || ''}
                            onChange={(val) => onInputChange(input.id, val)}
                            placeholder="..."
                            className="bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                          />
                        </div>
                      ))}
                  </div>

                  <div className="space-y-3 border-t border-slate-800 pt-4">
                    <div className="flex items-center justify-between cursor-pointer group" onClick={() => setSections((prev) => ({ ...prev, local: !prev.local }))}>
                      <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider group-hover:text-emerald-400 transition-colors">{t(language, 'sidebar.localVars')}</span>
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
                            <AutoResizeTextarea
                              value={activeProject.inputValues[input.id] || ''}
                              onChange={(val) => onInputChange(input.id, val)}
                              placeholder="..."
                              className="bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
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
                              placeholder={t(language, 'sidebar.varNamePlaceholder')}
                              value={newVarName}
                              onChange={(e) => setNewVarName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddVariable();
                                if (e.key === 'Escape') setIsAddingVariable(false);
                              }}
                            />
                            <div className="flex justify-end gap-2 mt-3">
                              <button onClick={() => setIsAddingVariable(false)} className="text-[10px] text-slate-500 px-2 py-1 hover:text-white">{t(language, 'sidebar.cancel')}</button>
                              <button onClick={handleAddVariable} className="text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-md transition-colors">{t(language, 'sidebar.add')}</button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setIsAddingVariable(true)}
                            className="w-full py-2 border border-dashed border-slate-800 rounded-lg text-[10px] text-slate-500 hover:border-emerald-500/50 hover:text-emerald-500 transition-all"
                          >
                            {t(language, 'sidebar.addLocalVar')}
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  <div className="space-y-3 border-t border-slate-800 pt-4">
                    <div className="flex items-center justify-between cursor-pointer group" onClick={() => setSections((prev) => ({ ...prev, result: !prev.result }))}>
                      <span className="text-[10px] font-bold text-violet-500 uppercase tracking-wider group-hover:text-violet-300 transition-colors">{t(language, 'sidebar.resultVars')}</span>
                      <ChevronDownIcon className={`w-3.5 h-3.5 text-violet-500/50 transition-transform ${sections.result ? 'rotate-180' : ''}`} />
                    </div>
                    {sections.result && (
                      <>
                        {resultVariables.length === 0 ? (
                          <div className="text-[10px] text-slate-600 border border-dashed border-slate-800 rounded-lg px-3 py-3">
                            {t(language, 'sidebar.noResultVars')}
                          </div>
                        ) : (
                          resultVariables.map((variable) => {
                            const isExpanded = Boolean(expandedResultVariableIds[variable.id]);
                            const preview = (variable.value || '').trim();

                            return (
                              <div key={variable.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-2">
                              <button
                                type="button"
                                onClick={() => toggleResultVariable(variable.id)}
                                className="flex w-full items-start justify-between gap-2 text-left"
                              >
                                <div className="min-w-0">
                                  <div className="text-[10px] text-violet-400 font-bold font-mono truncate">{`{{${variable.key}}}`}</div>
                                  <div className="text-[10px] text-slate-500 truncate">{variable.label}</div>
                                  <div className="text-[9px] text-slate-600 truncate">
                                    {variable.sourceType === 'step_output'
                                      ? `${t(language, 'sidebar.stepSource')}: ${getStepName(variable.sourceRef) || variable.sourceRef || '-'}`
                                      : `${t(language, 'sidebar.sourceType')}: ${variable.sourceType}`}
                                  </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
                                  {variable.sourceRef && (
                                    <span className={`w-2 h-2 rounded-full ${getStatusDotClass(getStepStatus(variable.sourceRef))}`}></span>
                                  )}
                                  <ChevronDownIcon className={`h-3.5 w-3.5 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                </div>
                              </button>
                              <div className="mt-1.5 flex items-center justify-between gap-2">
                                <div className="min-w-0 truncate text-[10px] text-slate-500">
                                  {preview
                                    ? `${preview.slice(0, 64)}${preview.length > 64 ? '...' : ''}`
                                    : language === 'zh-CN'
                                      ? '暂无内容'
                                      : 'Empty'}
                                </div>
                                <button
                                  onClick={() => toggleResultVariable(variable.id)}
                                  className="hidden"
                                >
                                  {isExpanded
                                    ? language === 'zh-CN' ? '收起' : 'Collapse'
                                    : language === 'zh-CN' ? '展开' : 'Expand'}
                                </button>
                              </div>
                              {isExpanded && (
                                <div className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-[11px] leading-relaxed text-slate-300">
                                  {variable.value || '...'}
                                </div>
                              )}
                              <div className="mt-1.5 flex items-center gap-2 text-[10px] font-medium">
                                <button
                                  onClick={() => copyVariableValue(variable.value || '')}
                                  className="text-slate-400 transition-colors hover:text-white"
                                >
                                  {t(language, 'sidebar.copyVar')}
                                </button>
                                {variable.sourceRef && (
                                  <button
                                    onClick={() => scrollToStep(variable.sourceRef)}
                                    className="text-amber-300 transition-colors hover:text-white"
                                  >
                                    {t(language, 'sidebar.goSource')}
                                  </button>
                                )}
                              </div>
                              </div>
                            );
                          })
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
                      onClick={() => scrollToStep(step.id)}
                      className="w-full flex items-center gap-3 p-2.5 hover:bg-slate-800 rounded-lg text-left transition-all group"
                    >
                      <span className="w-5 h-5 flex items-center justify-center shrink-0 bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-500 group-hover:border-amber-500 group-hover:text-amber-500 rounded transition-all">{idx + 1}</span>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${getStatusDotClass(getStepStatus(step.id))}`}></span>
                      <span className="text-xs text-slate-300 truncate font-medium">{step.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {activeTab === 'build' && (
                <div className="p-6 flex flex-col items-center justify-center text-center h-full">
                  <div className="w-14 h-14 bg-purple-900/30 text-purple-400 rounded-2xl flex items-center justify-center mb-4 shadow-xl shadow-purple-950/20">
                    <DownloadIcon className="w-7 h-7" />
                  </div>
                  <h4 className="text-xs font-bold text-white mb-2 uppercase tracking-wider">{t(language, 'sidebar.bakeTitle')}</h4>
                  <p className="text-[10px] text-slate-500 mb-6 px-4 leading-relaxed">{t(language, 'sidebar.bakeDescription')}</p>
                  <Button variant="primary" size="sm" onClick={onBakeDownload} className="w-full bg-purple-600 hover:bg-purple-500 shadow-lg shadow-purple-600/30 font-bold">
                    {t(language, 'sidebar.startExport')}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="p-10 text-center text-slate-600 text-[10px] flex flex-col items-center gap-3">
              <div className="w-8 h-8 border border-slate-800 rounded-full flex items-center justify-center opacity-40">!</div>
              {t(language, 'sidebar.openProjectFirst')}
            </div>
          )}
        </div>
      </div>

      <div
        className="absolute right-0 top-0 bottom-0 w-1.5 bg-transparent hover:bg-blue-500/30 cursor-col-resize z-40 transition-colors"
        onMouseDown={(e) => {
          e.preventDefault();
          onResizingChange(true);
        }}
      />
    </div>
  );
};
