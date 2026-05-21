import React from 'react';
import { StaticDiagnostic, TemplateStep, UiLanguage } from '../../types';

interface ProblemsPanelProps {
  language: UiLanguage;
  diagnostics: StaticDiagnostic[];
  steps: TemplateStep[];
  onDiagnosticClick: (diagnostic: StaticDiagnostic) => void;
}

export const ProblemsPanel: React.FC<ProblemsPanelProps> = ({
  language,
  diagnostics,
  steps,
  onDiagnosticClick,
}) => {
  if (diagnostics.length === 0) {
    return (
      <div className="px-2 py-3 text-xs text-slate-500">
        {language === 'zh-CN' ? '暂无问题。' : 'No problems.'}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {diagnostics.map((diagnostic) => {
        const step = steps.find((item) => item.id === diagnostic.stepId);
        return (
          <button
            key={diagnostic.id}
            type="button"
            onClick={() => onDiagnosticClick(diagnostic)}
            className="grid w-full grid-cols-[72px_160px_minmax(0,1fr)] gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-slate-900"
          >
            <span
              className={
                diagnostic.level === 'error'
                  ? 'text-red-300'
                  : diagnostic.level === 'warning'
                    ? 'text-amber-300'
                    : 'text-slate-400'
              }
            >
              {diagnostic.level === 'error'
                ? language === 'zh-CN'
                  ? '错误'
                  : 'Error'
                : diagnostic.level === 'warning'
                  ? language === 'zh-CN'
                    ? '警告'
                    : 'Warning'
                  : 'Info'}
            </span>
            <span className="truncate text-slate-400">{step?.name || diagnostic.stepId || '-'}</span>
            <span className="truncate text-slate-200">{diagnostic.message}</span>
          </button>
        );
      })}
    </div>
  );
};
