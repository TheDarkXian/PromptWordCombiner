
import React, { useState, useLayoutEffect, useRef, useEffect } from 'react';

interface PromptEditorProps {
  label: string;
  templateContent: string;
  interpolatedContent: string;
  originalTemplateContent: string;
  onUpdateOverride: (newContent: string) => void;
  onRevert: () => void;
  onSaveToTemplate: (newContent: string) => void;
}

const AutoResizeTextarea: React.FC<{
  value: string;
  onChange: (val: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}> = ({ value, onChange, onBlur, placeholder, className, autoFocus }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const findScrollParent = (element: HTMLElement): HTMLElement | null => {
    let parent = element.parentElement;
    while (parent) {
      const { overflowY } = window.getComputedStyle(parent);
      if (/(auto|scroll)/.test(overflowY) && parent.scrollHeight > parent.clientHeight) {
        return parent;
      }
      parent = parent.parentElement;
    }
    return null;
  };

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (el) {
      const scrollParent = findScrollParent(el);
      const previousScrollTop = scrollParent?.scrollTop;

      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;

      // Resizing a long focused textarea can make the browser lose its scroll
      // anchor and jump upward. Preserve upward position changes while still
      // allowing the browser to scroll down naturally to keep the caret visible.
      if (scrollParent && previousScrollTop !== undefined) {
        const restoreUnexpectedUpwardScroll = () => {
          if (scrollParent.scrollTop < previousScrollTop) {
            scrollParent.scrollTop = previousScrollTop;
          }
        };
        restoreUnexpectedUpwardScroll();
        requestAnimationFrame(restoreUnexpectedUpwardScroll);
      }
    }
  };

  useLayoutEffect(() => {
    adjustHeight();
  }, [value]);

  useEffect(() => {
    const handle = requestAnimationFrame(() => {
      adjustHeight();
      if (autoFocus && textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(value.length, value.length);
      }
    });
    return () => cancelAnimationFrame(handle);
  }, []);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      className={`block w-full resize-none overflow-hidden bg-transparent outline-none focus:ring-0 p-0 m-0 ${className}`}
      rows={1}
      spellCheck={false}
    />
  );
};

export const PromptEditor: React.FC<PromptEditorProps> = ({
  label,
  templateContent,
  interpolatedContent,
  originalTemplateContent,
  onUpdateOverride,
  onRevert,
  onSaveToTemplate
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isPreviewHidden, setIsPreviewHidden] = useState(false);
  const [editContent, setEditContent] = useState(templateContent);

  useEffect(() => {
    setEditContent(templateContent);
  }, [templateContent]);

  const hasChanges = templateContent !== originalTemplateContent;

  const handleBlur = () => {
    if (editContent !== templateContent) {
      onUpdateOverride(editContent);
    }
    setIsEditing(false);
  };

  return (
    <div className="bg-slate-950 border border-slate-800/80 rounded px-2.5 py-2 group/editor transition-all hover:border-slate-700">
      <div className={`flex items-center justify-between h-4 ${isPreviewHidden ? '' : 'mb-1'}`}>
        <div className="flex items-center gap-2">
           <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight select-none">{label}</span>
        </div>
        
        <div className="flex items-center gap-1">
          {!isEditing && (
            <button
              onClick={(e) => { e.stopPropagation(); setIsPreviewHidden(current => !current); }}
              className="text-[9px] text-slate-500 hover:text-blue-300 px-1"
            >
              {isPreviewHidden ? '显示提示词' : '隐藏提示词'}
            </button>
          )}
          {!isEditing && hasChanges && (
            <div className="flex items-center gap-1 animate-in fade-in duration-200">
              <span className="text-[9px] text-amber-500 font-bold">局部修改</span>
              <button onClick={(e) => { e.stopPropagation(); onSaveToTemplate(templateContent); }} className="text-[9px] text-blue-400 hover:text-blue-300 px-1">同步到模版</button>
              <button onClick={(e) => { e.stopPropagation(); onRevert(); }} className="text-[9px] text-slate-500 hover:text-white px-1">还原</button>
            </div>
          )}
          {isEditing && <span className="text-[9px] text-blue-500 font-medium">编辑源码模版...</span>}
        </div>
      </div>

      {!isPreviewHidden && <div className="relative min-h-[30px]">
        {isEditing ? (
          <div className="bg-slate-900/80 rounded p-2 border border-blue-500/30 shadow-inner">
            <AutoResizeTextarea 
              className="text-[13px] text-slate-200 font-mono leading-relaxed"
              value={editContent}
              onChange={setEditContent}
              onBlur={handleBlur}
              autoFocus
            />
          </div>
        ) : (
          <div 
            className="cursor-text group/preview px-2 py-1.5 rounded hover:bg-slate-900/40 transition-colors"
            onClick={() => setIsEditing(true)}
          >
            <div className="text-[13px] text-slate-300 font-mono whitespace-pre-wrap leading-relaxed break-words">
              {interpolatedContent || <span className="italic text-slate-700">等待输入或引用数据...</span>}
            </div>
            <div className="absolute bottom-1 right-1 opacity-0 group-hover/preview:opacity-100 transition-opacity">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 text-slate-700"><path d="m13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.596.892l-.848 2.047a.75.75 0 0 0 .98.98l2.047-.848a2.75 2.75 0 0 0 .892-.596l4.261-4.262a1.75 1.75 0 0 0 0-2.474Z" /></svg>
            </div>
          </div>
        )}
      </div>}
    </div>
  );
};
