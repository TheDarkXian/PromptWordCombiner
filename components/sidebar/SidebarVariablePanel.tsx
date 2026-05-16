import React from 'react';
import { Project, StepFlowStatus, Template, UiLanguage } from '../../types';
import { t } from '../../services/i18n';
import { ChevronDownIcon } from '../Icons';
import { AutoResizeTextarea } from '../common/AutoResizeTextarea';

type VariableTab = 'input' | 'local' | 'result';

interface SidebarVariablePanelProps {
  language: UiLanguage;
  activeProject: Project;
  activeProjectTemplate: Template;
  activeVariableTab: VariableTab;
  isVarTableMenuOpen: boolean;
  isAddingVariable: boolean;
  newVarName: string;
  expandedResultVariableIds: Record<string, boolean>;
  resultVarMenuId: string | null;
  newVarInputRef: React.RefObject<HTMLInputElement | null>;
  importFileInputRef: React.RefObject<HTMLInputElement | null>;
  onInputChange: (inputId: string, value: string) => void;
  onAddLocalVariable: (name: string) => void;
  onDeleteLocalVariable: (varId: string) => void;
  onImportVariableTable: (content: string) => void;
  onExportVariableTable: (format: 'json' | 'csv') => void;
  onRequestAlert: (title: string, message: string) => void;
  setActiveVariableTab: React.Dispatch<React.SetStateAction<VariableTab>>;
  setIsVarTableMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsAddingVariable: React.Dispatch<React.SetStateAction<boolean>>;
  setNewVarName: React.Dispatch<React.SetStateAction<string>>;
  setResultVarMenuId: React.Dispatch<React.SetStateAction<string | null>>;
  toggleResultVariable: (variableId: string) => void;
  copyVariableValue: (value: string) => Promise<void>;
  getStepName: (stepId?: string) => string | undefined;
  getStepStatus: (stepId: string) => StepFlowStatus;
  getStatusDotClass: (status: StepFlowStatus) => string;
  scrollToStep: (stepId?: string) => void;
}

export const SidebarVariablePanel: React.FC<SidebarVariablePanelProps> = ({
  language,
  activeProject,
  activeProjectTemplate,
  activeVariableTab,
  isVarTableMenuOpen,
  isAddingVariable,
  newVarName,
  expandedResultVariableIds,
  resultVarMenuId,
  newVarInputRef,
  importFileInputRef,
  onInputChange,
  onAddLocalVariable,
  onDeleteLocalVariable,
  onImportVariableTable,
  onExportVariableTable,
  onRequestAlert,
  setActiveVariableTab,
  setIsVarTableMenuOpen,
  setIsAddingVariable,
  setNewVarName,
  setResultVarMenuId,
  toggleResultVariable,
  copyVariableValue,
  getStepName,
  getStepStatus,
  getStatusDotClass,
  scrollToStep,
}) => {
  const inputVariables = activeProjectTemplate.inputs;
  const localVariables = activeProject.customInputs || [];
  const resultVariables = (activeProject.variables || []).filter((variable) =>
    ['step_output', 'structured_step_output', 'derived', 'manual'].includes(variable.sourceType)
  );

  const handleAddVariable = () => {
    const trimmed = newVarName.trim();
    if (!trimmed) {
      setIsAddingVariable(false);
      return;
    }
    if (activeProject.customInputs?.some((input) => input.label === trimmed)) {
      onRequestAlert(
        language === 'zh-CN' ? '名称重复' : 'Duplicate name',
        language === 'zh-CN'
          ? '已经存在同名的局部变量。'
          : 'A local variable with this name already exists.'
      );
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

  const renderVariableTabs = () => (
    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-1.5">
      <div className="grid grid-cols-3 gap-1">
        <button
          type="button"
          onClick={() => setActiveVariableTab('input')}
          className={`rounded-lg px-2 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${
            activeVariableTab === 'input'
              ? 'bg-slate-800 text-white'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          {`${t(language, 'sidebar.inputVars')} (${inputVariables.length})`}
        </button>
        <button
          type="button"
          onClick={() => setActiveVariableTab('local')}
          className={`rounded-lg px-2 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${
            activeVariableTab === 'local'
              ? 'bg-emerald-500/10 text-emerald-300'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          {`${t(language, 'sidebar.localVars')} (${localVariables.length})`}
        </button>
        <button
          type="button"
          onClick={() => setActiveVariableTab('result')}
          className={`rounded-lg px-2 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${
            activeVariableTab === 'result'
              ? 'bg-violet-500/10 text-violet-300'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          {`${t(language, 'sidebar.resultVars')} (${resultVariables.length})`}
        </button>
      </div>
    </div>
  );

  const renderInputVariables = () => (
    <div className="space-y-3">
      {inputVariables.map((input, idx) => (
        <div key={input.id}>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="font-mono text-[10px] font-bold text-blue-400">&lt;{idx}&gt;</span>
            <label className="block truncate text-[10px] font-medium text-slate-500">
              {input.label}
            </label>
          </div>
          <AutoResizeTextarea
            value={activeProject.inputValues[input.id] || ''}
            onChange={(val) => onInputChange(input.id, val)}
            placeholder="..."
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-300 outline-none transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
      ))}
    </div>
  );

  const renderLocalVariables = () => (
    <div className="space-y-3">
      {localVariables.map((input, idx) => (
        <div key={input.id} className="group relative">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="font-mono text-[10px] font-bold text-emerald-400">&lt;l{idx + 1}&gt;</span>
            <label className="block truncate text-[10px] font-medium text-slate-500">
              {input.label}
            </label>
          </div>
          <AutoResizeTextarea
            value={activeProject.inputValues[input.id] || ''}
            onChange={(val) => onInputChange(input.id, val)}
            placeholder="..."
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-300 outline-none transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={() => onDeleteLocalVariable(input.id)}
            className="absolute right-0 top-0 p-1 text-slate-700 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
          >
            ×
          </button>
        </div>
      ))}
      {isAddingVariable ? (
        <div className="animate-in slide-in-from-top-1 rounded-lg border border-emerald-900/50 bg-slate-950 p-3 duration-150">
          <input
            ref={newVarInputRef}
            type="text"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white outline-none focus:border-emerald-500"
            placeholder={t(language, 'sidebar.varNamePlaceholder')}
            value={newVarName}
            onChange={(e) => setNewVarName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddVariable();
              if (e.key === 'Escape') setIsAddingVariable(false);
            }}
          />
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => setIsAddingVariable(false)}
              className="px-2 py-1 text-[10px] text-slate-500 hover:text-white"
            >
              {t(language, 'sidebar.cancel')}
            </button>
            <button
              onClick={handleAddVariable}
              className="rounded-md bg-emerald-600 px-3 py-1 text-[10px] text-white transition-colors hover:bg-emerald-500"
            >
              {t(language, 'sidebar.add')}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsAddingVariable(true)}
          className="w-full rounded-lg border border-dashed border-slate-800 py-2 text-[10px] text-slate-500 transition-all hover:border-emerald-500/50 hover:text-emerald-500"
        >
          {t(language, 'sidebar.addLocalVar')}
        </button>
      )}
    </div>
  );

  const renderResultVariables = () => (
    <div className="space-y-3">
      {resultVariables.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-800 px-3 py-3 text-[10px] text-slate-600">
          {t(language, 'sidebar.noResultVars')}
        </div>
      ) : (
        resultVariables.map((variable) => {
          const isExpanded = Boolean(expandedResultVariableIds[variable.id]);
          const preview = (variable.value || '').trim();

          return (
            <div key={variable.id} className="relative rounded-lg border border-slate-800 bg-slate-950/40 p-2">
              <button
                type="button"
                onClick={() => toggleResultVariable(variable.id)}
                className="flex w-full items-start justify-between gap-2 text-left"
              >
                <div className="min-w-0">
                  <div className="truncate font-mono text-[10px] font-bold text-violet-400">{`{{${variable.key}}}`}</div>
                  <div className="truncate text-[10px] text-slate-500">
                    {variable.label}
                    {variable.sourceType === 'step_output' && (
                      <span className="ml-1 text-[9px] text-slate-600">
                        {`${t(language, 'sidebar.goSource')}: ${getStepName(variable.sourceRef) || variable.sourceRef || '-'}`}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
                  {variable.sourceRef && (
                    <span className={`h-2 w-2 rounded-full ${getStatusDotClass(getStepStatus(variable.sourceRef))}`}></span>
                  )}
                  <ChevronDownIcon className={`h-3.5 w-3.5 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
              </button>
              <div className="mt-1.5 flex items-start justify-between gap-2 text-[10px] text-slate-500">
                <div className="min-w-0 truncate">
                  {preview ? `${preview.slice(0, 64)}${preview.length > 64 ? '...' : ''}` : t(language, 'step.empty')}
                </div>
                <button
                  type="button"
                  onClick={() => setResultVarMenuId((current) => (current === variable.id ? null : variable.id))}
                  className="shrink-0 rounded px-1 text-[12px] leading-none text-slate-500 transition-colors hover:text-white"
                >
                  ⋯
                </button>
              </div>
              {isExpanded && (
                <div className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-[11px] leading-relaxed text-slate-300">
                  {variable.value || '...'}
                </div>
              )}
              {resultVarMenuId === variable.id && (
                <div className="absolute right-2 top-[58px] z-10 min-w-[72px] rounded-md border border-slate-700 bg-slate-950/95 p-1 shadow-lg shadow-black/30">
                  <button
                    type="button"
                    onClick={() => {
                      void copyVariableValue(variable.value || '');
                      setResultVarMenuId(null);
                    }}
                    className="block w-full rounded px-2 py-1 text-left text-[10px] text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
                  >
                    {t(language, 'sidebar.copyVar')}
                  </button>
                  {variable.sourceRef && (
                    <button
                      type="button"
                      onClick={() => {
                        scrollToStep(variable.sourceRef);
                        setResultVarMenuId(null);
                      }}
                      className="block w-full rounded px-2 py-1 text-left text-[10px] text-amber-300 transition-colors hover:bg-slate-800 hover:text-white"
                    >
                      {t(language, 'sidebar.goSource')}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );

  return (
    <div className="flex h-full flex-col overflow-y-auto space-y-5 p-4 no-scrollbar">
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

      {renderVariableTabs()}

      {activeVariableTab === 'input' && renderInputVariables()}
      {activeVariableTab === 'local' && renderLocalVariables()}
      {activeVariableTab === 'result' && renderResultVariables()}
    </div>
  );
};
