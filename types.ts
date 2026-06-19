
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
  stepOutputMeta?: Record<string, StepOutputMeta>;
  stepStructuredOutputs?: Record<string, unknown>;
  stepRunLogs?: Record<string, StepRunLog[]>;
  stepOverrides: Record<string, StepOverride>;
  variables?: ProjectVariable[];
  variableTables?: unknown[];
}

export interface StepOverride {
  content?: string;
}

export interface StepOutputMeta {
  updatedAt?: number;
  source?: 'manual' | 'ai';
  modelPresetId?: string;
  modelName?: string;
  providerType?: ProviderType;
  truncated?: boolean;
}

export interface StepRunLog {
  id: string;
  createdAt: number;
  status: 'success' | 'error';
  modelPresetId?: string;
  modelName?: string;
  providerType?: ProviderType;
  prompt: string;
  output?: string;
  error?: string;
  truncated?: boolean;
}

export interface ProjectVariable {
  id: string;
  key: string;
  label: string;
  type: 'text' | string;
  value: string;
  sourceType?: 'template_input' | 'local_input' | string;
  sourceRef?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface BackupData {
  projects: Project[];
  templates: Template[];
  settings?: Partial<AppSettings>;
  exportDate?: string;
  version?: string;
}

export type ProviderType = 'openai' | 'deepseek' | 'openai_compatible';

export interface ProviderConfig {
  id: string;
  label: string;
  providerType: ProviderType;
  apiKey: string;
  baseUrl?: string;
  enabled: boolean;
}

export interface ModelPreset {
  id: string;
  label: string;
  providerConfigId: string;
  modelName: string;
  enabled: boolean;
}

export interface TemplateModelRef {
  id: string;
  label: string;
  modelPresetId?: string;
}

export interface VariableExtractionPreset {
  id: string;
  name: string;
  sourceInputId?: string;
  targetInputIds: string[];
  modelRefId?: string;
  instruction?: string;
}

export interface StepExecutionConfig {
  enabled: boolean;
  modelRefId?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  outputTarget?: 'stepOutput' | 'templateInput';
  outputInputId?: string;
  skipBatchWhenOutputExists?: boolean;
}

export interface AppSettings {
  providerConfigs: ProviderConfig[];
  modelPresets: ModelPreset[];
  templateGroups: TemplateGroup[];
}

export type SortKey = 'lastModified' | 'createdAt' | 'name';
export type TemplateSortKey = 'name' | 'lastModified' | 'createdAt' | 'projectCount' | 'stepCount';
export interface TemplateTableColumnWidths {
  visibility: number;
  name: number;
  stats: number;
  projectCount: number;
  createdAt: number;
  lastModifiedAt: number;
  actions: number;
}
export type LibrarySelection = 'all-projects' | 'recent-projects' | 'all-templates' | 'ungrouped-templates' | `group:${string}` | `template:${string}`;

export interface TemplateGroup {
  id: string;
  name: string;
  order: number;
  parentId?: string;
}

export interface Template {
  id: string;
  name: string;
  groupId?: string;
  order?: number;
  createdAt?: number;
  lastModifiedAt?: number;
  projectNameRule?: TemplateProjectNameRule;
  inputs: TemplateInput[];
  modelRefs?: TemplateModelRef[];
  extractionPresets?: VariableExtractionPreset[];
  steps: TemplateStep[];
  hideProjects?: boolean; // 文件库项目可见性；true 时隐藏该模板下的项目
}

export interface TemplateProjectNameRule {
  inputId: string;
  prefix?: string;
}

export interface TemplateInput {
  id: string;
  label: string;
  defaultValue?: string;
  isConst?: boolean;
  extractionDescription?: string;
  extractionDisabled?: boolean;
}

export interface VariableExtractionResult {
  inputId: string;
  value: string | null;
  source: 'rule' | 'ai' | 'unresolved';
  status: 'ready' | 'conflict' | 'unresolved' | 'error';
  message?: string;
}

export interface TemplateStep {
  id: string;
  name: string;
  description?: string;
  content: string;
  showInPromptOverview?: boolean;
  execution?: StepExecutionConfig;
}
