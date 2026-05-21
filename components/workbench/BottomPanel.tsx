import React from 'react';
import {
  ProjectVariable,
  RuntimeDiagnostic,
  StaticDiagnostic,
  TemplateStep,
  UiLanguage,
  WorkbenchOutputSnapshot,
} from '../../types';
import { ProblemsPanel } from './ProblemsPanel';
import { ConsolePanel } from './ConsolePanel';
import { OutputPanel } from './OutputPanel';

export type BottomPanelTab = 'problems' | 'console' | 'output';

interface BottomPanelProps {
  language: UiLanguage;
  activeTab: BottomPanelTab;
  onActiveTabChange: (tab: BottomPanelTab) => void;
  onClose: () => void;
  diagnostics: StaticDiagnostic[];
  runtimeDiagnostics: RuntimeDiagnostic[];
  recentOutput: WorkbenchOutputSnapshot | null;
  variables?: ProjectVariable[];
  steps: TemplateStep[];
  onDiagnosticClick: (diagnostic: StaticDiagnostic) => void;
  onClearConsole: () => void;
}

export const BottomPanel: React.FC<BottomPanelProps> = ({
  language,
  activeTab,
  onActiveTabChange,
  onClose,
  diagnostics,
  runtimeDiagnostics,
  recentOutput,
  variables,
  steps,
  onDiagnosticClick,
  onClearConsole,
}) => {
  const tabs: Array<{ id: BottomPanelTab; label: string; count?: number }> = [
    {
      id: 'problems',
      label: language === 'zh-CN' ? '问题' : 'Problems',
      count: diagnostics.length,
    },
    {
      id: 'console',
      label: language === 'zh-CN' ? '控制台' : 'Console',
      count: runtimeDiagnostics.length,
    },
    {
      id: 'output',
      label: language === 'zh-CN' ? '输出' : 'Output',
    },
  ];

  return (
    <div className="mt-3 max-h-64 shrink-0 overflow-hidden rounded-lg border border-slate-800 bg-slate-950/80">
      <div className="flex items-center justify-between border-b border-slate-800 px-2 py-1.5">
        <div className="flex items-center gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onActiveTabChange(tab.id)}
              className={`rounded px-2.5 py-1 text-xs font-bold transition-colors ${
                activeTab === tab.id
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-500 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && <span className="ml-1 text-[10px]">{tab.count}</span>}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-800 hover:text-white"
        >
          x
        </button>
      </div>
      <div className="max-h-52 overflow-y-auto p-2">
        {activeTab === 'problems' && (
          <ProblemsPanel
            language={language}
            diagnostics={diagnostics}
            steps={steps}
            onDiagnosticClick={onDiagnosticClick}
          />
        )}
        {activeTab === 'console' && (
          <ConsolePanel language={language} diagnostics={runtimeDiagnostics} onClear={onClearConsole} />
        )}
        {activeTab === 'output' && (
          <OutputPanel
            language={language}
            output={recentOutput}
            variables={variables}
            steps={steps}
          />
        )}
      </div>
    </div>
  );
};
