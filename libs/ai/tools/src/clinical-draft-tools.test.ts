import assert from 'node:assert/strict';
import test from 'node:test';
import { createAuthenticatedRequestContext } from '../../../platform/context/src/index.ts';
import { createClinicalDraftTool } from './clinical-draft-tools.ts';

const context = createAuthenticatedRequestContext({
  requestId: 'request-draft', correlationId: 'correlation-draft', userId: 'doctor-a', subject: 'subject-a',
  tenantId: 'tenant-a', membershipId: 'membership-a',
});

const input = {
  patientId: 'patient-a', encounterId: 'encounter-a', diagnosis: 'routine', symptoms: 'none',
  clinicalNotes: 'draft note', treatmentPlan: 'follow-up',
};

test('clinical draft tool is explicitly draft-only and requires approval', async () => {
  const tool = createClinicalDraftTool({ async createDraft({ content }) { return content; } });
  assert.equal(tool.access, 'DRAFT');
  assert.equal(tool.requiresHumanApproval, true);
  assert.deepEqual(await tool.execute(input, context), {
    kind: 'DRAFT', patientId: 'patient-a', encounterId: 'encounter-a',
    content: { diagnosis: 'routine', symptoms: 'none', clinicalNotes: 'draft note', treatmentPlan: 'follow-up' },
    requiresHumanApproval: true,
  });
});

test('clinical draft tool binds encounter resource to input', () => {
  const tool = createClinicalDraftTool({ async createDraft({ content }) { return content; } });
  assert.equal(tool.authorize?.({ context, toolInput: input, resource: { resourceId: 'encounter-b', tenantId: 'tenant-a', resourceType: 'encounter' } }), false);
  assert.equal(tool.authorize?.({ context, toolInput: input, resource: { resourceId: 'encounter-a', tenantId: 'tenant-b', resourceType: 'encounter' } }), false);
});

test('clinical draft tool rejects incomplete or unknown input', () => {
  const tool = createClinicalDraftTool({ async createDraft({ content }) { return content; } });
  assert.equal(tool.validateInput({ ...input, clinicalNotes: '' }), false);
  assert.equal(tool.validateInput({ ...input, finalized: true }), false);
});
