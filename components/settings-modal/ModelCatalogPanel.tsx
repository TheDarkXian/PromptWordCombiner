import React from 'react';
import { Button } from '../Button';
import { ModelCatalogItem, ProviderConfig } from '../../types';

interface ModelCatalogPanelProps {
  modelCatalog: ModelCatalogItem[];
  providerConfigs: ProviderConfig[];
  onAddModelCatalogItem: () => void;
  onUpdateModelCatalogItem: (itemId: string, updates: Partial<ModelCatalogItem>) => void;
  onDeleteModelCatalogItem: (itemId: string) => void;
}

export const ModelCatalogPanel: React.FC<ModelCatalogPanelProps> = ({
  modelCatalog,
  providerConfigs,
  onAddModelCatalogItem,
  onUpdateModelCatalogItem,
  onDeleteModelCatalogItem,
}) => (
  <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
    <div className="flex items-center justify-between">
      <div>
        <h4 className="text-sm font-bold text-slate-200">Model Catalog</h4>
        <p className="mt-1 text-xs text-slate-500">Template model refs choose concrete models from this catalog.</p>
      </div>
      <Button size="sm" onClick={onAddModelCatalogItem} disabled={providerConfigs.length === 0}>
        Add model
      </Button>
    </div>

    <div className="space-y-4">
      {modelCatalog.map((item) => (
        <div key={item.id} className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <input
              value={item.label}
              onChange={(event) => onUpdateModelCatalogItem(item.id, { label: event.target.value })}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
              placeholder="Model label"
            />
            <Button variant="ghost" size="sm" onClick={() => onDeleteModelCatalogItem(item.id)}>
              鍒犻櫎
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="space-y-2">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">Provider</span>
              <select
                value={item.providerConfigId}
                onChange={(event) => onUpdateModelCatalogItem(item.id, { providerConfigId: event.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
              >
                {providerConfigs.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">Enabled</span>
              <button
                onClick={() => onUpdateModelCatalogItem(item.id, { enabled: !item.enabled })}
                className={`w-full rounded-lg border px-3 py-2 text-sm font-bold transition-colors ${
                  item.enabled
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-slate-700 bg-slate-950 text-slate-400'
                }`}
              >
                {item.enabled ? 'Enabled' : 'Disabled'}
              </button>
            </label>
          </div>

          <label className="space-y-2">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">Model Name</span>
            <input
              value={item.modelName}
              onChange={(event) => onUpdateModelCatalogItem(item.id, { modelName: event.target.value })}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
              placeholder="gpt-4.1"
            />
          </label>
        </div>
      ))}
    </div>
  </section>
);
