import { ModelPreset, ProviderConfig, TemplateInput, VariableExtractionResult } from '../types';
import { executeTextGeneration } from './aiTextService';

interface FieldTarget {
  input: TemplateInput;
  name: string;
}

export interface RunAiExtractionParams {
  sourceText: string;
  targets: TemplateInput[];
  modelPreset: ModelPreset;
  providerConfig: ProviderConfig;
  instruction?: string;
  signal?: AbortSignal;
}

const normalizeKey = (value: string) => value.trim().toLowerCase();

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const unique = (values: string[]) => Array.from(new Set(values.map(value => value.trim()).filter(Boolean)));

const createTargets = (inputs: TemplateInput[]): FieldTarget[] => inputs.map(input => ({
  input,
  name: input.label.trim(),
}));

const addCandidate = (
  candidates: Record<string, string[]>,
  inputId: string,
  value: unknown
) => {
  if (value === null || value === undefined) return;
  const text = typeof value === 'string' ? value.trim() : String(value).trim();
  if (!text) return;
  candidates[inputId] = unique([...(candidates[inputId] || []), text]);
};

const extractJsonObject = (sourceText: string): Record<string, unknown> | null => {
  const trimmed = sourceText.trim();
  const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [trimmed, codeBlock?.[1]].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // 规则层只处理完整可解析 JSON，其他情况交给字段规则或 AI。
    }
  }

  return null;
};

const extractFromJson = (
  sourceText: string,
  targets: FieldTarget[],
  candidates: Record<string, string[]>
) => {
  const parsed = extractJsonObject(sourceText);
  if (!parsed) return;

  const jsonEntries = Object.entries(parsed);
  targets.forEach(({ input, name }) => {
    const match = jsonEntries.find(([key]) => normalizeKey(name) === normalizeKey(key));
    if (match) {
      const rawValue = typeof match[1] === 'string' ? match[1] : JSON.stringify(match[1]);
      addCandidate(candidates, input.id, `${match[0]}：${rawValue.trim()}`);
    }
  });
};

const extractFromKeyValueLines = (
  sourceText: string,
  targets: FieldTarget[],
  candidates: Record<string, string[]>
) => {
  const lines = sourceText.split(/\r?\n/);
  targets.forEach(({ input, name }) => {
    const namePattern = escapeRegExp(name);
    if (!namePattern) return;
    const pattern = new RegExp(`^\\s*(${namePattern})\\s*([:：=])\\s*(.+?)\\s*$`, 'i');
    lines.forEach(line => {
      const match = line.match(pattern);
      if (match?.[1] && match?.[3]) addCandidate(candidates, input.id, `${match[1].trim()}：${match[3].trim()}`);
    });
  });
};

const extractFromMarkdownHeadings = (
  sourceText: string,
  targets: FieldTarget[],
  candidates: Record<string, string[]>
) => {
  const lines = sourceText.split(/\r?\n/);
  lines.forEach((line, index) => {
    const heading = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*$/);
    if (!heading) return;
    const headingName = normalizeKey(heading[1]);
    const target = targets.find(item => normalizeKey(item.name) === headingName);
    if (!target) return;

    const contentLines: string[] = [];
    for (let i = index + 1; i < lines.length; i += 1) {
      if (/^\s{0,3}#{1,6}\s+/.test(lines[i])) break;
      contentLines.push(lines[i]);
    }
    const content = contentLines.join('\n').trim();
    if (content) addCandidate(candidates, target.input.id, `${heading[1].trim()}：${content}`);
  });
};

export const runRuleExtraction = (
  sourceText: string,
  targets: TemplateInput[]
): VariableExtractionResult[] => {
  const activeTargets = createTargets(targets.filter(input => !input.isConst && !input.extractionDisabled));
  const candidates: Record<string, string[]> = {};

  extractFromJson(sourceText, activeTargets, candidates);
  extractFromKeyValueLines(sourceText, activeTargets, candidates);
  extractFromMarkdownHeadings(sourceText, activeTargets, candidates);

  return activeTargets.map(({ input }) => {
    const values = candidates[input.id] || [];
    if (values.length === 0) {
      return { inputId: input.id, value: null, source: 'unresolved', status: 'unresolved', message: '规则未提取到明确结果。' };
    }
    if (values.length > 1) {
      return { inputId: input.id, value: values[0], source: 'rule', status: 'conflict', message: `发现 ${values.length} 个不同结果，请人工确认。` };
    }
    return { inputId: input.id, value: values[0], source: 'rule', status: 'ready' };
  });
};

export const buildExtractionSystemPrompt = () => `你是一个结构化信息提取工具。

你的任务是根据目标字段列表，从用户提供的原始文本中提取对应内容。

规则：
1. 优先提取原文中明确存在的信息。
2. 可以组合、概括或转换原文已有信息，但不得加入原文没有的信息。
3. 提取结果应保留字段语义标签；如果原文中有“字段名：内容”这类结构，返回值也应包含“字段名：内容”，不要只返回内容部分。
4. 保留对目标字段有价值的细节，不要过度概括。
5. 每个结果只能使用提供的字段 ID。
6. 无法确定的字段返回 null。
7. 只返回符合指定结构的 JSON，不要添加解释、Markdown 或其他内容。`;

export const buildExtractionUserPrompt = (sourceText: string, targets: TemplateInput[], instruction?: string) => {
  const fields = targets.map(input => ({
    id: input.id,
    name: input.label,
    description: input.extractionDescription?.trim() || input.label,
  }));
  const shape = Object.fromEntries(targets.map(input => [input.id, '提取结果或 null']));

  return `请从下面的原始文本中提取目标字段。

${instruction?.trim() ? `本次提取要求：\n${instruction.trim()}\n` : ''}

目标字段：
${JSON.stringify(fields, null, 2)}

原始文本：
<source>
${sourceText}
</source>

请返回：
${JSON.stringify({ values: shape }, null, 2)}`;
};

const parseJsonFromModelOutput = (output: string): unknown => {
  const trimmed = output.trim();
  const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [trimmed, codeBlock?.[1]].filter(Boolean) as string[];
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // 尝试下一个候选。
    }
  }
  throw new Error('AI 返回内容不是有效 JSON。');
};

export const runAiExtraction = async ({
  sourceText,
  targets,
  modelPreset,
  providerConfig,
  instruction,
  signal,
}: RunAiExtractionParams): Promise<VariableExtractionResult[]> => {
  if (targets.length === 0) return [];

  const output = await executeTextGeneration({
    providerType: providerConfig.providerType,
    apiKey: providerConfig.apiKey,
    baseUrl: providerConfig.baseUrl,
    modelName: modelPreset.modelName,
    systemPrompt: buildExtractionSystemPrompt(),
    userPrompt: buildExtractionUserPrompt(sourceText, targets, instruction),
    temperature: 0.2,
    maxTokens: 1200,
    signal,
  });
  if (output.truncated) {
    throw new Error('AI 输出达到长度上限，结构化结果不完整，请提高最大输出长度后重试。');
  }

  const parsed = parseJsonFromModelOutput(output.output);
  const values = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as { values?: unknown }).values
    : null;

  if (!values || typeof values !== 'object' || Array.isArray(values)) {
    throw new Error('AI 返回 JSON 缺少 values 对象。');
  }

  const requestedIds = new Set(targets.map(input => input.id));
  return targets.map(input => {
    const rawValue = (values as Record<string, unknown>)[input.id];
    if (!requestedIds.has(input.id) || rawValue === null || rawValue === undefined) {
      return { inputId: input.id, value: null, source: 'unresolved', status: 'unresolved', message: 'AI 未提取到结果。' };
    }
    if (typeof rawValue !== 'string') {
      return { inputId: input.id, value: null, source: 'ai', status: 'error', message: 'AI 返回的字段值不是字符串。' };
    }
    const text = rawValue.trim();
    if (!text) {
      return { inputId: input.id, value: null, source: 'unresolved', status: 'unresolved', message: 'AI 返回空结果。' };
    }
    return { inputId: input.id, value: text, source: 'ai', status: 'ready' };
  });
};

export const mergeExtractionResults = (
  ruleResults: VariableExtractionResult[],
  aiResults: VariableExtractionResult[]
): VariableExtractionResult[] => {
  const aiByInputId = new Map(aiResults.map(result => [result.inputId, result]));
  return ruleResults.map(ruleResult => {
    if (ruleResult.status === 'ready') return ruleResult;
    const aiResult = aiByInputId.get(ruleResult.inputId);
    return aiResult || ruleResult;
  });
};
