import React from 'react';
import { Button } from '../Button';
import { ProviderConfig, ProviderType } from '../../types';

interface TestState {
  status: 'idle' | 'testing' | 'success' | 'error';
  message: string;
  latencyMs?: number;
}

interface ProviderSettingsPanelProps {
  providerConfigs: ProviderConfig[];
  providerTests: Record<string, TestState>;
  providerTypeOptions: Array<{ value: ProviderType; label: string }>;
  onAddProvider: () => void;
  onUpdateProvider: (providerId: string, updates: Partial<ProviderConfig>) => void;
  onDeleteProvider: (providerId: string) => void;
  onTestConnectivity: (provider: ProviderConfig) => void;
}

export const ProviderSettingsPanel: React.FC<ProviderSettingsPanelProps> = ({
  providerConfigs,
  providerTests,
  providerTypeOptions,
  onAddProvider,
  onUpdateProvider,
  onDeleteProvider,
  onTestConnectivity,
}) => (
  <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
    <div className="flex items-center justify-between">
      <div>
        <h4 className="text-sm font-bold text-slate-200">Providers</h4>
        <p className="mt-1 text-xs text-slate-500">Configure API keys, base URLs, and enable state for each provider.</p>
      </div>
      <Button size="sm" onClick={onAddProvider}>
        Add provider
      </Button>
    </div>
    <div className="space-y-4">
      {providerConfigs.map((provider) => (
        <div key={provider.id} className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <input
              value={provider.label}
              onChange={(event) => onUpdateProvider(provider.id, { label: event.target.value })}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
              placeholder="Provider name"
            />
            <Button variant="ghost" size="sm" onClick={() => onDeleteProvider(provider.id)}>
              鍒犻櫎
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="space-y-2">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">绫诲瀷</span>
              <select
                value={provider.providerType}
                onChange={(event) => onUpdateProvider(provider.id, { providerType: event.target.value as ProviderType })}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
              >
                {providerTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">Enabled</span>
              <button
                onClick={() => onUpdateProvider(provider.id, { enabled: !provider.enabled })}
                className={`w-full rounded-lg border px-3 py-2 text-sm font-bold transition-colors ${
                  provider.enabled
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-slate-700 bg-slate-950 text-slate-400'
                }`}
              >
                {provider.enabled ? 'Enabled' : 'Disabled'}
              </button>
            </label>
          </div>

          <label className="space-y-2">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">API Key</span>
            <div className="flex gap-2">
              <input
                type="password"
                autoComplete="off"
                value={provider.apiKey}
                onChange={(event) => onUpdateProvider(provider.id, { apiKey: event.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                placeholder="sk-..."
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onTestConnectivity(provider)}
                disabled={providerTests[provider.id]?.status === 'testing'}
              >
                {providerTests[provider.id]?.status === 'testing' ? 'Testing...' : 'Test'}
              </Button>
            </div>
            {providerTests[provider.id] &&
              providerTests[provider.id]?.status !== 'idle' &&
              providerTests[provider.id]?.status !== 'testing' && (
                <div
                  className={`mt-1 rounded-lg px-3 py-1.5 text-[11px] font-medium ${
                    providerTests[provider.id]?.status === 'success'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}
                >
                  {providerTests[provider.id]?.message}
                  {providerTests[provider.id]?.latencyMs !== undefined && (
                    <span className="ml-2 text-slate-500">({providerTests[provider.id]?.latencyMs}ms)</span>
                  )}
                </div>
              )}
          </label>

          <label className="space-y-2">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">Base URL</span>
            <input
              value={provider.baseUrl || ''}
              onChange={(event) => onUpdateProvider(provider.id, { baseUrl: event.target.value })}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
              placeholder="https://api.example.com/v1"
            />
          </label>
        </div>
      ))}
    </div>
  </section>
);
