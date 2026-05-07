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
  const [isEditing, setIsEditing] = useState(false);
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
    <div className="mt-1 rounded border border-slate-800/80 bg-slate-950 px-2.5 py-2 transition-colors hover:border-slate-700">
      <div className="mb-1.5 flex min-h-[18px] items-center justify-between gap-2">
        <span className="select-none text-[9px] font-bold uppercase tracking-tight text-slate-500">{label}</span>
        <div className="flex flex-wrap items-center justify-end gap-1 text-[9px]">
          {hasChanges && !isEditing && (
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
          {isEditing && <span className="font-medium text-blue-400">{t(language, 'editor.editing')}</span>}
        </div>
      </div>

      {isEditing ? (
        <div className="rounded border border-blue-500/30 bg-slate-900/80 p-2 shadow-inner">
          <AutoResizeTextarea
            className="text-xs font-mono leading-relaxed text-slate-200"
            value={editContent}
            onChange={setEditContent}
            onBlur={handleBlur}
            autoFocus
          />
        </div>
      ) : (
        <div
          className="group/preview relative cursor-text rounded px-2 py-2 transition-colors hover:bg-slate-900/40"
          onClick={() => setIsEditing(true)}
        >
          <div className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-slate-300">
            {interpolatedContent || <span className="italic text-slate-600">{t(language, 'editor.waiting')}</span>}
          </div>
          <div className="absolute bottom-1 right-1 opacity-0 transition-opacity group-hover/preview:opacity-100">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 text-slate-700">
              <path d="m13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.596.892l-.848 2.047a.75.75 0 0 0 .98.98l2.047-.848a2.75 2.75 0 0 0 .892-.596l4.261-4.262a1.75 1.75 0 0 0 0-2.474Z" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
};
