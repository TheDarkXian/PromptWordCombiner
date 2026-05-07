import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Template } from '../types';
import { Button } from './Button';
import {
  parseBatchProjectSeeds,
  parseVariableTableRows,
  PROJECT_NAME_COLUMN,
} from '../services/variableTableService';

interface BatchCreateProjectsModalProps {
  isOpen: boolean;
  template: Template | null;
  onConfirm: (content: string) => void;
  onCancel: () => void;
}

export const BatchCreateProjectsModal: React.FC<BatchCreateProjectsModalProps> = ({
  isOpen,
  template,
  onConfirm,
  onCancel,
}) => {
  const [content, setContent] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setContent('');
    }
  }, [isOpen, template?.id]);

  const csvExample = useMemo(() => {
    if (!template) return '';
    const headers = [PROJECT_NAME_COLUMN, ...template.inputs.map((input) => input.label)];
    const values = ['项目 1', ...template.inputs.map((_, index) => `值${index + 1}`)];
    return `${headers.join(',')}\n${values.join(',')}`;
  }, [template]);

  const preview = useMemo(() => {
    if (!template || !content.trim()) return null;

    try {
      const parsed = parseVariableTableRows(content);
      const seeds = parseBatchProjectSeeds(content, template);
      const allowedColumns = new Set([PROJECT_NAME_COLUMN, ...template.inputs.map((input) => input.label)]);
      const columns = Array.from(new Set(parsed.rows.flatMap((row) => Object.keys(row))));

      return {
        format: parsed.format,
        rowCount: parsed.rows.length,
        columns,
        ignoredColumns: columns.filter((column) => !allowedColumns.has(column)),
        seeds: seeds.slice(0, 5),
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : '预览解析失败。',
      };
    }
  }, [content, template]);

  if (!isOpen || !template) return null;

  const handleLoadFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const nextContent = await file.text();
    setContent(nextContent);
    event.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="mx-4 flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="border-b border-slate-800 px-6 py-5">
          <h3 className="text-lg font-bold text-white">批量创建项目</h3>
          <p className="mt-2 text-sm text-slate-400">
            当前模板：<span className="font-semibold text-emerald-300">{template.name}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            支持粘贴 JSON 数组或 CSV。保留列名 <code className="rounded bg-slate-950 px-1.5 py-0.5 text-slate-300">{PROJECT_NAME_COLUMN}</code> 可自定义项目名。
          </p>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-6 overflow-y-auto p-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">数据内容</div>
                <div className="mt-1 text-[11px] text-slate-500">一行代表一个项目实例。</div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.csv,text/csv,application/json"
                  onChange={handleLoadFile}
                  className="hidden"
                />
                <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()}>
                  读取文件
                </Button>
              </div>
            </div>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className="min-h-[360px] w-full rounded-xl border border-slate-700 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-200 outline-none focus:border-blue-500"
              placeholder={`[{"${PROJECT_NAME_COLUMN}":"项目 1"}]`}
              spellCheck={false}
            />
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">可用列</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-[11px] text-blue-300">
                  {PROJECT_NAME_COLUMN}
                </span>
                {template.inputs.map((input) => (
                  <span
                    key={input.id}
                    className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-300"
                  >
                    {input.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">CSV 示例</div>
              <pre className="mt-3 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-3 text-[11px] text-slate-300">
                {csvExample}
              </pre>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">预览</div>
              {!content.trim() ? (
                <div className="mt-3 rounded-lg border border-dashed border-slate-800 px-3 py-4 text-[11px] text-slate-500">
                  粘贴或读取数据后，这里会显示将要创建的项目预览。
                </div>
              ) : preview && 'error' in preview ? (
                <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-4 text-[11px] text-red-300">
                  {preview.error}
                </div>
              ) : preview ? (
                <div className="mt-3 space-y-3">
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-blue-300">
                      格式: {preview.format.toUpperCase()}
                    </span>
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-emerald-300">
                      行数: {preview.rowCount}
                    </span>
                    <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-slate-300">
                      列数: {preview.columns.length}
                    </span>
                  </div>
                  {preview.ignoredColumns.length > 0 && (
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-3 text-[11px] text-amber-300">
                      未使用列：{preview.ignoredColumns.join(', ')}
                    </div>
                  )}
                  <div className="overflow-hidden rounded-lg border border-slate-800">
                    <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] border-b border-slate-800 bg-slate-900 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <div>项目名</div>
                      <div>已识别变量</div>
                    </div>
                    <div className="divide-y divide-slate-800">
                      {preview.seeds.map((seed, index) => {
                        const filledInputLabels = template.inputs
                          .filter((input) => (seed.inputValues[input.id] || '').trim())
                          .map((input) => input.label);

                        return (
                          <div
                            key={`${seed.projectName}_${index}`}
                            className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-3 px-3 py-2 text-[11px]"
                          >
                            <div className="truncate text-slate-200">{seed.projectName}</div>
                            <div className="truncate text-slate-400">
                              {filledInputLabels.length > 0 ? filledInputLabels.join(', ') : '无'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {preview.rowCount > preview.seeds.length && (
                    <div className="text-[11px] text-slate-500">
                      仅预览前 {preview.seeds.length} 行，实际会创建 {preview.rowCount} 个项目。
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-800 px-6 py-4">
          <Button variant="secondary" onClick={onCancel}>
            取消
          </Button>
          <Button onClick={() => onConfirm(content)} disabled={!content.trim()}>
            批量创建
          </Button>
        </div>
      </div>
    </div>
  );
};
