
import React, { useState, useLayoutEffect, useRef, useEffect } from 'react';
import { ModelPreset, ProviderConfig, Template, TemplateInput, TemplateModelRef, TemplateStep } from '../types';
import { Button } from './Button';
import { DEFAULT_AI_MAX_TOKENS, DEFAULT_AI_TEMPERATURE } from '../services/aiTextService';
import { resolveModelPresetAvailability } from '../services/aiAvailabilityService';
import { validateStepReferences } from '../services/referenceValidationService';
import { StepContextMenu } from './StepContextMenu';

interface TemplateEditorProps {
  template: Template;
  onSave: (template: Template) => void;
  onCancel: () => void;
  onRequestConfirm: (title: string, message: string, onConfirm: () => void) => void;
  modelPresets: ModelPreset[];
  providerConfigs: ProviderConfig[];
  onOpenModelSettings: () => void;
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
      const scrollHeight = el.scrollHeight;
      el.style.height = `${scrollHeight}px`;
    }
  };

  useLayoutEffect(() => {
    adjustHeight();
  }, [value]);

  useEffect(() => {
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

const rewriteNumericInputRefs = (content: string, indexMap: Record<number, number>) => {
  const tokenPrefix = '__PWC_INPUT_REF_';
  const tokenSuffix = '__';
  let result = content.replace(/<(\d+)>/g, (match, rawIndex) => {
    const oldIndex = Number(rawIndex);
    if (indexMap[oldIndex] === undefined) return match;
    return `${tokenPrefix}${oldIndex}${tokenSuffix}`;
  });

  Object.entries(indexMap).forEach(([oldIndex, newIndex]) => {
    result = result.split(`${tokenPrefix}${oldIndex}${tokenSuffix}`).join(`<${newIndex}>`);
  });

  return result;
};

export const TemplateEditor: React.FC<TemplateEditorProps> = ({ template, onSave, onCancel, onRequestConfirm, modelPresets, providerConfigs, onOpenModelSettings }) => {
  const [editedTemplate, setEditedTemplate] = useState<Template>(() => {
    const cloned = JSON.parse(JSON.stringify(template));
    return { ...cloned, modelRefs: cloned.modelRefs || [] };
  });
  const [collapsedSteps, setCollapsedSteps] = useState<Record<number, boolean>>({});
  const [stepContextMenu, setStepContextMenu] = useState<{ x: number; y: number; stepIndex: number } | null>(null);

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

  const addModelRef = () => {
    const newModelRef: TemplateModelRef = {
      id: `model_ref_${Date.now()}`,
      label: '主生成模型',
      modelPresetId: modelPresets[0]?.id,
    };
    setEditedTemplate(prev => ({ ...prev, modelRefs: [...(prev.modelRefs || []), newModelRef] }));
  };

  const updateModelRef = (idx: number, updates: Partial<TemplateModelRef>) => {
    setEditedTemplate(prev => {
      const modelRefs = [...(prev.modelRefs || [])];
      modelRefs[idx] = { ...modelRefs[idx], ...updates };
      return { ...prev, modelRefs };
    });
  };

  const setInputConst = (idx: number, isConst: boolean) => {
    setEditedTemplate(prev => {
      const inputs = [...prev.inputs];
      const input = inputs[idx];
      inputs[idx] = { ...input, isConst };

      return {
        ...prev,
        inputs,
        steps: isConst
          ? prev.steps.map(step => step.execution?.outputInputId === input.id ? {
              ...step,
              execution: {
                ...step.execution,
                outputTarget: 'stepOutput',
                outputInputId: undefined,
              },
            } : step)
          : prev.steps,
      };
    });
  };

  const moveInput = (idx: number, direction: 'up' | 'down') => {
    setEditedTemplate(prev => {
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.inputs.length) return prev;

      const inputs = [...prev.inputs];
      [inputs[idx], inputs[targetIdx]] = [inputs[targetIdx], inputs[idx]];

      const indexMap: Record<number, number> = {
        [idx]: targetIdx,
        [targetIdx]: idx,
      };

      return {
        ...prev,
        inputs,
        steps: prev.steps.map(step => ({
          ...step,
          content: rewriteNumericInputRefs(step.content, indexMap),
        })),
      };
    });
  };

  const removeModelRef = (idx: number) => {
    const modelRef = editedTemplate.modelRefs?.[idx];
    if (!modelRef) return;
    const isUsed = editedTemplate.steps.some(step => step.execution?.modelRefId === modelRef.id);
    if (isUsed) {
      onRequestConfirm('删除模型变量', '有步骤正在使用这个模型变量。删除后这些步骤会变回未绑定状态。', () => {
        setEditedTemplate(prev => ({
          ...prev,
          modelRefs: (prev.modelRefs || []).filter((_, i) => i !== idx),
          steps: prev.steps.map(step => step.execution?.modelRefId === modelRef.id ? {
            ...step,
            execution: { ...step.execution, modelRefId: undefined },
          } : step),
        }));
      });
      return;
    }
    setEditedTemplate(prev => ({ ...prev, modelRefs: (prev.modelRefs || []).filter((_, i) => i !== idx) }));
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

  const moveStep = (idx: number, direction: 'up' | 'down') => {
    setEditedTemplate(prev => {
      const steps = [...prev.steps];
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= steps.length) return prev;
      
      // Swap steps
      [steps[idx], steps[targetIdx]] = [steps[targetIdx], steps[idx]];
      
      // Update collapsed states to follow the steps
      const newCollapsed = { ...collapsedSteps };
      const temp = newCollapsed[idx];
      newCollapsed[idx] = newCollapsed[targetIdx];
      newCollapsed[targetIdx] = temp;
      setCollapsedSteps(newCollapsed);

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

  const collapseOtherSteps = (stepIndex: number) => {
    setCollapsedSteps(Object.fromEntries(editedTemplate.steps.map((_, index) => [index, index !== stepIndex])));
    setStepContextMenu(null);
  };

  const expandAllSteps = () => {
    setCollapsedSteps({});
    setStepContextMenu(null);
  };

  return (
    <div className="bg-slate-900 h-full w-full overflow-hidden flex flex-col">
      <div className="shrink-0 flex flex-wrap items-center gap-3 px-4 md:px-6 py-3 bg-slate-900 border-b border-slate-800">
        <h2 className="text-base font-bold text-white whitespace-nowrap">编辑模版</h2>
        <div className="hidden sm:block w-px h-5 bg-slate-700" />
        <input
          className="min-w-0 flex-1 max-w-xl bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-sm font-bold text-white outline-none focus:border-blue-500"
          value={editedTemplate.name}
          onChange={(e) => setEditedTemplate({...editedTemplate, name: e.target.value})}
          placeholder="模版名称"
        />
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onOpenModelSettings}
            className="px-3 py-1.5 rounded border border-slate-700 bg-slate-950 text-xs font-bold text-slate-400 hover:border-blue-500/50 hover:text-blue-300 transition-colors"
          >
            模型设置
          </button>
          <Button variant="secondary" onClick={onCancel}>取消</Button>
          <Button onClick={() => onSave(editedTemplate)}>保存模版</Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-y-auto lg:overflow-hidden">
        <aside className="lg:col-span-4 min-h-0 lg:border-r border-slate-800 bg-slate-950/40">
           <div className="p-4 md:p-5 lg:h-full lg:overflow-y-auto lg:overscroll-contain">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-slate-200">输入变量</h3>
              <Button size="sm" onClick={addInput}>+ 添加</Button>
            </div>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              推荐使用 <span className="text-emerald-400 font-mono">&lt;变量名&gt;</span> 引用；移动变量时会自动维护 <span className="text-emerald-400 font-mono">&lt;0&gt;</span> 这类数字引用。
            </p>
            <div className="space-y-3">
              {editedTemplate.inputs.map((input, idx) => (
                <div key={input.id} className="relative group bg-slate-900 p-3 rounded border border-slate-700">
                   <div className="absolute -left-2 -top-2 w-6 h-6 flex items-center justify-center bg-emerald-600 text-white text-xs font-bold rounded-full border border-slate-900 shadow-sm z-10">
                     {idx}
                   </div>
                   <div className="space-y-2 mt-1">
                     <input 
                        className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 pr-24 text-sm text-slate-200"
                        value={input.label}
                        onChange={(e) => updateInput(idx, { label: e.target.value })}
                        placeholder="变量名称"
                     />
                     <textarea
                        className="w-full min-h-[54px] resize-y bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-300 outline-none focus:border-emerald-500"
                        value={input.defaultValue || ''}
                        onChange={(e) => updateInput(idx, { defaultValue: e.target.value || undefined })}
                        placeholder={input.isConst ? '常量值' : '默认值（创建项目时自动填入）'}
                     />
                     <label className="flex items-center justify-between gap-3 text-[11px] text-slate-500 cursor-pointer">
                       <span>
                         <span className="font-bold text-slate-400">设为常量</span>
                         <span className="ml-1">项目中只读，始终使用这里的值</span>
                       </span>
                       <input
                         type="checkbox"
                         checked={Boolean(input.isConst)}
                         onChange={(e) => setInputConst(idx, e.target.checked)}
                         className="accent-emerald-500"
                       />
                     </label>
                     <label className="flex items-center justify-between gap-3 text-[11px] text-slate-500 cursor-pointer">
                       <span>
                         <span className="font-bold text-slate-400">不参与提取</span>
                         <span className="ml-1">{input.isConst ? '常量变量会自动排除' : '变量提取工具不会显示或写入此变量'}</span>
                       </span>
                       <input
                         type="checkbox"
                         checked={Boolean(input.isConst || input.extractionDisabled)}
                         disabled={Boolean(input.isConst)}
                         onChange={(e) => updateInput(idx, { extractionDisabled: e.target.checked || undefined })}
                         className="accent-cyan-500"
                       />
                     </label>
                     <div className={`border-t border-slate-800 pt-2 space-y-2 ${input.isConst || input.extractionDisabled ? 'opacity-40' : ''}`}>
                       <textarea
                         className="w-full min-h-[42px] resize-y bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-300 outline-none focus:border-emerald-500"
                         value={input.extractionDescription || ''}
                         disabled={Boolean(input.isConst || input.extractionDisabled)}
                         onChange={(e) => updateInput(idx, { extractionDescription: e.target.value || undefined })}
                         placeholder="智能提取说明：告诉 AI 这个变量应该提取什么、输出成什么格式"
                       />
                     </div>
                   </div>
                   <div className="absolute top-2 right-2 flex items-center bg-slate-950/70 rounded-md border border-slate-800 overflow-hidden">
                     <button
                       onClick={() => moveInput(idx, 'up')}
                       disabled={idx === 0}
                       className={`p-1 hover:bg-slate-800 transition-colors ${idx === 0 ? 'text-slate-800 cursor-not-allowed' : 'text-slate-500 hover:text-blue-400'}`}
                       title="上移变量"
                     >
                       <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                         <path fillRule="evenodd" d="M8 11.75a.75.75 0 0 1-.75-.75V4.56L4.53 7.28a.75.75 0 0 1-1.06-1.06l4-4a.75.75 0 0 1 1.06 0l4 4a.75.75 0 1 1-1.06 1.06L8.75 4.56V11a.75.75 0 0 1-.75.75Z" clipRule="evenodd" />
                       </svg>
                     </button>
                     <button
                       onClick={() => moveInput(idx, 'down')}
                       disabled={idx === editedTemplate.inputs.length - 1}
                       className={`p-1 hover:bg-slate-800 transition-colors ${idx === editedTemplate.inputs.length - 1 ? 'text-slate-800 cursor-not-allowed' : 'text-slate-500 hover:text-blue-400'}`}
                       title="下移变量"
                     >
                       <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                         <path fillRule="evenodd" d="M8 4.25a.75.75 0 0 1 .75.75v6.44l2.72-2.72a.75.75 0 1 1 1.06 1.06l-4 4a.75.75 0 0 1-1.06 0l-4-4a.75.75 0 0 1 1.06-1.06l2.72 2.72V5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
                       </svg>
                     </button>
                     <button onClick={() => removeInput(idx)} className="p-1 text-slate-600 hover:text-red-400 hover:bg-red-400/10">
                       ✕
                     </button>
                   </div>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-800 mt-6 pt-5">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-200">模型变量</h3>
                <Button size="sm" onClick={addModelRef}>+ 添加</Button>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                步骤绑定模型变量，而模型变量再绑定全局模型预设。多个步骤共用同一个模型变量时，只需要在这里改一次。
              </p>
              <div className="space-y-3">
                {(editedTemplate.modelRefs || []).length === 0 && (
                  <div className="rounded border border-dashed border-slate-800 p-3 text-xs text-slate-600">还没有模型变量。</div>
                )}
                {(editedTemplate.modelRefs || []).map((modelRef, idx) => {
                  const preset = modelPresets.find(item => item.id === modelRef.modelPresetId);
                  const availability = resolveModelPresetAvailability(modelRef.modelPresetId, modelPresets, providerConfigs);
                  return (
                    <div key={modelRef.id} className={`relative group bg-slate-900 p-3 rounded border space-y-2 ${availability.isAvailable ? 'border-slate-700' : 'border-amber-500/30'}`}>
                      <input
                        className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200"
                        value={modelRef.label}
                        onChange={(e) => updateModelRef(idx, { label: e.target.value })}
                        placeholder="模型变量名称"
                      />
                      <select
                        className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-blue-500"
                        value={modelRef.modelPresetId || ''}
                        onChange={(e) => updateModelRef(idx, { modelPresetId: e.target.value || undefined })}
                      >
                        <option value="">未绑定模型预设</option>
                        {modelPresets.map(item => (
                          <option key={item.id} value={item.id}>
                            {item.label}{resolveModelPresetAvailability(item.id, modelPresets, providerConfigs).isAvailable ? '' : '（不可用）'}
                          </option>
                        ))}
                      </select>
                      <div className={`text-[11px] ${availability.isAvailable ? 'text-emerald-500/80' : 'text-amber-400'}`} title={availability.message}>
                        {availability.isAvailable ? `可用：${preset?.label}` : `不可用：${availability.label}`}
                      </div>
                      <button onClick={() => removeModelRef(idx)} className="absolute top-1 right-1 text-slate-600 hover:text-red-400 p-1">✕</button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>

        <main className="lg:col-span-8 min-h-0 bg-slate-950/20 lg:overflow-y-auto">
          <div className="p-4 md:p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-slate-200">流程步骤</h3>
            </div>
            <div className="space-y-4">
              {editedTemplate.steps.map((step, idx) => {
                const isCollapsed = collapsedSteps[idx];
                const selectedModelRef = (editedTemplate.modelRefs || []).find(item => item.id === step.execution?.modelRefId);
                const selectedModelAvailability = resolveModelPresetAvailability(selectedModelRef?.modelPresetId, modelPresets, providerConfigs);
                const referenceIssues = validateStepReferences(step.content, step, editedTemplate);
                const referenceErrors = referenceIssues.filter(issue => issue.severity === 'error').length;
                const referenceWarnings = referenceIssues.length - referenceErrors;
                return (
                  <div key={step.id} className="bg-slate-900 border border-slate-700 rounded-lg h-auto overflow-visible">
                    <div 
                      className="flex justify-between items-center p-4 bg-slate-800/50 cursor-pointer select-none hover:bg-slate-800 transition-colors rounded-t-lg"
                      onClick={() => toggleStep(idx)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setStepContextMenu({ x: event.clientX, y: event.clientY, stepIndex: idx });
                      }}
                    >
                       <div className="flex items-center gap-3">
                          <span className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded text-xs font-bold">Step {idx + 1}</span>
                          <span className="font-bold text-slate-200 text-sm">{step.name || '未命名步骤'}</span>
                          {referenceErrors > 0 && <span className="text-[10px] font-bold text-red-400">{referenceErrors} 个引用失效</span>}
                          {referenceWarnings > 0 && <span className="text-[10px] font-bold text-amber-400">{referenceWarnings} 个引用待确认</span>}
                       </div>
                       <div className="flex items-center gap-3">
                           <div className="flex items-center bg-slate-950/40 rounded-md border border-slate-700/50 overflow-hidden">
                              <button 
                                onClick={(e) => { e.stopPropagation(); moveStep(idx, 'up'); }}
                                disabled={idx === 0}
                                className={`p-1.5 hover:bg-slate-700 transition-colors ${idx === 0 ? 'text-slate-800 cursor-not-allowed' : 'text-slate-500 hover:text-blue-400'}`}
                                title="上移"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                                  <path fillRule="evenodd" d="M8 11.75a.75.75 0 0 1-.75-.75V4.56L4.53 7.28a.75.75 0 0 1-1.06-1.06l4-4a.75.75 0 0 1 1.06 0l4 4a.75.75 0 1 1-1.06 1.06L8.75 4.56V11a.75.75 0 0 1-.75.75Z" clipRule="evenodd" />
                                </svg>
                              </button>
                              <div className="w-[1px] h-4 bg-slate-800"></div>
                              <button 
                                onClick={(e) => { e.stopPropagation(); moveStep(idx, 'down'); }}
                                disabled={idx === editedTemplate.steps.length - 1}
                                className={`p-1.5 hover:bg-slate-700 transition-colors ${idx === editedTemplate.steps.length - 1 ? 'text-slate-800 cursor-not-allowed' : 'text-slate-500 hover:text-blue-400'}`}
                                title="下移"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                                  <path fillRule="evenodd" d="M8 4.25a.75.75 0 0 1 .75.75v6.44l2.72-2.72a.75.75 0 1 1 1.06 1.06l-4 4a.75.75 0 0 1-1.06 0l-4-4a.75.75 0 0 1 1.06-1.06l2.72 2.72V5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
                                </svg>
                              </button>
                           </div>

                           <button 
                             onClick={(e) => { e.stopPropagation(); removeStep(idx); }} 
                             className="text-slate-500 hover:text-red-400 p-1.5 hover:bg-red-400/10 rounded-md transition-colors"
                             title="删除步骤"
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
                          {referenceIssues.length > 0 && (
                            <div className="rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2 space-y-1">
                              <div className="text-[10px] font-bold text-amber-400">引用检查</div>
                              {referenceIssues.map((issue, issueIndex) => (
                                <div key={`${issue.reference}_${issueIndex}`} className={`text-[11px] ${issue.severity === 'error' ? 'text-red-400' : 'text-amber-300/80'}`}>
                                  <span className="font-mono font-bold">{issue.reference}</span>：{issue.message}
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="bg-slate-950 border border-slate-700 rounded p-4 h-auto flex flex-col">
                            <AutoResizeTextarea
                               className="text-sm font-mono text-slate-300 leading-relaxed"
                               value={step.content}
                               onChange={(val) => updateStep(idx, { content: val })}
                               placeholder="编写提示词，例如：我想做一个 <0> 风格的游戏..."
                            />
                          </div>
                        </div>

                        <div className="mt-4 border-t border-slate-800 pt-4 space-y-3">
                          <div>
                            <label className="text-xs font-bold text-slate-400 uppercase">AI 文本生成</label>
                            <p className="text-[11px] text-slate-600 mt-1">选择模型变量后启用 AI；目标变量留空时，生成结果保存到当前步骤输出。</p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <label className="space-y-1">
                              <span className="text-[11px] font-bold text-slate-500">模型变量</span>
                              <select
                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                                value={step.execution?.modelRefId || ''}
                                onChange={(e) => {
                                  const modelRefId = e.target.value || undefined;
                                  updateStep(idx, {
                                    execution: {
                                      ...(step.execution || {}),
                                      enabled: Boolean(modelRefId),
                                      modelRefId,
                                      temperature: step.execution?.temperature ?? DEFAULT_AI_TEMPERATURE,
                                      maxTokens: step.execution?.maxTokens ?? DEFAULT_AI_MAX_TOKENS,
                                    }
                                  });
                                }}
                              >
                                <option value="">手动步骤</option>
                                {(editedTemplate.modelRefs || []).map(modelRef => {
                                  const availability = resolveModelPresetAvailability(modelRef.modelPresetId, modelPresets, providerConfigs);
                                  return <option key={modelRef.id} value={modelRef.id}>{modelRef.label}{availability.isAvailable ? '' : `（不可用：${availability.label}）`}</option>;
                                })}
                              </select>
                              {step.execution?.modelRefId && !selectedModelAvailability.isAvailable && (
                                <span className="block text-[10px] text-amber-400" title={selectedModelAvailability.message}>
                                  不可用：{selectedModelAvailability.label}
                                </span>
                              )}
                            </label>
                            <label className="space-y-1">
                              <span className="text-[11px] font-bold text-slate-500">生成结果写入</span>
                              <select
                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500 disabled:opacity-40"
                                value={step.execution?.outputTarget === 'templateInput' ? step.execution?.outputInputId || '' : ''}
                                disabled={!step.execution?.modelRefId}
                                onChange={(e) => updateStep(idx, {
                                  execution: {
                                    ...(step.execution || { enabled: true }),
                                    outputTarget: e.target.value ? 'templateInput' : 'stepOutput',
                                    outputInputId: e.target.value || undefined,
                                  }
                                })}
                              >
                                <option value="">当前步骤输出（默认）</option>
                                {editedTemplate.inputs.filter(input => !input.isConst).map((input) => {
                                  const inputIdx = editedTemplate.inputs.findIndex(item => item.id === input.id);
                                  return (
                                  <option key={input.id} value={input.id}>{`变量：<${inputIdx}> ${input.label}`}</option>
                                  );
                                })}
                              </select>
                            </label>
                          </div>

                          {step.execution?.modelRefId && (
                            <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <label className="space-y-1">
                                <span className="text-[11px] font-bold text-slate-500">创造性（温度）</span>
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  max="2"
                                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                                  value={step.execution?.temperature ?? DEFAULT_AI_TEMPERATURE}
                                  onChange={(e) => updateStep(idx, { execution: { ...(step.execution || { enabled: true }), temperature: e.target.value === '' ? DEFAULT_AI_TEMPERATURE : Number(e.target.value) } })}
                                />
                                <span className="block text-[10px] text-slate-600">越低越稳定，越高越有创造性；推荐 0.7。</span>
                              </label>
                              <label className="space-y-1">
                                <span className="text-[11px] font-bold text-slate-500">最大输出长度（Token）</span>
                                <input
                                  type="number"
                                  min="1"
                                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                                  value={step.execution?.maxTokens ?? DEFAULT_AI_MAX_TOKENS}
                                  onChange={(e) => updateStep(idx, { execution: { ...(step.execution || { enabled: true }), maxTokens: e.target.value === '' ? DEFAULT_AI_MAX_TOKENS : Number(e.target.value) } })}
                                />
                                <span className="block text-[10px] text-slate-600">限制回答最长长度，防止生成内容过长；推荐 2000。</span>
                              </label>
                            </div>
                            </>
                          )}

                          {step.execution?.modelRefId && (
                            <label className="space-y-1 block">
                              <span className="text-[11px] font-bold text-slate-500">系统提示词（可选）</span>
                              <textarea
                                className="w-full min-h-[64px] bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-300 outline-none focus:border-blue-500 resize-y"
                                value={step.execution?.systemPrompt || ''}
                                onChange={(e) => updateStep(idx, { execution: { ...(step.execution || { enabled: true }), systemPrompt: e.target.value } })}
                                placeholder="例如：你是一个专业的小游戏素材提示词策划。"
                              />
                            </label>
                          )}
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
        </main>
      </div>
      {stepContextMenu && (
        <StepContextMenu
          x={stepContextMenu.x}
          y={stepContextMenu.y}
          onCollapseOthers={() => collapseOtherSteps(stepContextMenu.stepIndex)}
          onExpandAll={expandAllSteps}
          onClose={() => setStepContextMenu(null)}
        />
      )}
    </div>
  );
};
