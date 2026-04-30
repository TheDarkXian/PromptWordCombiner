export interface Project {
  id: string;
  templateId: string;
  name: string;
  createdAt: number;
  lastModifiedAt: number;
  lastOpenedAt?: number;
  inputValues: Record<string, string>;
  customInputs: TemplateInput[];
  stepOutputs: Record<string, string>;
  stepOutputMeta: Record<string, StepOutputMeta>;
  stepOverrides: Record<string, StepOverride>;
  variables: ProjectVariable[];
}

export interface StepOverride {
  content?: string;
}

export interface StepOutputMeta {
  updatedAt: number;
  lastSavedToVariableAt?: number;
}

export type VariableSourceType =
  | 'template_input'
  | 'project_local'
  | 'step_output'
  | 'derived'
  | 'manual';

export interface ProjectVariable {
  id: string;
  key: string;
  label: string;
  value: string;
  sourceType: VariableSourceType;
  sourceRef?: string;
  createdAt: number;
  updatedAt: number;
}

export type SortKey = 'lastModified' | 'createdAt' | 'name';

export type ProviderType = 'openai' | 'anthropic' | 'gemini' | 'openai_compatible';

export interface ProviderConfig {
  id: string;
  label: string;
  providerType: ProviderType;
  apiKey: string;
  baseUrl?: string;
  enabled: boolean;
}

export interface ModelCatalogItem {
  id: string;
  label: string;
  providerConfigId: string;
  modelName: string;
  enabled: boolean;
}

export interface AppSettings {
  uiScale: number;
  sidebarWidth: number;
  isSidebarOpen: boolean;
  rightPanelWidth: number;
  isRightPanelOpen: boolean;
  fontSize: 'text-xs' | 'text-sm' | 'text-base';
  cardScale: number;
  fileLibrarySortBy: SortKey;
  providerConfigs: ProviderConfig[];
  modelCatalog: ModelCatalogItem[];
}

export interface Template {
  id: string;
  name: string;
  inputs: TemplateInput[];
  modelRefs?: TemplateModelRef[];
  steps: TemplateStep[];
  hideProjects?: boolean;
}

export interface TemplateInput {
  id: string;
  label: string;
  defaultValue?: string;
}

export interface TemplateModelRef {
  id: string;
  label: string;
  modelCatalogItemId?: string;
}

export interface TemplateStep {
  id: string;
  name: string;
  description?: string;
  content: string;
  outputBinding?: StepOutputBinding;
  execution?: StepExecutionConfig;
}

export interface StepOutputBinding {
  variableKey?: string;
  variableLabel?: string;
}

export interface StepExecutionConfig {
  modelRefId?: string;
  systemPrompt: string;
}

export type StepFlowStatus = 'empty' | 'draft' | 'saved' | 'stale';
