import type { RequestContext } from '../../../libs/platform/context/src/index.ts';
import {
  createPatient,
  getPatient,
  listPatients,
  patchPatient,
  PatientApplicationError,
} from '../../../libs/patient/application-entrypoint/src/index.ts';
import type { PatientApplicationDependencies } from '../../../libs/patient/application-entrypoint/src/index.ts';
import type {
  PatientCreateRequest,
  PatientListQuery,
  PatientPatchRequest,
} from '../../../libs/patient/contracts/src/index.ts';
import type { Patient } from '../../../libs/patient/domain/src/index.ts';

export interface PatientApiResponse {
  readonly status: 200 | 201 | 403 | 404 | 409 | 412 | 422 | 500;
  readonly body: unknown;
  readonly etag?: string;
}

export interface PatientApiDependencies extends PatientApplicationDependencies {
  /** The composition root supplies policy-aware field minimization. */
  present(patient: Patient, context: RequestContext): unknown;
}

function errorResponse(error: unknown): PatientApiResponse {
  if (!(error instanceof PatientApplicationError)) {
    return { status: 500, body: { code: 'INTERNAL_ERROR' } };
  }
  const status = error.code === 'FORBIDDEN'
    ? 403
    : error.code === 'NOT_FOUND'
      ? 404
      : error.code === 'IDEMPOTENCY_CONFLICT'
        ? 409
        : error.code === 'PRECONDITION_FAILED'
          ? 412
          : 422;
  return { status, body: { code: error.code } };
}

function withEtag(
  dependencies: PatientApiDependencies,
  patient: Patient,
  context: RequestContext,
  status: 200 | 201,
): PatientApiResponse {
  return {
    status,
    body: dependencies.present(patient, context),
    etag: `"${patient.version.toString()}"`,
  };
}

export async function handleCreatePatient(
  dependencies: PatientApiDependencies,
  context: RequestContext,
  body: PatientCreateRequest,
  idempotencyKey: string,
): Promise<PatientApiResponse> {
  try {
    return withEtag(dependencies, await createPatient(dependencies, context, body, idempotencyKey), context, 201);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleGetPatient(
  dependencies: PatientApiDependencies,
  context: RequestContext,
  patientId: string,
): Promise<PatientApiResponse> {
  try {
    return withEtag(dependencies, await getPatient(dependencies, context, patientId), context, 200);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handlePatchPatient(
  dependencies: PatientApiDependencies,
  context: RequestContext,
  patientId: string,
  body: PatientPatchRequest,
  ifMatch?: string,
): Promise<PatientApiResponse> {
  try {
    return withEtag(dependencies, await patchPatient(dependencies, context, patientId, body, ifMatch), context, 200);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleListPatients(
  dependencies: PatientApiDependencies,
  context: RequestContext,
  query: PatientListQuery,
): Promise<PatientApiResponse> {
  try {
    return {
      status: 200,
      body: (await listPatients(dependencies, context, query)).map((patient) => dependencies.present(patient, context)),
    };
  } catch (error) {
    return errorResponse(error);
  }
}
