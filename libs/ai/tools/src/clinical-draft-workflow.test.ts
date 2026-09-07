import assert from 'node:assert/strict';
import test from 'node:test';
import { createAuthenticatedRequestContext } from '../../../platform/context/src/index.ts';
import { approveAiDraft, createAiDraft, rejectAiDraft, reviewAiDraft, type AiDraft, type AiDraftRepository } from './clinical-draft-workflow.ts';

const context = createAuthenticatedRequestContext({ requestId: 'r', correlationId: 'c', userId: 'clinician-a', subject: 's', tenantId: 'tenant-a', membershipId: 'm' });
const base = { tenantId: 'tenant-a', patientId: 'patient-a', encounterId: 'encounter-a', createdBy: 'ignored', draftType: 'clinical_note', content: { diagnosis: 'routine', symptoms: 'none', clinicalNotes: 'draft', treatmentPlan: 'follow-up' } };

function repository(): { repo: AiDraftRepository; get: () => AiDraft | null } {
  let current: AiDraft | null = null;
  const repo: AiDraftRepository = {
    async create(input) {
      assert.equal(input.version, 1n, 'workflow must supply the initial repository version');
      assert.equal(Object.hasOwn(input, 'createdAt'), false, 'repository owns creation timestamps');
      assert.equal(Object.hasOwn(input, 'updatedAt'), false, 'repository owns creation timestamps');
      current = { ...input, id: 'draft-a', createdAt: '2026-09-07T00:00:00Z', updatedAt: '2026-09-07T00:00:00Z' };
      return current;
    },
    async findById(input) { return current?.tenantId === input.tenantId && current.id === input.draftId ? current : null; },
    async transition(input) {
      if (!current || current.status !== input.from) return null;
      if (current.version !== input.expectedVersion) return null;
      current = { ...current, version: current.version + 1n, status: input.to, updatedAt: input.at, ...(input.to === 'APPROVED' ? { approvedBy: input.actorId, approvedAt: input.at } : {}), ...(input.to === 'REJECTED' ? { rejectedBy: input.actorId, rejectedAt: input.at } : {}) };
      return current;
    },
  };
  return { repo, get: () => current };
}

function deps(repo: AiDraftRepository) {
  return { drafts: repo, now: () => '2026-09-07T00:00:00Z', authorization: { allows: () => true } };
}

test('AI draft workflow enforces GENERATED → REVIEWING → APPROVED', async () => {
  const { repo, get } = repository();
  const created = await createAiDraft(deps(repo), context, base);
  assert.equal(created.status, 'GENERATED');
  assert.equal(created.version, 1n);
  assert.equal(created.createdBy, context.actor!.userId);
  assert.equal((await reviewAiDraft(deps(repo), context, created.id)).status, 'REVIEWING');
  const approved = await approveAiDraft(deps(repo), context, created.id);
  assert.equal(approved.status, 'APPROVED');
  assert.equal(approved.approvedBy, 'clinician-a');
  assert.equal(get()?.rejectedBy, null);
});

test('AI draft workflow rejects approval before human review and supports rejection', async () => {
  const { repo } = repository();
  const created = await createAiDraft(deps(repo), context, base);
  await assert.rejects(approveAiDraft(deps(repo), context, created.id), (error: unknown) => (error as { code?: string }).code === 'INVALID_TRANSITION');
  await reviewAiDraft(deps(repo), context, created.id);
  assert.equal((await rejectAiDraft(deps(repo), context, created.id)).status, 'REJECTED');
});

test('AI actor cannot perform human approval transitions', async () => {
  const { repo } = repository();
  const aiContext = createAuthenticatedRequestContext({
    requestId: 'r-ai', correlationId: 'c-ai', userId: 'ai-agent', subject: 'ai-subject',
    tenantId: 'tenant-a', membershipId: 'm', actorKind: 'AI',
  });
  const created = await createAiDraft(deps(repo), context, base);
  await assert.rejects(reviewAiDraft(deps(repo), aiContext, created.id), (error: unknown) => (error as { code?: string }).code === 'FORBIDDEN');
});
