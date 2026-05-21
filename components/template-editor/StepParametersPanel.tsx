import React from 'react';
import {
  StepParameter,
  StepParameterType,
  Template,
  TemplateStep,
  UiLanguage,
} from '../../types';
import {
  extractStepParameterReferences,
  syncStepParametersFromContent,
} from '../../services/stepParameterService';

interface StepParametersPanelProps {
  language: UiLanguage;
  template: Template;
  step: TemplateStep;
  onSyncParametersFromContent?: () => void;
  onAddParameter?: () => void;
  onUpdateParameter: (parameterIndex: number, updates: Partial<StepParameter>) => void;
  onRemoveParameter?: (parameterIndex: number) => void;
  compact?: boolean;
}

export const StepParametersPanel: React.FC<StepParametersPanelProps> = ({
  language,
  step,
  onUpdateParameter,
  compact = false,
}) => {
  const parameters = syncStepParametersFromContent(step);
  const invalidReferences = extractStepParameterReferences(step.content || '').filter(
    (reference) => !reference.valid
  );

  return (
    <div className={`${compact ? 'space-y-2' : 'border-t border-slate-800 pt-3'}`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="text-xs font-bold text-emerald-300">
            {language === 'zh-CN' ? '入口参数' : 'Parameters'}
          </div>
          <span className="text-[11px] text-slate-500">
            {parameters.length > 0
              ? `${parameters.length}`
              : language === 'zh-CN'
                ? '函数体未引用参数'
                : 'No parameter references'}
          </span>
          <span className="hidden truncate text-[11px] text-slate-500 md:inline">
            {language === 'zh-CN'
              ? '由函数体里的 [[参数名]] 自动解析；本地值优先，缺少时使用默认值。'
              : 'Derived from [[parameter]] references in the function body. Local values are used before defaults.'}
          </span>
        </div>
      </div>

      {invalidReferences.length > 0 && (
        <div className="mb-2 rounded border border-red-500/20 bg-red-500/10 px-2.5 py-2 text-[11px] text-red-200">
          {language === 'zh-CN'
            ? '函数体存在无效引用。入口参数只能写成 [[参数名]]。'
            : 'The function body has invalid references. Parameters must use [[name]] only.'}
        </div>
      )}

      {parameters.length > 0 && (
        <div className="space-y-1.5">
          <div className="grid grid-cols-[minmax(0,1fr)_80px_minmax(0,1fr)] gap-2 px-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            <span>{language === 'zh-CN' ? '参数名' : 'Parameter'}</span>
            <span>{language === 'zh-CN' ? '类型' : 'Type'}</span>
            <span>{language === 'zh-CN' ? '默认值' : 'Default'}</span>
          </div>
          {parameters.map((parameter, parameterIndex) => (
            <div
              key={parameter.id || `${step.id}_parameter_${parameterIndex}`}
              className="grid grid-cols-[minmax(0,1fr)_80px_minmax(0,1fr)] items-center gap-2 rounded border border-slate-800 bg-slate-950/50 p-2"
            >
              <div className="min-w-0 truncate rounded border border-slate-800 bg-slate-950 px-2.5 py-1.5 font-mono text-sm text-cyan-200">
                {parameter.name}
              </div>
              <select
                value={parameter.type}
                onChange={(event) =>
                  onUpdateParameter(parameterIndex, {
                    type: event.target.value as StepParameterType,
                  })
                }
                className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500"
              >
                <option value="text">{language === 'zh-CN' ? '文本' : 'Text'}</option>
                <option value="table">{language === 'zh-CN' ? '表' : 'Table'}</option>
              </select>
              <input
                value={parameter.defaultValue || ''}
                onChange={(event) =>
                  onUpdateParameter(parameterIndex, {
                    defaultValue: event.target.value,
                    source:
                      parameter.source?.type === 'literal'
                        ? { type: 'literal', value: event.target.value }
                        : parameter.source,
                  })
                }
                className="min-w-0 rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-200 outline-none focus:border-emerald-500"
                placeholder={
                  parameter.type === 'table'
                    ? language === 'zh-CN'
                      ? '表默认值暂用 JSON'
                      : 'JSON default'
                    : language === 'zh-CN'
                      ? '可选'
                      : 'Optional'
                }
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
