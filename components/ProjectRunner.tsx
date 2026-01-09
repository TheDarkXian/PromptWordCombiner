
import React, { useState, useLayoutEffect, useRef, useEffect } from 'react';
import { Project, Template, TemplateStep } from '../types';
import { PromptEditor } from './PromptEditor';
import { Button } from './Button';
import { FloatingToast, useToast } from './FloatingToast';

interface ProjectRunnerProps {
  project: Project;
  template: Template;
  onUpdateProject: (projectId: string, updates: Partial<Project>) => void;
  onUpdateTemplate: (templateId: string, updates: Partial<Template>) => void;
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
    if (el) { el.style.height = '0px'; el.style.height = `${el.scrollHeight}px`; }
  };
  useLayoutEffect(() => { adjustHeight(); }, [value]);
  return (
    <textarea ref={textareaRef} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`block w-full resize-none overflow-hidden bg-transparent outline-none focus:ring-0 p-0 m-0 ${className}`} rows={1} spellCheck={false} />
  );
};

export const ProjectRunner: React.FC<ProjectRunnerProps> = ({
  project, template, onUpdateProject, onUpdateTemplate, onRequestConfirm, fontSizeClass = 'text-sm', rightPanelWidth, onRightPanelWidthChange, isRightPanelOpen, onRightPanelOpenChange
}) => {
  const [collapsedSteps, setCollapsedSteps] = useState<Record<string, boolean>>({});
  const [isResizingRight, setIsResizingRight] = useState(false);
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

  const handleDoubleClickCopy = (content: string, e: React.MouseEvent) => {
    navigator.clipboard.writeText(content);
    showToast('复制成功', e.clientX, e.clientY);
  };

  return (
    <div className={`flex h-full w-full ${fontSizeClass}`}>
      <div className="flex-1 flex flex-col min-w-0">
         <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 pb-40 no-scrollbar">
            <div className="w-full space-y-8">
                {template.steps.map((step, index) => {
                const override = project.stepOverrides[step.id];
                const rawContent = override?.content !== undefined ? override.content : (step.content || "");
                const interpolated = interpolate(rawContent);
                const isCollapsed = collapsedSteps[step.id];

                return (
                    <div key={step.id} id={step.id} className={`border border-slate-800 rounded-2xl bg-slate-900/40 shadow-sm scroll-mt-8 overflow-hidden transition-all duration-300`}>
                    <div className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800 cursor-pointer hover:bg-slate-800/80 transition-colors" onClick={() => setCollapsedSteps(p => ({...p, [step.id]: !isCollapsed}))}>
                        <div className="flex items-center space-x-4">
                            <span className="text-xs font-mono font-bold text-slate-500 bg-slate-800 px-2 py-0.5 rounded-md">{index + 1}</span>
                            <h3 className="font-black text-slate-200 text-sm tracking-tight">{step.name}</h3>
                        </div>
                        <div className="flex items-center gap-4">
                           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-5 h-5 text-slate-600 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" /></svg>
                        </div>
                    </div>
                    
                    {!isCollapsed && (
                        <div className="p-6 bg-slate-900/20">
                            <PromptEditor label="提示词实时预览" templateContent={rawContent} interpolatedContent={interpolated} originalTemplateContent={step.content || ""} onUpdateOverride={(c) => onUpdateProject(project.id, { stepOverrides: { ...project.stepOverrides, [step.id]: { content: c } } })} onRevert={() => { const o = {...project.stepOverrides}; delete o[step.id]; onUpdateProject(project.id, { stepOverrides: o }); }} onSaveToTemplate={(c) => onRequestConfirm("保存到全局", "确定要将此步骤的局部修改保存回全局模版结构中吗？这会影响该模版下的所有项目。", () => { onUpdateTemplate(template.id, { steps: template.steps.map(s => s.id === step.id ? { ...s, content: c } : s) }); const o = {...project.stepOverrides}; delete o[step.id]; onUpdateProject(project.id, { stepOverrides: o }); })} />
                            <div className="mt-6 border-t border-slate-800/50 pt-6">
                                <div className="flex justify-between items-center mb-3">
                                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest block">步骤输出 / 个人备注 (支持 [[序号]] 引用)</label>
                                  <button onClick={() => onUpdateProject(project.id, { stepOutputs: { ...project.stepOutputs, [step.id]: '' } })} className="text-[10px] text-slate-700 hover:text-red-400 uppercase tracking-tighter font-bold transition-colors">清除内容</button>
                                </div>
                                <div className={`bg-slate-950/50 border border-slate-800/60 rounded-xl px-4 py-3 transition-colors hover:border-slate-700`}>
                                  <AutoResizeTextarea 
                                    className="text-sm text-slate-400 leading-relaxed font-sans min-h-[60px]" 
                                    value={project.stepOutputs[step.id] || ''} 
                                    onChange={(val) => onUpdateProject(project.id, { stepOutputs: { ...project.stepOutputs, [step.id]: val } })} 
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
                      className="text-slate-300 font-mono text-sm leading-relaxed whitespace-pre-wrap pl-4 py-2 border-l-2 border-slate-800 group-hover:border-blue-500/30 transition-colors relative cursor-copy select-none active:bg-blue-500/5"
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
