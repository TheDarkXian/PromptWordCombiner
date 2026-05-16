import React from 'react';
import { Project, Template, UiLanguage } from '../../types';
import { t } from '../../services/i18n';
import { createInterpolator } from '../../services/interpolationService';

interface SidebarPreviewPanelProps {
  language: UiLanguage;
  activeProject: Project;
  activeProjectTemplate: Template;
}

export const SidebarPreviewPanel: React.FC<SidebarPreviewPanelProps> = ({
  language,
  activeProject,
  activeProjectTemplate,
}) => {
  const interpolate = createInterpolator(activeProject, activeProjectTemplate);

  const copyContent = async (content: string) => {
    if (!content.trim()) return;
    await navigator.clipboard.writeText(content);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-slate-800 px-4 py-3">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          {t(language, 'project.liveOutline')}
        </div>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto p-4 no-scrollbar">
        {activeProjectTemplate.steps.map((step, index) => {
          const override = activeProject.stepOverrides[step.id];
          const rawContent = override?.content !== undefined ? override.content : step.content || '';
          const content = interpolate(rawContent);

          return (
            <div key={step.id} className="group relative">
              <div className="mb-2 flex items-center gap-2.5">
                <span className="font-mono text-[10px] font-bold text-slate-600">
                  &lt;{index + 1}&gt;
                </span>
                <span className="truncate text-xs font-black uppercase tracking-tight text-slate-500">
                  {step.name}
                </span>
              </div>
              <button
                type="button"
                onDoubleClick={() => {
                  void copyContent(content);
                }}
                className="block w-full cursor-copy select-none whitespace-pre-wrap break-words border-l-2 border-slate-800 py-1.5 pl-3 text-left font-mono text-[12px] leading-relaxed text-slate-300 transition-colors group-hover:border-blue-500/30 active:bg-blue-500/5"
                title={t(language, 'project.doubleClickToCopy')}
              >
                {content || '...'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
