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
  stepStructuredOutputs?: Record<string, Record<string, string>>;
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
  | 'structured_step_output'
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

export type ImportEncoding = 'utf-8' | 'gb18030' | 'unknown';

export type ImportPayloadKind =
  | 'backup_bundle'
  | 'projects_array'
  | 'templates_array'
  | 'project_variable_table'
  | 'unknown';

export interface ImportWarningItem {
  code:
    | 'legacy_version'
    | 'encoding_fallback'
    | 'suspicious_garbled_text'
    | 'orphan_project'
    | 'unmapped_model_ref'
    | 'patched_missing_fields';
  level: 'info' | 'warning' | 'error';
  message: string;
  fieldPath?: string;
  preview?: string;
}

export interface ImportMigrationReport {
  fromVersion: string | 'legacy-unknown';
  toVersion: string;
  detectedKind: ImportPayloadKind;
  encoding: ImportEncoding;
  appliedMigrations: string[];
  warnings: ImportWarningItem[];
  stats: {
    projectCount: number;
    templateCount: number;
    orphanProjectCount: number;
    suspiciousTextCount: number;
    patchedFieldCount: number;
    unmappedModelRefCount: number;
  };
  allowForceImport: boolean;
}

export interface PreparedImportBundle {
  projects: Project[];
  templates: Template[];
  report: ImportMigrationReport;
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
  tabOpenMode: 'single' | 'multi';
  uiScale: number;
  sidebarWidth: number;
  isSidebarOpen: boolean;
  templateEditorLeftWidth: number;
  templateBlueprintInspectorWidth: number;
  projectRunnerInspectorWidth: number;
  fontSize: 'text-xs' | 'text-sm' | 'text-base';
  cardScale: number;
  fileLibrarySortBy: SortKey;
  structuredOutputResultView: 'raw' | 'structured';
  projectWorkspaceByTemplateId?: Record<string, ProjectWorkspaceState>;
  providerConfigs: ProviderConfig[];
  modelCatalog: ModelCatalogItem[];
  executionPresetTemplates: ExecutionPresetTemplate[];
}

export interface ProjectWorkspaceState {
  selectedStepIds?: string[];
  blueprintViewport?: TemplateBlueprintViewport;
  activeTool?: 'pan' | 'move';
  minimapCollapsed?: boolean;
  viewMode?: 'compact' | 'detail';
  sidebarTab?: 'vars' | 'preview' | 'nav' | 'build';
  sidebarVariableTab?: 'input' | 'local' | 'result';
  inspectorWidth?: number;
  scenePanelWidth?: number;
  detailsPanelWidth?: number;
  scenePanelVisible?: boolean;
  detailsPanelVisible?: boolean;
  detailsMode?: 'auto' | 'empty' | 'node' | 'multi' | 'edge' | 'canvas';
}

export interface Template {
  id: string;
  name: string;
  inputs: TemplateInput[];
  modelRefs?: TemplateModelRef[];
  steps: TemplateStep[];
  blueprint?: TemplateBlueprint;
  hideProjects?: boolean;
  tags?: string[];
  version?: number;
  history?: Template[];
}

export interface TemplateBlueprintNodePosition {
  x: number;
  y: number;
}

export interface TemplateBlueprintViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface TemplateBlueprint {
  version: 1 | 2;
  nodes: Record<string, TemplateBlueprintNodePosition>;
  viewport?: TemplateBlueprintViewport;
  comments?: TemplateBlueprintCommentBox[];
  selection?: {
    stepIds?: string[];
    edgeKeys?: string[];
    commentIds?: string[];
    expandedPromptStepIds?: string[];
  };
}

export interface TemplateBlueprintCommentBox {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  collapsed?: boolean;
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
  structuredOutputFields?: StructuredOutputFieldDefinition[];
  structuredOutputBindings?: StructuredOutputVariableBinding[];
  execution?: StepExecutionConfig;
  stepType?: StepType;
  autoRunEnabled?: boolean;
}

export interface StructuredOutputFieldDefinition {
  key: string;
  label: string;
  description?: string;
}

export interface StructuredOutputVariableBinding {
  fieldKey: string;
  variableKey: string;
  variableLabel?: string;
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
  | 'waiting_structured_overwrite_confirm'
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
  structuredParseStatus?: StepStructuredParseSummaryStatus;
  structuredParseMessage?: string;
}

export type StructuredParseLifecycleState =
  | 'idle'
  | 'running'
  | 'awaiting_confirm'
  | 'success'
  | 'skipped'
  | 'error';

export type StepStructuredParseSummaryStatus =
  | 'not_applicable'
  | 'success'
  | 'skipped'
  | 'error';

export type StructuredOverwriteDecision = 'overwrite' | 'skip';

export interface StructuredOverwriteConfirmRequest {
  stepId: string;
  stepName: string;
  fieldLabels: string[];
  mode: 'single' | 'automation';
}

export interface StepStructuredParseSummary {
  status: StepStructuredParseSummaryStatus;
  message: string;
  updatedFieldKeys?: string[];
}

export interface ExecuteProjectStepOptions {
  structuredParseMode?: 'single' | 'automation' | 'library_batch';
  onStructuredParseStateChange?: (
    state: StructuredParseLifecycleState,
    message?: string
  ) => void;
  confirmStructuredOverwrite?: (
    request: StructuredOverwriteConfirmRequest
  ) => Promise<StructuredOverwriteDecision>;
}

export interface ExecuteProjectStepResult {
  output: string;
  structuredParse: StepStructuredParseSummary;
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
