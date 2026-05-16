import React from 'react';
import { SplitPane } from '../common/SplitPane';

interface WorkbenchShellProps {
  sceneTitle: string;
  workspaceTitle: string;
  detailsTitle: string;
  scenePanel: React.ReactNode;
  workspacePanel: React.ReactNode;
  detailsPanel: React.ReactNode;
  sceneWidth: number;
  detailsWidth: number;
  sceneVisible?: boolean;
  detailsVisible?: boolean;
  onSceneWidthChange: (width: number) => void;
  onDetailsWidthChange: (width: number) => void;
  sceneMinWidth?: number;
  sceneMaxWidth?: number;
  detailsMinWidth?: number;
  detailsMaxWidth?: number;
}

const PanelFrame: React.FC<{
  title: string;
  children: React.ReactNode;
  className?: string;
}> = ({ title, children, className }) => (
  <section className={`flex h-full min-h-0 w-full flex-col overflow-hidden ${className || ''}`}>
    <div className="flex h-8 shrink-0 items-center border-b border-slate-800/80 px-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
      {title}
    </div>
    <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
  </section>
);

export const WorkbenchShell: React.FC<WorkbenchShellProps> = ({
  sceneTitle,
  workspaceTitle,
  detailsTitle,
  scenePanel,
  workspacePanel,
  detailsPanel,
  sceneWidth,
  detailsWidth,
  sceneVisible = true,
  detailsVisible = true,
  onSceneWidthChange,
  onDetailsWidthChange,
  sceneMinWidth = 260,
  sceneMaxWidth = 480,
  detailsMinWidth = 320,
  detailsMaxWidth = 640,
}) => {
  const workspace = (
    <PanelFrame title={workspaceTitle} className="bg-slate-950/30">
      {workspacePanel}
    </PanelFrame>
  );

  const workspaceWithDetails = detailsVisible ? (
    <SplitPane
      className="h-full min-h-0 w-full"
      direction="horizontal"
      size={detailsWidth}
      sizeTarget="second"
      minSize={detailsMinWidth}
      maxSize={detailsMaxWidth}
      onSizeChange={onDetailsWidthChange}
      first={workspace}
      second={
        <PanelFrame title={detailsTitle} className="border-l border-slate-800 bg-slate-950/60">
          {detailsPanel}
        </PanelFrame>
      }
    />
  ) : (
    workspace
  );

  if (!sceneVisible) {
    return <div className="flex h-full min-h-0 w-full overflow-hidden">{workspaceWithDetails}</div>;
  }

  return (
    <SplitPane
      className="h-full min-h-0 w-full"
      direction="horizontal"
      size={sceneWidth}
      minSize={sceneMinWidth}
      maxSize={sceneMaxWidth}
      onSizeChange={onSceneWidthChange}
      first={
        <PanelFrame title={sceneTitle} className="border-r border-slate-800 bg-slate-950/60">
          {scenePanel}
        </PanelFrame>
      }
      second={workspaceWithDetails}
    />
  );
};
