
import React, { useState, useMemo } from 'react';
import { Project, Template } from '../types';
import { Button } from './Button';
import { ioService } from '../services/ioService';
import { DataPreviewOverlay } from './DataPreviewOverlay';
import { normalizeBackupData } from '../services/dataCompatibility';

interface MergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProjects: Project[];
  currentTemplates: Template[];
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
}

export const MergeModal: React.FC<MergeModalProps> = ({
  isOpen,
  onClose,
  currentProjects,
  currentTemplates,
  onConfirmMerge,
  onRequestAlert
}) => {
  const [importedData, setImportedData] = useState<{ projects: Project[]; templates: Template[] } | null>(null);
  const [inventory, setInventory] = useState<MergeItem<any>[]>([]);
  const [queue, setQueue] = useState<MergeItem<any>[]>([]);
  const [previewItem, setPreviewItem] = useState<any | null>(null);

  if (!isOpen) return null;

  const handleSelectFile = async () => {
    try {
      const content = await ioService.selectAndReadFile();
      if (!content) return;
      const data = normalizeBackupData(JSON.parse(content));
      if (!data.projects || !data.templates) {
        onRequestAlert('格式错误', '该文件不是有效的备份文件。');
        return;
      }
      
      const analyzedInventory: MergeItem<any>[] = [
        ...data.templates.map((t: Template) => {
          const existing = currentTemplates.find(ct => ct.name === t.name);
          const isIdentical = existing ? JSON.stringify({ ...t, id: '' }) === JSON.stringify({ ...existing, id: '' }) : false;
          return {
            id: t.id,
            originalData: t,
            type: 'template',
            status: existing ? (isIdentical ? 'identical' : 'conflict') : 'new',
            action: 'import',
            newName: t.name + (existing ? '_copy' : '')
          };
        }),
        ...data.projects.map((p: Project) => {
          const existing = currentProjects.find(cp => cp.name === p.name);
          const isIdentical = existing ? JSON.stringify({ ...p, id: '', lastModifiedAt: 0 }) === JSON.stringify({ ...existing, id: '', lastModifiedAt: 0 }) : false;
          return {
            id: p.id,
            originalData: p,
            type: 'project',
            status: existing ? (isIdentical ? 'identical' : 'conflict') : 'new',
            action: 'import',
            newName: p.name + (existing ? '_copy' : '')
          };
        })
      ];

      setInventory(analyzedInventory);
      setQueue([]);
      setImportedData(data);
    } catch (e) {
      onRequestAlert('解析失败', '无法读取或解析该 JSON 文件。');
    }
  };

  const addToQueue = (id: string) => {
    if (queue.some(i => i.id === id)) return;
    const item = inventory.find(i => i.id === id);
    if (!item) return;

    let itemsToAdd = [item];
    if (item.type === 'project') {
      const templateId = (item.originalData as Project).templateId;
      const templateItem = inventory.find(i => i.type === 'template' && i.id === templateId);
      if (templateItem && !queue.some(i => i.id === templateId)) {
        itemsToAdd.unshift(templateItem);
      }
    }
    setQueue([...queue, ...itemsToAdd]);
  };

  const removeFromQueue = (id: string) => {
    const item = queue.find(i => i.id === id);
    if (!item) return;

    if (item.type === 'template') {
      setQueue(queue.filter(i => {
        if (i.id === id) return false;
        if (i.type === 'project' && (i.originalData as Project).templateId === id) return false;
        return true;
      }));
    } else {
      setQueue(queue.filter(i => i.id !== id));
    }
  };

  const handleConfirm = () => {
    // 建立 ID 映射表，解决模版引用失效问题
    const templateIdMapping: Record<string, string> = {};

    // 1. 先处理模版，记录它们的新 ID
    const finalTemplates = queue
      .filter(i => i.type === 'template')
      .map(item => {
        const oldId = item.id;
        let targetId = oldId;

        if (item.action === 'overwrite') {
          const existing = currentTemplates.find(t => t.name === item.originalData.name);
          targetId = existing?.id || oldId;
        } else {
          // 如果是导入为副本或新项，生成新 ID
          targetId = `tmpl_m_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        }

        templateIdMapping[oldId] = targetId;
        return { 
          ...item.originalData, 
          name: item.newName, 
          id: targetId 
        };
      });

    // 2. 处理项目，根据映射表修正其引用的 templateId
    const finalProjects = queue
      .filter(i => i.type === 'project')
      .map(item => {
        const originalProject = item.originalData as Project;
        const oldTemplateId = originalProject.templateId;
        
        // 关键修复：如果在映射表里找到了新模版 ID，就使用它；否则保留（可能引用的是库中已有的模版）
        const correctedTemplateId = templateIdMapping[oldTemplateId] || oldTemplateId;

        if (item.action === 'overwrite') {
          const existing = currentProjects.find(p => p.name === item.originalData.name);
          return { 
            ...originalProject, 
            templateId: correctedTemplateId, 
            id: existing?.id || originalProject.id 
          };
        }
        
        return { 
          ...originalProject, 
          name: item.newName, 
          templateId: correctedTemplateId, 
          id: `proj_m_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` 
        };
      });

    onConfirmMerge(finalProjects, finalTemplates);
    onClose();
  };

  const renderGroupedList = (items: MergeItem<any>[], isQueue: boolean) => {
    const templates = items.filter(i => i.type === 'template');
    const orphanProjects = items.filter(i => i.type === 'project' && !templates.some(t => t.id === (i.originalData as Project).templateId));
    
    return (
      <div className="space-y-6">
        {templates.map(tpl => {
          const childProjects = items.filter(i => i.type === 'project' && (i.originalData as Project).templateId === tpl.id);
          return (
            <div key={tpl.id} className="space-y-2">
              {renderItem(tpl, isQueue, false)}
              {childProjects.length > 0 && (
                <div className="pl-6 space-y-2 border-l-2 border-slate-900 ml-5">
                  {childProjects.map(proj => renderItem(proj, isQueue, true))}
                </div>
              )}
            </div>
          );
        })}
        {orphanProjects.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-[9px] text-slate-700 font-bold uppercase px-2 mb-3">
              {isQueue ? '选中的孤立项目' : '无关联模版的孤立项目'}
            </h5>
            {orphanProjects.map(proj => renderItem(proj, isQueue, false))}
          </div>
        )}
      </div>
    );
  };

  const renderItem = (item: MergeItem<any>, isQueue: boolean, isChild: boolean) => {
    const isAlreadyInQueue = !isQueue && queue.some(q => q.id === item.id);
    const queueItem = isQueue ? queue.find(q => q.id === item.id) : null;
    const currentItem = queueItem || item;

    return (
      <div key={item.id} className={`p-3 rounded-xl border transition-all duration-300 ${
        isAlreadyInQueue ? 'bg-blue-600/10 border-blue-500/30' :
        item.status === 'conflict' ? 'bg-amber-500/5 border-amber-500/20' : 
        item.status === 'identical' ? 'bg-slate-900/50 border-slate-800' : 
        'bg-slate-900/30 border-slate-800/50'
      } ${isChild ? 'py-2 px-3 scale-[0.98] origin-left' : ''}`}>
        <div className="flex justify-between items-start gap-3">
          <div className={`min-w-0 flex-1 ${isAlreadyInQueue ? 'opacity-60' : ''}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase ${
                item.type === 'template' ? 'bg-blue-600/20 text-blue-400' : 'bg-purple-600/20 text-purple-400'
              }`}>
                {item.type === 'template' ? '模版' : '项目'}
              </span>
              <span className={`font-bold text-slate-200 truncate ${item.type === 'template' ? 'text-xs' : 'text-[11px]'}`}>{item.originalData.name}</span>
              {isAlreadyInQueue && (
                <span className="flex items-center gap-1 text-[8px] text-blue-400 font-bold uppercase ml-2 animate-in fade-in slide-in-from-left-1">
                   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-2.5 h-2.5"><path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" /></svg>
                   已入队
                </span>
              )}
            </div>
            
            {isQueue && currentItem.action === 'import' && currentItem.status === 'conflict' && (
              <div className="mt-2 space-y-1">
                 <input 
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[11px] text-blue-400 outline-none focus:border-blue-500"
                  value={currentItem.newName}
                  onChange={(e) => {
                    setQueue(queue.map(i => i.id === item.id ? { ...i, newName: e.target.value } : i));
                  }}
                  placeholder="存为新名称..."
                />
              </div>
            )}

            {isQueue && currentItem.status === 'conflict' && (
               <div className="flex gap-1.5 mt-2">
                 <button 
                  onClick={() => setQueue(queue.map(i => i.id === item.id ? { ...i, action: 'import' } : i))}
                  className={`text-[8px] px-2 py-0.5 rounded border transition-all font-bold ${currentItem.action === 'import' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-500'}`}
                 >
                   存为副本
                 </button>
                 <button 
                  onClick={() => setQueue(queue.map(i => i.id === item.id ? { ...i, action: 'overwrite' } : i))}
                  className={`text-[8px] px-2 py-0.5 rounded border transition-all font-bold ${currentItem.action === 'overwrite' ? 'bg-amber-600 border-amber-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-500'}`}
                 >
                   覆盖现有
                 </button>
               </div>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0 mt-1">
            <button 
              onClick={() => setPreviewItem(item.originalData)}
              className="p-1.5 text-slate-600 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="查看详情"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5"><path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" /><path fillRule="evenodd" d="M1.38 8.28a.87.87 0 0 1 0-.56 6.33 6.33 0 0 1 13.24 0 .87.87 0 0 1 0 .56 6.33 6.33 0 0 1-13.24 0ZM8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" /></svg>
            </button>
            {isQueue ? (
              <button 
                onClick={() => removeFromQueue(item.id)}
                className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                title={item.type === 'template' ? "移出队列（同步移除子项目）" : "移出队列"}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5"><path d="M3.75 7.25a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5Z" /></svg>
              </button>
            ) : (
              <button 
                onClick={() => addToQueue(item.id)}
                disabled={isAlreadyInQueue}
                className={`p-1.5 rounded-lg transition-all ${isAlreadyInQueue ? 'text-blue-500 bg-blue-500/10 cursor-default' : 'text-slate-600 hover:text-emerald-400 hover:bg-emerald-500/10'}`}
                title={item.type === 'project' ? "加入队列（自动包含对应模版）" : "加入队列"}
              >
                {isAlreadyInQueue ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" /></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5"><path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" /></svg>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[110] flex flex-col bg-slate-950 animate-in fade-in duration-200">
      <div className="flex justify-between items-center p-6 border-b border-slate-800 bg-slate-900 shrink-0">
        <div className="flex items-center gap-4">
             <h2 className="text-xl font-bold text-white tracking-tight">数据合并工作台</h2>
             <span className="text-xs text-slate-500 border-l border-slate-700 pl-4 py-1">精细化控制增量导入内容</span>
        </div>
        <div className="flex items-center gap-3">
          {!importedData ? (
            <Button variant="primary" onClick={handleSelectFile} size="sm">选择备份文件 (.json)</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setImportedData(null)} size="sm">重新选择文件</Button>
              <Button variant="success" onClick={handleConfirm} size="sm" className="px-8 font-black shadow-lg shadow-emerald-500/20" disabled={queue.length === 0}>
                确认执行合并 ({queue.length} 项)
              </Button>
            </>
          )}
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800 transition-colors ml-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-8 flex flex-col">
        {!importedData ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-20 h-20 bg-slate-900 rounded-3xl flex items-center justify-center border border-slate-800 shadow-2xl">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-blue-500"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            </div>
            <div className="max-w-md">
              <h3 className="text-lg font-bold text-white mb-2">载入外部数据以开始</h3>
              <p className="text-sm text-slate-500 leading-relaxed">左侧展示文件完整结构，点击 “+” 将项标记为入队。导入项目将自动关联其所属模版。</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex gap-12 min-h-0">
            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex items-center justify-between mb-6 px-2">
                 <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">外部文件库存 (全量)</h4>
                 <button onClick={() => setQueue([...inventory])} className="text-[10px] text-blue-400 hover:underline">全部入队</button>
              </div>
              <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar">
                {renderGroupedList(inventory, false)}
              </div>
            </div>

            <div className="w-[1px] bg-slate-800 shrink-0 self-stretch my-10 relative">
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-950 p-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 text-slate-800"><path fillRule="evenodd" d="M12.72 3.22a.75.75 0 0 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L4.22 4.28a.75.75 0 0 1 1.06-1.06L8 5.94l4.72-2.72ZM12.72 8.22a.75.75 0 0 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L4.22 9.28a.75.75 0 0 1 1.06-1.06L8 10.94l4.72-2.72Z" clipRule="evenodd" /></svg>
               </div>
            </div>

            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex items-center justify-between mb-6 px-2">
                 <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-widest">待合并执行队列 ({queue.length})</h4>
                 <button onClick={() => setQueue([])} className="text-[10px] text-slate-600 hover:text-white">清空队列</button>
              </div>
              <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar">
                {renderGroupedList(queue, true)}
                {queue.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-slate-900 rounded-2xl text-center p-6">
                    <div className="w-10 h-10 rounded-full border border-slate-800 flex items-center justify-center mb-3 text-slate-800 font-black">+</div>
                    <p className="text-[10px] text-slate-700 font-bold uppercase tracking-tight">队列为空</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <DataPreviewOverlay 
        isOpen={!!previewItem} 
        onClose={() => setPreviewItem(null)} 
        data={previewItem} 
      />

      <div className="p-4 bg-slate-900/50 border-t border-slate-800 flex justify-center gap-10">
         <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500"></div><span className="text-[10px] text-slate-600 font-bold uppercase">模版</span></div>
         <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-purple-500"></div><span className="text-[10px] text-slate-600 font-bold uppercase">所属项目</span></div>
         <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-500"></div><span className="text-[10px] text-slate-600 font-bold uppercase">重名冲突项</span></div>
      </div>
    </div>
  );
};
