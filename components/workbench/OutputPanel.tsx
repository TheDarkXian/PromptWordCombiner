import React from 'react';
import { ProjectVariable, TemplateStep, UiLanguage, WorkbenchOutputSnapshot } from '../../types';
import { getStepOutputs } from '../../services/stepVariablePortsService';

interface OutputPanelProps {
  language: UiLanguage;
  output: WorkbenchOutputSnapshot | null;
  variables?: ProjectVariable[];
  steps: TemplateStep[];
}

export const OutputPanel: React.FC<OutputPanelProps> = ({ language, output, variables = [], steps }) => {
  if (!output) {
    return (
      <div className="px-2 py-3 text-xs text-slate-500">
        {language === 'zh-CN' ? '暂无运行输出。' : 'No run output yet.'}
      </div>
    );
  }

  const step = steps.find((item) => item.id === output.stepId);
  const declaredOutputs = step ? getStepOutputs(step) : [];
  const outputVariables = variables.filter((variable) =>
    declaredOutputs.some((declared) => declared.key === variable.key)
  );

  return (
    <div className="space-y-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="font-bold text-slate-200">{output.stepName}</div>
        {output.structuredParse && (
          <div
            className={
              output.structuredParse.status === 'error'
                ? 'text-red-300'
                : output.structuredParse.status === 'success'
                  ? 'text-emerald-300'
                  : 'text-slate-500'
            }
          >
            {output.structuredParse.message}
          </div>
        )}
      </div>

      {outputVariables.length > 0 && (
        <div className="space-y-2">
          {outputVariables.map((variable) => (
            <div key={variable.id} className="rounded border border-slate-800 bg-slate-950/60 p-2">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-bold text-slate-300">{variable.label || variable.key}</span>
                <span className="text-[11px] text-slate-500">
                  {variable.type === 'table'
                    ? language === 'zh-CN'
                      ? '表'
                      : 'Table'
                    : language === 'zh-CN'
                      ? '文本'
                      : 'Text'}
                </span>
              </div>
              {variable.type === 'table' ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-[11px]">
                    <thead>
                      <tr className="text-slate-500">
                        {(variable.tableValue?.columns || []).map((column) => (
                          <th key={column.key} className="border border-slate-800 px-2 py-1 text-left">
                            {column.label || column.key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(variable.tableValue?.rows || []).slice(0, 5).map((row) => (
                        <tr key={row.id}>
                          {(variable.tableValue?.columns || []).map((column) => (
                            <td key={column.key} className="border border-slate-800 px-2 py-1 text-slate-300">
                              {row.cells[column.key] || ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="whitespace-pre-wrap text-slate-300">{variable.value || ''}</div>
              )}
            </div>
          ))}
        </div>
      )}

      <div>
        <div className="mb-1 font-bold text-slate-500">
          {language === 'zh-CN' ? '原始输出' : 'Raw output'}
        </div>
        <pre className="max-h-36 overflow-auto whitespace-pre-wrap rounded border border-slate-800 bg-slate-950 p-2 text-[11px] text-slate-300">
          {output.rawOutput}
        </pre>
      </div>
    </div>
  );
};
