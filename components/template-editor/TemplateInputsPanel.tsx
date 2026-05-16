import React from 'react';
import { TemplateInput, UiLanguage } from '../../types';
import { t } from '../../services/i18n';
import { Button } from '../Button';

interface TemplateInputsPanelProps {
  language: UiLanguage;
  inputs: TemplateInput[];
  onAdd: () => void;
  onUpdate: (index: number, updates: Partial<TemplateInput>) => void;
  onRemove: (index: number) => void;
}

export const TemplateInputsPanel: React.FC<TemplateInputsPanelProps> = ({
  language,
  inputs,
  onAdd,
  onUpdate,
  onRemove,
}) => (
  <section>
    <div className="mb-2 flex items-center justify-between">
      <h3 className="text-sm font-bold text-slate-200">
        {t(language, 'templateEditor.inputSection')}
      </h3>
      <Button size="sm" onClick={onAdd}>
        {t(language, 'templateEditor.add')}
      </Button>
    </div>
    <p className="mb-2 text-[11px] leading-snug text-slate-500">
      {t(language, 'templateEditor.inputHelp')}
    </p>
    <div className="space-y-2">
      {inputs.map((input, index) => (
        <div
          key={input.id}
          className="relative rounded border border-slate-700 bg-slate-900 p-2"
        >
          <div className="absolute -left-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-slate-900 bg-emerald-600 text-[10px] font-bold text-white shadow-sm">
            {index}
          </div>
          <div className="mt-1 space-y-2">
            <input
              className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200"
              value={input.label}
              onChange={(event) => onUpdate(index, { label: event.target.value })}
              placeholder={t(language, 'templateEditor.inputName')}
            />
          </div>
          <button
            onClick={() => onRemove(index)}
            className="absolute right-1 top-1 p-1 text-slate-600 hover:text-red-400"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  </section>
);
