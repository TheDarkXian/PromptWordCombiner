import { z } from 'zod';

const variableSourceTypeSchema = z.enum([
  'template_input',
  'project_local',
  'step_output',
  'structured_step_output',
  'derived',
  'manual',
]);

export const projectVariableSchema = z.object({
  id: z.string(),
  key: z.string(),
  label: z.string(),
  value: z.string(),
  sourceType: variableSourceTypeSchema,
  sourceRef: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const stepOutputMetaSchema = z.object({
  updatedAt: z.number(),
  lastSavedToVariableAt: z.number().optional(),
});

const providerTypeSchema = z.enum(['openai', 'anthropic', 'deepseek', 'openai_compatible']);
const uiLanguageSchema = z.enum(['zh-CN', 'en-US']);
const executionPresetModelRefStrategySchema = z.enum(['keep_current', 'bind_specific_model_catalog_item']);

export const stepRunLogSchema = z.object({
  id: z.string(),
  createdAt: z.number(),
  status: z.enum(['success', 'error']),
  providerType: providerTypeSchema,
  providerLabel: z.string(),
  modelName: z.string(),
  modelLabel: z.string(),
  systemPrompt: z.string(),
  userPrompt: z.string(),
  temperature: z.number().optional(),
  maxTokens: z.number().optional(),
  output: z.string(),
  error: z.string(),
  rawResponse: z.unknown().optional(),
});

export const stepOverrideSchema = z.object({
  content: z.string().optional(),
});

export const templateInputSchema = z.object({
  id: z.string(),
  label: z.string(),
  defaultValue: z.string().optional(),
});

export const projectSchema = z.object({
  id: z.string(),
  templateId: z.string(),
  name: z.string(),
  createdAt: z.number(),
  lastModifiedAt: z.number(),
  lastOpenedAt: z.number().optional(),
  inputValues: z.record(z.string(), z.string()),
  customInputs: z.array(templateInputSchema).default([]),
  stepOutputs: z.record(z.string(), z.string()).default({}),
  stepStructuredOutputs: z.record(z.string(), z.record(z.string(), z.string())).default({}),
  stepOutputMeta: z.record(z.string(), stepOutputMetaSchema).default({}),
  stepRunLogs: z.record(z.string(), z.array(stepRunLogSchema)).default({}),
  stepOverrides: z.record(z.string(), stepOverrideSchema).default({}),
  variables: z.array(projectVariableSchema).default([]),
  archived: z.boolean().optional(),
});

export const providerConfigSchema = z.object({
  id: z.string(),
  label: z.string(),
  providerType: providerTypeSchema,
  apiKey: z.string(),
  baseUrl: z.string().optional(),
  enabled: z.boolean(),
});

export const modelCatalogItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  providerConfigId: z.string(),
  modelName: z.string(),
  enabled: z.boolean(),
});

export const executionPresetTemplateSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  modelRefStrategy: executionPresetModelRefStrategySchema,
  modelCatalogItemId: z.string().optional(),
  temperature: z.number().optional(),
  maxTokens: z.number().optional(),
  systemPrompt: z.string().optional(),
  enabled: z.boolean(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const sortKeySchema = z.enum(['lastModified', 'createdAt', 'name']);

export const appSettingsSchema = z.object({
  language: uiLanguageSchema,
  tabOpenMode: z.enum(['single', 'multi']).optional(),
  uiScale: z.number(),
  sidebarWidth: z.number(),
  isSidebarOpen: z.boolean(),
  templateEditorLeftWidth: z.number().optional(),
  templateBlueprintInspectorWidth: z.number().optional(),
  projectRunnerInspectorWidth: z.number().optional(),
  fontSize: z.enum(['text-xs', 'text-sm', 'text-base']),
  cardScale: z.number(),
  fileLibrarySortBy: sortKeySchema,
  structuredOutputResultView: z.enum(['raw', 'structured']).optional(),
  projectWorkspaceByTemplateId: z.record(z.object({
    selectedStepIds: z.array(z.string()).optional(),
    blueprintViewport: z.object({
      x: z.number(),
      y: z.number(),
      zoom: z.number(),
    }).optional(),
    activeTool: z.enum(['pan', 'move']).optional(),
    minimapCollapsed: z.boolean().optional(),
    viewMode: z.enum(['compact', 'detail']).optional(),
    sidebarTab: z.enum(['vars', 'preview', 'nav', 'build']).optional(),
    sidebarVariableTab: z.enum(['input', 'local', 'result']).optional(),
    inspectorWidth: z.number().optional(),
    scenePanelWidth: z.number().optional(),
    detailsPanelWidth: z.number().optional(),
    scenePanelVisible: z.boolean().optional(),
    detailsPanelVisible: z.boolean().optional(),
    detailsMode: z.enum(['auto', 'empty', 'node', 'multi', 'edge', 'canvas']).optional(),
  })).optional(),
  providerConfigs: z.array(providerConfigSchema),
  modelCatalog: z.array(modelCatalogItemSchema),
  executionPresetTemplates: z.array(executionPresetTemplateSchema).optional(),
});

export const stepOutputBindingSchema = z.object({
  variableKey: z.string().optional(),
  variableLabel: z.string().optional(),
});

export const stepExecutionConfigSchema = z.object({
  modelRefId: z.string().optional(),
  systemPrompt: z.string(),
  temperature: z.number().optional(),
  maxTokens: z.number().optional(),
});

export const structuredOutputFieldDefinitionSchema = z.object({
  key: z.string(),
  label: z.string(),
  description: z.string().optional(),
});

export const structuredOutputVariableBindingSchema = z.object({
  fieldKey: z.string(),
  variableKey: z.string(),
  variableLabel: z.string().optional(),
});

export const stepTypeSchema = z.enum(['text_generation', 'manual', 'external']);

export const templateModelRefSchema = z.object({
  id: z.string(),
  label: z.string(),
  modelCatalogItemId: z.string().optional(),
});

export const templateStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  content: z.string(),
  outputBinding: stepOutputBindingSchema.optional(),
  structuredOutputFields: z.array(structuredOutputFieldDefinitionSchema).optional(),
  structuredOutputBindings: z.array(structuredOutputVariableBindingSchema).optional(),
  execution: stepExecutionConfigSchema.optional(),
  stepType: stepTypeSchema.optional(),
  autoRunEnabled: z.boolean().optional(),
});

export const templateSchema = z.object({
  id: z.string(),
  name: z.string(),
  inputs: z.array(templateInputSchema),
  modelRefs: z.array(templateModelRefSchema).optional(),
  steps: z.array(templateStepSchema),
  blueprint: z
    .object({
      version: z.union([z.literal(1), z.literal(2)]),
      nodes: z.record(z.string(), z.object({ x: z.number(), y: z.number() })),
      viewport: z
        .object({
          x: z.number(),
          y: z.number(),
          zoom: z.number(),
        })
        .optional(),
      comments: z
        .array(
          z.object({
            id: z.string(),
            title: z.string(),
            x: z.number(),
            y: z.number(),
            width: z.number(),
            height: z.number(),
            collapsed: z.boolean().optional(),
          })
        )
        .optional(),
      selection: z
        .object({
          stepIds: z.array(z.string()).optional(),
          edgeKeys: z.array(z.string()).optional(),
          commentIds: z.array(z.string()).optional(),
          expandedPromptStepIds: z.array(z.string()).optional(),
        })
        .optional(),
    })
    .optional(),
  hideProjects: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  version: z.number().optional(),
  history: z.array(z.lazy(() => templateSchema)).optional(),
});

export type ValidatedProject = z.infer<typeof projectSchema>;
export type ValidatedAppSettings = z.infer<typeof appSettingsSchema>;
export type ValidatedTemplate = z.infer<typeof templateSchema>;

const backupBundleSchema = z.object({
  projects: z.array(projectSchema),
  templates: z.array(templateSchema),
});

export function validateBackupBundle(
  raw: unknown
): { valid: true; data: { projects: ValidatedProject[]; templates: ValidatedTemplate[] } } | { valid: false; error: string } {
  const result = backupBundleSchema.safeParse(raw);
  if (!result.success) {
    const messages = result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`
    );
    return { valid: false, error: messages.slice(0, 5).join('; ') };
  }
  return {
    valid: true,
    data: result.data as { projects: ValidatedProject[]; templates: ValidatedTemplate[] },
  };
}

export function validateProjectsArray(
  raw: unknown
): { valid: true; data: ValidatedProject[] } | { valid: false; error: string } {
  const result = z.array(projectSchema).safeParse(raw);
  if (!result.success) {
    const messages = result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`
    );
    return { valid: false, error: messages.slice(0, 3).join('; ') };
  }
  return { valid: true, data: result.data };
}

export function validateTemplatesArray(
  raw: unknown
): { valid: true; data: ValidatedTemplate[] } | { valid: false; error: string } {
  const result = z.array(templateSchema).safeParse(raw);
  if (!result.success) {
    const messages = result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`
    );
    return { valid: false, error: messages.slice(0, 3).join('; ') };
  }
  return { valid: true, data: result.data };
}

export function validateSettings(
  raw: unknown
): { valid: true; data: ValidatedAppSettings } | { valid: false; error: string } {
  const result = appSettingsSchema.safeParse(raw);
  if (!result.success) {
    const messages = result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`
    );
    return { valid: false, error: messages.slice(0, 3).join('; ') };
  }
  return { valid: true, data: result.data };
}
