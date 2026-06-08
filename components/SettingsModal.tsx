import React, { useEffect, useState } from 'react';
import { Button } from './Button';
import { getVersion } from '@tauri-apps/api/app';
import { ModelPreset, ProviderConfig, ProviderType } from '../types';
import { RECOMMENDED_MODEL_PRESETS, RECOMMENDED_PROVIDER_CONFIGS } from '../services/dataCompatibility';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  uiScale: number;
  setUiScale: (val: any) => void;
  fontSize: string;
  setFontSize: (val: any) => void;
  providerConfigs: ProviderConfig[];
  modelPresets: ModelPreset[];
  onProviderConfigsChange: (providers: ProviderConfig[]) => void;
  onModelPresetsChange: (models: ModelPreset[]) => void;
  initialTab?: 'interface' | 'ai';
}

declare const __APP_VERSION__: string;

const PROVIDER_TYPES: Array<{ value: ProviderType; label: string }> = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'openai_compatible', label: 'OpenAI Compatible' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  uiScale,
  setUiScale,
  fontSize,
  setFontSize,
  providerConfigs,
  modelPresets,
  onProviderConfigsChange,
  onModelPresetsChange,
  initialTab = 'interface',
}) => {
  const [appVersion, setAppVersion] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'interface' | 'ai'>('interface');

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      try {
        setAppVersion(__APP_VERSION__);
      } catch (e) {
        getVersion()
          .then(v => setAppVersion(v))
          .catch(() => setAppVersion('Unknown'));
      }
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const addProvider = () => {
    const now = Date.now();
    onProviderConfigsChange([
      ...providerConfigs,
      {
        id: `provider_${now}`,
        label: '新提供商',
        providerType: 'deepseek',
        apiKey: '',
        baseUrl: '',
        enabled: false,
      },
    ]);
  };

  const updateProvider = (id: string, updates: Partial<ProviderConfig>) => {
    onProviderConfigsChange(providerConfigs.map(provider => {
      if (provider.id !== id) return provider;
      const next = { ...provider, ...updates };
      if ('apiKey' in updates && !next.apiKey.trim()) next.enabled = false;
      return next;
    }));
  };

  const deleteProvider = (id: string) => {
    if (modelPresets.some(model => model.providerConfigId === id)) return;
    onProviderConfigsChange(providerConfigs.filter(provider => provider.id !== id));
  };

  const addModelPreset = () => {
    const now = Date.now();
    onModelPresetsChange([
      ...modelPresets,
      {
        id: `model_${now}`,
        label: '新模型预设',
        providerConfigId: providerConfigs[0]?.id || '',
        modelName: '',
        enabled: true,
      },
    ]);
  };

  const updateModelPreset = (id: string, updates: Partial<ModelPreset>) => {
    onModelPresetsChange(modelPresets.map(model => model.id === id ? { ...model, ...updates } : model));
  };

  const addRecommendedPresets = () => {
    const existingProviderIds = new Set(providerConfigs.map(provider => provider.id));
    const existingModelIds = new Set(modelPresets.map(model => model.id));
    const existingModels = new Set(modelPresets.map(model => `${model.providerConfigId}:${model.modelName}`));

    onProviderConfigsChange([
      ...providerConfigs.map(provider => {
        const recommended = RECOMMENDED_PROVIDER_CONFIGS.find(item => item.id === provider.id);
        return recommended && !provider.baseUrl?.trim()
          ? { ...provider, baseUrl: recommended.baseUrl }
          : provider;
      }),
      ...RECOMMENDED_PROVIDER_CONFIGS
        .filter(provider => !existingProviderIds.has(provider.id))
        .map(provider => ({ ...provider })),
    ]);
    onModelPresetsChange([
      ...modelPresets,
      ...RECOMMENDED_MODEL_PRESETS
        .filter(model => !existingModelIds.has(model.id) && !existingModels.has(`${model.providerConfigId}:${model.modelName}`))
        .map(model => ({ ...model })),
    ]);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-8 py-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
          <div className="flex items-center gap-5">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest">全局环境配置</h3>
            <div className="flex rounded-xl border border-slate-800 bg-slate-950 p-1">
              {[
                { key: 'interface', label: '界面' },
                { key: 'ai', label: '文本模型' },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as 'interface' | 'ai')}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${activeTab === tab.key ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-5 h-5">
              <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0-1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
            </svg>
          </button>
        </div>

        <div className="p-8 overflow-y-auto space-y-8">
          {activeTab === 'interface' ? (
            <>
              <div className="space-y-4">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">UI 整体缩放比例</label>
                <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
                  {[8, 11, 14, 16, 18, 19, 22].map((scale) => (
                    <button
                      key={scale}
                      onClick={() => setUiScale(scale)}
                      className={`py-2.5 text-[10px] font-bold rounded-xl border transition-all ${uiScale === scale ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20 scale-[1.02]' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                    >
                      {scale === 16 ? '100%' : `${Math.round(scale / 16 * 100)}%`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">内容排版密度</label>
                <div className="flex bg-slate-950 p-1.5 rounded-xl border border-slate-800 shadow-inner max-w-md">
                  {[
                    { label: '紧凑', value: 'text-xs' },
                    { label: '标准', value: 'text-sm' },
                    { label: '舒适', value: 'text-base' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setFontSize(opt.value)}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${fontSize === opt.value ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-200">提供商</h4>
                    <p className="mt-1 text-xs text-slate-500">配置 API Key、Base URL 和启用状态。</p>
                  </div>
                  <Button size="sm" onClick={addProvider}>新增</Button>
                </div>

                {providerConfigs.length === 0 && <div className="rounded-xl border border-dashed border-slate-800 p-4 text-xs text-slate-600">还没有提供商。</div>}
                <div className="space-y-4">
                  {providerConfigs.map(provider => {
                    const inUse = modelPresets.some(model => model.providerConfigId === provider.id);
                    const hasApiKey = Boolean(provider.apiKey.trim());
                    return (
                      <div key={provider.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
                        <div className="flex gap-2">
                          <input value={provider.label} onChange={e => updateProvider(provider.id, { label: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500" placeholder="提供商名称" />
                          <button onClick={() => deleteProvider(provider.id)} disabled={inUse} title={inUse ? '已有模型预设使用该提供商' : '删除提供商'} className="px-3 rounded-lg border border-slate-800 text-xs text-slate-500 hover:text-red-400 disabled:opacity-30">删除</button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <select value={provider.providerType} onChange={e => updateProvider(provider.id, { providerType: e.target.value as ProviderType })} className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500">
                            {PROVIDER_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                          </select>
                          <button
                            onClick={() => updateProvider(provider.id, { enabled: !provider.enabled })}
                            disabled={!hasApiKey}
                            title={hasApiKey ? '切换提供商启用状态' : '填写 API Key 后才能启用'}
                            className={`rounded-lg border px-3 py-2 text-sm font-bold ${!hasApiKey ? 'border-slate-800 bg-slate-950 text-slate-600 cursor-not-allowed' : provider.enabled ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-950 text-slate-400'}`}
                          >
                            {!hasApiKey ? '缺少 API Key' : provider.enabled ? '已启用' : '已禁用'}
                          </button>
                        </div>
                        <input type="password" autoComplete="off" value={provider.apiKey} onChange={e => updateProvider(provider.id, { apiKey: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500" placeholder="API Key" />
                        <input value={provider.baseUrl || ''} onChange={e => updateProvider(provider.id, { baseUrl: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500" placeholder="Base URL，可留空使用默认地址" />
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-200">模型预设</h4>
                    <p className="mt-1 text-xs text-slate-500">模板模型变量会绑定到这里的具体模型。</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={addRecommendedPresets} className="px-3 py-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 text-[11px] font-bold text-blue-300 hover:bg-blue-600 hover:text-white transition-colors">
                      添加推荐预设
                    </button>
                    <Button size="sm" onClick={addModelPreset} disabled={providerConfigs.length === 0}>新增</Button>
                  </div>
                </div>

                {modelPresets.length === 0 && <div className="rounded-xl border border-dashed border-slate-800 p-4 text-xs text-slate-600">还没有模型预设。</div>}
                <div className="space-y-4">
                  {modelPresets.map(model => {
                    const provider = providerConfigs.find(item => item.id === model.providerConfigId);
                    const providerAvailable = Boolean(provider?.enabled && provider.apiKey.trim());
                    return (
                    <div key={model.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
                      <div className="flex gap-2">
                        <input value={model.label} onChange={e => updateModelPreset(model.id, { label: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500" placeholder="模型预设名称" />
                        <button onClick={() => onModelPresetsChange(modelPresets.filter(item => item.id !== model.id))} className="px-3 rounded-lg border border-slate-800 text-xs text-slate-500 hover:text-red-400">删除</button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <select value={model.providerConfigId} onChange={e => updateModelPreset(model.id, { providerConfigId: e.target.value })} className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500">
                          {providerConfigs.map(provider => <option key={provider.id} value={provider.id}>{provider.label}</option>)}
                        </select>
                        <button
                          onClick={() => updateModelPreset(model.id, { enabled: !model.enabled })}
                          disabled={!providerAvailable}
                          title={providerAvailable ? '切换模型启用状态' : '先配置并启用所属提供商'}
                          className={`rounded-lg border px-3 py-2 text-sm font-bold ${!providerAvailable ? 'border-slate-800 bg-slate-950 text-slate-600 cursor-not-allowed' : model.enabled ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-950 text-slate-400'}`}
                        >
                          {!providerAvailable ? '提供商不可用' : model.enabled ? '已启用' : '已禁用'}
                        </button>
                      </div>
                      <input value={model.modelName} onChange={e => updateModelPreset(model.id, { modelName: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500" placeholder="模型名称，例如 deepseek-chat / gpt-4.1-mini" />
                    </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )}

          <div className="pt-4 border-t border-slate-800/50 flex justify-between items-center">
             <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">当前版本</span>
             <span className="text-xs font-mono text-slate-400 bg-slate-950 px-2 py-1 rounded border border-slate-800">{appVersion || 'Loading...'}</span>
          </div>
        </div>

        <div className="px-8 py-5 bg-slate-900/30 border-t border-slate-800 flex justify-end">
          <Button variant="primary" size="md" onClick={onClose} className="w-full md:w-auto font-black tracking-widest px-10">
            保存并返回
          </Button>
        </div>
      </div>
    </div>
  );
};
