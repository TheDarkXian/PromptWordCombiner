import React from 'react';
import { Template, UiLanguage } from '../../types';
import { t } from '../../services/i18n';

interface TemplateMetaPanelProps {
  language: UiLanguage;
  template: Template;
  onChange: (template: Template) => void;
}

export const TemplateMetaPanel: React.FC<TemplateMetaPanelProps> = ({
  language,
  template,
  onChange,
}) => (
  <>
    <div className="mb-8 space-y-4">
      <label className="block text-sm font-bold text-slate-300">
        {t(language, 'templateEditor.name')}
      </label>
      <input
        className="w-full rounded border border-slate-700 bg-slate-950 p-2 text-white"
        value={template.name}
        onChange={(event) =>
          onChange({ ...template, name: event.target.value })
        }
      />
    </div>

    <div className="mb-6 space-y-2">
      <label className="block text-sm font-bold text-slate-300">
        {t(language, 'templateEditor.tags')}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        {(template.tags || []).map((tag, idx) => (
          <span
            key={idx}
            className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] text-amber-400"
          >
            {tag}
            <button
              onClick={() =>
                onChange({
                  ...template,
                  tags: (template.tags || []).filter((_, i) => i !== idx),
                })
              }
              className="ml-0.5 text-amber-600 hover:text-red-400"
            >
              x
            </button>
          </span>
        ))}
        <input
          className="w-32 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-[11px] text-slate-200 outline-none focus:border-amber-500"
          placeholder={t(language, 'templateEditor.addTag')}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            const value = (event.target as HTMLInputElement).value.trim();
            if (!value) return;
            onChange({
              ...template,
              tags: [...(template.tags || []), value],
            });
            (event.target as HTMLInputElement).value = '';
          }}
        />
      </div>
    </div>
  </>
);
