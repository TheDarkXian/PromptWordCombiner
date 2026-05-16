import React from 'react';
import { Button } from '../Button';
import { ExecutionPresetModelRefStrategy, ExecutionPresetTemplate, ModelCatalogItem } from '../../types';

interface ExecutionPresetLibraryPanelProps {
  executionPresetTemplates: ExecutionPresetTemplate[];
  modelCatalog: ModelCatalogItem[];
  modelRefStrategyOptions: Array<{ value: ExecutionPresetModelRefStrategy; label: string }>;
  onAddExecutionPresetTemplate: () => void;
  onUpdateExecutionPresetTemplate: (
    executionPresetTemplateId: string,
    updates: Partial<ExecutionPresetTemplate>
  ) => void;
  onDeleteExecutionPresetTemplate: (executionPresetTemplateId: string) => void;
}

export const ExecutionPresetLibraryPanel: React.FC<ExecutionPresetLibraryPanelProps> = ({
  executionPresetTemplates,
  modelCatalog,
  modelRefStrategyOptions,
  onAddExecutionPresetTemplate,
  onUpdateExecutionPresetTemplate,
  onDeleteExecutionPresetTemplate,
}) => (
  <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/50 p-5 xl:col-span-2">
    <div className="flex items-center justify-between">
      <div>
        <h4 className="text-sm font-bold text-slate-200">执行模板库</h4>
        <p className="mt-1 text-xs text-slate-500">集中保存可复用的执行参数与 system prompt。</p>
      </div>
      <Button size="sm" onClick={onAddExecutionPresetTemplate}>
        新增模板
      </Button>
    </div>

    <div className="space-y-4">
      {executionPresetTemplates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 px-4 py-5 text-xs text-slate-500">
          暂无执行模板。你可以先在这里创建模板，也可以稍后在模板步骤里直接保存当前执行配置。
        </div>
      ) : (
        executionPresetTemplates.map((executionPresetTemplate) => (
          <div
            key={executionPresetTemplate.id}
            className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <input
                value={executionPresetTemplate.label}
                onChange={(event) =>
                  onUpdateExecutionPresetTemplate(executionPresetTemplate.id, { label: event.target.value })
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                placeholder="执行模板名称"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDeleteExecutionPresetTemplate(executionPresetTemplate.id)}
              >
                删除
              </Button>
            </div>

            <textarea
              value={executionPresetTemplate.description || ''}
              onChange={(event) =>
                onUpdateExecutionPresetTemplate(executionPresetTemplate.id, { description: event.target.value })
              }
              className="min-h-[72px] w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
              placeholder="备注说明（可选）"
            />

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="space-y-2">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">模型策略</span>
                <select
                  value={executionPresetTemplate.modelRefStrategy}
                  onChange={(event) =>
                    onUpdateExecutionPresetTemplate(executionPresetTemplate.id, {
                      modelRefStrategy: event.target.value as ExecutionPresetModelRefStrategy,
                    })
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                >
                  {modelRefStrategyOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">启用状态</span>
                <button
                  onClick={() =>
                    onUpdateExecutionPresetTemplate(executionPresetTemplate.id, {
                      enabled: !executionPresetTemplate.enabled,
                    })
                  }
                  className={`w-full rounded-lg border px-3 py-2 text-sm font-bold transition-colors ${
                    executionPresetTemplate.enabled
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      : 'border-slate-700 bg-slate-950 text-slate-400'
                  }`}
                >
                  {executionPresetTemplate.enabled ? '已启用' : '已禁用'}
                </button>
              </label>
            </div>

            {executionPresetTemplate.modelRefStrategy === 'bind_specific_model_catalog_item' && (
              <label className="space-y-2">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  绑定模型目录项
                </span>
                <select
                  value={executionPresetTemplate.modelCatalogItemId || ''}
                  onChange={(event) =>
                    onUpdateExecutionPresetTemplate(executionPresetTemplate.id, {
                      modelCatalogItemId: event.target.value || undefined,
                    })
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                >
                  <option value="">选择模型目录项</option>
                  {modelCatalog.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                      {!item.enabled ? ' [已禁用]' : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="space-y-2">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">Temperature</span>
                <input
                  type="number"
                  min="0"
                  max="2"
                  step="0.1"
                  value={executionPresetTemplate.temperature ?? ''}
                  onChange={(event) =>
                    onUpdateExecutionPresetTemplate(executionPresetTemplate.id, {
                      temperature: event.target.value === '' ? undefined : Number(event.target.value),
                    })
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                  placeholder="留空则使用默认值"
                />
              </label>

              <label className="space-y-2">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">Max Tokens</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={executionPresetTemplate.maxTokens ?? ''}
                  onChange={(event) =>
                    onUpdateExecutionPresetTemplate(executionPresetTemplate.id, {
                      maxTokens: event.target.value === '' ? undefined : Number(event.target.value),
                    })
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                  placeholder="留空则使用默认值"
                />
              </label>
            </div>

            <label className="space-y-2">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">System Prompt</span>
              <textarea
                value={executionPresetTemplate.systemPrompt || ''}
                onChange={(event) =>
                  onUpdateExecutionPresetTemplate(executionPresetTemplate.id, { systemPrompt: event.target.value })
                }
                className="min-h-[120px] w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                placeholder="留空表示不覆盖当前步骤的 system prompt"
              />
            </label>
          </div>
        ))
      )}
    </div>
  </section>
);
