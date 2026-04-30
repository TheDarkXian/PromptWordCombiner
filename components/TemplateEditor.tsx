import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ModelCatalogItem,
  StepExecutionConfig,
  StepOutputBinding,
  Template,
  TemplateInput,
  TemplateModelRef,
  TemplateStep,
} from '../types';
import { Button } from './Button';

interface TemplateEditorProps {
  template: Template;
  modelCatalog: ModelCatalogItem[];
  onSave: (template: Template) => void;
  onCancel: () => void;
  onRequestConfirm: (title: string, message: string, onConfirm: () => void) => void;
}

const AutoResizeTextarea: React.FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}> = ({ value, onChange, placeholder, className }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = () => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = '0px';
    element.style.height = `${element.scrollHeight}px`;
  };

  useLayoutEffect(() => {
    adjustHeight();
  }, [value]);

  useEffect(() => {
    const frame = requestAnimationFrame(adjustHeight);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    window.addEventListener('resize', adjustHeight);
    return () => window.removeEventListener('resize', adjustHeight);
  }, []);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className={`block w-full resize-none overflow-hidden bg-transparent p-0 outline-none focus:ring-0 ${className || ''}`}
      rows={1}
      spellCheck={false}
    />
  );
};

const normalizeBinding = (binding?: StepOutputBinding): StepOutputBinding => binding || {};
const normalizeExecution = (execution?: StepExecutionConfig): StepExecutionConfig => execution || { systemPrompt: '' };

const cloneTemplate = (template: Template): Template => JSON.parse(JSON.stringify(template));

const createModelRefLabel = (existingRefs: TemplateModelRef[]) => `模型引用 ${existingRefs.length + 1}`;

export const TemplateEditor: React.FC<TemplateEditorProps> = ({
  template,
  modelCatalog,
  onSave,
  onCancel,
  onRequestConfirm,
}) => {
  const [editedTemplate, setEditedTemplate] = useState<Template>(cloneTemplate(template));
  const [collapsedSteps, setCollapsedSteps] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setEditedTemplate(cloneTemplate(template));
  }, [template]);

  const modelRefs = editedTemplate.modelRefs || [];

  const knownVariableKeys = useMemo(
    () =>
      Array.from(
        new Set([
          ...editedTemplate.inputs.map((input) => input.label.trim()).filter(Boolean),
          ...editedTemplate.steps
            .map((step) => step.outputBinding?.variableKey?.trim() || '')
            .filter(Boolean),
        ])
      ),
    [editedTemplate.inputs, editedTemplate.steps]
  );

  const getCatalogItem = (itemId?: string) => modelCatalog.find((item) => item.id === itemId);

  const addInput = () => {
    const newInput: TemplateInput = {
      id: `input_${Date.now()}`,
      label: 'new_input',
    };
    setEditedTemplate((prev) => ({ ...prev, inputs: [...prev.inputs, newInput] }));
  };

  const updateInput = (index: number, updates: Partial<TemplateInput>) => {
    setEditedTemplate((prev) => {
      const inputs = [...prev.inputs];
      inputs[index] = { ...inputs[index], ...updates };
      return { ...prev, inputs };
    });
  };

  const removeInput = (index: number) => {
    onRequestConfirm('删除输入变量', '确认删除这个输入变量吗？依赖它的步骤占位符需要你手动调整。', () => {
      setEditedTemplate((prev) => ({
        ...prev,
        inputs: prev.inputs.filter((_, currentIndex) => currentIndex !== index),
      }));
    });
  };

  const addModelRef = () => {
    const newRef: TemplateModelRef = {
      id: `model_ref_${Date.now()}`,
      label: createModelRefLabel(modelRefs),
      modelCatalogItemId: modelCatalog[0]?.id,
    };
    setEditedTemplate((prev) => ({
      ...prev,
      modelRefs: [...(prev.modelRefs || []), newRef],
    }));
  };

  const updateModelRef = (index: number, updates: Partial<TemplateModelRef>) => {
    setEditedTemplate((prev) => {
      const nextRefs = [...(prev.modelRefs || [])];
      nextRefs[index] = { ...nextRefs[index], ...updates };
      return { ...prev, modelRefs: nextRefs };
    });
  };

  const removeModelRef = (index: number) => {
    const currentRef = modelRefs[index];
    onRequestConfirm('删除模型引用', '确认删除这个模型引用吗？引用它的步骤会退回为手动步骤。', () => {
      setEditedTemplate((prev) => {
        const nextRefs = (prev.modelRefs || []).filter((_, currentIndex) => currentIndex !== index);
        const nextSteps = prev.steps.map((step) => {
          if (step.execution?.modelRefId !== currentRef.id) return step;
          return {
            ...step,
            execution: {
              ...normalizeExecution(step.execution),
              modelRefId: undefined,
            },
          };
        });

        return {
          ...prev,
          modelRefs: nextRefs,
          steps: nextSteps,
        };
      });
    });
  };

  const addStep = () => {
    const newStep: TemplateStep = {
      id: `step_${Date.now()}`,
      name: 'New Step',
      content: 'Write your prompt template here...',
      outputBinding: {},
      execution: normalizeExecution(),
    };
    setEditedTemplate((prev) => ({ ...prev, steps: [...prev.steps, newStep] }));
  };

  const updateStep = (index: number, updates: Partial<TemplateStep>) => {
    setEditedTemplate((prev) => {
      const steps = [...prev.steps];
      steps[index] = { ...steps[index], ...updates };
      return { ...prev, steps };
    });
  };

  const updateStepBinding = (index: number, updates: Partial<StepOutputBinding>) => {
    setEditedTemplate((prev) => {
      const steps = [...prev.steps];
      const nextBinding: StepOutputBinding = { ...normalizeBinding(steps[index].outputBinding), ...updates };

      if (!nextBinding.variableKey?.trim()) {
        nextBinding.variableKey = '';
        nextBinding.variableLabel = '';
      }

      steps[index] = { ...steps[index], outputBinding: nextBinding };
      return { ...prev, steps };
    });
  };

  const updateStepExecution = (index: number, updates: Partial<StepExecutionConfig>) => {
    setEditedTemplate((prev) => {
      const steps = [...prev.steps];
      steps[index] = {
        ...steps[index],
        execution: { ...normalizeExecution(steps[index].execution), ...updates },
      };
      return { ...prev, steps };
    });
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    setEditedTemplate((prev) => {
      const steps = [...prev.steps];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= steps.length) return prev;

      [steps[index], steps[targetIndex]] = [steps[targetIndex], steps[index]];

      const nextCollapsed = { ...collapsedSteps };
      const temp = nextCollapsed[index];
      nextCollapsed[index] = nextCollapsed[targetIndex];
      nextCollapsed[targetIndex] = temp;
      setCollapsedSteps(nextCollapsed);

      return { ...prev, steps };
    });
  };

  const removeStep = (index: number) => {
    onRequestConfirm('删除步骤', '确认删除这个步骤吗？', () => {
      setEditedTemplate((prev) => ({
        ...prev,
        steps: prev.steps.filter((_, currentIndex) => currentIndex !== index),
      }));
    });
  };

  const toggleStep = (index: number) => {
    setCollapsedSteps((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <div className="h-full w-full overflow-y-auto rounded-lg bg-slate-900 p-4 md:p-6">
      <div className="sticky top-0 z-10 mb-6 flex items-center justify-between border-b border-slate-800 bg-slate-900 py-2">
        <h2 className="text-xl font-bold text-white">编辑模板</h2>
        <div className="space-x-2">
          <Button variant="secondary" onClick={onCancel}>
            取消
          </Button>
          <Button onClick={() => onSave(editedTemplate)}>保存模板</Button>
        </div>
      </div>

      <div className="mb-8 space-y-4">
        <label className="block text-sm font-bold text-slate-300">模板名称</label>
        <input
          className="w-full rounded p-2 text-white border border-slate-700 bg-slate-950"
          value={editedTemplate.name}
          onChange={(event) => setEditedTemplate({ ...editedTemplate, name: event.target.value })}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-4">
          <div className="sticky top-24 space-y-6 rounded-lg border border-slate-800 bg-slate-950/50 p-4">
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-200">1. 输入变量</h3>
                <Button size="sm" onClick={addInput}>
                  + 添加
                </Button>
              </div>
              <p className="mb-4 text-xs text-slate-500">
                模板里可以继续用 <code>{'<序号>'}</code>、<code>{'<变量名>'}</code> 或 <code>{'{{variable_key}}'}</code> 引用上下文。
              </p>
              <div className="space-y-3">
                {editedTemplate.inputs.map((input, index) => (
                  <div key={input.id} className="relative rounded border border-slate-700 bg-slate-900 p-3">
                    <div className="absolute -left-2 -top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-slate-900 bg-emerald-600 text-xs font-bold text-white shadow-sm">
                      {index}
                    </div>
                    <div className="mt-1 space-y-2">
                      <input
                        className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200"
                        value={input.label}
                        onChange={(event) => updateInput(index, { label: event.target.value })}
                        placeholder="变量名称"
                      />
                    </div>
                    <button onClick={() => removeInput(index)} className="absolute right-1 top-1 p-1 text-slate-600 hover:text-red-400">
                      删
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="border-t border-slate-800 pt-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-200">2. 模型引用</h3>
                <Button size="sm" onClick={addModelRef}>
                  + 添加
                </Button>
              </div>
              <p className="mb-4 text-xs text-slate-500">
                这里定义模板可用的模型引用。步骤里只选择引用，不直接配置 provider 或 API。
              </p>
              <div className="space-y-3">
                {modelRefs.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-800 px-3 py-3 text-xs text-slate-500">
                    还没有模型引用。不选择模型引用的步骤，默认就是手动步骤。
                  </div>
                ) : (
                  modelRefs.map((modelRef, index) => {
                    const catalogItem = getCatalogItem(modelRef.modelCatalogItemId);
                    const isDisabled = catalogItem && !catalogItem.enabled;

                    return (
                      <div key={modelRef.id} className="relative space-y-2 rounded border border-slate-700 bg-slate-900 p-3">
                        <input
                          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200"
                          value={modelRef.label}
                          onChange={(event) => updateModelRef(index, { label: event.target.value })}
                          placeholder="模型引用名称"
                        />
                        <select
                          value={modelRef.modelCatalogItemId || ''}
                          onChange={(event) => updateModelRef(index, { modelCatalogItemId: event.target.value || undefined })}
                          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                        >
                          <option value="">不绑定具体模型</option>
                          {modelCatalog.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.label}
                              {!item.enabled ? ' [已禁用]' : ''}
                            </option>
                          ))}
                        </select>
                        {modelRef.modelCatalogItemId && !catalogItem && (
                          <div className="text-xs text-amber-400">当前绑定的模型目录项不存在，保存后会保留为空引用。</div>
                        )}
                        {isDisabled && <div className="text-xs text-amber-400">当前绑定的模型目录项已禁用。</div>}
                        <button onClick={() => removeModelRef(index)} className="absolute right-1 top-1 p-1 text-slate-600 hover:text-red-400">
                          删
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        </div>

        <div className="lg:col-span-8">
          <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-200">3. 流程步骤</h3>
            </div>
            <div className="space-y-4">
              {editedTemplate.steps.map((step, index) => {
                const isCollapsed = collapsedSteps[index];
                const binding = normalizeBinding(step.outputBinding);
                const execution = normalizeExecution(step.execution);
                const bindingKey = binding.variableKey?.trim() || '';
                const isKnownVariable = !bindingKey || knownVariableKeys.includes(bindingKey);
                const currentRef = modelRefs.find((item) => item.id === execution.modelRefId);
                const currentCatalogItem = currentRef ? getCatalogItem(currentRef.modelCatalogItemId) : undefined;

                return (
                  <div key={step.id} className="h-auto overflow-visible rounded-lg border border-slate-700 bg-slate-900">
                    <div
                      className="flex cursor-pointer select-none items-center justify-between rounded-t-lg bg-slate-800/50 p-4 transition-colors hover:bg-slate-800"
                      onClick={() => toggleStep(index)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="rounded bg-slate-700 px-2 py-0.5 text-xs font-bold text-slate-300">Step {index + 1}</span>
                        <span className="text-sm font-bold text-slate-200">{step.name || '未命名步骤'}</span>
                        {execution.modelRefId && (
                          <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-300">
                            {currentRef?.label || '模型引用'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center overflow-hidden rounded-md border border-slate-700/50 bg-slate-950/40">
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              moveStep(index, 'up');
                            }}
                            disabled={index === 0}
                            className={`p-1.5 transition-colors ${
                              index === 0 ? 'cursor-not-allowed text-slate-800' : 'text-slate-500 hover:bg-slate-700 hover:text-blue-400'
                            }`}
                            title="上移"
                          >
                            ↑
                          </button>
                          <div className="h-4 w-px bg-slate-800" />
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              moveStep(index, 'down');
                            }}
                            disabled={index === editedTemplate.steps.length - 1}
                            className={`p-1.5 transition-colors ${
                              index === editedTemplate.steps.length - 1
                                ? 'cursor-not-allowed text-slate-800'
                                : 'text-slate-500 hover:bg-slate-700 hover:text-blue-400'
                            }`}
                            title="下移"
                          >
                            ↓
                          </button>
                        </div>

                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            removeStep(index);
                          }}
                          className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-red-400/10 hover:text-red-400"
                          title="删除步骤"
                        >
                          删
                        </button>

                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 16 16"
                          fill="currentColor"
                          className={`h-4 w-4 text-slate-500 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
                        >
                          <path
                            fillRule="evenodd"
                            d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </div>

                    {!isCollapsed && (
                      <div className="h-auto overflow-visible border-t border-slate-800 p-4">
                        <div className="mb-4 flex items-start gap-4">
                          <div className="flex-1 space-y-2">
                            <label className="text-xs font-bold uppercase text-slate-500">步骤名称</label>
                            <input
                              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                              value={step.name}
                              onChange={(event) => updateStep(index, { name: event.target.value })}
                              placeholder="步骤名称"
                            />
                          </div>
                          <div className="flex-1 space-y-2">
                            <label className="text-xs font-bold uppercase text-slate-500">描述</label>
                            <input
                              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                              value={step.description || ''}
                              onChange={(event) => updateStep(index, { description: event.target.value })}
                              placeholder="可选描述"
                            />
                          </div>
                        </div>

                        <div className="mb-4 space-y-2">
                          <label className="text-xs font-bold uppercase text-slate-400">提示词模板内容</label>
                          <div className="flex h-auto flex-col rounded border border-slate-700 bg-slate-950 p-4">
                            <AutoResizeTextarea
                              className="font-mono text-sm leading-relaxed text-slate-300"
                              value={step.content}
                              onChange={(value) => updateStep(index, { content: value })}
                              placeholder="编写提示词，例如：根据 {{topic}} 生成内容..."
                            />
                          </div>
                        </div>

                        <div className="mb-4 space-y-3 border-t border-slate-800 pt-4">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold uppercase text-cyan-400">模型引用</label>
                            {execution.modelRefId && (
                              <span className="font-mono text-[11px] text-cyan-300">{currentRef?.label || '模型引用'}</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500">
                            这里只选模板里定义好的模型引用。不选就表示这个步骤继续按手动步骤处理。
                          </p>
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                              <label className="text-[11px] font-bold uppercase text-slate-500">模型引用</label>
                              <select
                                value={execution.modelRefId || ''}
                                onChange={(event) => updateStepExecution(index, { modelRefId: event.target.value || undefined })}
                                className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                              >
                                <option value="">不使用模型引用</option>
                                {modelRefs.map((modelRef) => {
                                  const item = getCatalogItem(modelRef.modelCatalogItemId);
                                  return (
                                    <option key={modelRef.id} value={modelRef.id}>
                                      {modelRef.label}
                                      {item && !item.enabled ? ' [已禁用]' : ''}
                                      {!item && modelRef.modelCatalogItemId ? ' [缺失]' : ''}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-[11px] font-bold uppercase text-slate-500">当前模型</label>
                              <div className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-400">
                                {!execution.modelRefId
                                  ? '手动步骤'
                                  : currentCatalogItem
                                    ? `${currentCatalogItem.label}${currentCatalogItem.enabled ? '' : ' [已禁用]'}`
                                    : '未找到模型目录项'}
                              </div>
                            </div>
                          </div>
                          {execution.modelRefId && currentRef?.modelCatalogItemId && !currentCatalogItem && (
                            <div className="text-xs text-amber-400">当前步骤引用的模型目录项不存在。</div>
                          )}
                          {currentCatalogItem && !currentCatalogItem.enabled && (
                            <div className="text-xs text-amber-400">当前步骤引用的模型目录项已禁用，但模板仍可保存。</div>
                          )}
                          <div className="space-y-2">
                            <label className="text-[11px] font-bold uppercase text-slate-500">System Prompt</label>
                            <div className="rounded border border-slate-700 bg-slate-950 p-4">
                              <AutoResizeTextarea
                                className="text-sm leading-relaxed text-slate-300"
                                value={execution.systemPrompt}
                                onChange={(value) => updateStepExecution(index, { systemPrompt: value })}
                                placeholder="例如：把中文需求整理成适合该模型执行的提示词。"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3 border-t border-slate-800 pt-4">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold uppercase text-violet-400">输出到变量</label>
                            {bindingKey && <span className="font-mono text-[11px] text-violet-300">{`{{${bindingKey}}}`}</span>}
                          </div>
                          <p className="text-xs text-slate-500">
                            变量 key 为空就表示不绑定。配置后，这个步骤的结果可以写入对应变量。
                          </p>
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                              <label className="text-[11px] font-bold uppercase text-slate-500">变量 Key</label>
                              <input
                                value={binding.variableKey || ''}
                                onChange={(event) => updateStepBinding(index, { variableKey: event.target.value })}
                                className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                                placeholder="scene_description"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[11px] font-bold uppercase text-slate-500">显示名</label>
                              <input
                                value={binding.variableLabel || ''}
                                onChange={(event) => updateStepBinding(index, { variableLabel: event.target.value })}
                                className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                                placeholder="场景描述"
                              />
                            </div>
                          </div>
                          {bindingKey && (
                            <div className={`text-xs ${isKnownVariable ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {isKnownVariable ? '当前 key 已存在于模板上下文中。' : '当前 key 还不存在，将创建新的输出变量。'}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              <button
                onClick={addStep}
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-800 bg-slate-900/50 py-4 text-sm font-bold text-slate-500 transition-all hover:border-blue-500/50 hover:bg-slate-900 hover:text-blue-400"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                  <path
                    fillRule="evenodd"
                    d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2Z"
                    clipRule="evenodd"
                  />
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
