
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Project, Template, TemplateInput } from '../types';
import { 
  VarsIcon, 
  NavIcon, 
  BuildIcon, 
  ChevronDownIcon, 
  DownloadIcon 
} from './Icons';
import { Button } from './Button';

type SidebarTab = 'vars' | 'nav' | 'build';

interface SidebarProps {
  isOpen: boolean;
  width: number;
  onWidthChange: (width: number) => void;
  isResizing: boolean;
  onResizingChange: (resizing: boolean) => void;
  activeProject: Project | null;
  activeProjectTemplate: Template | null;
  onInputChange: (inputId: string, value: string) => void;
  onAddLocalVariable: (name: string) => void;
  onDeleteLocalVariable: (varId: string) => void;
  onBakeDownload: () => void;
  onRequestAlert: (title: string, message: string) => void;
}

const AutoResizeSidebarTextarea: React.FC<{
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}> = ({ value, onChange, placeholder, className }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const adjustHeight = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.max(32, el.scrollHeight)}px`;
    }
  };
  useLayoutEffect(() => {
    const timeout = setTimeout(adjustHeight, 0);
    return () => clearTimeout(timeout);
  }, [value]);
  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`block w-full resize-none overflow-hidden bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all ${className}`}
      rows={1}
      spellCheck={false}
    />
  );
};

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  width,
  onWidthChange,
  isResizing,
  onResizingChange,
  activeProject,
  activeProjectTemplate,
  onInputChange,
  onAddLocalVariable,
  onDeleteLocalVariable,
  onBakeDownload,
  onRequestAlert
}) => {
  const [activeTab, setActiveTab] = useState<SidebarTab>('vars');
  const [sections, setSections] = useState({ global: true, local: true });
  const [isAddingVariable, setIsAddingVariable] = useState(false);
  const [newVarName, setNewVarName] = useState("");
  const newVarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAddingVariable && newVarInputRef.current) {
      newVarInputRef.current.focus();
    }
  }, [isAddingVariable]);

  const handleAddVariable = () => {
    const trimmed = newVarName.trim();
    if (!trimmed) {
      setIsAddingVariable(false);
      return;
    }
    // 重名检查交由父组件或在此处预检查
    if (activeProject?.customInputs?.some(i => i.label === trimmed)) {
      onRequestAlert("重名警告", "该变量名称已存在。");
      return;
    }
    onAddLocalVariable(trimmed);
    setNewVarName("");
    setIsAddingVariable(false);
  };

  if (!isOpen) return null;

  return (
    <div 
      style={{ width }} 
      className="bg-slate-900 flex flex-shrink-0 z-20 transition-all duration-75 relative border-r border-slate-800 animate-in slide-in-from-left-2"
    >
      {/* 左侧窄条图标导航 */}
      <div className="w-12 bg-slate-950 flex flex-col items-center py-6 border-r border-slate-800 gap-6 shrink-0">
        {activeProject && (
          <>
            <button 
              onClick={() => setActiveTab('vars')} 
              title="变量配置" 
              className={`p-2 rounded-lg transition-colors ${activeTab === 'vars' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-slate-600 hover:text-slate-300'}`}
            >
              <VarsIcon className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setActiveTab('nav')} 
              title="步骤导航" 
              className={`p-2 rounded-lg transition-colors ${activeTab === 'nav' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30' : 'text-slate-600 hover:text-slate-300'}`}
            >
              <NavIcon className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setActiveTab('build')} 
              title="导出烘焙" 
              className={`p-2 rounded-lg transition-colors ${activeTab === 'build' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30' : 'text-slate-600 hover:text-slate-300'}`}
            >
              <BuildIcon className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      {/* 右侧内容区 */}
      <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden">
        <div className="flex-1 overflow-hidden flex flex-col">
          {activeProject && activeProjectTemplate ? (
            <>
              {activeTab === 'vars' && (
                <div className="flex flex-col h-full overflow-y-auto p-4 space-y-6 no-scrollbar">
                  {/* 全局变量 */}
                  <div className="space-y-3">
                    <div 
                      className="flex items-center justify-between cursor-pointer group" 
                      onClick={() => setSections(s => ({ ...s, global: !s.global }))}
                    >
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-slate-300 transition-colors">全局变量</span>
                      <ChevronDownIcon className={`w-3.5 h-3.5 text-slate-600 transition-transform ${sections.global ? 'rotate-180' : ''}`} />
                    </div>
                    {sections.global && activeProjectTemplate.inputs.map((input, idx) => (
                      <div key={input.id}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[10px] font-mono text-blue-400 font-bold">&lt;{idx}&gt;</span>
                          <label className="text-[10px] text-slate-500 block truncate font-medium">{input.label}</label>
                        </div>
                        <AutoResizeSidebarTextarea 
                          value={activeProject.inputValues[input.id] || ''} 
                          onChange={(val) => onInputChange(input.id, val)} 
                          placeholder="..." 
                        />
                      </div>
                    ))}
                  </div>

                  {/* 本地变量 */}
                  <div className="space-y-3 border-t border-slate-800 pt-4">
                    <div 
                      className="flex items-center justify-between cursor-pointer group" 
                      onClick={() => setSections(s => ({ ...s, local: !s.local }))}
                    >
                      <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider group-hover:text-emerald-400 transition-colors">本地变量</span>
                      <ChevronDownIcon className={`w-3.5 h-3.5 text-emerald-600/50 transition-transform ${sections.local ? 'rotate-180' : ''}`} />
                    </div>
                    {sections.local && (
                      <>
                        {(activeProject.customInputs || []).map((input, idx) => (
                          <div key={input.id} className="group relative">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-[10px] font-mono text-emerald-400 font-bold">&lt;l{idx + 1}&gt;</span>
                              <label className="text-[10px] text-slate-500 block truncate font-medium">{input.label}</label>
                            </div>
                            <AutoResizeSidebarTextarea 
                              value={activeProject.inputValues[input.id] || ''} 
                              onChange={(val) => onInputChange(input.id, val)} 
                              placeholder="..." 
                            />
                            <button 
                              onClick={() => onDeleteLocalVariable(input.id)} 
                              className="absolute top-0 right-0 text-slate-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        {isAddingVariable ? (
                          <div className="bg-slate-950 border border-emerald-900/50 rounded-lg p-3 animate-in slide-in-from-top-1 duration-150">
                            <input 
                              ref={newVarInputRef} 
                              type="text" 
                              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-white focus:border-emerald-500 outline-none" 
                              placeholder="名称..." 
                              value={newVarName} 
                              onChange={(e) => setNewVarName(e.target.value)} 
                              onKeyDown={(e) => { 
                                if (e.key === 'Enter') handleAddVariable(); 
                                if (e.key === 'Escape') setIsAddingVariable(false); 
                              }} 
                            />
                            <div className="flex justify-end gap-2 mt-3">
                              <button onClick={() => setIsAddingVariable(false)} className="text-[10px] text-slate-500 px-2 py-1 hover:text-white">取消</button>
                              <button onClick={handleAddVariable} className="text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-md transition-colors">添加</button>
                            </div>
                          </div>
                        ) : (
                          <button 
                            onClick={() => setIsAddingVariable(true)} 
                            className="w-full py-2 border border-dashed border-slate-800 rounded-lg text-[10px] text-slate-500 hover:border-emerald-500/50 hover:text-emerald-500 transition-all"
                          >
                            + 新增本地变量
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'nav' && (
                <div className="h-full overflow-y-auto p-3 space-y-2 no-scrollbar">
                  {activeProjectTemplate.steps.map((step, idx) => (
                    <button 
                      key={step.id} 
                      onClick={() => {
                        const el = document.getElementById(step.id);
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }} 
                      className="w-full flex items-center gap-3 p-2.5 hover:bg-slate-800 rounded-lg text-left transition-all group"
                    >
                      <span className="w-5 h-5 flex items-center justify-center shrink-0 bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-500 group-hover:border-amber-500 group-hover:text-amber-500 rounded transition-all">{idx + 1}</span>
                      <span className="text-xs text-slate-300 truncate font-medium">{step.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {activeTab === 'build' && (
                <div className="p-6 flex flex-col items-center justify-center text-center h-full">
                  <div className="w-14 h-14 bg-purple-900/30 text-purple-400 rounded-2xl flex items-center justify-center mb-4 shadow-xl shadow-purple-950/20">
                    <DownloadIcon className="w-7 h-7" />
                  </div>
                  <h4 className="text-xs font-bold text-white mb-2 uppercase tracking-wider">提示词全量烘焙</h4>
                  <p className="text-[10px] text-slate-500 mb-6 px-4 leading-relaxed">一键合并所有步骤内容导出为 .txt 纯文本</p>
                  <Button 
                    variant="primary" 
                    size="sm" 
                    onClick={onBakeDownload} 
                    className="w-full bg-purple-600 hover:bg-purple-500 shadow-lg shadow-purple-600/30 font-bold"
                  >
                    开始导出
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="p-10 text-center text-slate-600 text-[10px] flex flex-col items-center gap-3">
              <div className="w-8 h-8 border border-slate-800 rounded-full flex items-center justify-center opacity-40">!</div>
              请先从库中打开项目
            </div>
          )}
        </div>
      </div>

      {/* 调整宽度的拖拽条 */}
      <div 
        className="absolute right-0 top-0 bottom-0 w-1.5 bg-transparent hover:bg-blue-500/30 cursor-col-resize z-40 transition-colors" 
        onMouseDown={(e) => {
          e.preventDefault();
          onResizingChange(true);
        }} 
      />
    </div>
  );
};
