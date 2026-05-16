import React, { useMemo, useState } from 'react';
import {
  ImportWarningItem,
  ModelCatalogItem,
  PreparedImportBundle,
  Project,
  Template,
} from '../types';
import { Button } from './Button';
import { ioService } from '../services/ioService';
import {
  buildImportReportText,
  prepareImportedBackupBundle,
} from '../services/importCompatibilityService';
import { DataPreviewOverlay } from './DataPreviewOverlay';

interface MergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProjects: Project[];
  currentTemplates: Template[];
  modelCatalog: ModelCatalogItem[];
  onConfirmMerge: (projects: Project[], templates: Template[]) => void;
  onRequestAlert: (title: string, message: string) => void;
}

interface MergeItem<T> {
  id: string;
  originalData: T;
  type: 'project' | 'template';
  status: 'new' | 'conflict' | 'identical';
  action: 'import' | 'overwrite';
  newName: string;
  isOrphan?: boolean;
}

const warningToneClass: Record<ImportWarningItem['level'], string> = {
  info: 'border-blue-500/20 bg-blue-500/5 text-blue-200',
  warning: 'border-amber-500/20 bg-amber-500/5 text-amber-100',
  error: 'border-red-500/20 bg-red-500/5 text-red-100',
};

const buildInventory = (
  prepared: PreparedImportBundle,
  currentProjects: Project[],
  currentTemplates: Template[]
): MergeItem<any>[] => {
  const templateIdSet = new Set(prepared.templates.map((template) => template.id));

  const templates: MergeItem<Template>[] = prepared.templates.map((template) => {
    const existing = currentTemplates.find((item) => item.name === template.name);
    const isIdentical = existing
      ? JSON.stringify({ ...template, id: '' }) === JSON.stringify({ ...existing, id: '' })
      : false;
    return {
      id: template.id,
      originalData: template,
      type: 'template',
      status: existing ? (isIdentical ? 'identical' : 'conflict') : 'new',
      action: 'import',
      newName: `${template.name}${existing ? '_copy' : ''}`,
    };
  });

  const projects: MergeItem<Project>[] = prepared.projects.map((project) => {
    const existing = currentProjects.find((item) => item.name === project.name);
    const isIdentical = existing
      ? JSON.stringify({ ...project, id: '', lastModifiedAt: 0 }) ===
        JSON.stringify({ ...existing, id: '', lastModifiedAt: 0 })
      : false;
    return {
      id: project.id,
      originalData: project,
      type: 'project',
      status: existing ? (isIdentical ? 'identical' : 'conflict') : 'new',
      action: 'import',
      newName: `${project.name}${existing ? '_copy' : ''}`,
      isOrphan: !templateIdSet.has(project.templateId),
    };
  });

  return [...templates, ...projects];
};

export const MergeModal: React.FC<MergeModalProps> = ({
  isOpen,
  onClose,
  currentProjects,
  currentTemplates,
  modelCatalog,
  onConfirmMerge,
  onRequestAlert,
}) => {
  const [preparedImport, setPreparedImport] = useState<PreparedImportBundle | null>(null);
  const [inventory, setInventory] = useState<MergeItem<any>[]>([]);
  const [queue, setQueue] = useState<MergeItem<any>[]>([]);
  const [previewItem, setPreviewItem] = useState<any | null>(null);
  const [forceRiskImport, setForceRiskImport] = useState(false);

  const suspiciousWarnings = useMemo(
    () =>
      preparedImport?.report.warnings.filter(
        (warning) => warning.code === 'suspicious_garbled_text'
      ) || [],
    [preparedImport]
  );

  const queuedOrphanCount = useMemo(
    () => queue.filter((item) => item.type === 'project' && item.isOrphan).length,
    [queue]
  );

  const requiresForceImport = suspiciousWarnings.length > 0 || queuedOrphanCount > 0;
  if (!isOpen) return null;

  const resetImportedState = () => {
    setPreparedImport(null);
    setInventory([]);
    setQueue([]);
    setPreviewItem(null);
    setForceRiskImport(false);
  };

  const handleSelectFile = async () => {
    try {
      const selected = await ioService.selectAndReadImportFile();
      if (!selected) return;

      const payload = selected.bytes || selected.text;
      if (!payload) {
        onRequestAlert('导入失败', '无法读取所选文件。');
        return;
      }

      const prepared = prepareImportedBackupBundle(payload, modelCatalog);
      const analyzedInventory = buildInventory(prepared, currentProjects, currentTemplates);
      const safeQueue = analyzedInventory.filter(
        (item) => !(item.type === 'project' && item.isOrphan)
      );

      setPreparedImport(prepared);
      setInventory(analyzedInventory);
      setQueue(safeQueue);
      setForceRiskImport(false);
    } catch (error) {
      onRequestAlert(
        '导入失败',
        error instanceof Error ? error.message : '所选文件无法处理。'
      );
    }
  };

  const addToQueue = (id: string) => {
    if (queue.some((item) => item.id === id)) return;
    const item = inventory.find((inventoryItem) => inventoryItem.id === id);
    if (!item) return;

    const nextItems = [item];
    if (item.type === 'project') {
      const templateId = (item.originalData as Project).templateId;
      const templateItem = inventory.find(
        (inventoryItem) => inventoryItem.type === 'template' && inventoryItem.id === templateId
      );
      if (templateItem && !queue.some((queuedItem) => queuedItem.id === templateId)) {
        nextItems.unshift(templateItem);
      }
    }
    setQueue([...queue, ...nextItems]);
  };

  const removeFromQueue = (id: string) => {
    const item = queue.find((queuedItem) => queuedItem.id === id);
    if (!item) return;
    if (item.type === 'template') {
      setQueue(
        queue.filter((queuedItem) => {
          if (queuedItem.id === id) return false;
          if (
            queuedItem.type === 'project' &&
            (queuedItem.originalData as Project).templateId === id
          ) {
            return false;
          }
          return true;
        })
      );
      return;
    }
    setQueue(queue.filter((queuedItem) => queuedItem.id !== id));
  };

  const handleConfirm = () => {
    if (requiresForceImport && !forceRiskImport) {
      onRequestAlert(
        '需要确认风险',
        '当前导入包含风险项，请先点击“强制导入风险项”，再执行确认合并。'
      );
      return;
    }

    const templateIdMapping: Record<string, string> = {};
    const finalTemplates = queue
      .filter((item) => item.type === 'template')
      .map((item) => {
        const oldId = item.id;
        let targetId = oldId;
        if (item.action === 'overwrite') {
          const existing = currentTemplates.find((template) => template.name === item.originalData.name);
          targetId = existing?.id || oldId;
        } else {
          targetId = `tmpl_m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        }
        templateIdMapping[oldId] = targetId;
        return {
          ...item.originalData,
          name: item.newName,
          id: targetId,
        };
      });

    const finalProjects = queue
      .filter((item) => item.type === 'project')
      .map((item) => {
        const originalProject = item.originalData as Project;
        const correctedTemplateId =
          templateIdMapping[originalProject.templateId] || originalProject.templateId;

        if (item.action === 'overwrite') {
          const existing = currentProjects.find((project) => project.name === originalProject.name);
          return { ...originalProject, templateId: correctedTemplateId, id: existing?.id || originalProject.id };
        }

        return {
          ...originalProject,
          name: item.newName,
          templateId: correctedTemplateId,
          id: `proj_m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        };
      });

    onConfirmMerge(finalProjects, finalTemplates);
    onClose();
    resetImportedState();
  };

  const renderItem = (item: MergeItem<any>, isQueue: boolean) => {
    const isAlreadyInQueue = !isQueue && queue.some((queuedItem) => queuedItem.id === item.id);
    const queueItem = isQueue ? queue.find((queuedItem) => queuedItem.id === item.id) : null;
    const currentItem = queueItem || item;

    return (
      <div key={item.id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">
                {item.type === 'template' ? '模板' : '项目'}
              </span>
              <span className="truncate text-sm font-semibold text-slate-100">{item.originalData.name}</span>
              {item.isOrphan ? (
                <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-300">
                  孤儿
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setPreviewItem(item.originalData)} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
              查看
            </button>
            {isQueue ? (
              <button onClick={() => removeFromQueue(item.id)} className="rounded p-1 text-slate-400 hover:bg-red-500/10 hover:text-red-300">
                移除
              </button>
            ) : (
              <button disabled={isAlreadyInQueue} onClick={() => addToQueue(item.id)} className="rounded p-1 text-slate-400 hover:bg-emerald-500/10 hover:text-emerald-300 disabled:opacity-50">
                加入
              </button>
            )}
          </div>
        </div>

        {isQueue && currentItem.status === 'conflict' ? (
          <div className="space-y-2">
            <div className="flex gap-2 text-xs">
              <button
                onClick={() => setQueue(queue.map((q) => (q.id === item.id ? { ...q, action: 'import' } : q)))}
                className={`rounded border px-2 py-1 ${currentItem.action === 'import' ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-700 text-slate-300'}`}
              >
                保存副本
              </button>
              <button
                onClick={() => setQueue(queue.map((q) => (q.id === item.id ? { ...q, action: 'overwrite' } : q)))}
                className={`rounded border px-2 py-1 ${currentItem.action === 'overwrite' ? 'border-amber-500 bg-amber-600 text-white' : 'border-slate-700 text-slate-300'}`}
              >
                覆盖现有
              </button>
            </div>
            {currentItem.action === 'import' ? (
              <input
                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200"
                value={currentItem.newName}
                onChange={(event) =>
                  setQueue(queue.map((q) => (q.id === item.id ? { ...q, newName: event.target.value } : q)))
                }
                placeholder="另存名称"
              />
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[110] flex flex-col bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 p-6">
        <div>
          <h2 className="text-xl font-bold text-white">导入与合并</h2>
          <p className="text-xs text-slate-500">预解析旧备份、展示风险并在确认后导入。</p>
        </div>
        <div className="flex items-center gap-2">
          {!preparedImport ? (
            <Button variant="primary" onClick={handleSelectFile} size="sm">
              选择备份文件（.json）
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={resetImportedState} size="sm">
                重新选择文件
              </Button>
              {requiresForceImport && !forceRiskImport ? (
                <Button variant="danger" onClick={() => setForceRiskImport(true)} size="sm">
                  强制导入风险项
                </Button>
              ) : null}
              <Button
                variant="success"
                onClick={handleConfirm}
                size="sm"
                disabled={queue.length === 0 || (requiresForceImport && !forceRiskImport)}
              >
                确认合并（{queue.length}）
              </Button>
            </>
          )}
          <button onClick={() => { resetImportedState(); onClose(); }} className="rounded p-2 text-slate-400 hover:bg-slate-800 hover:text-white">关闭</button>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden p-6">
        {!preparedImport ? (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-500">请选择一个备份文件开始预解析。</div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr,0.8fr]">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-200">
                <div>类型：{preparedImport.report.detectedKind}</div>
                <div>版本迁移：{preparedImport.report.fromVersion} {'->'} {preparedImport.report.toVersion}</div>
                <div>编码：{preparedImport.report.encoding}</div>
                <div>模板/项目：{preparedImport.report.stats.templateCount} / {preparedImport.report.stats.projectCount}</div>
                <div>补齐字段：{preparedImport.report.stats.patchedFieldCount}</div>
                <div>风险项：{preparedImport.report.warnings.length}</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="mb-2 text-sm font-bold text-white">风险提示</div>
                <button
                  className="mb-2 rounded border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
                  onClick={() => onRequestAlert('导入报告', buildImportReportText(preparedImport.report))}
                >
                  查看摘要
                </button>
                <button
                  className="mb-3 ml-2 rounded border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
                  onClick={() => {
                    const reportText = buildImportReportText(preparedImport.report);
                    navigator.clipboard
                      .writeText(reportText)
                      .then(() => onRequestAlert('导入报告', '已复制导入诊断报告。'))
                      .catch(() => onRequestAlert('导入报告', reportText));
                  }}
                >
                  复制诊断报告（中文）
                </button>
                <div className="max-h-40 space-y-2 overflow-y-auto">
                  {preparedImport.report.warnings.length === 0 ? (
                    <div className="rounded border border-emerald-500/20 bg-emerald-500/10 p-2 text-xs text-emerald-300">
                      未检测到风险。
                    </div>
                  ) : (
                    preparedImport.report.warnings.map((warning, index) => (
                      <div key={`${warning.code}-${index}`} className={`rounded border p-2 text-xs ${warningToneClass[warning.level]}`}>
                        <div className="font-semibold">{warning.code}</div>
                        <div>{warning.message}</div>
                        {warning.fieldPath ? <div className="font-mono text-[11px]">{warning.fieldPath}</div> : null}
                        {warning.preview ? <div className="font-mono text-[11px]">{warning.preview}</div> : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-2 gap-4">
              <div className="min-h-0 rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-400">导入内容</div>
                  <button
                    onClick={() => setQueue(inventory.filter((item) => !(item.type === 'project' && item.isOrphan)))}
                    className="text-xs text-blue-300 hover:underline"
                  >
                    安全项全部入队
                  </button>
                </div>
                <div className="space-y-2 overflow-y-auto">
                  {inventory.map((item) => renderItem(item, false))}
                </div>
              </div>

              <div className="min-h-0 rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs font-bold text-blue-300">合并队列（{queue.length}）</div>
                  <button onClick={() => setQueue([])} className="text-xs text-slate-300 hover:underline">
                    清空队列
                  </button>
                </div>
                <div className="space-y-2 overflow-y-auto">
                  {queue.length === 0 ? (
                    <div className="rounded border border-dashed border-slate-700 p-8 text-center text-xs text-slate-500">
                      队列为空
                    </div>
                  ) : (
                    queue.map((item) => renderItem(item, true))
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <DataPreviewOverlay isOpen={!!previewItem} onClose={() => setPreviewItem(null)} data={previewItem} />
    </div>
  );
};
