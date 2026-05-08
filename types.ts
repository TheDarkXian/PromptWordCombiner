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
  stepRunLogs: Record<string, StepRunLog[]>;
  stepOverrides: Record<string, StepOverride>;
  variables: ProjectVariable[];
  archived?: boolean;
}

export interface StepOverride {
  content?: string;
}

export interface StepOutputMeta {
  updatedAt: number;
  lastSavedToVariableAt?: number;
}

export interface StepRunLog {
  id: string;
  createdAt: number;
  status: 'success' | 'error';
  providerType: ProviderType;
  providerLabel: string;
  modelName: string;
  modelLabel: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  output: string;
  error: string;
  rawResponse?: unknown;
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

export type ProviderType = 'openai' | 'anthropic' | 'deepseek' | 'openai_compatible';
export type UiLanguage = 'zh-CN' | 'en-US';

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

export type ExecutionPresetModelRefStrategy = 'keep_current' | 'bind_specific_model_catalog_item';

export interface ExecutionPresetTemplate {
  id: string;
  label: string;
  description?: string;
  modelRefStrategy: ExecutionPresetModelRefStrategy;
  modelCatalogItemId?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AppSettings {
  language: UiLanguage;
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
  executionPresetTemplates: ExecutionPresetTemplate[];
}

export interface Template {
  id: string;
  name: string;
  inputs: TemplateInput[];
  modelRefs?: TemplateModelRef[];
  steps: TemplateStep[];
  hideProjects?: boolean;
  tags?: string[];
  version?: number;
  history?: Template[];
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
  stepType?: StepType;
  autoRunEnabled?: boolean;
}

export type StepType = 'text_generation' | 'manual' | 'external';

export type StepGraphNodeRole = 'producer' | 'consumer' | 'passthrough';

export interface StepGraphNode {
  stepId: string;
  nodeRole: StepGraphNodeRole;
  inputVariableKeys: string[];
  outputVariableKey?: string;
  upstreamStepIds: string[];
  downstreamStepIds: string[];
}

export interface StepGraphEdge {
  fromStepId: string;
  toStepId: string;
  variableKey: string;
}

export interface ProducerCandidate {
  stepId: string;
  stepName: string;
  outputVariableKey: string;
  inputVariableKeys: string[];
  upstreamStepIds: string[];
  downstreamStepIds: string[];
}

export type ProducerPreflightStatus = 'ready' | 'blocked' | 'existing_result' | 'skipped';

export type ProducerRunScope = 'empty_only' | 'changed_only' | 'all';

export interface ProducerPreflightItem {
  stepId: string;
  stepName: string;
  outputVariableKey: string;
  status: ProducerPreflightStatus;
  reason?: string;
  willOverwrite?: boolean;
}

export type ProducerRunResultStatus = 'success' | 'error' | 'skipped' | 'blocked' | 'stopped';

export type ProducerAutomationStepState =
  | 'idle'
  | 'queued'
  | 'running'
  | 'success'
  | 'error'
  | 'skipped'
  | 'blocked'
  | 'stopped';

export interface ProducerRunResultItem {
  stepId: string;
  stepName: string;
  outputVariableKey: string;
  status: ProducerRunResultStatus;
  message: string;
}

export interface StepOutputBinding {
  variableKey?: string;
  variableLabel?: string;
}

export interface StepExecutionConfig {
  modelRefId?: string;
  systemPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

export type StepFlowStatus = 'empty' | 'draft' | 'saved' | 'stale';

export type StepExecutionAvailabilityStatus =
  | 'manual'
  | 'missing_model_ref'
  | 'missing_model_catalog_item'
  | 'model_disabled'
  | 'missing_provider'
  | 'provider_disabled'
  | 'missing_api_key'
  | 'unsupported_provider'
  | 'ready';

export interface StepExecutionAvailability {
  status: StepExecutionAvailabilityStatus;
  label: string;
  message: string;
  isRunnable: boolean;
  modelRef?: TemplateModelRef;
  modelCatalogItem?: ModelCatalogItem;
  providerConfig?: ProviderConfig;
}

export type StepRunState = 'idle' | 'running' | 'success' | 'error';
