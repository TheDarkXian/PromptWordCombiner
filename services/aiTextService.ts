import { ProviderType } from '../types';

interface ExecuteTextParams {
  providerType: ProviderType;
  apiKey: string;
  baseUrl?: string;
  modelName: string;
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface ExecuteTextResult {
  output: string;
  finishReason?: string;
  truncated?: boolean;
  rawResponse?: unknown;
}

const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';
export const DEFAULT_AI_TEMPERATURE = 0.7;
export const DEFAULT_AI_MAX_TOKENS = 2000;
let activeAiRequestCount = 0;

const updateAiActivity = (delta: number) => {
  activeAiRequestCount = Math.max(0, activeAiRequestCount + delta);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pwc:ai-activity', { detail: activeAiRequestCount }));
  }
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const getBaseUrl = (providerType: ProviderType, baseUrl?: string) => {
  if (baseUrl?.trim()) return baseUrl.trim();
  if (providerType === 'deepseek') return DEFAULT_DEEPSEEK_BASE_URL;
  return DEFAULT_OPENAI_BASE_URL;
};

const extractContent = (content: unknown): string => {
  if (typeof content === 'string') return content.trim();
  if (!Array.isArray(content)) return '';
  return content
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && 'text' in item) {
        const text = (item as { text?: unknown }).text;
        return typeof text === 'string' ? text : '';
      }
      return '';
    })
    .join('\n')
    .trim();
};

const extractResponseOutput = (data: any): string => {
  const choice = data?.choices?.[0];
  return (
    extractContent(choice?.message?.content)
    || extractContent(choice?.text)
    || extractContent(data?.output_text)
  );
};

export const executeTextGeneration = async ({
  providerType,
  apiKey,
  baseUrl,
  modelName,
  systemPrompt = '',
  userPrompt,
  temperature = DEFAULT_AI_TEMPERATURE,
  maxTokens = DEFAULT_AI_MAX_TOKENS,
  signal,
}: ExecuteTextParams): Promise<ExecuteTextResult> => {
  const endpoint = `${trimTrailingSlash(getBaseUrl(providerType, baseUrl))}/chat/completions`;
  updateAiActivity(1);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        temperature,
        max_tokens: maxTokens,
        messages: [
          ...(systemPrompt.trim() ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      const message = data?.error?.message || data?.message || `请求失败：${response.status}`;
      throw new Error(message);
    }

    const output = extractResponseOutput(data);
    const finishReason = data?.choices?.[0]?.finish_reason;
    if (!output) {
      if (finishReason === 'length') {
        throw new Error('模型未返回正文：输出长度已耗尽，请提高“最大输出长度”后重试。');
      }
      throw new Error(`模型请求成功，但没有返回可用正文${finishReason ? `（结束原因：${finishReason}）` : ''}。`);
    }

    return { output, finishReason, truncated: finishReason === 'length', rawResponse: data };
  } finally {
    updateAiActivity(-1);
  }
};
