
import React, { useState, useRef } from 'react';
import { Button } from './Button';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: any;
  onDownload: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, data, onDownload }) => {
  const [copied, setCopied] = useState(false);
  if (!isOpen) return null;

  const jsonString = JSON.stringify(data, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-950 animate-in fade-in duration-200">
      <div className="flex justify-between items-center p-6 border-b border-slate-800 bg-slate-900 shrink-0">
        <div className="flex items-center gap-4">
             <h2 className="text-xl font-bold text-white tracking-tight">数据备份与恢复中心</h2>
             <span className="text-xs text-slate-500 border-l border-slate-700 pl-4 py-1">导出您的全量项目和模版数据</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={handleCopy} size="sm" className="min-w-[100px]">
            {copied ? '已复制到剪贴板' : '复制 JSON 源码'}
          </Button>
          <Button variant="primary" onClick={onDownload} size="sm">
            下载 .json 文件
          </Button>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800 transition-colors ml-4"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-8 flex flex-col">
         <div className="max-w-screen-xl mx-auto w-full h-full flex flex-col">
            <div className="mb-4 bg-blue-900/20 border border-blue-800/50 p-4 rounded-lg">
              <p className="text-sm text-blue-300">
                <span className="font-bold">提示：</span> 这是您的全量本地存储数据备份。定期备份数据可以防止因浏览器清理缓存导致的数据丢失。您可以在“文件库 &rarr; 数据恢复”中重新导入此 JSON 文件。
              </p>
            </div>
            
            <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl relative group">
              <textarea 
                readOnly
                className="w-full h-full p-6 font-mono text-xs text-slate-400 bg-transparent resize-none outline-none overflow-y-auto selection:bg-blue-500/30"
                value={jsonString}
              />
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[10px] bg-slate-950 px-2 py-1 rounded text-slate-600 border border-slate-800">JSON SOURCE V2.0</span>
              </div>
            </div>
         </div>
      </div>
      
      <div className="p-4 bg-slate-900/50 border-t border-slate-800 text-center">
         <p className="text-[10px] text-slate-600">您的隐私很重要：备份数据仅存储在您的本地浏览器中，除非您手动导出，否则不会上传到任何服务器。</p>
      </div>
    </div>
  );
};
