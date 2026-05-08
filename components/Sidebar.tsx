import React, { useEffect, useRef, useState } from 'react';
import { Project, StepFlowStatus, Template, UiLanguage } from '../types';
import { t } from '../services/i18n';
import { BuildIcon, NavIcon, VarsIcon } from './Icons';
import { SidebarBuildPanel } from './sidebar/SidebarBuildPanel';
import { SidebarNavigationPanel } from './sidebar/SidebarNavigationPanel';
import { SidebarVariablePanel } from './sidebar/SidebarVariablePanel';

type SidebarTab = 'vars' | 'nav' | 'build';
type VariableTab = 'input' | 'local' | 'result';

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
  const [activeVariableTab, setActiveVariableTab] = useState<VariableTab>('input');
  const [isAddingVariable, setIsAddingVariable] = useState(false);
  const [newVarName, setNewVarName] = useState('');
  const [isVarTableMenuOpen, setIsVarTableMenuOpen] = useState(false);
  const [expandedResultVariableIds, setExpandedResultVariableIds] = useState<Record<string, boolean>>({});
  const [resultVarMenuId, setResultVarMenuId] = useState<string | null>(null);
  const newVarInputRef = useRef<HTMLInputElement>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  const getStepName = (stepId?: string) => activeProjectTemplate?.steps.find((step) => step.id === stepId)?.name;

  const getStepStatus = (stepId: string): StepFlowStatus => {
    const output = activeProject?.stepOutputs?.[stepId] || '';
    if (!output.trim()) return 'empty';

    const boundVariable = (activeProject?.variables || []).find(
      (variable) => variable.sourceType === 'step_output' && variable.sourceRef === stepId
    );
    if (!boundVariable) return 'draft';

    if (String(boundVariable.value || '') === output) return 'saved';
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

  const copyVariableValue = async (value: string) => {
    if (!value.trim()) {
      onRequestAlert(t(language, 'sidebar.duplicateVar'), t(language, 'sidebar.duplicateVarMessage'));
      return;
    }
    await navigator.clipboard.writeText(value);
  };

  const scrollToStep = (stepId?: string) => {
    if (!stepId) return;
    const el = document.getElementById(stepId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
              className={`p-2 rounded-lg transition-colors ${
                activeTab === 'vars' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-slate-600 hover:text-slate-300'
              }`}
            >
              <VarsIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => setActiveTab('nav')}
              title={t(language, 'sidebar.nav')}
              className={`p-2 rounded-lg transition-colors ${
                activeTab === 'nav' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30' : 'text-slate-600 hover:text-slate-300'
              }`}
            >
              <NavIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => setActiveTab('build')}
              title={t(language, 'sidebar.build')}
              className={`p-2 rounded-lg transition-colors ${
                activeTab === 'build' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30' : 'text-slate-600 hover:text-slate-300'
              }`}
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
                <SidebarVariablePanel
                  language={language}
                  activeProject={activeProject}
                  activeProjectTemplate={activeProjectTemplate}
                  activeVariableTab={activeVariableTab}
                  isVarTableMenuOpen={isVarTableMenuOpen}
                  isAddingVariable={isAddingVariable}
                  newVarName={newVarName}
                  expandedResultVariableIds={expandedResultVariableIds}
                  resultVarMenuId={resultVarMenuId}
                  newVarInputRef={newVarInputRef}
                  importFileInputRef={importFileInputRef}
                  onInputChange={onInputChange}
                  onAddLocalVariable={onAddLocalVariable}
                  onDeleteLocalVariable={onDeleteLocalVariable}
                  onImportVariableTable={onImportVariableTable}
                  onExportVariableTable={onExportVariableTable}
                  onRequestAlert={onRequestAlert}
                  setActiveVariableTab={setActiveVariableTab}
                  setIsVarTableMenuOpen={setIsVarTableMenuOpen}
                  setIsAddingVariable={setIsAddingVariable}
                  setNewVarName={setNewVarName}
                  setResultVarMenuId={setResultVarMenuId}
                  toggleResultVariable={toggleResultVariable}
                  copyVariableValue={copyVariableValue}
                  getStepName={getStepName}
                  getStepStatus={getStepStatus}
                  getStatusDotClass={getStatusDotClass}
                  scrollToStep={scrollToStep}
                />
              )}

              {activeTab === 'nav' && (
                <SidebarNavigationPanel
                  activeProjectTemplate={activeProjectTemplate}
                  language={language}
                  getStatusDotClass={getStatusDotClass}
                  getStepStatus={getStepStatus}
                  scrollToStep={scrollToStep}
                />
              )}

              {activeTab === 'build' && <SidebarBuildPanel language={language} onBakeDownload={onBakeDownload} />}
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
