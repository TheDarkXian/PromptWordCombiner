import React from 'react';
import { StepFlowStatus, Template, UiLanguage } from '../../types';

interface SidebarNavigationPanelProps {
  activeProjectTemplate: Template;
  language: UiLanguage;
  getStatusDotClass: (status: StepFlowStatus) => string;
  getStepStatus: (stepId: string) => StepFlowStatus;
  selectedStepIds: string[];
  onFocusStep: (stepId: string) => void;
}

const getStepTypeLabel = (language: UiLanguage, stepType?: string) => {
  if (stepType === 'text_generation') return language === 'zh-CN' ? '文本生成' : 'Text';
  if (stepType === 'external') return language === 'zh-CN' ? '外部' : 'External';
  return language === 'zh-CN' ? '手动' : 'Manual';
};

export const SidebarNavigationPanel: React.FC<SidebarNavigationPanelProps> = ({
  activeProjectTemplate,
  language,
  getStatusDotClass,
  getStepStatus,
  selectedStepIds,
  onFocusStep,
}) => (
  <div className="flex h-full min-h-0 flex-col overflow-hidden">
    <div className="shrink-0 border-b border-slate-800 px-4 py-3">
      <div className="text-sm font-black text-white">{language === 'zh-CN' ? '节点导航' : 'Node Navigator'}</div>
      <div className="mt-1 text-[11px] leading-relaxed text-slate-500">
        {language === 'zh-CN' ? '点击节点可在蓝图中聚焦并高亮。' : 'Click a node to focus and highlight it in the blueprint.'}
      </div>
    </div>
    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 no-scrollbar">
      {activeProjectTemplate.steps.map((step, idx) => {
        const selected = selectedStepIds.includes(step.id);
        const outputKey = step.outputBinding?.variableKey?.trim();
        return (
          <button
            key={step.id}
            onClick={() => onFocusStep(step.id)}
            className={`group flex w-full items-start gap-3 rounded-lg border p-2.5 text-left transition-all ${
              selected
                ? 'border-cyan-500/60 bg-cyan-500/10 shadow-lg shadow-cyan-950/30'
                : 'border-transparent hover:border-slate-700 hover:bg-slate-800'
            }`}
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border text-[10px] font-bold transition-all ${
                selected
                  ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                  : 'border-slate-700 bg-slate-800 text-slate-500 group-hover:border-amber-500 group-hover:text-amber-400'
              }`}
            >
              {idx + 1}
            </span>
            <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${getStatusDotClass(getStepStatus(step.id))}`} />
            <span className="min-w-0 flex-1">
              <span className={`block truncate text-xs font-semibold ${selected ? 'text-cyan-100' : 'text-slate-300'}`}>
                {step.name}
              </span>
              <span className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-slate-500">
                <span className="rounded border border-slate-800 bg-slate-950/60 px-1.5 py-0.5">
                  {getStepTypeLabel(language, step.stepType)}
                </span>
                {outputKey && (
                  <span className="max-w-full truncate rounded border border-cyan-500/20 bg-cyan-500/10 px-1.5 py-0.5 text-cyan-300">
                    {`{{${outputKey}}}`}
                  </span>
                )}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  </div>
);
