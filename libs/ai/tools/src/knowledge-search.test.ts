import assert from 'node:assert/strict';
import test from 'node:test';
import { createAuthenticatedRequestContext, createUnauthenticatedRequestContext } from '../../../platform/context/src/index.ts';
import { TenantScopedKnowledgeSearch, type KnowledgeSearchCandidate } from './index.ts';

const context = createAuthenticatedRequestContext({
  requestId: 'request-rag', correlationId: 'correlation-rag', userId: 'user-a', subject: 'subject-a',
  tenantId: 'tenant-a', membershipId: 'membership-a',
});

const candidates: KnowledgeSearchCandidate[] = [
  { documentId: 'doc-a', chunkId: 'chunk-a', tenantId: 'tenant-a', status: 'APPROVED', title: 'A', source: 'source-a', snippet: 'approved tenant A' },
  { documentId: 'doc-draft', chunkId: 'chunk-draft', tenantId: 'tenant-a', status: 'DRAFT', title: 'Draft', source: 'source-draft', snippet: 'must not appear' },
  { documentId: 'doc-b', chunkId: 'chunk-b', tenantId: 'tenant-b', status: 'APPROVED', title: 'B', source: 'source-b', snippet: 'must not appear' },
];

function makeSearch(sourceCandidates = candidates, permission = true) {
  const audits: Array<{ outcome: string; resultCount: number }> = [];
  const search = new TenantScopedKnowledgeSearch(
    { async search() { return sourceCandidates; } },
    { canSearch() { return permission; } },
    { async record(input) { audits.push({ outcome: input.outcome, resultCount: input.resultCount }); } },
  );
  return { search, audits };
}

test('RAG retrieval fails closed without authenticated context', async () => {
  const { search } = makeSearch();
  assert.deepEqual(await search.search(createUnauthenticatedRequestContext('r', 'c'), { query: 'patient' }), { kind: 'DENIED', reason: 'INVALID_CONTEXT' });
});

test('RAG retrieval requires explicit permission', async () => {
  const { search } = makeSearch(candidates, false);
  assert.deepEqual(await search.search(context, { query: 'patient' }), { kind: 'DENIED', reason: 'MISSING_PERMISSION' });
});

test('RAG retrieval filters tenant and status before returning results', async () => {
  const { search } = makeSearch();
  const result = await search.search(context, { query: 'patient', limit: 20 });
  assert.deepEqual(result, {
    kind: 'RESULTS',
    results: [{ documentId: 'doc-a', chunkId: 'chunk-a', title: 'A', source: 'source-a', snippet: 'approved tenant A' }],
  });
});

test('RAG retrieval bounds query, result count, and snippets', async () => {
  const { search } = makeSearch([{ ...candidates[0], snippet: '123456789' }, { ...candidates[0], chunkId: 'chunk-2' }]);
  const result = await search.search(context, { query: ' patient ', limit: 1 });
  assert.deepEqual(result, {
    kind: 'RESULTS',
    results: [{ documentId: 'doc-a', chunkId: 'chunk-a', title: 'A', source: 'source-a', snippet: '123456789' }],
  });
  assert.deepEqual(await search.search(context, { query: 'x'.repeat(2_001) }), { kind: 'INVALID', reason: 'QUERY_TOO_LONG' });
});

test('RAG retrieval does not expose source failure details', async () => {
  const search = new TenantScopedKnowledgeSearch(
    { async search() { throw new Error('database/provider detail'); } },
    { canSearch() { return true; } },
    { async record() {} },
  );
  assert.deepEqual(await search.search(context, { query: 'patient' }), { kind: 'FAILED', reason: 'SEARCH_UNAVAILABLE' });
});
