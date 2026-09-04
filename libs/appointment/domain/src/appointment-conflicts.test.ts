import { strict as assert } from 'node:assert';
import test from 'node:test';
import { appointmentsOverlap } from './index.ts';

const base = {
  doctorId: 'doctor-1',
  startTime: '2026-09-04T09:00:00Z',
  endTime: '2026-09-04T09:30:00Z',
  status: 'CONFIRMED' as const,
};

test('detects overlapping active appointments for the same doctor', () => {
  assert.equal(appointmentsOverlap(base, { ...base, startTime: '2026-09-04T09:15:00Z', endTime: '2026-09-04T09:45:00Z' }), true);
  assert.equal(appointmentsOverlap(base, { ...base, startTime: '2026-09-04T09:30:00Z', endTime: '2026-09-04T10:00:00Z' }), false);
});

test('does not treat another doctor or terminal appointment as a double booking', () => {
  assert.equal(appointmentsOverlap(base, { ...base, doctorId: 'doctor-2' }), false);
  assert.equal(appointmentsOverlap(base, { ...base, status: 'CANCELLED' }), false);
  assert.equal(appointmentsOverlap(base, { ...base, status: 'NO_SHOW' }), false);
});
