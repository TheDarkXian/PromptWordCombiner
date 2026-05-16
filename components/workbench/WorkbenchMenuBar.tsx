import React, { useState } from 'react';

export interface WorkbenchCommand {
  id: string;
  label: string;
  shortcut?: string;
  enabled?: boolean;
  run: () => void;
}

export interface WorkbenchMenuGroup {
  label: string;
  commands: WorkbenchCommand[];
}

interface WorkbenchMenuBarProps {
  groups: WorkbenchMenuGroup[];
}

export const WorkbenchMenuBar: React.FC<WorkbenchMenuBarProps> = ({ groups }) => {
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  return (
    <div className="relative z-40 flex h-8 w-full shrink-0 items-center border-b border-slate-800 bg-slate-950/95 px-2 text-xs text-slate-300">
      {groups.map((group) => (
        <div key={group.label} className="relative">
          <button
            type="button"
            className={`rounded px-3 py-1 font-semibold transition-colors ${
              openGroup === group.label ? 'bg-slate-800 text-white' : 'hover:bg-slate-900 hover:text-white'
            }`}
            onClick={() => setOpenGroup((current) => (current === group.label ? null : group.label))}
          >
            {group.label}
          </button>
          {openGroup === group.label && (
            <div
              className="absolute left-0 top-7 min-w-48 rounded-lg border border-slate-700 bg-slate-950 p-1 shadow-2xl shadow-black/40"
              onMouseLeave={() => setOpenGroup(null)}
            >
              {group.commands.map((command) => {
                const enabled = command.enabled !== false;
                return (
                  <button
                    key={command.id}
                    type="button"
                    disabled={!enabled}
                    className={`flex w-full items-center justify-between gap-8 rounded px-3 py-2 text-left text-xs ${
                      enabled
                        ? 'text-slate-200 hover:bg-slate-800 hover:text-white'
                        : 'cursor-not-allowed text-slate-600'
                    }`}
                    onClick={() => {
                      if (!enabled) return;
                      setOpenGroup(null);
                      command.run();
                    }}
                  >
                    <span>{command.label}</span>
                    {command.shortcut && <span className="text-[10px] text-slate-500">{command.shortcut}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
