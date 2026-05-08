import React from 'react';
import { ModelCatalogItem, TemplateModelRef, UiLanguage } from '../../types';
import { t } from '../../services/i18n';
import { Button } from '../Button';

interface TemplateModelRefsPanelProps {
  language: UiLanguage;
  modelRefs: TemplateModelRef[];
  modelCatalog: ModelCatalogItem[];
  onAdd: () => void;
  onUpdate: (index: number, updates: Partial<TemplateModelRef>) => void;
  onRemove: (index: number) => void;
}

export const TemplateModelRefsPanel: React.FC<TemplateModelRefsPanelProps> = ({
  language,
  modelRefs,
  modelCatalog,
  onAdd,
  onUpdate,
  onRemove,
}) => (
  <section className="border-t border-slate-800 pt-6">
    <div className="mb-4 flex items-center justify-between">
      <h3 className="text-lg font-bold text-slate-200">
        {t(language, 'templateEditor.modelRefSection')}
      </h3>
      <Button size="sm" onClick={onAdd}>
        {t(language, 'templateEditor.add')}
      </Button>
    </div>
    <p className="mb-4 text-xs text-slate-500">
      {t(language, 'templateEditor.modelRefHelp')}
    </p>
    <div className="space-y-3">
      {modelRefs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-800 px-3 py-3 text-xs text-slate-500">
          {t(language, 'templateEditor.noModelRef')}
        </div>
      ) : (
        modelRefs.map((modelRef, index) => {
          const catalogItem = modelCatalog.find(
            (item) => item.id === modelRef.modelCatalogItemId
          );
          return (
            <div
              key={modelRef.id}
              className="relative space-y-2 rounded border border-slate-700 bg-slate-900 p-3"
            >
              <input
                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200"
                value={modelRef.label}
                onChange={(event) => onUpdate(index, { label: event.target.value })}
                placeholder={t(language, 'templateEditor.modelRefName')}
              />
              <select
                value={modelRef.modelCatalogItemId || ''}
                onChange={(event) =>
                  onUpdate(index, {
                    modelCatalogItemId: event.target.value || undefined,
                  })
                }
                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
              >
                <option value="">{t(language, 'templateEditor.unboundModel')}</option>
                {modelCatalog.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                    {!item.enabled
                      ? t(language, 'templateEditor.disabledSuffix')
                      : ''}
                  </option>
                ))}
              </select>
              {modelRef.modelCatalogItemId && !catalogItem && (
                <div className="text-xs text-amber-400">
                  {t(language, 'templateEditor.missingModelItem')}
                </div>
              )}
              {catalogItem && !catalogItem.enabled && (
                <div className="text-xs text-amber-400">
                  {t(language, 'templateEditor.disabledModelItem')}
                </div>
              )}
              <button
                onClick={() => onRemove(index)}
                className="absolute right-1 top-1 p-1 text-slate-600 hover:text-red-400"
              >
                ×
              </button>
            </div>
          );
        })
      )}
    </div>
  </section>
);
