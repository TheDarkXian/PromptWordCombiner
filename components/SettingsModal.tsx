﻿﻿﻿﻿﻿﻿import React, { useEffect, useRef, useState } from 'react';
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
import { ExecutionPresetLibraryPanel } from './settings-modal/ExecutionPresetLibraryPanel';
import { InterfaceSettingsPanel } from './settings-modal/InterfaceSettingsPanel';
import { ModelCatalogPanel } from './settings-modal/ModelCatalogPanel';
import { ProviderSettingsPanel } from './settings-modal/ProviderSettingsPanel';

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
  const _versionLoadRef = useRef(false);
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
    setProviderTests((prev) => ({ ...prev, [provider.id]: { status: 'testing', message: '测试中...' } }));
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
        [provider.id]: { status: 'error', message: '测试异常' },
      }));
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-8 py-5">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.3em] text-white">应用设置</h3>
            <p className="mt-1 text-xs text-slate-500">管理界面偏好、提供商凭据、模型目录和执行模板。</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-800 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-5 w-5">
              <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0-1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
            </svg>
          </button>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-6 overflow-y-auto p-8 xl:grid-cols-2">
          <InterfaceSettingsPanel
            appVersion={appVersion}
            language={settings.language}
            settings={settings}
            languageOptions={LANGUAGE_OPTIONS}
            onChange={onChange}
          />
          <ProviderSettingsPanel
            providerConfigs={settings.providerConfigs}
            providerTests={providerTests}
            providerTypeOptions={PROVIDER_TYPE_OPTIONS}
            onAddProvider={addProvider}
            onUpdateProvider={updateProvider}
            onDeleteProvider={onDeleteProvider}
            onTestConnectivity={handleTestConnectivity}
          />
          <ModelCatalogPanel
            modelCatalog={settings.modelCatalog}
            providerConfigs={settings.providerConfigs}
            onAddModelCatalogItem={addModelCatalogItem}
            onUpdateModelCatalogItem={updateModelCatalogItem}
            onDeleteModelCatalogItem={onDeleteModelCatalogItem}
          />
          <ExecutionPresetLibraryPanel
            executionPresetTemplates={settings.executionPresetTemplates}
            modelCatalog={settings.modelCatalog}
            modelRefStrategyOptions={EXECUTION_PRESET_MODEL_REF_STRATEGY_OPTIONS}
            onAddExecutionPresetTemplate={addExecutionPresetTemplate}
            onUpdateExecutionPresetTemplate={updateExecutionPresetTemplate}
            onDeleteExecutionPresetTemplate={onDeleteExecutionPresetTemplate}
          />
        </div>

        <div className="flex justify-end border-t border-slate-800 bg-slate-900/30 px-8 py-5">
          <Button variant="primary" size="md" onClick={onClose} className="min-w-36 font-black tracking-widest">
            完成
          </Button>
        </div>
      </div>
    </div>
  );
};
