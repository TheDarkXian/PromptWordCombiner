import React from 'react';
import { AppSettings, UiLanguage } from '../../types';
import { t } from '../../services/i18n';

interface InterfaceSettingsPanelProps {
  appVersion: string;
  language: UiLanguage;
  settings: AppSettings;
  languageOptions: Array<{ value: UiLanguage; labelKey: 'settings.languageZh' | 'settings.languageEn' }>;
  onChange: (updates: Partial<AppSettings>) => void;
}

const UI_SCALE_OPTIONS = [
  { scale: 8, label: '50%' },
  { scale: 11, label: '70%' },
  { scale: 14, label: '85%' },
  { scale: 16, label: '100%' },
  { scale: 18, label: '112%' },
  { scale: 19, label: '120%' },
  { scale: 22, label: '138%' },
] as const;

const FONT_SIZE_OPTIONS = [
  { value: 'text-xs', label: '绱у噾' },
  { value: 'text-sm', label: '鏍囧噯' },
  { value: 'text-base', label: '鑸掑睍' },
] as const;

export const InterfaceSettingsPanel: React.FC<InterfaceSettingsPanelProps> = ({
  appVersion,
  language,
  settings,
  languageOptions,
  onChange,
}) => (
  <section className="space-y-6 rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
    <div>
      <h4 className="text-sm font-bold text-slate-200">Interface</h4>
      <p className="mt-1 text-xs text-slate-500">These settings only affect this device and local workspace presentation.</p>
    </div>

    <div className="space-y-3">
      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
        {t(language, 'settings.language')}
      </label>
      <div className="flex rounded-xl border border-slate-800 bg-slate-950 p-1.5 shadow-inner">
        {languageOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange({ language: option.value })}
            className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
              settings.language === option.value ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {t(language, option.labelKey)}
          </button>
        ))}
      </div>
    </div>

    <div className="space-y-3">
      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">UI 缂╂斁</label>
      <div className="grid grid-cols-4 gap-2">
        {UI_SCALE_OPTIONS.map((option) => (
          <button
            key={option.scale}
            onClick={() => onChange({ uiScale: option.scale })}
            className={`rounded-xl border py-2.5 text-[10px] font-bold transition-all ${
              settings.uiScale === option.scale
                ? 'scale-[1.02] border-blue-500 bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>

    <div className="space-y-3">
      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">瀛楀彿瀵嗗害</label>
      <div className="flex rounded-xl border border-slate-800 bg-slate-950 p-1.5 shadow-inner">
        {FONT_SIZE_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange({ fontSize: option.value as AppSettings['fontSize'] })}
            className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
              settings.fontSize === option.value ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>

    <div className="border-t border-slate-800 pt-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">褰撳墠鐗堟湰</span>
        <span className="rounded border border-slate-800 bg-slate-950 px-2 py-1 font-mono text-xs text-slate-400">
          {appVersion || 'Loading...'}
        </span>
      </div>
    </div>
  </section>
);
