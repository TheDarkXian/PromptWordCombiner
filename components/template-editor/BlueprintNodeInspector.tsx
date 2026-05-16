import React from 'react';
import { UiLanguage } from '../../types';

interface BlueprintNodeInspectorProps {
  language: UiLanguage;
  selectedStepId?: string;
  children: React.ReactNode;
}

export const BlueprintNodeInspector: React.FC<BlueprintNodeInspectorProps> = ({
  language,
  selectedStepId,
  children,
}) => {
  if (!selectedStepId) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">
        {language === 'zh-CN' ? '请先在蓝图中选择一个节点' : 'Select a node in blueprint first'}
      </div>
    );
  }
  return <>{children}</>;
};

