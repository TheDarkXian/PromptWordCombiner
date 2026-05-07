import { ProviderConfig, ProviderType } from '../types';
import { SUPPORTED_EXECUTION_PROVIDERS } from './executionAvailability';

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_ANTHROPIC_BASE_URL = 'https://api.anthropic.com';

interface ConnectivityResult {
  success: boolean;
  message: string;
  latencyMs?: number;
}

function getConnectivityEndpoint(provider: ProviderConfig): { url: string; headers: Record<string, string> } {
  const type = provider.providerType as ProviderType;
  const apiKey = provider.apiKey.trim();

  if (type === 'anthropic') {
    const base = trimTrailingSlash(provider.baseUrl?.trim() || DEFAULT_ANTHROPIC_BASE_URL);
    const url = base.endsWith('/v1')
      ? `${base}/messages`
      : base.endsWith('/v1/messages')
        ? base
        : `${base}/v1/messages`;
    return {
      url,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    };
  }

  const base = trimTrailingSlash(provider.baseUrl?.trim() || DEFAULT_OPENAI_BASE_URL);
  return {
    url: `${base}/models`,
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  };
}

export async function testProviderConnectivity(provider: ProviderConfig): Promise<ConnectivityResult> {
  if (!SUPPORTED_EXECUTION_PROVIDERS.includes(provider.providerType as ProviderType)) {
    return { success: false, message: `暂不支持 ${provider.providerType} 的连通性测试。` };
  }

  if (!provider.apiKey.trim()) {
    return { success: false, message: '请先填写 API Key。' };
  }

  const { url, headers } = getConnectivityEndpoint(provider);
  const start = Date.now();

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });
    const latencyMs = Date.now() - start;

    if (response.ok) {
      return { success: true, message: '连接成功', latencyMs };
    }

    if (response.status === 401 || response.status === 403) {
      return { success: false, message: `认证失败 (${response.status})，请检查 API Key。`, latencyMs };
    }

    return { success: false, message: `请求失败 (${response.status})`, latencyMs };
  } catch (error) {
    const latencyMs = Date.now() - start;
    const message = error instanceof Error ? error.message : '网络连接失败';
    return { success: false, message: `无法连接：${message}`, latencyMs };
  }
}
