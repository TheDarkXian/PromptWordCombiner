
import React from 'react';
import { Button } from './Button';

interface DataPreviewOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  data: any;
  title?: string;
}

export const DataPreviewOverlay: React.FC<DataPreviewOverlayProps> = ({
  isOpen,
  onClose,
  data,
  title = "数据详情预览 (只读)"
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex flex-col bg-slate-950 animate-in fade-in duration-300">
      {/* 顶部控制栏 - 保持精简与对齐 */}
      <div className="flex justify-between items-center px-6 h-16 border-b border-slate-800 bg-slate-900 shrink-0 z-10 shadow-lg">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <h2 className="text-lg font-bold text-white tracking-tight leading-none">{title}</h2>
            <span className="text-[9px] text-slate-500 font-mono mt-1.5 uppercase tracking-[0.2em]">Data Inspector / Read Only</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(data, null, 2));
              // 简单的反馈，实际可结合系统 Toast
              alert('JSON 已复制');
            }}
            className="text-[10px] text-slate-400 hover:text-blue-400 font-bold uppercase tracking-widest px-4 py-2 transition-colors border border-transparent hover:border-blue-500/20 rounded-lg"
          >
            复制全文
          </button>
          <div className="w-[1px] h-6 bg-slate-800 mx-2"></div>
          <Button variant="secondary" size="sm" onClick={onClose} className="px-8 font-bold">
            退出预览
          </Button>
        </div>
      </div>

      {/* 核心展示区域 - 全屏占满且智能滚动 */}
      <div className="flex-1 w-full bg-slate-950 overflow-hidden flex flex-col relative">
        {/* 侧边装饰条，模拟代码行号区背景 */}
        <div className="absolute left-0 top-0 bottom-0 w-12 bg-slate-900/30 border-r border-slate-800/50 pointer-events-none"></div>
        
        <div className="flex-1 overflow-auto custom-scrollbar p-6 pl-16">
          {/* 
            inline-block 关键点：它会让 pre 的宽度由内容决定。
            结合 parent 的 overflow-auto，横向滚动条将完全匹配内容长度。
          */}
          <pre className="inline-block min-w-full text-[13px] font-mono text-blue-400/90 leading-relaxed selection:bg-blue-500/30">
            {JSON.stringify(data, null, 2)}
          </pre>
          
          {/* 底部留白，防止滚动到底部时视觉太紧凑 */}
          <div className="h-20 w-full"></div>
        </div>

        {/* 底部信息悬浮条 */}
        <div className="absolute bottom-6 right-8 pointer-events-none">
          <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 px-4 py-2 rounded-full shadow-2xl">
             <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">
                Source Format: JSON | Version: 2.0
             </span>
          </div>
        </div>
      </div>

      <style>{`
        /* 针对此页面的滚动条进行更细腻的定制 */
        .custom-scrollbar::-webkit-scrollbar {
          width: 12px;
          height: 12px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #020617; /* slate-950 */
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1e293b; /* slate-800 */
          border: 3px solid #020617;
          border-radius: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #334155; /* slate-700 */
        }
        .custom-scrollbar::-webkit-scrollbar-corner {
          background: #020617;
        }
      `}</style>
    </div>
  );
};
