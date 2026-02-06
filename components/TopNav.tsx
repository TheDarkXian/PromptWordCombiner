
import React from 'react';
import { Project } from '../types';
import { 
  MenuIcon, 
  SettingsIcon, 
  CloseIcon, 
  ProjectEmptyIcon as LibraryIcon 
} from './Icons';

interface TopNavProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenSettings: () => void;
  activeTabId: string | null;
  openTabIds: string[];
  projects: Project[];
  onOpenTab: (id: string) => void;
  onCloseTab: (id: string, e: React.MouseEvent) => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  isSidebarOpen,
  onToggleSidebar,
  onOpenSettings,
  activeTabId,
  openTabIds,
  projects,
  onOpenTab,
  onCloseTab
}) => {
  return (
    <div className="flex items-center bg-slate-900 h-14 border-b border-slate-800 shrink-0 pr-4 z-30 relative shadow-sm">
      {/* 侧边栏开关 */}
      <button 
        onClick={onToggleSidebar} 
        className={`w-14 h-full flex items-center justify-center text-slate-400 hover:text-white border-r border-slate-800 hover:bg-slate-800 transition-colors shrink-0 ${isSidebarOpen ? 'bg-slate-800/50 text-white' : ''}`}
        title={isSidebarOpen ? "关闭侧边栏" : "打开侧边栏"}
      >
        <MenuIcon className="w-5 h-5" />
      </button>

      {/* 标题与设置 */}
      <div className="px-5 font-bold text-slate-400 text-sm flex items-center gap-3 shrink-0">
        <span className="tracking-tight whitespace-nowrap">提示词拼接器 Pro</span>
        <button 
          onClick={onOpenSettings} 
          className="p-1.5 text-slate-600 hover:text-blue-400 transition-colors"
          title="全局设置"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>
      </div>

      {/* 标签页区域 */}
      <div className="flex-1 flex overflow-x-auto no-scrollbar items-end h-full px-3 gap-0.5">
        {/* 固定标签：文件库 */}
        <div 
          onClick={() => onOpenTab('library')} 
          className={`group relative flex items-center gap-2 px-4 py-2 min-w-[100px] cursor-pointer border-t border-r border-l rounded-t text-sm transition-colors h-[85%] ${activeTabId === 'library' ? 'bg-slate-950 border-slate-800 text-white z-10' : 'bg-slate-900 border-transparent text-slate-500'}`}
          style={{ marginBottom: '-1px' }}
        >
          <LibraryIcon className={`w-3.5 h-3.5 ${activeTabId === 'library' ? 'text-blue-400' : 'text-slate-600'}`} />
          <span className="truncate flex-1 font-bold">文件库</span>
        </div>

        {/* 动态项目标签 */}
        {openTabIds.map(id => {
          const project = projects.find(p => p.id === id);
          const isActive = activeTabId === id;
          return (
            <div 
              key={id} 
              onClick={() => onOpenTab(id)} 
              className={`group relative flex items-center gap-2 px-4 py-2 min-w-[120px] max-w-[220px] cursor-pointer border-t border-r border-l rounded-t text-sm transition-colors h-[85%] ${isActive ? 'bg-slate-950 border-slate-800 text-white z-10' : 'bg-slate-900 border-transparent text-slate-500'}`}
              style={{ marginBottom: '-1px' }}
              title={project?.name || '未知项目'}
            >
              <span className="truncate flex-1">{project?.name || '未命名项目'}</span>
              <button 
                onClick={(e) => onCloseTab(id, e)} 
                className="p-1 rounded-full hover:bg-slate-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <CloseIcon className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
