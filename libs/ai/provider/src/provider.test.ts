import assert from 'node:assert/strict';
import test from 'node:test';
import { createAuthenticatedRequestContext } from '../../../platform/context/src/index.ts';
import { AiProviderError, DifyAiProvider } from './index.ts';

const context = createAuthenticatedRequestContext({ requestId: 'r', correlationId: 'c', userId: 'u', subject: 's', tenantId: 't', membershipId: 'm' });

test('Dify adapter sends bounded provider request without exposing secret in payload', async () => {
  let request: RequestInit | undefined;
  const provider = new DifyAiProvider({ baseUrl: 'https://dify.internal', timeoutMs: 1000, maxPromptCharacters: 100, secret: { getApiKey: () => 'secret-value' }, fetch: async (_url, init) => { request = init; return new Response(JSON.stringify({ answer: 'safe answer', message_id: 'm1', conversation_id: 'c1' }), { status: 200 }); } });
  assert.deepEqual(await provider.complete({ context, prompt: 'hello' }), { text: 'safe answer', providerRequestId: 'm1', providerConversationId: 'c1' });
  assert.equal(new Headers(request?.headers).get('authorization'), 'Bearer secret-value');
  assert.equal(String(request?.body).includes('secret-value'), false);
});

test('Dify adapter fails closed on invalid context, provider failure, and malformed response', async () => {
  const make = (response: Response) => new DifyAiProvider({ baseUrl: 'https://dify.internal', timeoutMs: 1000, maxPromptCharacters: 10, secret: { getApiKey: () => 'secret' }, fetch: async () => response });
  await assert.rejects(make(new Response('', { status: 503 })).complete({ context: context, prompt: 'hello' }), (error: AiProviderError) => error.code === 'UNAVAILABLE');
  await assert.rejects(make(new Response(JSON.stringify({}), { status: 200 })).complete({ context, prompt: 'hello' }), (error: AiProviderError) => error.code === 'INVALID_RESPONSE');
  await assert.rejects(make(new Response(JSON.stringify({ answer: 'x' }), { status: 200 })).complete({ context: { ...context, actor: undefined }, prompt: 'hello' }), (error: AiProviderError) => error.code === 'INVALID_INPUT');
});

test('Dify adapter maps timeout, caller cancellation, and secret-provider failures safely', async () => {
  const timeoutProvider = new DifyAiProvider({ baseUrl: 'https://dify.internal', timeoutMs: 1, maxPromptCharacters: 10, secret: { getApiKey: () => 'secret' }, fetch: async (_url, init) => await new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })) });
  await assert.rejects(timeoutProvider.complete({ context, prompt: 'hello' }), (error: AiProviderError) => error.code === 'TIMEOUT');
  const controller = new AbortController();
  controller.abort();
  const cancelledProvider = new DifyAiProvider({ baseUrl: 'https://dify.internal', timeoutMs: 1000, maxPromptCharacters: 10, secret: { getApiKey: () => 'secret' }, fetch: async () => new Response('{}') });
  await assert.rejects(cancelledProvider.complete({ context, prompt: 'hello', signal: controller.signal }), (error: AiProviderError) => error.code === 'CANCELLED');
  const secretFailureProvider = new DifyAiProvider({ baseUrl: 'https://dify.internal', timeoutMs: 1000, maxPromptCharacters: 10, secret: { getApiKey: () => { throw new Error('secret backend detail'); } }, fetch: async () => new Response('{}') });
  await assert.rejects(secretFailureProvider.complete({ context, prompt: 'hello' }), (error: AiProviderError) => error.code === 'UNAVAILABLE');
});
