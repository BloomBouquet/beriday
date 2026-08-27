import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptOfficialRowsToCollectionRules } from '../../dist-tests/src/data/canonical/officialRuleAdapter.js';

function sourceRow(overrides = {}) {
  return {
    sourceRow: 7,
    sido: '광주광역시',
    sigungu: '북구',
    managementAreaName: '1권역',
    targetAreaNames: ['일곡동', '매곡동'],
    generalMethod: '종량제봉투',
    foodMethod: '전용용기',
    recyclingMethod: '분리배출',
    generalWeekdays: '월+수+금',
    foodWeekdays: '화+목',
    recyclingWeekdays: '수+금',
    generalStartTime: '19:00',
    generalEndTime: '02:00',
    foodStartTime: '18:00',
    foodEndTime: '23:00',
    recyclingStartTime: '20:00',
    recyclingEndTime: '02:00',
    noCollectionDays: '2026-09-01+2026-09-03',
    authorityName: '청소행정과',
    authorityContact: '062-000-0000',
    sourceUpdatedAt: '2026-08-25',
    ...overrides,
  };
}

const importedAt = '2026-08-27T15:00:00.000Z';

test('expands one official collection zone into verified rules for each safe target area', () => {
  const result = adaptOfficialRowsToCollectionRules([sourceRow()], importedAt);

  assert.deepEqual(
    result.regions.map((region) => region.id).sort(),
    ['광주광역시/북구/매곡동', '광주광역시/북구/일곡동'].sort(),
  );
  assert.equal(result.rules.length, 6);

  const general = result.rules.find(
    (rule) => rule.regionId === '광주광역시/북구/일곡동' && rule.category === 'general',
  );
  assert.deepEqual(general.weekdays, [1, 3, 5]);
  assert.deepEqual(general.timeWindows, [{ start: '19:00', end: '02:00' }]);
  assert.deepEqual(general.excludedDates, ['2026-09-01', '2026-09-03']);
  assert.deepEqual(general.instructions, ['종량제봉투']);
  assert.equal(general.provenance.sourceId, 'household-waste:7');
  assert.equal(general.provenance.sourceUpdatedAt, '2026-08-25');
  assert.equal(result.mappingReport.selectableRegions, 2);
  assert.equal(result.adapterReport.skippedSourceRows, 0);
});

test('does not generate rules for a target area that maps to multiple collection zones', () => {
  const result = adaptOfficialRowsToCollectionRules([
    sourceRow({ sourceRow: 1, targetAreaNames: ['일곡동'], managementAreaName: '1권역' }),
    sourceRow({ sourceRow: 2, targetAreaNames: ['일곡동'], managementAreaName: '2권역' }),
  ], importedAt);

  assert.deepEqual(result.regions, []);
  assert.deepEqual(result.rules, []);
  assert.equal(result.mappingReport.ambiguousTargetAreas, 1);
});

test('does not invent rules when the official row has no target area names', () => {
  const result = adaptOfficialRowsToCollectionRules([
    sourceRow({ sourceRow: 3, targetAreaNames: [], managementAreaName: '전체' }),
  ], importedAt);

  assert.deepEqual(result.regions, []);
  assert.deepEqual(result.rules, []);
  assert.equal(result.mappingReport.unresolvedRows, 1);
});

test('keeps malformed category schedules out and reports the original CSV source row', () => {
  const result = adaptOfficialRowsToCollectionRules([
    sourceRow({
      sourceRow: 9,
      targetAreaNames: ['일곡동'],
      foodWeekdays: '미운영',
      foodStartTime: '00:00',
      foodEndTime: '00:00',
    }),
  ], importedAt);

  assert.equal(result.rules.some((rule) => rule.category === 'food'), false);
  assert.ok(result.normalizationReport.errors.some(
    (error) => error.row === 9 && error.code === 'invalid-food-schedule',
  ));
});

test('blocks schedule generation when no-collection text cannot be represented as concrete dates', () => {
  const result = adaptOfficialRowsToCollectionRules([
    sourceRow({ sourceRow: 11, targetAreaNames: ['일곡동'], noCollectionDays: '명절+임시공휴일' }),
  ], importedAt);

  assert.equal(result.regions.length, 1);
  assert.deepEqual(result.rules, []);
  assert.equal(result.adapterReport.skippedSourceRows, 1);
  assert.deepEqual(result.adapterReport.errors, [
    {
      row: 11,
      code: 'unsupported-no-collection-days',
      message: 'Cannot safely convert 미수거일 to concrete excluded dates: 명절+임시공휴일',
    },
  ]);
});
