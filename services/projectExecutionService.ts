import { appendStepRunLog, upsertVariable } from '../domain/projectDomain';
import { interpolateStepBody } from './interpolationService';
import { resolveStepExecutionAvailability } from './modelService';
import { getStepOutputs } from './stepVariablePortsService';
import { resolveConnectedValueByKey, resolveTextValueByKey } from './stepConnectionValueService';
import {
  parseStepOutputVariablesFromResponse,
  shouldParseStepOutputsDirectly,
} from './stepOutputParseService';
import {
  AppSettings,
  Project,
  ProjectVariable,
  ProjectVariableTable,
  StepRunLog,
  StepStructuredParseSummary,
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

const buildReturnFormatInstruction = (step: TemplateStep): string => {
  const outputs = getStepOutputs(step);
  if (outputs.length === 0 || !shouldParseStepOutputsDirectly(outputs)) return '';

  const lines = outputs.map((output) => {
    if (output.type === 'table') {
      const columns = (output.tableSchema?.columns || []).map((column) => column.key).join(', ');
      return `- ${output.key}: 表，必须是数组；每一行是对象，只包含这些字段：${columns || '无字段'}`;
    }
    return `- ${output.key}: 文本`;
  });

  return [
    '请严格按 JSON 对象返回，不要添加 Markdown 代码块或额外说明。',
    'JSON 对象的 key 必须与返回值名称完全一致。',
    '返回值声明：',
    ...lines,
  ].join('\n');
};

const appendSystemInstruction = (systemPrompt: string, instruction: string): string => {
  if (!instruction.trim()) return systemPrompt;
  return [systemPrompt.trim(), instruction.trim()].filter(Boolean).join('\n\n');
};

const parseNumberLiteral = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const resolveMathOperand = (project: Project, template: Template, step: TemplateStep, raw: string): number => {
  const literal = parseNumberLiteral(raw);
  if (literal !== undefined) return literal;
  const value = resolveTextValueByKey(raw, project, template, step);
  if (value === undefined) {
    throw new Error(`数学节点找不到输入变量：${raw}`);
  }
  const parsed = parseNumberLiteral(value);
  if (parsed === undefined) {
    throw new Error(`数学节点输入不是数字：${raw}`);
  }
  return parsed;
};

const makeLocalLogBase = (step: TemplateStep, userPrompt: string): Omit<StepRunLog, 'status' | 'output' | 'error'> => ({
  id: `run_${Date.now()}`,
  createdAt: Date.now(),
  providerType: 'openai_compatible',
  providerLabel: 'Local',
  modelName: step.kind || 'local',
  modelLabel:
    step.kind === 'math_operation'
      ? 'Math operation'
      : step.kind === 'table_row'
        ? 'Table row'
        : 'Variable',
  systemPrompt: '',
  userPrompt,
  rawResponse: undefined,
});

export const isLocalExecutableStep = (step: TemplateStep) =>
  step.kind === 'variable' || step.kind === 'math_operation' || step.kind === 'table_row';

export const executeLocalProjectStep = ({
  project,
  template,
  stepId,
}: {
  project: Project;
  template: Template;
  stepId: string;
}): { project: Project; result: { output: string; structuredParse: StepStructuredParseSummary } } => {
  const step = template.steps.find((item) => item.id === stepId);
  if (!step) throw new Error('The requested step could not be found.');

  const now = Date.now();
  let outputKey = '';
  let output = '';
  let userPrompt = '';

  if (step.kind === 'variable') {
    const name = step.variable?.name?.trim() || '';
    outputKey = step.variable?.outputKey?.trim() || `${step.id}:value`;
    if (!name || !outputKey) throw new Error('变量节点需要填写变量名。');
    const inputKey = step.variable?.inputKey?.trim();
    const existingValue = inputKey
      ? resolveTextValueByKey(inputKey, project, template, step)
      : resolveTextValueByKey(name, project, template, step);
    const hasDefaultValue = step.variable?.defaultValue !== undefined;
    if (existingValue === undefined && !hasDefaultValue) {
      throw new Error(`变量节点没有找到输入值，也没有默认值：${inputKey || name}`);
    }
    output = existingValue !== undefined ? existingValue : step.variable?.defaultValue || '';
    userPrompt = `variable ${inputKey || name} -> ${outputKey}`;
  } else if (step.kind === 'math_operation') {
    const leftKey = step.math?.leftKey?.trim() || '';
    const rightKey = step.math?.rightKey?.trim() || '';
    outputKey = step.math?.outputKey?.trim() || `${step.id}:result`;
    if (!leftKey || !rightKey || !outputKey) throw new Error('数学节点需要填写输入 A、输入 B 和输出端。');
    const left = resolveMathOperand(project, template, step, leftKey);
    const right = resolveMathOperand(project, template, step, rightKey);
    const operation = step.math?.operation || 'add';
    if (operation === 'divide' && right === 0) throw new Error('数学节点不能除以 0。');
    const result =
      operation === 'subtract'
        ? left - right
        : operation === 'multiply'
          ? left * right
          : operation === 'divide'
            ? left / right
            : left + right;
    output = String(result);
    userPrompt = `${leftKey} ${operation} ${rightKey} -> ${outputKey}`;
  } else if (step.kind === 'table_row') {
    const tableKey = step.tableRow?.tableKey?.trim() || '';
    if (!tableKey) throw new Error('表行节点需要连接一张表。');

    const resolved = resolveConnectedValueByKey(tableKey, project, template, step);
    if (resolved.missing || !resolved.tableValue) {
      throw new Error(`表行节点找不到表变量：${tableKey}`);
    }

    const rowIndexRaw = step.tableRow?.rowIndex?.trim() || '1';
    const rowIndexValue = parseNumberLiteral(rowIndexRaw) ?? parseNumberLiteral(resolveTextValueByKey(rowIndexRaw, project, template, step) || '');
    if (rowIndexValue === undefined || rowIndexValue < 1 || !Number.isInteger(rowIndexValue)) {
      throw new Error('表行节点行号必须是大于 0 的整数。');
    }

    const row = resolved.tableValue.rows[rowIndexValue - 1];
    if (!row) throw new Error(`表行节点找不到第 ${rowIndexValue} 行。`);

    const declaredOutputs = getStepOutputs(step);
    const fallbackOutputs = resolved.tableValue.columns.map((column) => ({
      key: column.key,
      label: column.label || column.key,
      type: 'text' as const,
    }));
    const outputs = declaredOutputs.length > 0 ? declaredOutputs : fallbackOutputs;
    const rowOutput = outputs.reduce<Record<string, string>>((cells, item) => {
      cells[item.key] = row.cells[item.key] || '';
      return cells;
    }, {});
    output = JSON.stringify(rowOutput, null, 2);
    userPrompt = `table ${tableKey} row ${rowIndexValue}`;

    const logBase = makeLocalLogBase(step, userPrompt);
    const nextProject = applyProjectStepSuccess({
      project,
      step: declaredOutputs.length > 0 ? step : { ...step, outputs },
      output,
      logBase,
    });

    return {
      project: nextProject,
      result: {
        output,
        structuredParse: {
          status: 'not_applicable',
          message: 'Table row selected.',
        },
      },
    };
  } else {
    throw new Error('This is not a local executable node.');
  }

  const previous = (project.variables || []).find(
    (variable) => variable.sourceType === 'step_output' && variable.sourceRef === step.id && variable.key === outputKey
  );
  const nextVariable: ProjectVariable = {
    id: previous?.id || `var_step_${step.id}_${outputKey}`,
    key: outputKey,
    label: outputKey,
    type: 'text',
    value: output,
    sourceType: 'step_output',
    sourceRef: step.id,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
  };
  const logBase = makeLocalLogBase(step, userPrompt);
  const nextProject = applyProjectStepSuccess({
    project: {
      ...project,
      variables: upsertVariable(project.variables || [], nextVariable),
    },
    step,
    output,
    logBase,
  });

  return {
    project: nextProject,
    result: {
      output,
      structuredParse: {
        status: 'not_applicable',
        message: 'Local node executed.',
      },
    },
  };
};

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
  const interpolation = interpolateStepBody(step.id, rawContent, project, template);
  if (interpolation.diagnostics.length > 0) {
    throw new Error(interpolation.diagnostics[0].message);
  }
  const userPrompt = interpolation.text.trim();
  const systemPrompt = appendSystemInstruction(
    step.execution?.systemPrompt || '',
    buildReturnFormatInstruction(step)
  );
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
