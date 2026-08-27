import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRows } from '../../dist-tests/src/domain/waste/normalize.js';

const base = {
  sido: '광주광역시',
  sigungu: '북구',
  areaName: '일곡동',
  generalWeekdays: '월,수,금',
  generalTime: '20:00~02:00',
  generalMethod: '종량제 봉투 사용',
  foodWeekdays: '매일',
  foodTime: '18시 이후',
  foodMethod: '전용 용기 사용',
  recyclingWeekdays: '화,목',
  recyclingTime: '20:00~02:00',
  recyclingMethod: '품목별 분리',
  noCollectionDays: '2026-09-01',
  authorityName: '광주광역시 북구',
  authorityContact: '062-000-0000',
  sourceUpdatedAt: '2026-02-10'
};

test('normalizeRows creates region and category rules with provenance', () => {
  const out = normalizeRows([base], '2026-08-27T12:00:00.000Z');
  assert.equal(out.report.totalRows, 1);
  assert.equal(out.report.acceptedRows, 1);
  assert.equal(out.report.rejectedRows, 0);
  assert.equal(out.regions.length, 1);
  assert.equal(out.rules.length, 3);
  const general = out.rules.find((r) => r.category === 'general');
  assert.deepEqual(general.weekdays, [1,3,5]);
  assert.deepEqual(general.timeWindows, [{ start: '20:00', end: '02:00' }]);
  assert.deepEqual(general.excludedDates, ['2026-09-01']);
  assert.equal(general.provenance.authorityName, '광주광역시 북구');
  assert.equal(general.confidence, 'verified');
});

test('normalizeRows rejects rows with missing region keys', () => {
  const out = normalizeRows([{ ...base, sigungu: '' }], '2026-08-27T12:00:00.000Z');
  assert.equal(out.report.acceptedRows, 0);
  assert.equal(out.report.rejectedRows, 1);
  assert.equal(out.rules.length, 0);
  assert.match(out.report.errors[0].code, /region/i);
});

test('normalizeRows keeps conflicting rules and marks them ambiguous', () => {
  const out = normalizeRows([
    base,
    { ...base, generalWeekdays: '화,목', generalTime: '19:00~23:00' }
  ], '2026-08-27T12:00:00.000Z');
  const general = out.rules.filter((r) => r.category === 'general');
  assert.equal(general.length, 2);
  assert.ok(general.every((r) => r.confidence === 'ambiguous'));
  assert.ok(out.report.ambiguousRows >= 2);
});

test('normalizeRows records malformed category schedule without inventing a rule', () => {
  const out = normalizeRows([{ ...base, foodTime: '저녁쯤' }], '2026-08-27T12:00:00.000Z');
  assert.equal(out.report.acceptedRows, 1);
  assert.equal(out.rules.some((r) => r.category === 'food'), false);
  assert.ok(out.report.errors.some((e) => e.code === 'invalid-food-schedule'));
});
