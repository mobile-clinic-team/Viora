import type { RequestContext } from '../../../platform/context/src/index.ts';

export interface AiProviderRequest {
  readonly context: RequestContext;
  readonly prompt: string;
  readonly conversationId?: string;
  readonly signal?: AbortSignal;
}

export interface AiProviderResponse {
  readonly text: string;
  readonly providerRequestId: string | null;
  readonly providerConversationId: string | null;
}

export interface AiProviderClient {
  complete(input: AiProviderRequest): Promise<AiProviderResponse>;
}

export interface DifySecretProvider {
  getApiKey(): string | Promise<string>;
}

export interface DifyClientConfig {
  readonly baseUrl: string;
  readonly secret: DifySecretProvider;
  readonly timeoutMs: number;
  readonly maxPromptCharacters: number;
  readonly fetch?: typeof fetch;
}

export type AiProviderErrorCode = 'INVALID_INPUT' | 'TIMEOUT' | 'CANCELLED' | 'UNAVAILABLE' | 'INVALID_RESPONSE';

export class AiProviderError extends Error {
  public readonly code: AiProviderErrorCode;
  public constructor(code: AiProviderErrorCode) {
    super(code);
    this.name = 'AiProviderError';
    this.code = code;
  }
}

function required(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new AiProviderError('INVALID_INPUT');
  return value.trim();
}

function authenticated(context: RequestContext): boolean {
  return Boolean(context?.actor?.userId?.trim() && context?.tenant?.tenantId?.trim() && context.requestId?.trim() && context.correlationId?.trim());
}

export class DifyAiProvider implements AiProviderClient {
  private readonly baseUrl: string;
  private readonly secret: DifySecretProvider;
  private readonly timeoutMs: number;
  private readonly maxPromptCharacters: number;
  private readonly request: typeof fetch;

  public constructor(config: DifyClientConfig) {
    this.baseUrl = required(config.baseUrl, 'baseUrl').replace(/\/$/, '');
    this.secret = config.secret;
    this.timeoutMs = config.timeoutMs;
    this.maxPromptCharacters = config.maxPromptCharacters;
    this.request = config.fetch ?? fetch;
    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs < 1 || this.timeoutMs > 120_000) throw new AiProviderError('INVALID_INPUT');
    if (!Number.isInteger(this.maxPromptCharacters) || this.maxPromptCharacters < 1) throw new AiProviderError('INVALID_INPUT');
    try { new URL(this.baseUrl); } catch { throw new AiProviderError('INVALID_INPUT'); }
  }

  public async complete(input: AiProviderRequest): Promise<AiProviderResponse> {
    const prompt = required(input.prompt, 'prompt');
    if (!authenticated(input.context) || prompt.length > this.maxPromptCharacters) throw new AiProviderError('INVALID_INPUT');
    if (input.signal?.aborted) throw new AiProviderError('CANCELLED');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const cancel = () => controller.abort();
    input.signal?.addEventListener('abort', cancel, { once: true });
    try {
      const apiKey = required(await this.secret.getApiKey(), 'apiKey');
      const response = await this.request(`${this.baseUrl}/v1/chat-messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputs: {}, query: prompt, response_mode: 'blocking', user: input.context.actor!.userId,
          ...(input.conversationId ? { conversation_id: input.conversationId } : {}),
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw new AiProviderError('UNAVAILABLE');
      const body = await response.json() as { answer?: unknown; message_id?: unknown; conversation_id?: unknown };
      if (typeof body.answer !== 'string' || !body.answer.trim()) throw new AiProviderError('INVALID_RESPONSE');
      return { text: body.answer, providerRequestId: typeof body.message_id === 'string' ? body.message_id : null, providerConversationId: typeof body.conversation_id === 'string' ? body.conversation_id : null };
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      if (input.signal?.aborted) throw new AiProviderError('CANCELLED');
      if (error instanceof DOMException && error.name === 'AbortError') throw new AiProviderError('TIMEOUT');
      throw new AiProviderError('UNAVAILABLE');
    } finally {
      clearTimeout(timer);
      input.signal?.removeEventListener('abort', cancel);
    }
  }
}
