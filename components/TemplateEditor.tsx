
import React, { useState, useLayoutEffect, useRef, useEffect } from 'react';
import { Template, TemplateInput, TemplateStep } from '../types';
import { Button } from './Button';

interface TemplateEditorProps {
  template: Template;
  onSave: (template: Template) => void;
  onCancel: () => void;
  onRequestConfirm: (title: string, message: string, onConfirm: () => void) => void;
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
      // 关键：先重置为 0，让容器塌陷，从而获取真实的 scrollHeight
      el.style.height = '0px';
      const scrollHeight = el.scrollHeight;
      // 设置高度，确保没有多余空白
      el.style.height = `${scrollHeight}px`;
    }
  };

  // 监听值变化实时调整
  useLayoutEffect(() => {
    adjustHeight();
  }, [value]);

  // 处理初次挂载时的布局不稳定
  useEffect(() => {
    // 使用 requestAnimationFrame 确保在浏览器完成初次渲染和布局后再计算
    const handle = requestAnimationFrame(() => {
      adjustHeight();
    });
    return () => cancelAnimationFrame(handle);
  }, []);

  useEffect(() => {
    window.addEventListener('resize', adjustHeight);
    return () => window.removeEventListener('resize', adjustHeight);
  }, []);

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

export const TemplateEditor: React.FC<TemplateEditorProps> = ({ template, onSave, onCancel, onRequestConfirm }) => {
  const [editedTemplate, setEditedTemplate] = useState<Template>(JSON.parse(JSON.stringify(template)));
  const [collapsedSteps, setCollapsedSteps] = useState<Record<number, boolean>>({});

  const addInput = () => {
    const newInput: TemplateInput = {
      id: `input_${Date.now()}`,
      label: '新输入变量'
    };
    setEditedTemplate(prev => ({ ...prev, inputs: [...prev.inputs, newInput] }));
  };

  const updateInput = (idx: number, updates: Partial<TemplateInput>) => {
    setEditedTemplate(prev => {
      const inputs = [...prev.inputs];
      inputs[idx] = { ...inputs[idx], ...updates };
      return { ...prev, inputs };
    });
  };

  const removeInput = (idx: number) => {
    onRequestConfirm('删除变量', '确认删除此输入项？使用此输入的步骤将会显示错误。', () => {
      setEditedTemplate(prev => ({
        ...prev,
        inputs: prev.inputs.filter((_, i) => i !== idx)
      }));
    });
  };

  const addStep = () => {
    const newStep: TemplateStep = {
      id: `step_${Date.now()}`,
      name: '新步骤',
      content: '请在此输入提示词模板...'
    };
    setEditedTemplate(prev => ({ ...prev, steps: [...prev.steps, newStep] }));
  };

  const updateStep = (idx: number, updates: Partial<TemplateStep>) => {
    setEditedTemplate(prev => {
      const steps = [...prev.steps];
      steps[idx] = { ...steps[idx], ...updates };
      return { ...prev, steps };
    });
  };

  const removeStep = (idx: number) => {
    onRequestConfirm('删除步骤', '确认删除此步骤？', () => {
      setEditedTemplate(prev => ({
        ...prev,
        steps: prev.steps.filter((_, i) => i !== idx)
      }));
    });
  };

  const toggleStep = (idx: number) => {
    setCollapsedSteps(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div className="bg-slate-900 p-6 rounded-lg h-full overflow-y-auto max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6 sticky top-0 bg-slate-900 z-10 py-2 border-b border-slate-800">
        <h2 className="text-xl font-bold text-white">编辑模版</h2>
        <div className="space-x-2">
          <Button variant="secondary" onClick={onCancel}>取消</Button>
          <Button onClick={() => onSave(editedTemplate)}>保存模版</Button>
        </div>
      </div>

      <div className="space-y-4 mb-8">
        <label className="block text-sm font-bold text-slate-300">模版名称</label>
        <input 
          className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
          value={editedTemplate.name}
          onChange={(e) => setEditedTemplate({...editedTemplate, name: e.target.value})}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-4">
           <div className="border border-slate-800 rounded-lg p-4 bg-slate-950/50 sticky top-24">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-200">1. 输入变量 (Inputs)</h3>
              <Button size="sm" onClick={addInput}>+ 添加</Button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              提示: 可以使用 <span className="text-emerald-400 font-mono">&lt;序号&gt;</span> 或 <span className="text-emerald-400 font-mono">&lt;变量名&gt;</span> 引用。
            </p>
            <div className="space-y-3">
              {editedTemplate.inputs.map((input, idx) => (
                <div key={input.id} className="relative group bg-slate-900 p-3 rounded border border-slate-700">
                   <div className="absolute -left-2 -top-2 w-6 h-6 flex items-center justify-center bg-emerald-600 text-white text-xs font-bold rounded-full border border-slate-900 shadow-sm z-10">
                     {idx}
                   </div>
                   <div className="space-y-2 mt-1">
                     <input 
                        className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200"
                        value={input.label}
                        onChange={(e) => updateInput(idx, { label: e.target.value })}
                        placeholder="变量名称"
                     />
                   </div>
                   <button onClick={() => removeInput(idx)} className="absolute top-1 right-1 text-slate-600 hover:text-red-400 p-1">
                     ✕
                   </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-8">
          <div className="border border-slate-800 rounded-lg p-4 bg-slate-950/50">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-200">2. 流程步骤 (Steps)</h3>
            </div>
            <div className="space-y-4">
              {editedTemplate.steps.map((step, idx) => {
                const isCollapsed = collapsedSteps[idx];
                return (
                  <div key={step.id} className="bg-slate-900 border border-slate-700 rounded-lg h-auto overflow-visible">
                    <div 
                      className="flex justify-between items-center p-4 bg-slate-800/50 cursor-pointer select-none hover:bg-slate-800 transition-colors rounded-t-lg"
                      onClick={() => toggleStep(idx)}
                    >
                       <div className="flex items-center gap-3">
                          <span className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded text-xs font-bold">Step {idx + 1}</span>
                          <span className="font-bold text-slate-200 text-sm">{step.name || '未命名步骤'}</span>
                       </div>
                       <div className="flex items-center gap-2">
                           <button 
                             onClick={(e) => { e.stopPropagation(); removeStep(idx); }} 
                             className="text-slate-500 hover:text-red-400 p-1"
                           >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                                <path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5Z" clipRule="evenodd" />
                              </svg>
                           </button>
                           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className={`w-4 h-4 text-slate-500 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}>
                             <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                           </svg>
                       </div>
                    </div>

                    {!isCollapsed && (
                      <div className="p-4 border-t border-slate-800 h-auto overflow-visible">
                        <div className="flex justify-between items-start mb-4 gap-4">
                           <div className="flex-1 space-y-2">
                              <label className="text-xs text-slate-500 font-bold uppercase">步骤名称</label>
                              <input 
                                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                                  value={step.name}
                                  onChange={(e) => updateStep(idx, { name: e.target.value })}
                                  placeholder="步骤名称"
                              />
                           </div>
                           <div className="flex-1 space-y-2">
                              <label className="text-xs text-slate-500 font-bold uppercase">描述 (可选)</label>
                              <input 
                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                                value={step.description || ''}
                                onChange={(e) => updateStep(idx, { description: e.target.value })}
                                placeholder="描述 (可选)"
                              />
                           </div>
                        </div>

                        <div className="space-y-2 h-auto overflow-visible">
                          <label className="text-xs font-bold text-slate-400 uppercase">提示词模版内容</label>
                          <div className="bg-slate-950 border border-slate-700 rounded p-4 h-auto flex flex-col">
                            <AutoResizeTextarea
                               className="text-sm font-mono text-slate-300 leading-relaxed"
                               value={step.content}
                               onChange={(val) => updateStep(idx, { content: val })}
                               placeholder="编写提示词，例如：我想做一个 <0> 风格的游戏..."
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              
              <button 
                onClick={addStep}
                className="w-full py-4 border-2 border-dashed border-slate-800 hover:border-blue-500/50 rounded-lg text-slate-500 hover:text-blue-400 transition-all bg-slate-900/50 hover:bg-slate-900 flex items-center justify-center gap-2 font-bold text-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2Z" clipRule="evenodd" />
                </svg>
                添加新步骤
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
