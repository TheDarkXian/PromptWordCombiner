import { appendStepRunLog, upsertVariable } from '../domain/projectDomain';
import { createInterpolator } from './interpolationService';
import { resolveStepExecutionAvailability } from './modelService';
import { getStepOutputs } from './stepVariablePortsService';
import { parseStepOutputVariablesFromResponse } from './stepOutputParseService';
import {
  AppSettings,
  Project,
  ProjectVariableTable,
  StepRunLog,
  Template,
  TemplateStep,
} from '../types';

interface PreparedProjectStepExecution {
  project: Project;
  template: Template;
  step: TemplateStep;
  userPrompt: string;
  systemPrompt: string;
  temperature?: number;
  maxTokens?: number;
  logBase: Omit<StepRunLog, 'status' | 'output' | 'error'>;
  providerType: StepRunLog['providerType'];
  apiKey: string;
  baseUrl?: string;
  modelName: string;
}

export const prepareProjectStepExecution = ({
  project,
  template,
  stepId,
  settings,
}: {
  project: Project;
  template: Template;
  stepId: string;
  settings: AppSettings;
}): PreparedProjectStepExecution => {
  const step = template.steps.find((item) => item.id === stepId);
  if (!step) {
    throw new Error('The requested step could not be found.');
  }

  const availability = resolveStepExecutionAvailability({
    step,
    template,
    modelCatalog: settings.modelCatalog,
    providerConfigs: settings.providerConfigs,
  });

  if (
    !availability.isRunnable ||
    !availability.modelCatalogItem ||
    !availability.providerConfig
  ) {
    throw new Error(availability.message);
  }

  const override = project.stepOverrides[step.id];
  const rawContent =
    override?.content !== undefined ? override.content : step.content || '';
  const interpolate = createInterpolator(project, template);
  const userPrompt = interpolate(rawContent).trim();
  const systemPrompt = step.execution?.systemPrompt || '';
  const temperature = step.execution?.temperature;
  const maxTokens = step.execution?.maxTokens;

  if (!userPrompt) {
    throw new Error('The interpolated prompt is empty, so this step cannot run.');
  }

  return {
    project,
    template,
    step,
    userPrompt,
    systemPrompt,
    temperature,
    maxTokens,
    providerType: availability.providerConfig.providerType,
    apiKey: availability.providerConfig.apiKey,
    baseUrl: availability.providerConfig.baseUrl,
    modelName: availability.modelCatalogItem.modelName,
    logBase: {
      id: `run_${Date.now()}`,
      createdAt: Date.now(),
      providerType: availability.providerConfig.providerType,
      providerLabel: availability.providerConfig.label,
      modelName: availability.modelCatalogItem.modelName,
      modelLabel: availability.modelCatalogItem.label,
      systemPrompt,
      userPrompt,
      temperature,
      maxTokens,
      rawResponse: undefined,
    },
  };
};

export const applyProjectStepSuccess = ({
  project,
  step,
  output,
  logBase,
  rawResponse,
}: {
  project: Project;
  step: TemplateStep;
  output: string;
  logBase: Omit<StepRunLog, 'status' | 'output' | 'error'>;
  rawResponse?: unknown;
}): Project => {
  const now = Date.now();
  const nextLog: StepRunLog = {
    ...logBase,
    status: 'success',
    output,
    error: '',
    rawResponse,
  };

  let nextProject: Project = {
    ...project,
    stepOutputs: {
      ...project.stepOutputs,
      [step.id]: output,
    },
    stepOutputMeta: {
      ...project.stepOutputMeta,
      [step.id]: {
        ...(project.stepOutputMeta?.[step.id] || {}),
        updatedAt: now,
      },
    },
    stepRunLogs: {
      ...project.stepRunLogs,
      [step.id]: appendStepRunLog(project.stepRunLogs?.[step.id], nextLog),
    },
  };

  const outputs = getStepOutputs(step);
  const shouldPersistOutputs = outputs.length > 0 && output.trim();
  if (shouldPersistOutputs) {
    const nextVariables = parseStepOutputVariablesFromResponse({
      responseText: output,
      outputs,
      stepId: step.id,
      existingVariables: nextProject.variables || [],
      now,
    });

    nextProject = {
      ...nextProject,
      stepOutputMeta: {
        ...nextProject.stepOutputMeta,
        [step.id]: {
          updatedAt: now,
          ...(nextProject.stepOutputMeta?.[step.id] || {}),
          lastSavedToVariableAt: now,
        },
      },
      variables: nextVariables.reduce(
        (variables, variable) => upsertVariable(variables, variable),
        nextProject.variables || []
      ),
    };

    const tableVariables = nextVariables.filter((variable) => variable.type === 'table' && variable.tableValue);
    if (tableVariables.length > 0) {
      const nextLegacyTables = tableVariables.map<ProjectVariableTable>((variable) => ({
        id: `table_step_${step.id}_${variable.key}`,
        key: variable.key,
        label: variable.label,
        sourceStepId: step.id,
        columns: variable.tableValue?.columns || [],
        rows: variable.tableValue?.rows || [],
        updatedAt: now,
      }));
      const firstTable = tableVariables[0];
      const firstRow = firstTable.tableValue?.rows[0]?.cells || {};
      nextProject = {
        ...nextProject,
        stepStructuredOutputs: {
          ...(nextProject.stepStructuredOutputs || {}),
          [step.id]: {
            ...(nextProject.stepStructuredOutputs?.[step.id] || {}),
            ...firstRow,
          },
        },
        variableTables: [
          ...(nextProject.variableTables || []).filter(
            (table) => !(table.sourceStepId === step.id && tableVariables.some((variable) => variable.key === table.key))
          ),
          ...nextLegacyTables,
        ],
      };
    }
  }

  return nextProject;
};

export const applyProjectStepError = ({
  project,
  stepId,
  logBase,
  message,
}: {
  project: Project;
  stepId: string;
  logBase: Omit<StepRunLog, 'status' | 'output' | 'error'>;
  message: string;
}): Project => ({
  ...project,
  stepRunLogs: {
    ...project.stepRunLogs,
    [stepId]: appendStepRunLog(project.stepRunLogs?.[stepId], {
      ...logBase,
      status: 'error',
      output: '',
      error: message,
    }),
  },
});
