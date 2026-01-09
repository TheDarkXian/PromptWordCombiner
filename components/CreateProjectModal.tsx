
import React, { useState, useEffect, useRef } from 'react';
import { Button } from './Button';

interface CreateProjectModalProps {
  isOpen: boolean;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onConfirm,
  onCancel
}) => {
  const [name, setName] = useState('新项目');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName('新项目');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (name.trim()) {
      onConfirm(name.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden transform transition-all scale-100 p-8">
        <h3 className="text-lg font-bold text-white mb-2">新建项目</h3>
        <p className="text-xs text-slate-500 mb-6">请为您的新项目命名以继续。</p>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 outline-none transition-all shadow-inner"
            placeholder="项目名称..."
          />
          
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onCancel}>
              取消
            </Button>
            <Button type="submit" variant="primary" disabled={!name.trim()}>
              确认创建
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
