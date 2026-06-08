import { AppSettings, BackupData, ModelPreset, Project, ProjectVariable, ProviderConfig, Template, TemplateInput, TemplateStep } from '../types';

const BACKUP_VERSION = '2.1';

export const RECOMMENDED_PROVIDER_CONFIGS: ProviderConfig[] = [
  {
    id: 'provider_builtin_deepseek',
    label: 'DeepSeek',
    providerType: 'deepseek',
    apiKey: '',
    baseUrl: 'https://api.deepseek.com/v1',
    enabled: false,
  },
  {
    id: 'provider_builtin_openai',
    label: 'OpenAI',
    providerType: 'openai',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    enabled: false,
  },
];

export const RECOMMENDED_MODEL_PRESETS: ModelPreset[] = [
  {
    id: 'model_builtin_deepseek_v4_flash',
    label: 'DeepSeek V4 Flash',
    providerConfigId: 'provider_builtin_deepseek',
    modelName: 'deepseek-v4-flash',
    enabled: true,
  },
  {
    id: 'model_builtin_deepseek_v4_pro',
    label: 'DeepSeek V4 Pro',
    providerConfigId: 'provider_builtin_deepseek',
    modelName: 'deepseek-v4-pro',
    enabled: true,
  },
  {
    id: 'model_builtin_openai_gpt_4_1_mini',
    label: 'OpenAI GPT-4.1 Mini',
    providerConfigId: 'provider_builtin_openai',
    modelName: 'gpt-4.1-mini',
    enabled: true,
  },
  {
    id: 'model_builtin_openai_gpt_4_1',
    label: 'OpenAI GPT-4.1',
    providerConfigId: 'provider_builtin_openai',
    modelName: 'gpt-4.1',
    enabled: true,
  },
];

export const DEFAULT_APP_SETTINGS: AppSettings = {
  providerConfigs: RECOMMENDED_PROVIDER_CONFIGS.map(provider => ({ ...provider })),
  modelPresets: RECOMMENDED_MODEL_PRESETS.map(model => ({ ...model })),
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

const syncProjectVariablesWithTemplates = (projects: Project[], templates: Template[]): Project[] => {
  const templatesById = new Map(templates.map(template => [template.id, template]));

  return projects.map(project => {
    const template = templatesById.get(project.templateId);
    if (!template) return project;

    const existingVariables = asArray<ProjectVariable>(project.variables);
    const existingBySourceRef = new Map(existingVariables.map(variable => [variable.sourceRef, variable]));
    const now = Date.now();

    const templateVariables = template.inputs.map(input => {
      const existing = existingBySourceRef.get(input.id);
      const value = input.isConst ? input.defaultValue || '' : project.inputValues[input.id] || '';
      return {
        ...existing,
        id: existing?.id || `var_${input.id}`,
        key: input.label,
        label: input.label,
        type: existing?.type || 'text',
        value,
        sourceType: 'template_input',
        sourceRef: input.id,
        createdAt: existing?.createdAt || project.createdAt || now,
        updatedAt: project.lastModifiedAt || existing?.updatedAt || now,
      } satisfies ProjectVariable;
    });

    const localVariables = (project.customInputs || []).map(input => {
      const existing = existingBySourceRef.get(input.id);
      return {
        ...existing,
        id: existing?.id || `var_${input.id}`,
        key: input.label,
        label: input.label,
        type: existing?.type || 'text',
        value: project.inputValues[input.id] || '',
        sourceType: 'local_input',
        sourceRef: input.id,
        createdAt: existing?.createdAt || project.createdAt || now,
        updatedAt: project.lastModifiedAt || existing?.updatedAt || now,
      } satisfies ProjectVariable;
    });

    const knownSourceRefs = new Set([...template.inputs, ...(project.customInputs || [])].map(input => input.id));
    const otherVariables = existingVariables.filter(variable => !variable.sourceRef || !knownSourceRefs.has(variable.sourceRef));
    return { ...project, variables: [...templateVariables, ...localVariables, ...otherVariables] };
  });
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
  const inputs = asArray<any>(template.inputs).map((input, index): TemplateInput => ({
    ...input,
    id: String(input?.id || `input_${now}_${index}`),
    label: String(input?.label || `变量${index + 1}`),
    defaultValue: input?.defaultValue !== undefined ? String(input.defaultValue) : undefined,
    isConst: Boolean(input?.isConst),
    extractionDescription: input?.extractionDescription ? String(input.extractionDescription) : undefined,
    extractionDisabled: Boolean(input?.extractionDisabled),
  }));
  const steps = asArray<any>(template.steps).map((step, index): TemplateStep => ({
    ...step,
    id: String(step?.id || `step_${now}_${index}`),
    name: String(step?.name || `步骤${index + 1}`),
    description: step?.description ? String(step.description) : undefined,
    content: String(step?.content || ''),
    execution: step?.execution && typeof step.execution === 'object'
      ? {
          ...step.execution,
          enabled: Boolean(step.execution.modelRefId),
          modelRefId: step.execution.modelRefId || undefined,
          outputTarget: step.execution.outputTarget === 'templateInput' || step.execution.outputInputId
            ? 'templateInput'
            : 'stepOutput',
          outputInputId: step.execution.outputInputId || undefined,
        }
      : undefined,
  }));

  return {
    ...template,
    id: String(template.id || `tmpl_${now}`),
    name: String(template.name || '未命名模版'),
    inputs,
    modelRefs: asArray(template.modelRefs),
    steps,
  };
};

const repairProjectTemplateLinks = (projects: Project[], templates: Template[]): Project[] => {
  const templateIds = new Set(templates.map(template => template.id));

  return projects.map(project => {
    if (templateIds.has(project.templateId)) return project;

    const projectInputIds = new Set(Object.keys(project.inputValues));
    const projectStepIds = new Set([
      ...Object.keys(project.stepOutputs),
      ...Object.keys(project.stepOverrides),
    ]);

    const matches = templates
      .map(template => ({
        template,
        score:
          template.inputs.filter(input => projectInputIds.has(input.id)).length * 2
          + template.steps.filter(step => projectStepIds.has(step.id)).length * 3,
      }))
      .filter(match => match.score > 0)
      .sort((a, b) => b.score - a.score);

    if (matches.length === 0 || matches[0].score === matches[1]?.score) return project;
    return { ...project, templateId: matches[0].template.id };
  });
};

export const normalizeAppSettings = (settings: any): AppSettings => {
  const providerConfigs = asArray<ProviderConfig>(settings?.providerConfigs).map(provider => {
    const apiKey = String(provider.apiKey || '');
    return {
      ...provider,
      id: String(provider.id || `provider_${Date.now()}`),
      label: String(provider.label || '未命名提供商'),
      providerType: provider.providerType || 'openai_compatible',
      apiKey,
      baseUrl: provider.baseUrl || '',
      enabled: Boolean(apiKey.trim()) && provider.enabled !== false,
    };
  });

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
  const templates = asArray(data?.templates).map(normalizeTemplate);
  const projects = syncProjectVariablesWithTemplates(
    repairProjectTemplateLinks(asArray(data?.projects).map(normalizeProject), templates),
    templates
  );

  return {
    ...data,
    projects,
    templates,
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
  const normalizedTemplates = templates.map(normalizeTemplate);
  const normalizedProjects = syncProjectVariablesWithTemplates(projects.map(normalizeProject), normalizedTemplates);
  return {
    projects: normalizedProjects,
    templates: normalizedTemplates,
    settings: stripSecretsFromSettings(settings),
    exportDate: new Date().toISOString(),
    version: BACKUP_VERSION,
  };
};

export const getBackupVersion = () => BACKUP_VERSION;
