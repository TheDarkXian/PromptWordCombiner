
import React from 'react';
import { Button } from './Button';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  uiScale: number;
  setUiScale: (val: any) => void;
  fontSize: string;
  setFontSize: (val: any) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  uiScale,
  setUiScale,
  fontSize,
  setFontSize
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="px-8 py-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
          <h3 className="text-sm font-bold text-white uppercase tracking-widest">全局环境配置</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-5 h-5">
              <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0-1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
            </svg>
          </button>
        </div>

        <div className="p-8 space-y-8">
          <div className="space-y-4">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">UI 整体缩放比例</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { scale: 8, label: '50%' },
                { scale: 11, label: '70%' },
                { scale: 14, label: '85%' },
                { scale: 16, label: '100%' },
                { scale: 18, label: '112%' },
                { scale: 19, label: '120%' },
                { scale: 22, label: '138%' }
              ].map((opt) => (
                <button
                  key={opt.scale}
                  onClick={() => setUiScale(opt.scale)}
                  className={`py-2.5 text-[10px] font-bold rounded-xl border transition-all ${
                    uiScale === opt.scale 
                    ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20 scale-[1.02]' 
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">内容排版密度</label>
            <div className="flex bg-slate-950 p-1.5 rounded-xl border border-slate-800 shadow-inner">
              {[
                { label: '紧凑', value: 'text-xs' },
                { label: '标准', value: 'text-sm' },
                { label: '舒适', value: 'text-base' }
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFontSize(opt.value)}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    fontSize === opt.value 
                    ? 'bg-slate-800 text-white shadow-lg' 
                    : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-8 py-5 bg-slate-900/30 border-t border-slate-800 flex justify-end">
          <Button variant="primary" size="md" onClick={onClose} className="w-full font-black tracking-widest">
            保存并返回
          </Button>
        </div>
      </div>
    </div>
  );
};
