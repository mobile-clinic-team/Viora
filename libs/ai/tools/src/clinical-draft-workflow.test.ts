import assert from 'node:assert/strict';
import test from 'node:test';
import { createAuthenticatedRequestContext } from '../../../platform/context/src/index.ts';
import { approveAiDraft, createAiDraft, rejectAiDraft, reviewAiDraft, type AiDraft, type AiDraftRepository } from './clinical-draft-workflow.ts';

const context = createAuthenticatedRequestContext({ requestId: 'r', correlationId: 'c', userId: 'clinician-a', subject: 's', tenantId: 'tenant-a', membershipId: 'm' });
const base = { tenantId: 'tenant-a', patientId: 'patient-a', encounterId: 'encounter-a', createdBy: 'ignored', draftType: 'clinical_note', content: { diagnosis: 'routine', symptoms: 'none', clinicalNotes: 'draft', treatmentPlan: 'follow-up' } };

function repository(): { repo: AiDraftRepository; get: () => AiDraft | null } {
  let current: AiDraft | null = null;
  const repo: AiDraftRepository = {
    async create(input) { current = { ...input, id: 'draft-a', createdAt: input.createdAt, updatedAt: input.updatedAt }; return current; },
    async findById(input) { return current?.tenantId === input.tenantId && current.id === input.draftId ? current : null; },
    async transition(input) {
      if (!current || current.status !== input.from) return null;
      current = { ...current, status: input.to, updatedAt: input.at, ...(input.to === 'APPROVED' ? { approvedBy: input.actorId, approvedAt: input.at } : {}), ...(input.to === 'REJECTED' ? { rejectedBy: input.actorId, rejectedAt: input.at } : {}) };
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
