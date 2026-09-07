import type { RequestContext } from '../../../platform/context/src/index.ts';

export interface AiProviderCompletionRequest {
  readonly prompt: string;
  readonly conversationId?: string;
  readonly signal?: AbortSignal;
}

export interface AiProviderCompletionResponse {
  readonly text: string;
  readonly providerRequestId: string | null;
  readonly providerConversationId: string | null;
}

export interface AiProviderCompletionClient {
  complete(input: AiProviderCompletionRequest & { readonly context: RequestContext }): Promise<AiProviderCompletionResponse>;
}

export type AiProviderCompletionFailure =
  | 'INVALID_CONTEXT'
  | 'INVALID_INPUT'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'UNAVAILABLE'
  | 'INVALID_RESPONSE'
  | 'OUTPUT_REJECTED';

export type AiProviderCompletionResult =
  | { readonly ok: true; readonly text: string; readonly providerRequestId: string | null; readonly providerConversationId: string | null }
  | { readonly ok: false; readonly reason: AiProviderCompletionFailure };

export interface AiProviderCompletionAuditRecord {
  readonly operation: 'ai_completion';
  readonly context: RequestContext;
  readonly outcome: 'ALLOWED' | 'FAILURE' | 'DENIED';
  readonly providerRequestId?: string | null;
  readonly providerConversationId?: string | null;
  readonly errorCode?: AiProviderCompletionFailure;
}

export interface AiProviderCompletionAuditRecorder {
  record(record: AiProviderCompletionAuditRecord): Promise<void>;
}

export interface AiProviderCompletionOptions {
  readonly maxPromptCharacters: number;
  readonly maxOutputBytes: number;
}

function authenticated(context: RequestContext): boolean {
  return Boolean(
    context?.requestId?.trim() &&
    context?.correlationId?.trim() &&
    context?.actor?.userId?.trim() &&
    context?.actor?.subject?.trim() &&
    context?.tenant?.tenantId?.trim() &&
    context?.tenant?.membershipId?.trim(),
  );
}

function outputSize(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

function providerFailure(error: unknown): AiProviderCompletionFailure {
  if (typeof error !== 'object' || error === null || !('code' in error)) return 'UNAVAILABLE';
  const code = (error as { readonly code?: unknown }).code;
  return code === 'TIMEOUT' || code === 'CANCELLED' || code === 'UNAVAILABLE' || code === 'INVALID_RESPONSE'
    ? code
    : 'UNAVAILABLE';
}

export class DefaultAiProviderCompletionPort {
  private readonly provider: AiProviderCompletionClient;
  private readonly audit: AiProviderCompletionAuditRecorder;
  private readonly options: AiProviderCompletionOptions;

  public constructor(
    provider: AiProviderCompletionClient,
    audit: AiProviderCompletionAuditRecorder,
    options: AiProviderCompletionOptions,
  ) {
    this.provider = provider;
    this.audit = audit;
    this.options = options;
    if (!Number.isInteger(options.maxPromptCharacters) || options.maxPromptCharacters < 1) throw new Error('invalid completion limits');
    if (!Number.isInteger(options.maxOutputBytes) || options.maxOutputBytes < 1) throw new Error('invalid completion limits');
  }

  public async complete(
    request: AiProviderCompletionRequest,
    context: RequestContext,
  ): Promise<AiProviderCompletionResult> {
    const deny = async (reason: AiProviderCompletionFailure): Promise<AiProviderCompletionResult> => {
      await this.audit.record({ operation: 'ai_completion', context, outcome: 'DENIED', errorCode: reason });
      return { ok: false, reason };
    };

    if (!authenticated(context)) return deny('INVALID_CONTEXT');
    if (!request || typeof request.prompt !== 'string' || !request.prompt.trim()) return deny('INVALID_INPUT');
    if (request.prompt.length > this.options.maxPromptCharacters) return deny('INVALID_INPUT');

    try {
      const response = await this.provider.complete({ ...request, context });
      if (typeof response.text !== 'string' || !response.text.trim()) {
        await this.audit.record({ operation: 'ai_completion', context, outcome: 'FAILURE', errorCode: 'INVALID_RESPONSE' });
        return { ok: false, reason: 'INVALID_RESPONSE' };
      }
      if (outputSize(response.text) > this.options.maxOutputBytes) {
        await this.audit.record({ operation: 'ai_completion', context, outcome: 'FAILURE', errorCode: 'OUTPUT_REJECTED' });
        return { ok: false, reason: 'OUTPUT_REJECTED' };
      }
      await this.audit.record({
        operation: 'ai_completion', context, outcome: 'ALLOWED',
        providerRequestId: response.providerRequestId,
        providerConversationId: response.providerConversationId,
      });
      return { ok: true, ...response };
    } catch (error) {
      const reason = providerFailure(error);
      await this.audit.record({ operation: 'ai_completion', context, outcome: 'FAILURE', errorCode: reason });
      return { ok: false, reason };
    }
  }
}
