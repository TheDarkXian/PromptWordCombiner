import { ProviderType } from '../types';

interface ExecuteModelTextParams {
  providerType: ProviderType;
  apiKey: string;
  baseUrl?: string;
  modelName: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ExecuteModelTextResult {
  output: string;
  rawResponse?: unknown;
}

const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_ANTHROPIC_BASE_URL = 'https://api.anthropic.com';

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const extractOpenAiContent = (content: unknown): string => {
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'text' in item && typeof (item as { text?: unknown }).text === 'string') {
          return (item as { text: string }).text;
        }
        return '';
      })
      .join('\n')
      .trim();
  }
  return '';
};

const extractAnthropicContent = (content: unknown): string => {
  if (!Array.isArray(content)) return '';
  return content
    .map((item) => {
      if (item && typeof item === 'object' && 'type' in item && (item as { type?: unknown }).type === 'text') {
        const text = (item as { text?: unknown }).text;
        return typeof text === 'string' ? text : '';
      }
      return '';
    })
    .join('\n')
    .trim();
};

const runOpenAiCompatible = async ({
  apiKey,
  baseUrl,
  modelName,
  systemPrompt,
  userPrompt,
  temperature,
  maxTokens,
}: ExecuteModelTextParams): Promise<ExecuteModelTextResult> => {
  const endpoint = `${trimTrailingSlash(baseUrl?.trim() || DEFAULT_OPENAI_BASE_URL)}/chat/completions`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelName,
      ...(temperature !== undefined ? { temperature } : {}),
      ...(maxTokens !== undefined ? { max_tokens: maxTokens } : {}),
      messages: [
        ...(systemPrompt.trim() ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.message ||
      `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  const content = extractOpenAiContent(data?.choices?.[0]?.message?.content);
  if (!content) {
    throw new Error('模型返回了空结果。');
  }

  return {
    output: content,
    rawResponse: data,
  };
};

const runAnthropic = async ({
  apiKey,
  baseUrl,
  modelName,
  systemPrompt,
  userPrompt,
  temperature,
  maxTokens,
}: ExecuteModelTextParams): Promise<ExecuteModelTextResult> => {
  const normalizedBaseUrl = trimTrailingSlash(baseUrl?.trim() || DEFAULT_ANTHROPIC_BASE_URL);
  const endpoint = normalizedBaseUrl.endsWith('/v1/messages')
    ? normalizedBaseUrl
    : normalizedBaseUrl.endsWith('/v1')
      ? `${normalizedBaseUrl}/messages`
      : `${normalizedBaseUrl}/v1/messages`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: modelName,
      max_tokens: maxTokens ?? 2048,
      ...(temperature !== undefined ? { temperature } : {}),
      ...(systemPrompt.trim() ? { system: systemPrompt } : {}),
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.message ||
      `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  const content = extractAnthropicContent(data?.content);
  if (!content) {
    throw new Error('模型返回了空结果。');
  }

  return {
    output: content,
    rawResponse: data,
  };
};

export const executeModelText = async (params: ExecuteModelTextParams): Promise<ExecuteModelTextResult> => {
  switch (params.providerType) {
    case 'openai':
    case 'deepseek':
    case 'openai_compatible':
      return runOpenAiCompatible(params);
    case 'anthropic':
      return runAnthropic(params);
    default:
      throw new Error(`当前版本暂不支持 ${params.providerType} 执行。`);
  }
};
