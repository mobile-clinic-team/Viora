import type { RequestContext } from '../../../platform/context/src/index.ts';
import type { ClinicalRecordCreateRequest } from '../../../clinical/contracts/src/index.ts';
import type { AiToolDefinition } from '../../contracts/src/index.ts';

export interface ClinicalDraftProvider {
  createDraft(input: { readonly context: RequestContext; readonly patientId: string; readonly encounterId: string; readonly content: ClinicalRecordCreateRequest }): Promise<ClinicalRecordCreateRequest>;
}

export interface ClinicalDraftToolInput extends ClinicalRecordCreateRequest {
  readonly patientId: string;
  readonly encounterId: string;
}

export interface ClinicalDraftToolOutput {
  readonly kind: 'DRAFT';
  readonly patientId: string;
  readonly encounterId: string;
  readonly content: ClinicalRecordCreateRequest;
  readonly requiresHumanApproval: true;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validInput(input: unknown): input is ClinicalDraftToolInput {
  if (!input || typeof input !== 'object') return false;
  const value = input as ClinicalDraftToolInput;
  if (Object.keys(value).some((key) => !['patientId', 'encounterId', 'diagnosis', 'symptoms', 'clinicalNotes', 'treatmentPlan'].includes(key))) return false;
  return nonEmpty(value.patientId) && nonEmpty(value.encounterId) && nonEmpty(value.diagnosis) && nonEmpty(value.symptoms) && nonEmpty(value.clinicalNotes) && nonEmpty(value.treatmentPlan);
}

export function createClinicalDraftTool(provider: ClinicalDraftProvider): AiToolDefinition<ClinicalDraftToolInput, ClinicalDraftToolOutput> {
  return {
    name: 'draft_clinical_note',
    purpose: 'Create non-authoritative clinical draft content for human review',
    access: 'DRAFT',
    requiresHumanApproval: true,
    maxOutputBytes: 12_000,
    validateInput: validInput,
    authorize: ({ context, resource, toolInput }) => !resource || (
      resource.resourceType === 'encounter' && nonEmpty(resource.resourceId) && resource.resourceId === toolInput.encounterId.trim() && resource.tenantId === context.tenant?.tenantId
    ),
    execute: async (input, context) => ({
      kind: 'DRAFT',
      patientId: input.patientId.trim(),
      encounterId: input.encounterId.trim(),
      content: await provider.createDraft({
        context,
        patientId: input.patientId.trim(),
        encounterId: input.encounterId.trim(),
        content: {
          diagnosis: input.diagnosis.trim(),
          symptoms: input.symptoms.trim(),
          clinicalNotes: input.clinicalNotes.trim(),
          treatmentPlan: input.treatmentPlan.trim(),
        },
      }),
      requiresHumanApproval: true,
    }),
  };
}
