import React from 'react';
import { Project, Template, UiLanguage } from '../../types';
import { t } from '../../services/i18n';

interface ProjectPreviewPanelProps {
  isOpen: boolean;
  rightPanelWidth: number;
  language: UiLanguage;
  project: Project;
  template: Template;
  onRightPanelOpenChange: (isOpen: boolean) => void;
  onDoubleClickCopy: (content: string, event: React.MouseEvent) => void;
  interpolate: (templateStr: string) => string;
}

export const ProjectPreviewPanel: React.FC<ProjectPreviewPanelProps> = ({
  isOpen,
  rightPanelWidth,
  language,
  project,
  template,
  onRightPanelOpenChange,
  onDoubleClickCopy,
  interpolate,
}) => (
  <div
    style={{ width: isOpen ? rightPanelWidth : '40px' }}
    className="relative flex flex-shrink-0 flex-col border-l border-slate-800 bg-slate-900 transition-all duration-75"
  >
    <div className="flex h-11 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900 px-2.5 py-2">
      {isOpen && <span className="truncate pl-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">{t(language, 'project.liveOutline')}</span>}
      <button onClick={() => onRightPanelOpenChange(!isOpen)} className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-white">
        {isOpen ? t(language, 'project.hide') : t(language, 'project.show')}
      </button>
    </div>
    {isOpen && (
      <div className="flex-1 overflow-y-auto bg-slate-950/30 p-4 space-y-5 no-scrollbar">
        {template.steps.map((step, idx) => {
          const override = project.stepOverrides[step.id];
          const content = interpolate(override?.content !== undefined ? override.content : step.content || '');
          return (
            <div key={step.id} className="group relative">
              <div className="mb-2 flex items-center gap-2.5">
                <span className="text-[10px] font-mono font-bold text-slate-600">&lt;{idx + 1}&gt;</span>
                <span className="truncate text-xs font-black uppercase tracking-tight text-slate-500">{step.name}</span>
              </div>
              <div
                onDoubleClick={(event) => onDoubleClickCopy(content, event)}
                className="relative cursor-copy select-none whitespace-pre-wrap break-words border-l-2 border-slate-800 pl-3 py-1.5 font-mono text-[13px] leading-relaxed text-slate-300 transition-colors group-hover:border-blue-500/30 active:bg-blue-500/5"
                title={t(language, 'project.doubleClickToCopy')}
              >
                {content}
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
);
