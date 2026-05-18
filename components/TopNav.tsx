import React from 'react';
import { Project } from '../types';
import {
  MenuIcon,
  SettingsIcon,
  CloseIcon,
  ProjectEmptyIcon as LibraryIcon,
} from './Icons';

interface TopNavProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenSettings: () => void;
  activeTabId: string | null;
  openTabIds: string[];
  projects: Project[];
  onOpenTab: (id: string, options?: { forceNew?: boolean }) => void;
  tabOpenMode: 'single' | 'multi';
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
  tabOpenMode,
  onCloseTab,
}) => {
  return (
    <div className="relative z-30 flex h-14 shrink-0 items-center border-b border-slate-800 bg-slate-900 pr-4 shadow-sm">
      <button
        onClick={onToggleSidebar}
        className={`flex h-full w-14 shrink-0 items-center justify-center border-r border-slate-800 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white ${
          isSidebarOpen ? 'bg-slate-800/50 text-white' : ''
        }`}
        title={isSidebarOpen ? '关闭侧边栏' : '打开侧边栏'}
      >
        <MenuIcon className="h-5 w-5" />
      </button>

      <div className="flex shrink-0 items-center gap-3 px-5 text-sm font-bold text-slate-400">
        <span className="whitespace-nowrap tracking-tight">提示词函数流 Pro</span>
        <button
          onClick={onOpenSettings}
          className="p-1.5 text-slate-600 transition-colors hover:text-blue-400"
          title="全局设置"
        >
          <SettingsIcon className="h-4 w-4" />
        </button>
        <span className="rounded border border-slate-700 px-2 py-0.5 font-mono text-[10px] text-slate-500">
          {tabOpenMode === 'multi' ? 'multi' : 'single'}
        </span>
      </div>

      <div className="no-scrollbar flex h-full flex-1 items-end gap-0.5 overflow-x-auto px-3">
        <div
          onClick={() => onOpenTab('library')}
          className={`group relative flex h-[85%] min-w-[100px] cursor-pointer items-center gap-2 rounded-t border-l border-r border-t px-4 py-2 text-sm transition-colors ${
            activeTabId === 'library'
              ? 'z-10 border-slate-800 bg-slate-950 text-white'
              : 'border-transparent bg-slate-900 text-slate-500'
          }`}
          style={{ marginBottom: '-1px' }}
        >
          <LibraryIcon
            className={`h-3.5 w-3.5 ${
              activeTabId === 'library' ? 'text-blue-400' : 'text-slate-600'
            }`}
          />
          <span className="flex-1 truncate font-bold">文件库</span>
        </div>

        {openTabIds.map((id) => {
          const project = projects.find((item) => item.id === id);
          const isActive = activeTabId === id;
          return (
            <div
              key={id}
              onClick={() => onOpenTab(id)}
              className={`group relative flex h-[85%] min-w-[120px] max-w-[220px] cursor-pointer items-center gap-2 rounded-t border-l border-r border-t px-4 py-2 text-sm transition-colors ${
                isActive
                  ? 'z-10 border-slate-800 bg-slate-950 text-white'
                  : 'border-transparent bg-slate-900 text-slate-500'
              }`}
              style={{ marginBottom: '-1px' }}
              title={project?.name || '未知项目'}
            >
              <span className="flex-1 truncate">{project?.name || '未命名项目'}</span>
              <button
                onClick={(event) => onCloseTab(id, event)}
                className="rounded-full p-1 opacity-0 transition-opacity hover:bg-slate-700 hover:text-red-400 group-hover:opacity-100"
              >
                <CloseIcon className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
