
import React, { useState, useLayoutEffect, useRef, useEffect } from 'react';
import { ModelPreset, Project, ProviderConfig, StepRunLog, Template } from '../types';
import { PromptEditor } from './PromptEditor';
import { FloatingToast, useToast } from './FloatingToast';
import { resolveStepAiAvailability } from '../services/aiAvailabilityService';
import { executeTextGeneration } from '../services/aiTextService';

interface ProjectRunnerProps {
  project: Project;
  template: Template;
  onUpdateProject: (projectId: string, updates: Partial<Project>) => void;
  onUpdateTemplate: (templateId: string, updates: Partial<Template>) => void;
  onRequestConfirm: (title: string, message: string, onConfirm: () => void) => void;
  providerConfigs: ProviderConfig[];
  modelPresets: ModelPreset[];
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
    if (el) { el.style.height = '0px'; el.style.height = `${el.scrollHeight}px`; }
  };
  useLayoutEffect(() => { adjustHeight(); }, [value]);
  return (
    <textarea ref={textareaRef} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`block w-full resize-none overflow-hidden bg-transparent outline-none focus:ring-0 p-0 m-0 ${className}`} rows={1} spellCheck={false} />
  );
};

export const ProjectRunner: React.FC<ProjectRunnerProps> = ({
  project, template, onUpdateProject, onUpdateTemplate, onRequestConfirm, providerConfigs, modelPresets, fontSizeClass = 'text-sm', rightPanelWidth, onRightPanelWidthChange, isRightPanelOpen, onRightPanelOpenChange
}) => {
  const [collapsedSteps, setCollapsedSteps] = useState<Record<string, boolean>>({});
  const [isResizingRight, setIsResizingRight] = useState(false);
  const [runningStepId, setRunningStepId] = useState<string | null>(null);
  const { toasts, showToast, removeToast } = useToast();
  
  const interpolate = (templateStr: string): string => {
    if (!templateStr) return "";
    let result = templateStr;

    // 1. Global Inputs <0>, <1>... or <Name>
    template.inputs.forEach((input, index) => {
      const val = project.inputValues[input.id] || "";
      result = result.split(`<${index}>`).join(val);
      result = result.split(`<${input.label}>`).join(val);
    });

    // 2. Local Custom Variables <l1>, <l2>... or <Name>
    (project.customInputs || []).forEach((input, index) => {
       const val = project.inputValues[input.id] || "";
       result = result.split(`<l${index + 1}>`).join(val);
       result = result.split(`<${input.label}>`).join(val);
    });

    // 3. Step Output Referencing [[1]], [[2]]... or [[Step Name]]
    template.steps.forEach((step, index) => {
      const output = project.stepOutputs[step.id] || "";
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
    const handleMouseUp = () => { setIsResizingRight(false); document.body.style.cursor = 'default'; };
    if (isResizingRight) { window.addEventListener('mousemove', handleMouseMove); window.addEventListener('mouseup', handleMouseUp); document.body.style.cursor = 'col-resize'; }
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [isResizingRight, onRightPanelWidthChange]);

  const copyPrompt = (content: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(content);
    showToast('复制成功', e.clientX, e.clientY);
  };

  const handleDoubleClickCopy = (content: string, e: React.MouseEvent) => {
    copyPrompt(content, e);
  };

  const writeStepOutput = (stepId: string, value: string, source: 'manual' | 'ai', meta?: {
    modelPresetId?: string;
    modelName?: string;
    providerType?: ProviderConfig['providerType'];
  }) => {
    onUpdateProject(project.id, {
      stepOutputs: { ...project.stepOutputs, [stepId]: value },
      stepOutputMeta: {
        ...(project.stepOutputMeta || {}),
        [stepId]: {
          updatedAt: Date.now(),
          source,
          ...meta,
        },
      },
    });
  };

  const writeGeneratedOutput = (stepId: string, value: string, meta: {
    modelPresetId?: string;
    modelName?: string;
    providerType?: ProviderConfig['providerType'];
  }) => {
    const step = template.steps.find(item => item.id === stepId);
    const target = step?.execution?.outputTarget || 'stepOutput';
    const outputInputId = step?.execution?.outputInputId;

    if (target === 'templateInput' && outputInputId) {
      onUpdateProject(project.id, {
        inputValues: { ...project.inputValues, [outputInputId]: value },
        stepOutputMeta: {
          ...(project.stepOutputMeta || {}),
          [stepId]: {
            updatedAt: Date.now(),
            source: 'ai',
            ...meta,
          },
        },
      });
      return;
    }

    writeStepOutput(stepId, value, 'ai', meta);
  };

  const appendRunLog = (stepId: string, log: StepRunLog) => {
    onUpdateProject(project.id, {
      stepRunLogs: {
        ...(project.stepRunLogs || {}),
        [stepId]: [log, ...((project.stepRunLogs || {})[stepId] || [])].slice(0, 20),
      },
    });
  };

  const generateStepText = async (stepId: string, prompt: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const step = template.steps.find(item => item.id === stepId);
    if (!step || runningStepId) return;

    const availability = resolveStepAiAvailability(step, template, modelPresets, providerConfigs);
    if (!availability.isRunnable || !availability.modelPreset || !availability.providerConfig) {
      showToast(availability.label, e.clientX, e.clientY);
      return;
    }

    const modelPreset = availability.modelPreset;
    const providerConfig = availability.providerConfig;
    setRunningStepId(stepId);
    try {
      const result = await executeTextGeneration({
        providerType: providerConfig.providerType,
        apiKey: providerConfig.apiKey,
        baseUrl: providerConfig.baseUrl,
        modelName: modelPreset.modelName,
        systemPrompt: step.execution?.systemPrompt,
        userPrompt: prompt,
        temperature: step.execution?.temperature,
        maxTokens: step.execution?.maxTokens,
      });
      writeGeneratedOutput(stepId, result.output, {
        modelPresetId: modelPreset.id,
        modelName: modelPreset.modelName,
        providerType: providerConfig.providerType,
      });
      appendRunLog(stepId, {
        id: `run_${Date.now()}`,
        createdAt: Date.now(),
        status: 'success',
        modelPresetId: modelPreset.id,
        modelName: modelPreset.modelName,
        providerType: providerConfig.providerType,
        prompt,
        output: result.output,
      });
      showToast('生成完成', e.clientX, e.clientY);
    } catch (error) {
      const message = error instanceof Error ? error.message : '生成失败';
      appendRunLog(stepId, {
        id: `run_${Date.now()}`,
        createdAt: Date.now(),
        status: 'error',
        modelPresetId: modelPreset.id,
        modelName: modelPreset.modelName,
        providerType: providerConfig.providerType,
        prompt,
        error: message,
      });
      showToast(message, e.clientX, e.clientY);
    } finally {
      setRunningStepId(null);
    }
  };

  return (
    <div className={`flex h-full w-full ${fontSizeClass}`}>
      <div className="flex-1 flex flex-col min-w-0">
         <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 pb-24 no-scrollbar">
            {/* 项目标题编辑区域 */}
            <div className="mb-4 px-1 animate-in fade-in slide-in-from-top-2 duration-500">
               <div className="flex items-center gap-3 group/title">
                  <div className="p-1.5 bg-blue-600/10 rounded-lg text-blue-500 group-hover/title:bg-blue-600 group-hover/title:text-white transition-all duration-300">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-5 h-5"><path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.596.892l-.848 2.047a.75.75 0 0 0 .98.98l2.047-.848a2.75 2.75 0 0 0 .892-.596l4.261-4.262a1.75 1.75 0 0 0 0-2.474Z" /></svg>
                  </div>
                  <input 
                    type="text"
                    value={project.name}
                    onChange={(e) => onUpdateProject(project.id, { name: e.target.value })}
                    className="bg-transparent text-xl font-black text-white outline-none border-b-2 border-transparent focus:border-blue-500/50 hover:bg-white/5 px-2 py-1 rounded-lg transition-all w-full max-w-2xl tracking-tight"
                    placeholder="未命名项目"
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  />
               </div>
               <div className="flex items-center gap-4 mt-1 ml-10">
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Base Template: {template.name}</span>
                  <div className="w-1 h-1 rounded-full bg-slate-800"></div>
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Project ID: {project.id}</span>
               </div>
            </div>

            <div className="w-full space-y-3">
                {template.steps.map((step, index) => {
                const override = project.stepOverrides[step.id];
                const rawContent = override?.content !== undefined ? override.content : (step.content || "");
                const interpolated = interpolate(rawContent);
                const isCollapsed = collapsedSteps[step.id];
                const aiAvailability = resolveStepAiAvailability(step, template, modelPresets, providerConfigs);
                const isRunning = runningStepId === step.id;
                const latestMeta = project.stepOutputMeta?.[step.id];
                const outputInput = step.execution?.outputInputId ? template.inputs.find(input => input.id === step.execution?.outputInputId) : undefined;

                return (
                    <div key={step.id} id={step.id} className={`border border-slate-800 rounded-lg bg-slate-900/40 shadow-sm scroll-mt-4 overflow-hidden transition-all duration-300`}>
                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 cursor-pointer hover:bg-slate-800/80 transition-colors" onClick={() => setCollapsedSteps(p => ({...p, [step.id]: !isCollapsed}))}>
                        <div className="flex items-center space-x-4">
                            <span className="text-xs font-mono font-bold text-slate-500 bg-slate-800 px-2 py-0.5 rounded-md">{index + 1}</span>
                            <h3 className="font-black text-slate-200 text-sm tracking-tight">{step.name}</h3>
                        </div>
                        <div className="flex items-center gap-3">
                           <button
                             onClick={(e) => copyPrompt(interpolated, e)}
                             className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-blue-500/20 bg-blue-500/10 text-[10px] font-black text-blue-300 hover:bg-blue-600 hover:border-blue-500 hover:text-white transition-all shadow-sm shadow-blue-950/20"
                             title="复制当前步骤渲染后的提示词"
                           >
                             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                               <path d="M4 4.75A2.75 2.75 0 0 1 6.75 2h3.5A2.75 2.75 0 0 1 13 4.75v3.5A2.75 2.75 0 0 1 10.25 11h-3.5A2.75 2.75 0 0 1 4 8.25v-3.5Z" />
                               <path d="M3 5.25c0-.43.09-.84.25-1.21A2.75 2.75 0 0 0 2 6.35v4.4A2.75 2.75 0 0 0 4.75 13h4.4c.98 0 1.84-.51 2.33-1.27-.38.17-.8.27-1.23.27h-3.5A3.75 3.75 0 0 1 3 8.25v-3Z" />
                             </svg>
                             复制提示词
                           </button>
                           {step.execution?.enabled && (
                             <button
                               onClick={(e) => generateStepText(step.id, interpolated, e)}
                               disabled={!aiAvailability.isRunnable || isRunning}
                               className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] font-black transition-all ${
                                 aiAvailability.isRunnable
                                   ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-600 hover:border-emerald-500 hover:text-white'
                                   : 'border-slate-700 bg-slate-950 text-slate-600 cursor-not-allowed'
                               }`}
                               title={aiAvailability.message}
                             >
                               {isRunning ? '生成中...' : '生成文本'}
                             </button>
                           )}
                           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-5 h-5 text-slate-600 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" /></svg>
                        </div>
                    </div>
                    
                    {!isCollapsed && (
                        <div className="p-3 bg-slate-900/20">
                            <PromptEditor label="提示词实时预览" templateContent={rawContent} interpolatedContent={interpolated} originalTemplateContent={step.content || ""} onUpdateOverride={(c) => onUpdateProject(project.id, { stepOverrides: { ...project.stepOverrides, [step.id]: { content: c } } })} onRevert={() => { const o = {...project.stepOverrides}; delete o[step.id]; onUpdateProject(project.id, { stepOverrides: o }); }} onSaveToTemplate={(c) => onRequestConfirm("保存到全局", "确定要将此步骤的局部修改保存回全局模版结构中吗？这会影响该模版下的所有项目。", () => { onUpdateTemplate(template.id, { steps: template.steps.map(s => s.id === step.id ? { ...s, content: c } : s) }); const o = {...project.stepOverrides}; delete o[step.id]; onUpdateProject(project.id, { stepOverrides: o }); })} />
                            <div className="mt-3 border-t border-slate-800/50 pt-3">
                                {latestMeta?.source === 'ai' && (
                                  <div className="mb-1.5 text-[10px] text-emerald-500/80">
                                    AI 生成{step.execution?.outputTarget === 'templateInput' && outputInput ? `到变量「${outputInput.label}」` : ''}：{latestMeta.modelName || '未知模型'} · {latestMeta.updatedAt ? new Date(latestMeta.updatedAt).toLocaleString() : ''}
                                  </div>
                                )}
                                <div className={`relative bg-slate-950/50 border border-slate-800/60 rounded-lg px-3 py-2 transition-colors hover:border-slate-700`}>
                                  <button onClick={() => writeStepOutput(step.id, '', 'manual')} className="absolute right-3 top-2 z-10 text-[10px] text-slate-700 hover:text-red-400 uppercase tracking-tighter font-bold transition-colors">清除内容</button>
                                  <AutoResizeTextarea 
                                    className="text-sm text-slate-400 leading-relaxed font-sans min-h-[40px] pr-16" 
                                    value={project.stepOutputs[step.id] || ''} 
                                    onChange={(val) => writeStepOutput(step.id, val, 'manual')} 
                                    placeholder="输入此步骤的生成结果、草稿或用于下一步骤引用的关键信息..." 
                                  />
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

      {isRightPanelOpen && <div className="w-1.5 bg-slate-800 hover:bg-blue-600 cursor-col-resize z-30 flex-shrink-0 transition-colors" onMouseDown={(e) => { e.preventDefault(); setIsResizingRight(true); }} />}

      <div style={{ width: isRightPanelOpen ? rightPanelWidth : '40px' }} className="bg-slate-900 border-l border-slate-800 flex flex-col flex-shrink-0 transition-all duration-75 relative">
         <div className="flex items-center justify-between p-3 border-b border-slate-800 bg-slate-900 h-12 shrink-0">
             {isRightPanelOpen && <span className="font-bold text-[10px] text-slate-500 uppercase tracking-widest pl-3 truncate">拼接结果实时全览</span>}
             <button onClick={() => onRightPanelOpenChange(!isRightPanelOpen)} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-colors">{isRightPanelOpen ? "»" : "«"}</button>
         </div>
         {isRightPanelOpen && (
           <div className="flex-1 overflow-y-auto p-6 bg-slate-950/30 space-y-8 no-scrollbar">
             {template.steps.map((step, idx) => {
                const override = project.stepOverrides[step.id];
                const content = interpolate(override?.content !== undefined ? override.content : (step.content || ""));
                return (
                  <div key={step.id} className="relative group">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-[11px] font-mono text-slate-600 font-bold">&lt;{idx+1}&gt;</span>
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
