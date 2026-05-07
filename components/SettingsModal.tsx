import React, { useEffect, useRef, useState } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import {
  AppSettings,
  ExecutionPresetModelRefStrategy,
  ExecutionPresetTemplate,
  ModelCatalogItem,
  ProviderConfig,
  ProviderType,
  UiLanguage,
} from '../types';
import { Button } from './Button';
import { testProviderConnectivity } from '../services/apiConnectivityService';
import { t } from '../services/i18n';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onChange: (updates: Partial<AppSettings>) => void;
  onDeleteProvider: (providerId: string) => void;
  onDeleteModelCatalogItem: (modelCatalogItemId: string) => void;
  onDeleteExecutionPresetTemplate: (executionPresetTemplateId: string) => void;
}

interface TestState {
  status: 'idle' | 'testing' | 'success' | 'error';
  message: string;
  latencyMs?: number;
}

declare const __APP_VERSION__: string;

const PROVIDER_TYPE_OPTIONS: Array<{ value: ProviderType; label: string }> = [
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai_compatible', label: 'OpenAI Compatible' },
];

const LANGUAGE_OPTIONS: Array<{ value: UiLanguage; labelKey: 'settings.languageZh' | 'settings.languageEn' }> = [
  { value: 'zh-CN', labelKey: 'settings.languageZh' },
  { value: 'en-US', labelKey: 'settings.languageEn' },
];

const createProviderConfig = (): ProviderConfig => ({
  id: `provider_${Date.now()}`,
  label: 'New Provider',
  providerType: 'deepseek',
  apiKey: '',
  baseUrl: '',
  enabled: true,
});

const createModelCatalogItem = (providerConfigs: ProviderConfig[]): ModelCatalogItem => ({
  id: `model_${Date.now()}`,
  label: 'New Model',
  providerConfigId: providerConfigs[0]?.id || '',
  modelName: '',
  enabled: true,
});

const EXECUTION_PRESET_MODEL_REF_STRATEGY_OPTIONS: Array<{
  value: ExecutionPresetModelRefStrategy;
  label: string;
}> = [
  { value: 'keep_current', label: '保留当前模型' },
  { value: 'bind_specific_model_catalog_item', label: '记录指定模型目录项' },
];

const createExecutionPresetTemplate = (): ExecutionPresetTemplate => {
  const now = Date.now();
  return {
    id: `execution_preset_${now}`,
    label: '新执行模板',
    description: '',
    modelRefStrategy: 'keep_current',
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onChange,
  onDeleteProvider,
  onDeleteModelCatalogItem,
  onDeleteExecutionPresetTemplate,
}) => {
  const [appVersion, setAppVersion] = useState<string>('');
  const [providerTests, setProviderTests] = useState<Record<string, TestState>>({});

  useEffect(() => {
    if (!isOpen) return;

    try {
      setAppVersion(__APP_VERSION__);
    } catch {
      getVersion()
        .then((version) => setAppVersion(version))
        .catch(() => setAppVersion('Unknown'));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const updateProviderConfigs = (providerConfigs: ProviderConfig[]) => onChange({ providerConfigs });
  const updateModelCatalog = (modelCatalog: ModelCatalogItem[]) => onChange({ modelCatalog });
  const updateExecutionPresetTemplates = (executionPresetTemplates: ExecutionPresetTemplate[]) =>
    onChange({ executionPresetTemplates });

  const updateProvider = (providerId: string, updates: Partial<ProviderConfig>) => {
    updateProviderConfigs(
      settings.providerConfigs.map((provider) =>
        provider.id === providerId ? { ...provider, ...updates } : provider
      )
    );
  };

  const updateModelCatalogItem = (itemId: string, updates: Partial<ModelCatalogItem>) => {
    updateModelCatalog(
      settings.modelCatalog.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item
      )
    );
  };

  const addProvider = () => updateProviderConfigs([...settings.providerConfigs, createProviderConfig()]);
  const addModelCatalogItem = () =>
    updateModelCatalog([...settings.modelCatalog, createModelCatalogItem(settings.providerConfigs)]);
  const addExecutionPresetTemplate = () =>
    updateExecutionPresetTemplates([...settings.executionPresetTemplates, createExecutionPresetTemplate()]);

  const updateExecutionPresetTemplate = (
    executionPresetTemplateId: string,
    updates: Partial<ExecutionPresetTemplate>
  ) => {
    updateExecutionPresetTemplates(
      settings.executionPresetTemplates.map((item) =>
        item.id === executionPresetTemplateId
          ? {
              ...item,
              ...updates,
              updatedAt: Date.now(),
              modelCatalogItemId:
                (updates.modelRefStrategy || item.modelRefStrategy) === 'bind_specific_model_catalog_item'
                  ? updates.modelCatalogItemId ?? item.modelCatalogItemId
                  : undefined,
            }
          : item
      )
    );
  };

  const handleTestConnectivity = async (provider: ProviderConfig) => {
    setProviderTests((prev) => ({ ...prev, [provider.id]: { status: 'testing', message: '娴嬭瘯涓?..' } }));
    try {
      const result = await testProviderConnectivity(provider);
      setProviderTests((prev) => ({
        ...prev,
        [provider.id]: {
          status: result.success ? 'success' : 'error',
          message: result.message,
          latencyMs: result.latencyMs,
        },
      }));
    } catch {
      setProviderTests((prev) => ({
        ...prev,
        [provider.id]: { status: 'error', message: '娴嬭瘯寮傚父' },
      }));
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-8 py-5">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.3em] text-white">App Settings</h3>
            <p className="mt-1 text-xs text-slate-500">Manage UI preferences, provider credentials, model catalog items, and execution presets.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-800 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-5 w-5">
              <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0-1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
            </svg>
          </button>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-6 overflow-y-auto p-8 xl:grid-cols-[0.9fr_1.1fr_1.1fr]">
          <section className="space-y-6 rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
            <div>
              <h4 className="text-sm font-bold text-slate-200">Interface</h4>
              <p className="mt-1 text-xs text-slate-500">These settings only affect this device and local workspace presentation.</p>
            </div>

            <div className="space-y-3">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {t(settings.language, 'settings.language')}
              </label>
              <div className="flex rounded-xl border border-slate-800 bg-slate-950 p-1.5 shadow-inner">
                {LANGUAGE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => onChange({ language: option.value })}
                    className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
                      settings.language === option.value
                        ? 'bg-slate-800 text-white shadow-lg'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {t(settings.language, option.labelKey)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">UI 缂╂斁</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { scale: 8, label: '50%' },
                  { scale: 11, label: '70%' },
                  { scale: 14, label: '85%' },
                  { scale: 16, label: '100%' },
                  { scale: 18, label: '112%' },
                  { scale: 19, label: '120%' },
                  { scale: 22, label: '138%' },
                ].map((option) => (
                  <button
                    key={option.scale}
                    onClick={() => onChange({ uiScale: option.scale })}
                    className={`rounded-xl border py-2.5 text-[10px] font-bold transition-all ${
                      settings.uiScale === option.scale
                        ? 'scale-[1.02] border-blue-500 bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                        : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">瀛楀彿瀵嗗害</label>
              <div className="flex rounded-xl border border-slate-800 bg-slate-950 p-1.5 shadow-inner">
                {[
                  { value: 'text-xs', label: '绱у噾' },
                  { value: 'text-sm', label: '鏍囧噯' },
                  { value: 'text-base', label: '鑸掑睍' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => onChange({ fontSize: option.value as AppSettings['fontSize'] })}
                    className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
                      settings.fontSize === option.value
                        ? 'bg-slate-800 text-white shadow-lg'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-800 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">褰撳墠鐗堟湰</span>
                <span className="rounded border border-slate-800 bg-slate-950 px-2 py-1 font-mono text-xs text-slate-400">
                  {appVersion || 'Loading...'}
                </span>
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-200">Providers</h4>
                <p className="mt-1 text-xs text-slate-500">Configure API keys, base URLs, and enable state for each provider.</p>
              </div>
              <Button size="sm" onClick={addProvider}>
                Add provider
              </Button>
            </div>
            <div className="space-y-4">
              {settings.providerConfigs.map((provider) => (
                <div key={provider.id} className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <input
                      value={provider.label}
                      onChange={(event) => updateProvider(provider.id, { label: event.target.value })}
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
                        onChange={(event) =>
                          updateProvider(provider.id, { providerType: event.target.value as ProviderType })
                        }
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                      >
                        {PROVIDER_TYPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2">
                      <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">Enabled</span>
                      <button
                        onClick={() => updateProvider(provider.id, { enabled: !provider.enabled })}
                        className={`w-full rounded-lg border px-3 py-2 text-sm font-bold transition-colors ${
                          provider.enabled
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                            : 'border-slate-700 bg-slate-950 text-slate-400'
                        }`}
                      >
                        {provider.enabled ? "Enabled" : "Disabled"}
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
                        onChange={(event) => updateProvider(provider.id, { apiKey: event.target.value })}
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                        placeholder="sk-..."
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleTestConnectivity(provider)}
                        disabled={providerTests[provider.id]?.status === 'testing'}
                      >
                        {providerTests[provider.id]?.status === "testing" ? "Testing..." : "Test"}
                      </Button>
                    </div>
                    {providerTests[provider.id] && providerTests[provider.id]?.status !== 'idle' && providerTests[provider.id]?.status !== 'testing' && (
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
                      onChange={(event) => updateProvider(provider.id, { baseUrl: event.target.value })}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                      placeholder="https://api.example.com/v1"
                    />
                  </label>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-200">Model Catalog</h4>
                <p className="mt-1 text-xs text-slate-500">Template model refs choose concrete models from this catalog.</p>
              </div>
              <Button size="sm" onClick={addModelCatalogItem} disabled={settings.providerConfigs.length === 0}>
                Add model
              </Button>
            </div>

            <div className="space-y-4">
              {settings.modelCatalog.map((item) => (
                <div key={item.id} className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <input
                      value={item.label}
                      onChange={(event) => updateModelCatalogItem(item.id, { label: event.target.value })}
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
                        onChange={(event) => updateModelCatalogItem(item.id, { providerConfigId: event.target.value })}
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                      >
                        {settings.providerConfigs.map((provider) => (
                          <option key={provider.id} value={provider.id}>
                            {provider.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2">
                      <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">Enabled</span>
                      <button
                        onClick={() => updateModelCatalogItem(item.id, { enabled: !item.enabled })}
                        className={`w-full rounded-lg border px-3 py-2 text-sm font-bold transition-colors ${
                          item.enabled
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                            : 'border-slate-700 bg-slate-950 text-slate-400'
                        }`}
                      >
                        {item.enabled ? "Enabled" : "Disabled"}
                      </button>
                    </label>
                  </div>

                  <label className="space-y-2">
                    <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">Model Name</span>
                    <input
                      value={item.modelName}
                      onChange={(event) => updateModelCatalogItem(item.id, { modelName: event.target.value })}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                      placeholder="gpt-4.1"
                    />
                  </label>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-200">执行模板库</h4>
                <p className="mt-1 text-xs text-slate-500">集中保存可复用的执行参数和 system prompt 方案。</p>
              </div>
              <Button size="sm" onClick={addExecutionPresetTemplate}>
                新增模板
              </Button>
            </div>

            <div className="space-y-4">
              {settings.executionPresetTemplates.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 px-4 py-5 text-xs text-slate-500">
                  暂无执行模板。你可以先在这里创建模板，也可以稍后从模板步骤里直接保存当前执行配置。
                </div>
              ) : (
                settings.executionPresetTemplates.map((executionPresetTemplate) => (
                  <div
                    key={executionPresetTemplate.id}
                    className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <input
                        value={executionPresetTemplate.label}
                        onChange={(event) =>
                          updateExecutionPresetTemplate(executionPresetTemplate.id, { label: event.target.value })
                        }
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                        placeholder="执行模板名称"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDeleteExecutionPresetTemplate(executionPresetTemplate.id)}
                      >
                        删除
                      </Button>
                    </div>

                    <textarea
                      value={executionPresetTemplate.description || ''}
                      onChange={(event) =>
                        updateExecutionPresetTemplate(executionPresetTemplate.id, {
                          description: event.target.value,
                        })
                      }
                      className="min-h-[72px] w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                      placeholder="备注说明（可选）"
                    />

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          模型策略
                        </span>
                        <select
                          value={executionPresetTemplate.modelRefStrategy}
                          onChange={(event) =>
                            updateExecutionPresetTemplate(executionPresetTemplate.id, {
                              modelRefStrategy: event.target.value as ExecutionPresetModelRefStrategy,
                            })
                          }
                          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                        >
                          {EXECUTION_PRESET_MODEL_REF_STRATEGY_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-2">
                        <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          启用状态
                        </span>
                        <button
                          onClick={() =>
                            updateExecutionPresetTemplate(executionPresetTemplate.id, {
                              enabled: !executionPresetTemplate.enabled,
                            })
                          }
                          className={`w-full rounded-lg border px-3 py-2 text-sm font-bold transition-colors ${
                            executionPresetTemplate.enabled
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                              : 'border-slate-700 bg-slate-950 text-slate-400'
                          }`}
                        >
                          {executionPresetTemplate.enabled ? '已启用' : '已禁用'}
                        </button>
                      </label>
                    </div>

                    {executionPresetTemplate.modelRefStrategy === 'bind_specific_model_catalog_item' && (
                      <label className="space-y-2">
                        <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          绑定模型目录项
                        </span>
                        <select
                          value={executionPresetTemplate.modelCatalogItemId || ''}
                          onChange={(event) =>
                            updateExecutionPresetTemplate(executionPresetTemplate.id, {
                              modelCatalogItemId: event.target.value || undefined,
                            })
                          }
                          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                        >
                          <option value="">选择模型目录项</option>
                          {settings.modelCatalog.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.label}
                              {!item.enabled ? ' [已禁用]' : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          Temperature
                        </span>
                        <input
                          type="number"
                          min="0"
                          max="2"
                          step="0.1"
                          value={executionPresetTemplate.temperature ?? ''}
                          onChange={(event) =>
                            updateExecutionPresetTemplate(executionPresetTemplate.id, {
                              temperature: event.target.value === '' ? undefined : Number(event.target.value),
                            })
                          }
                          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                          placeholder="留空使用默认值"
                        />
                      </label>

                      <label className="space-y-2">
                        <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          Max Tokens
                        </span>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={executionPresetTemplate.maxTokens ?? ''}
                          onChange={(event) =>
                            updateExecutionPresetTemplate(executionPresetTemplate.id, {
                              maxTokens: event.target.value === '' ? undefined : Number(event.target.value),
                            })
                          }
                          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                          placeholder="留空使用默认值"
                        />
                      </label>
                    </div>

                    <label className="space-y-2">
                      <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        System Prompt
                      </span>
                      <textarea
                        value={executionPresetTemplate.systemPrompt || ''}
                        onChange={(event) =>
                          updateExecutionPresetTemplate(executionPresetTemplate.id, {
                            systemPrompt: event.target.value,
                          })
                        }
                        className="min-h-[120px] w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
                        placeholder="留空表示不覆盖当前步骤的 system prompt"
                      />
                    </label>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="flex justify-end border-t border-slate-800 bg-slate-900/30 px-8 py-5">
          <Button variant="primary" size="md" onClick={onClose} className="min-w-36 font-black tracking-widest">
            瀹屾垚
          </Button>
        </div>
      </div>
    </div>
  );
};
