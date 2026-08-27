import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSchedule } from '../../dist-tests/src/domain/schedule/evaluateSchedule.js';

const provenance = {
  sourceId: 'fixture:1',
  sourceName: 'fixture',
  sourceUrl: 'https://example.go.kr/source',
  sourceUpdatedAt: '2026-08-20',
  importedAt: '2026-08-27T00:00:00.000Z',
  authorityName: '테스트구',
  authorityContact: '000-0000-0000'
};

function rule(overrides = {}) {
  return {
    id: 'r1',
    regionId: '서울특별시/테스트구/테스트동',
    category: 'general',
    weekdays: [1],
    timeWindows: [{ start: '19:00', end: '22:00' }],
    excludedDates: [],
    instructions: ['종량제 봉투'],
    confidence: 'verified',
    provenance,
    ...overrides
  };
}

function resultFor(rules, now) {
  return evaluateSchedule(rules, new Date(now)).find((x) => x.category === 'general');
}

test('returns available during a normal same-day window in Seoul time', () => {
  const result = resultFor([rule()], '2026-08-24T10:30:00.000Z'); // Mon 19:30 KST
  assert.equal(result.status, 'available');
  assert.deepEqual(result.currentWindow, { start: '19:00', end: '22:00' });
});

test('returns upcoming before a later same-day window', () => {
  const result = resultFor([rule({ timeWindows: [{ start: '20:00', end: '22:00' }] })], '2026-08-24T10:30:00.000Z');
  assert.equal(result.status, 'upcoming');
  assert.equal(result.nextAvailableAt, '2026-08-24T11:00:00.000Z');
});

test('cross-midnight window remains available after midnight on the next Seoul day', () => {
  const result = resultFor([rule({ timeWindows: [{ start: '20:00', end: '02:00' }] })], '2026-08-24T16:00:00.000Z'); // Tue 01:00 KST
  assert.equal(result.status, 'available');
  assert.deepEqual(result.currentWindow, { start: '20:00', end: '02:00' });
});

test('excluded date overrides a regular weekday schedule', () => {
  const result = resultFor([rule({ excludedDates: ['2026-08-24'] })], '2026-08-24T10:30:00.000Z');
  assert.notEqual(result.status, 'available');
  assert.equal(result.nextAvailableAt, '2026-08-31T10:00:00.000Z');
});

test('returns closed after todays collection window and calculates next occurrence', () => {
  const result = resultFor([rule()], '2026-08-24T14:00:00.000Z'); // Mon 23:00 KST
  assert.equal(result.status, 'closed');
  assert.equal(result.nextAvailableAt, '2026-08-31T10:00:00.000Z');
});

test('ambiguous source rules return needs-verification instead of choosing one', () => {
  const result = resultFor([rule({ confidence: 'ambiguous' })], '2026-08-24T10:30:00.000Z');
  assert.equal(result.status, 'needs-verification');
  assert.equal(result.nextAvailableAt, null);
});
