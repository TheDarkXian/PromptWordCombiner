import React from 'react';
import { StepFlowStatus, Template, UiLanguage } from '../../types';

interface SidebarNavigationPanelProps {
  activeProjectTemplate: Template;
  language: UiLanguage;
  getStatusDotClass: (status: StepFlowStatus) => string;
  getStepStatus: (stepId: string) => StepFlowStatus;
  scrollToStep: (stepId: string) => void;
}

export const SidebarNavigationPanel: React.FC<SidebarNavigationPanelProps> = ({
  activeProjectTemplate,
  getStatusDotClass,
  getStepStatus,
  scrollToStep,
}) => (
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
);
