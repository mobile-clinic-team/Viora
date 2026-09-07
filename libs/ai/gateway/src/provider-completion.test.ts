import assert from 'node:assert/strict';
import test from 'node:test';
import { createAuthenticatedRequestContext, createUnauthenticatedRequestContext } from '../../../platform/context/src/index.ts';
import { DefaultAiProviderCompletionPort, type AiProviderCompletionAuditRecord, type AiProviderCompletionClient } from './provider-completion.ts';

const context = createAuthenticatedRequestContext({ requestId: 'r', correlationId: 'c', userId: 'u', subject: 's', tenantId: 't', membershipId: 'm' });

function make(provider: AiProviderCompletionClient) {
  const records: AiProviderCompletionAuditRecord[] = [];
  return { port: new DefaultAiProviderCompletionPort(provider, { async record(record) { records.push(record); } }, { maxPromptCharacters: 20, maxOutputBytes: 20 }), records };
}

test('completion port validates context, bounds output, and records metadata only', async () => {
  const { port, records } = make({ async complete() { return { text: 'safe', providerRequestId: 'req-1', providerConversationId: 'conv-1' }; } });
  assert.deepEqual(await port.complete({ prompt: 'hello' }, context), { ok: true, text: 'safe', providerRequestId: 'req-1', providerConversationId: 'conv-1' });
  assert.equal(records[0].outcome, 'ALLOWED');
  assert.equal('prompt' in records[0], false);
  assert.equal('response' in records[0], false);
});

test('completion port fails closed for invalid context, oversized output, and provider failure', async () => {
  const invalid = make({ async complete() { throw new Error('must not call'); } });
  assert.deepEqual(await invalid.port.complete({ prompt: 'hello' }, createUnauthenticatedRequestContext('r', 'c')), { ok: false, reason: 'INVALID_CONTEXT' });

  const oversized = make({ async complete() { return { text: '123456789012345678901', providerRequestId: null, providerConversationId: null }; } });
  assert.deepEqual(await oversized.port.complete({ prompt: 'hello' }, context), { ok: false, reason: 'OUTPUT_REJECTED' });

  const unavailable = make({ async complete() { throw Object.assign(new Error('hidden'), { code: 'UNAVAILABLE' }); } });
  assert.deepEqual(await unavailable.port.complete({ prompt: 'hello' }, context), { ok: false, reason: 'UNAVAILABLE' });
  assert.equal(unavailable.records.at(-1)?.errorCode, 'UNAVAILABLE');
});
