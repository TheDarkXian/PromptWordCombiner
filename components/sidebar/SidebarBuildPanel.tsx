import React from 'react';
import { UiLanguage } from '../../types';
import { t } from '../../services/i18n';
import { DownloadIcon } from '../Icons';
import { Button } from '../Button';

interface SidebarBuildPanelProps {
  language: UiLanguage;
  onBakeDownload: () => void;
}

export const SidebarBuildPanel: React.FC<SidebarBuildPanelProps> = ({ language, onBakeDownload }) => (
  <div className="p-6 flex flex-col items-center justify-center text-center h-full">
    <div className="w-14 h-14 bg-purple-900/30 text-purple-400 rounded-2xl flex items-center justify-center mb-4 shadow-xl shadow-purple-950/20">
      <DownloadIcon className="w-7 h-7" />
    </div>
    <h4 className="text-xs font-bold text-white mb-2 uppercase tracking-wider">{t(language, 'sidebar.bakeTitle')}</h4>
    <p className="text-[10px] text-slate-500 mb-6 px-4 leading-relaxed">{t(language, 'sidebar.bakeDescription')}</p>
    <Button variant="primary" size="sm" onClick={onBakeDownload} className="w-full bg-purple-600 hover:bg-purple-500 shadow-lg shadow-purple-600/30 font-bold">
      {t(language, 'sidebar.startExport')}
    </Button>
  </div>
);
