import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Project, StepFlowStatus, Template } from '../types';
import { PromptEditor } from './PromptEditor';
import { FloatingToast, useToast } from './FloatingToast';

interface ProjectRunnerProps {
  project: Project;
  template: Template;
  onUpdateProject: (projectId: string, updates: Partial<Project>) => void;
  onUpdateTemplate: (templateId: string, updates: Partial<Template>) => void;
  onSaveStepOutputAsVariable: (stepId: string) => void;
  onRequestConfirm: (title: string, message: string, onConfirm: () => void) => void;
  fontSizeClass?: string;
  rightPanelWidth: number;
  onRightPanelWidthChange: (width: number) => void;
  isRightPanelOpen: boolean;
  onRightPanelOpenChange: (isOpen: boolean) => void;
}

const AutoResizeTextarea: React.FC<{
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}> = ({ value, onChange, placeholder, className }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = '0px';
      el.style.height = `${el.scrollHeight}px`;
    }
  };

  useLayoutEffect(() => {
    adjustHeight();
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`block w-full resize-none overflow-hidden bg-transparent outline-none focus:ring-0 p-0 m-0 ${className}`}
      rows={1}
      spellCheck={false}
    />
  );
};

export const ProjectRunner: React.FC<ProjectRunnerProps> = ({
  project,
  template,
  onUpdateProject,
  onUpdateTemplate,
  onSaveStepOutputAsVariable,
  onRequestConfirm,
  fontSizeClass = 'text-sm',
  rightPanelWidth,
  onRightPanelWidthChange,
  isRightPanelOpen,
  onRightPanelOpenChange
}) => {
  const [collapsedSteps, setCollapsedSteps] = useState<Record<string, boolean>>({});
  const [isResizingRight, setIsResizingRight] = useState(false);
  const { toasts, showToast, removeToast } = useToast();

  const getVariableByKey = (key: string) =>
    (project.variables || []).find(variable => variable.key === key);

  const getStepStatus = (stepId: string): StepFlowStatus => {
    const output = project.stepOutputs[stepId] || '';
    if (!output.trim()) return 'empty';

    const meta = project.stepOutputMeta?.[stepId];
    const boundVariable = (project.variables || []).find(
      variable => variable.sourceType === 'step_output' && variable.sourceRef === stepId
    );
    if (!boundVariable) return 'draft';

    const lastSavedAt = meta?.lastSavedToVariableAt || 0;
    const updatedAt = meta?.updatedAt || 0;
    if (lastSavedAt >= updatedAt && boundVariable.updatedAt >= updatedAt) return 'saved';
    return 'stale';
  };

  const getStatusMeta = (status: StepFlowStatus) => {
    switch (status) {
      case 'saved':
        return { label: '已写入变量', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
      case 'stale':
        return { label: '变量待更新', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
      case 'draft':
        return { label: '已填写未写入', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
      default:
        return { label: '未填写', className: 'bg-slate-800 text-slate-500 border-slate-700' };
    }
  };

  const extractVariableKeys = (content: string) => {
    if (!content) return [];
    const matches = Array.from(content.matchAll(/\{\{([^}]+)\}\}/g));
    return Array.from(new Set(matches.map((match) => String(match[1]).trim()).filter(Boolean)));
  };

  const getDependencyState = (content: string) => {
    const referencedKeys = extractVariableKeys(content);
    const missingKeys: string[] = [];
    const staleKeys: string[] = [];

    referencedKeys.forEach((key) => {
      const variable = getVariableByKey(key);
      if (!variable || !String(variable.value || '').trim()) {
        missingKeys.push(key);
        return;
      }

      if (variable.sourceType === 'step_output' && variable.sourceRef) {
        const sourceStatus = getStepStatus(variable.sourceRef);
        if (sourceStatus === 'stale') staleKeys.push(key);
      }
    });

    return { referencedKeys, missingKeys, staleKeys };
  };

  const interpolate = (templateStr: string): string => {
    if (!templateStr) return '';
    let result = templateStr;
    const variableMap = Object.fromEntries((project.variables || []).map(variable => [variable.key, variable.value || '']));

    result = result.replace(/\{\{([^}]+)\}\}/g, (_, rawKey) => variableMap[String(rawKey).trim()] || '');

    template.inputs.forEach((input, index) => {
      const value = project.inputValues[input.id] || '';
      result = result.split(`<${index}>`).join(value);
      result = result.split(`<${input.label}>`).join(value);
    });

    (project.customInputs || []).forEach((input, index) => {
      const value = project.inputValues[input.id] || '';
      result = result.split(`<l${index + 1}>`).join(value);
      result = result.split(`<${input.label}>`).join(value);
    });

    template.steps.forEach((step, index) => {
      const output = project.stepOutputs[step.id] || '';
      result = result.split(`[[${index + 1}]]`).join(output);
      result = result.split(`[[${step.name}]]`).join(output);
    });

    return result;
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRight) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 250 && newWidth < 1000) onRightPanelWidthChange(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizingRight(false);
      document.body.style.cursor = 'default';
    };

    if (isResizingRight) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingRight, onRightPanelWidthChange]);

  const handleDoubleClickCopy = (content: string, e: React.MouseEvent) => {
    navigator.clipboard.writeText(content);
    showToast('复制成功', e.clientX, e.clientY);
  };

  const handleQuickCopy = async (content: string, label: string) => {
    if (!content.trim()) return;
    await navigator.clipboard.writeText(content);
    showToast(`${label}已复制`, Math.max(120, window.innerWidth / 2), 72);
  };

  const scrollToStep = (stepId: string) => {
    const el = document.getElementById(stepId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className={`flex h-full w-full ${fontSizeClass}`}>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 pb-40 no-scrollbar">
          <div className="mb-10 px-2 animate-in fade-in slide-in-from-top-2 duration-500">
            <div className="flex items-center gap-3 group/title">
              <div className="p-2 bg-blue-600/10 rounded-xl text-blue-500 group-hover/title:bg-blue-600 group-hover/title:text-white transition-all duration-300">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-5 h-5"><path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.596.892l-.848 2.047a.75.75 0 0 0 .98.98l2.047-.848a2.75 2.75 0 0 0 .892-.596l4.261-4.262a1.75 1.75 0 0 0 0-2.474Z" /></svg>
              </div>
              <input
                type="text"
                value={project.name}
                onChange={(e) => onUpdateProject(project.id, { name: e.target.value })}
                className="bg-transparent text-2xl font-black text-white outline-none border-b-2 border-transparent focus:border-blue-500/50 hover:bg-white/5 px-2 py-1 rounded-lg transition-all w-full max-w-2xl tracking-tight"
                placeholder="未命名项目"
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              />
            </div>
            <div className="flex items-center gap-4 mt-2 ml-12">
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Base Template: {template.name}</span>
              <div className="w-1 h-1 rounded-full bg-slate-800"></div>
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Project ID: {project.id}</span>
            </div>
          </div>

          <div className="w-full space-y-8">
            {template.steps.map((step, index) => {
              const override = project.stepOverrides[step.id];
              const rawContent = override?.content !== undefined ? override.content : (step.content || '');
              const interpolated = interpolate(rawContent);
              const isCollapsed = collapsedSteps[step.id];
              const boundVariable = (project.variables || []).find(variable => variable.sourceType === 'step_output' && variable.sourceRef === step.id);
              const configuredBinding = step.outputBinding?.variableKey ? step.outputBinding : null;
              const stepStatus = getStepStatus(step.id);
              const statusMeta = getStatusMeta(stepStatus);
              const dependencyState = getDependencyState(rawContent);
              const referencedSourceSteps = dependencyState.referencedKeys
                .map((key) => getVariableByKey(key))
                .filter((variable): variable is Exclude<typeof variable, undefined> => Boolean(variable?.sourceType === 'step_output' && variable.sourceRef))
                .map((variable) => ({
                  key: variable.key,
                  stepId: variable.sourceRef as string,
                  stepName: template.steps.find((item) => item.id === variable.sourceRef)?.name || variable.sourceRef || variable.key,
                }))
                .filter((item, itemIndex, array) => array.findIndex((candidate) => candidate.stepId === item.stepId) === itemIndex);

              return (
                <div key={step.id} id={step.id} className="border border-slate-800 rounded-2xl bg-slate-900/40 shadow-sm scroll-mt-8 overflow-hidden transition-all duration-300">
                  <div
                    className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800 cursor-pointer hover:bg-slate-800/80 transition-colors"
                    onClick={() => setCollapsedSteps(prev => ({ ...prev, [step.id]: !isCollapsed }))}
                  >
                    <div className="flex items-center space-x-4">
                      <span className="text-xs font-mono font-bold text-slate-500 bg-slate-800 px-2 py-0.5 rounded-md">{index + 1}</span>
                      <h3 className="font-black text-slate-200 text-sm tracking-tight">{step.name}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusMeta.className}`}>
                        {statusMeta.label}
                      </span>
                      {dependencyState.missingKeys.length > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full border bg-red-500/10 text-red-400 border-red-500/20">
                          缺少变量 {dependencyState.missingKeys.length}
                        </span>
                      )}
                      {dependencyState.staleKeys.length > 0 && dependencyState.missingKeys.length === 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-400 border-amber-500/20">
                          依赖待更新 {dependencyState.staleKeys.length}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickCopy(interpolated, '插值结果');
                        }}
                        className="rounded-md border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-[10px] font-bold text-blue-300 transition-colors hover:border-blue-400/40 hover:text-white"
                      >
                        复制结果
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickCopy(rawContent, '模板原文');
                        }}
                        className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-[10px] font-bold text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
                      >
                        复制模板
                      </button>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-5 h-5 text-slate-600 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" /></svg>
                    </div>
                  </div>

                  {!isCollapsed && (
                    <div className="p-6 bg-slate-900/20">
                      <PromptEditor
                        label="提示词实时预览"
                        templateContent={rawContent}
                        interpolatedContent={interpolated}
                        originalTemplateContent={step.content || ''}
                        onUpdateOverride={(content) => onUpdateProject(project.id, {
                          stepOverrides: { ...project.stepOverrides, [step.id]: { content } }
                        })}
                        onRevert={() => {
                          const nextOverrides = { ...project.stepOverrides };
                          delete nextOverrides[step.id];
                          onUpdateProject(project.id, { stepOverrides: nextOverrides });
                        }}
                        onSaveToTemplate={(content) => onRequestConfirm(
                          '保存到全局模板',
                          '确定要把当前步骤的局部修改写回模板吗？这会影响同模板下的所有项目。',
                          () => {
                            onUpdateTemplate(template.id, {
                              steps: template.steps.map(item => item.id === step.id ? { ...item, content } : item)
                            });
                            const nextOverrides = { ...project.stepOverrides };
                            delete nextOverrides[step.id];
                            onUpdateProject(project.id, { stepOverrides: nextOverrides });
                          }
                        )}
                      />

                      <div className="mt-4 flex flex-wrap gap-2">
                        {configuredBinding && (
                          <button
                            onClick={() => onSaveStepOutputAsVariable(step.id)}
                            className="rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-1.5 text-[11px] font-bold text-violet-300 transition-colors hover:border-violet-400/40 hover:text-white"
                          >
                            {boundVariable ? '更新推荐变量' : '写入推荐变量'}
                          </button>
                        )}
                        {referencedSourceSteps.slice(0, 2).map((sourceStep) => (
                          <button
                            key={sourceStep.stepId}
                            onClick={() => scrollToStep(sourceStep.stepId)}
                            className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-[11px] font-bold text-amber-300 transition-colors hover:border-amber-400/40 hover:text-white"
                          >
                            查看来源: {sourceStep.stepName}
                          </button>
                        ))}
                      </div>

                      {(dependencyState.missingKeys.length > 0 || dependencyState.staleKeys.length > 0) && (
                        <div className="mt-4 space-y-2">
                          {dependencyState.missingKeys.length > 0 && (
                            <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
                              <div className="text-[11px] font-bold uppercase tracking-wider text-red-400">缺少变量</div>
                              <div className="mt-1 text-xs text-red-200/80 break-words">
                                {dependencyState.missingKeys.map((key) => `{{${key}}}`).join(' , ')}
                              </div>
                            </div>
                          )}
                          {dependencyState.staleKeys.length > 0 && (
                            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400">依赖变量待更新</div>
                              <div className="mt-1 text-xs text-amber-200/80 break-words">
                                {dependencyState.staleKeys.map((key) => `{{${key}}}`).join(' , ')}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="mt-6 border-t border-slate-800/50 pt-6">
                        <div className="flex justify-between items-center mb-3">
                          <label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest block">
                            步骤输出 / 个人备注 (支持 [[序号]] 和 {'{{variable_key}}'} 引用)
                          </label>
                          {configuredBinding && (
                            <span className="text-[10px] text-violet-400 font-mono">{`{{${configuredBinding.variableKey}}}`}</span>
                          )}
                        </div>
                        <div className="bg-slate-950/50 border border-slate-800/60 rounded-xl px-4 py-3 transition-colors hover:border-slate-700">
                          <AutoResizeTextarea
                            className="text-sm text-slate-400 leading-relaxed font-sans min-h-[60px]"
                            value={project.stepOutputs[step.id] || ''}
                            onChange={(value) => onUpdateProject(project.id, {
                              stepOutputs: { ...project.stepOutputs, [step.id]: value },
                              stepOutputMeta: {
                                ...project.stepOutputMeta,
                                [step.id]: {
                                  ...(project.stepOutputMeta?.[step.id] || {}),
                                  updatedAt: Date.now(),
                                }
                              }
                            })}
                            placeholder="输入该步骤的生成结果、草稿，或后续步骤需要复用的信息..."
                          />
                        </div>
                        <div className="mt-3 flex justify-end">
                          <button
                            onClick={() => onUpdateProject(project.id, {
                              stepOutputs: { ...project.stepOutputs, [step.id]: '' },
                              stepOutputMeta: {
                                ...project.stepOutputMeta,
                                [step.id]: {
                                  ...(project.stepOutputMeta?.[step.id] || {}),
                                  updatedAt: Date.now(),
                                }
                              }
                            })}
                            className="text-[10px] text-slate-700 hover:text-red-400 uppercase tracking-tighter font-bold transition-colors"
                          >
                            清除内容
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {isRightPanelOpen && (
        <div
          className="w-1.5 bg-slate-800 hover:bg-blue-600 cursor-col-resize z-30 flex-shrink-0 transition-colors"
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizingRight(true);
          }}
        />
      )}

      <div style={{ width: isRightPanelOpen ? rightPanelWidth : '40px' }} className="bg-slate-900 border-l border-slate-800 flex flex-col flex-shrink-0 transition-all duration-75 relative">
        <div className="flex items-center justify-between p-3 border-b border-slate-800 bg-slate-900 h-12 shrink-0">
          {isRightPanelOpen && <span className="font-bold text-[10px] text-slate-500 uppercase tracking-widest pl-3 truncate">拼接结果实时总览</span>}
          <button onClick={() => onRightPanelOpenChange(!isRightPanelOpen)} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-colors">
            {isRightPanelOpen ? '收' : '展'}
          </button>
        </div>
        {isRightPanelOpen && (
          <div className="flex-1 overflow-y-auto p-6 bg-slate-950/30 space-y-8 no-scrollbar">
            {template.steps.map((step, idx) => {
              const override = project.stepOverrides[step.id];
              const content = interpolate(override?.content !== undefined ? override.content : (step.content || ''));
              return (
                <div key={step.id} className="relative group">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-[11px] font-mono text-slate-600 font-bold">&lt;{idx + 1}&gt;</span>
                    <span className="text-xs font-black text-slate-500 uppercase truncate tracking-tight">{step.name}</span>
                  </div>
                  <div
                    onDoubleClick={(e) => handleDoubleClickCopy(content, e)}
                    className="text-slate-300 font-mono text-sm leading-relaxed whitespace-pre-wrap break-words pl-4 py-2 border-l-2 border-slate-800 group-hover:border-blue-500/30 transition-colors relative cursor-copy select-none active:bg-blue-500/5"
                    title="双击复制内容"
                  >
                    {content}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <FloatingToast toasts={toasts} onRemove={removeToast} />
    </div>
  );
};
