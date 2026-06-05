import { AppSettings, BackupData, ModelPreset, Project, ProjectVariable, ProviderConfig, Template } from '../types';

const BACKUP_VERSION = '2.1';

export const DEFAULT_APP_SETTINGS: AppSettings = {
  providerConfigs: [],
  modelPresets: [],
};

const asRecord = (value: unknown): Record<string, any> => {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
};

const asArray = <T>(value: unknown): T[] => {
  return Array.isArray(value) ? value as T[] : [];
};

const normalizeProjectVariables = (project: any): ProjectVariable[] => {
  const existingVariables = asArray<ProjectVariable>(project.variables);
  if (existingVariables.length > 0) {
    return existingVariables.map(variable => ({
      ...variable,
      value: variable.value ?? '',
      type: variable.type || 'text',
    }));
  }

  const now = Date.now();
  const inputValues = asRecord(project.inputValues);
  return Object.entries(inputValues).map(([inputId, value]) => ({
    id: `var_${inputId}`,
    key: inputId,
    label: inputId,
    type: 'text',
    value: String(value ?? ''),
    sourceType: 'template_input',
    sourceRef: inputId,
    createdAt: project.createdAt || now,
    updatedAt: project.lastModifiedAt || now,
  }));
};

export const normalizeProject = (project: any): Project => {
  const now = Date.now();
  return {
    ...project,
    id: String(project.id || `proj_${now}`),
    templateId: String(project.templateId || ''),
    name: String(project.name || '未命名项目'),
    createdAt: Number(project.createdAt || now),
    lastModifiedAt: Number(project.lastModifiedAt || project.createdAt || now),
    inputValues: asRecord(project.inputValues),
    customInputs: asArray(project.customInputs),
    stepOutputs: asRecord(project.stepOutputs),
    stepOutputMeta: asRecord(project.stepOutputMeta),
    stepStructuredOutputs: asRecord(project.stepStructuredOutputs),
    stepRunLogs: asRecord(project.stepRunLogs),
    stepOverrides: asRecord(project.stepOverrides),
    variables: normalizeProjectVariables(project),
    variableTables: asArray(project.variableTables),
  };
};

export const normalizeTemplate = (template: any): Template => {
  const now = Date.now();
  return {
    ...template,
    id: String(template.id || `tmpl_${now}`),
    name: String(template.name || '未命名模版'),
    inputs: asArray(template.inputs),
    modelRefs: asArray(template.modelRefs),
    steps: asArray(template.steps),
  };
};

export const normalizeAppSettings = (settings: any): AppSettings => {
  const providerConfigs = asArray<ProviderConfig>(settings?.providerConfigs).map(provider => ({
    ...provider,
    id: String(provider.id || `provider_${Date.now()}`),
    label: String(provider.label || '未命名提供商'),
    providerType: provider.providerType || 'openai_compatible',
    apiKey: String(provider.apiKey || ''),
    baseUrl: provider.baseUrl || '',
    enabled: provider.enabled !== false,
  }));

  const modelPresets = asArray<ModelPreset>(settings?.modelPresets).map(model => ({
    ...model,
    id: String(model.id || `model_${Date.now()}`),
    label: String(model.label || '未命名模型'),
    providerConfigId: String(model.providerConfigId || providerConfigs[0]?.id || ''),
    modelName: String(model.modelName || ''),
    enabled: model.enabled !== false,
  }));

  return { providerConfigs, modelPresets };
};

export const normalizeBackupData = (data: any): BackupData => {
  return {
    ...data,
    projects: asArray(data?.projects).map(normalizeProject),
    templates: asArray(data?.templates).map(normalizeTemplate),
    settings: data?.settings ? normalizeAppSettings(data.settings) : undefined,
    version: data?.version || BACKUP_VERSION,
  };
};

const stripSecretsFromSettings = (settings?: AppSettings): AppSettings | undefined => {
  if (!settings) return undefined;
  return {
    providerConfigs: settings.providerConfigs.map(provider => ({ ...provider, apiKey: '' })),
    modelPresets: settings.modelPresets,
  };
};

export const createBackupData = (projects: Project[], templates: Template[], settings?: AppSettings): BackupData => {
  return {
    projects: projects.map(normalizeProject),
    templates: templates.map(normalizeTemplate),
    settings: stripSecretsFromSettings(settings),
    exportDate: new Date().toISOString(),
    version: BACKUP_VERSION,
  };
};

export const getBackupVersion = () => BACKUP_VERSION;
