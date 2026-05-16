import React, { useEffect, useState } from 'react';
import { UiLanguage } from '../types';
import { t } from '../services/i18n';
import { AutoResizeTextarea } from './common/AutoResizeTextarea';

interface PromptEditorProps {
  language: UiLanguage;
  label: string;
  templateContent: string;
  interpolatedContent: string;
  originalTemplateContent: string;
  onUpdateOverride: (newContent: string) => void;
  onRevert: () => void;
  onSaveToTemplate: (newContent: string) => void;
}

export const PromptEditor: React.FC<PromptEditorProps> = ({
  language,
  label,
  templateContent,
  interpolatedContent,
  originalTemplateContent,
  onUpdateOverride,
  onRevert,
  onSaveToTemplate,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [editContent, setEditContent] = useState(templateContent);

  useEffect(() => {
    setEditContent(templateContent);
  }, [templateContent]);

  const hasChanges = templateContent !== originalTemplateContent;

  const handleBlur = () => {
    if (editContent !== templateContent) {
      onUpdateOverride(editContent);
    }
    setIsFocused(false);
  };

  return (
    <div className="mt-1 rounded-lg border border-slate-800/60 bg-slate-950/40 px-2.5 py-2 transition-colors hover:border-slate-700/80">
      <div className="mb-1.5 flex min-h-[18px] items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="select-none text-[9px] font-bold uppercase tracking-tight text-slate-500">
            {label}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1 text-[9px]">
          {hasChanges && !isFocused && (
            <>
              <span className="font-bold text-amber-400">{t(language, 'editor.edited')}</span>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onSaveToTemplate(templateContent);
                }}
                className="rounded px-1.5 py-0.5 text-blue-400 transition-colors hover:bg-blue-500/10 hover:text-blue-300"
              >
                {t(language, 'editor.syncTemplate')}
              </button>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onRevert();
                }}
                className="rounded px-1.5 py-0.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-white"
              >
                {t(language, 'editor.revert')}
              </button>
            </>
          )}
          {isFocused && <span className="font-medium text-blue-400">{t(language, 'editor.editing')}</span>}
        </div>
      </div>

      {isFocused ? (
        <div className="rounded-md border border-blue-500/30 bg-slate-900/80 px-2 py-2 shadow-inner transition-colors">
          <div className="max-h-44 overflow-y-auto pr-1">
            <AutoResizeTextarea
              className="text-xs font-mono leading-relaxed text-slate-300"
              value={editContent}
              onChange={setEditContent}
              onFocus={() => setIsFocused(true)}
              onBlur={handleBlur}
              autoFocus
            />
          </div>
        </div>
      ) : (
        <div
          className="rounded-md border border-slate-800/40 bg-slate-950/60 px-2 py-1.5 transition-colors hover:border-slate-700/70 hover:bg-slate-950/80"
          onClick={() => setIsFocused(true)}
        >
          <div className="max-h-24 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-slate-400">
            {interpolatedContent || (
              <span className="italic text-slate-600">{t(language, 'editor.waiting')}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
