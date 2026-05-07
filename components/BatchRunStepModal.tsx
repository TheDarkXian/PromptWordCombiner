import React, { useEffect, useMemo, useState } from 'react';
import { Project, Template } from '../types';
import { Button } from './Button';

interface BatchRunStepModalProps {
  isOpen: boolean;
  templates: Template[];
  projects: Project[];
  onConfirm: (templateId: string, stepId: string) => void;
  onCancel: () => void;
}

export const BatchRunStepModal: React.FC<BatchRunStepModalProps> = ({
  isOpen,
  templates,
  projects,
  onConfirm,
  onCancel,
}) => {
  const [templateId, setTemplateId] = useState('');
  const [stepId, setStepId] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setTemplateId('');
    setStepId('');
  }, [isOpen]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === templateId) || null,
    [templateId, templates]
  );

  const matchedProjects = useMemo(
    () => projects.filter((project) => project.templateId === templateId && !project.archived),
    [projects, templateId]
  );

  useEffect(() => {
    if (!selectedTemplate) {
      setStepId('');
      return;
    }

    if (!selectedTemplate.steps.some((step) => step.id === stepId)) {
      setStepId(selectedTemplate.steps[0]?.id || '');
    }
  }, [selectedTemplate, stepId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="mx-4 flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="border-b border-slate-800 px-6 py-5">
          <h3 className="text-lg font-bold text-white">批量执行步骤</h3>
          <p className="mt-2 text-sm text-slate-400">
            选择一个模板和其中一步，系统会顺序执行该模板下的全部未归档项目。
          </p>
        </div>

        <div className="space-y-5 p-6">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">模板</label>
            <select
              value={templateId}
              onChange={(event) => setTemplateId(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-200 outline-none focus:border-blue-500"
            >
              <option value="">选择模板</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">步骤</label>
            <select
              value={stepId}
              onChange={(event) => setStepId(event.target.value)}
              disabled={!selectedTemplate}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-200 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {!selectedTemplate ? (
                <option value="">先选择模板</option>
              ) : (
                selectedTemplate.steps.map((step, index) => (
                  <option key={step.id} value={step.id}>
                    {index + 1}. {step.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">执行范围</div>
            <div className="mt-3 space-y-2 text-sm text-slate-300">
              <div>
                模板：
                <span className="ml-2 font-semibold text-emerald-300">
                  {selectedTemplate?.name || '未选择'}
                </span>
              </div>
              <div>
                项目数：
                <span className="ml-2 font-semibold text-blue-300">{matchedProjects.length}</span>
              </div>
              {matchedProjects.length > 0 && (
                <div className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-3 text-[11px] text-slate-400">
                  {matchedProjects.slice(0, 5).map((project) => project.name).join(' / ')}
                  {matchedProjects.length > 5 ? ` ... 另有 ${matchedProjects.length - 5} 个项目` : ''}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-800 px-6 py-4">
          <Button variant="secondary" onClick={onCancel}>
            取消
          </Button>
          <Button
            onClick={() => onConfirm(templateId, stepId)}
            disabled={!templateId || !stepId || matchedProjects.length === 0}
          >
            开始批量执行
          </Button>
        </div>
      </div>
    </div>
  );
};
