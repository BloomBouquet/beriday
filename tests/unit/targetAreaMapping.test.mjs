import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTargetAreaCatalog } from '../../dist-tests/src/data/canonical/targetAreaMapping.js';

function sourceRow(overrides = {}) {
  return {
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
    noCollectionDays: '',
    authorityName: '청소행정과',
    authorityContact: '062-000-0000',
    sourceUpdatedAt: '2026-08-25',
    ...overrides,
  };
}

test('maps official target areas to user-selectable regions while keeping the collection zone separate', () => {
  const result = buildTargetAreaCatalog([sourceRow()]);

  assert.deepEqual(result.regions, [
    {
      id: '광주광역시/북구/매곡동',
      sido: '광주광역시',
      sigungu: '북구',
      areaName: '매곡동',
      displayName: '광주광역시 북구 매곡동',
    },
    {
      id: '광주광역시/북구/일곡동',
      sido: '광주광역시',
      sigungu: '북구',
      areaName: '일곡동',
      displayName: '광주광역시 북구 일곡동',
    },
  ]);
  assert.deepEqual(result.managementAreas, [
    {
      id: 'collection:%EA%B4%91%EC%A3%BC%EA%B4%91%EC%97%AD%EC%8B%9C/%EB%B6%81%EA%B5%AC/1%EA%B6%8C%EC%97%AD',
      sido: '광주광역시',
      sigungu: '북구',
      name: '1권역',
    },
  ]);
  assert.equal(result.associations.length, 2);
  assert.equal(result.associations[0].sources[0].sourceRow, 1);
  assert.equal(result.report.selectableRegions, 2);
  assert.equal(result.report.unresolvedRows, 0);
  assert.equal(result.report.ambiguousTargetAreas, 0);
});

test('does not invent a selectable region when the official row has no target area names', () => {
  const result = buildTargetAreaCatalog([
    sourceRow({ targetAreaNames: [], managementAreaName: '전체' }),
  ]);

  assert.deepEqual(result.regions, []);
  assert.equal(result.associations.length, 0);
  assert.equal(result.report.unresolvedRows, 1);
  assert.deepEqual(result.report.issues, [
    {
      row: 1,
      code: 'missing-target-area',
      message: 'No 관리구역대상지역명 available for 전체',
    },
  ]);
});

test('merges duplicate target-to-zone associations while preserving each source provenance record', () => {
  const result = buildTargetAreaCatalog([
    sourceRow({ targetAreaNames: ['일곡동'] }),
    sourceRow({ targetAreaNames: ['일곡동'], sourceUpdatedAt: '2026-08-26' }),
  ]);

  assert.equal(result.regions.length, 1);
  assert.equal(result.associations.length, 1);
  assert.deepEqual(
    result.associations[0].sources.map((source) => source.sourceRow),
    [1, 2],
  );
  assert.deepEqual(
    result.associations[0].sources.map((source) => source.sourceUpdatedAt),
    ['2026-08-25', '2026-08-26'],
  );
});

test('excludes a target area from the selectable catalog when it maps to multiple collection zones', () => {
  const result = buildTargetAreaCatalog([
    sourceRow({ targetAreaNames: ['일곡동'], managementAreaName: '1권역' }),
    sourceRow({ targetAreaNames: ['일곡동'], managementAreaName: '2권역' }),
  ]);

  assert.deepEqual(result.regions, []);
  assert.equal(result.associations.length, 2);
  assert.equal(result.report.ambiguousTargetAreas, 1);
  assert.deepEqual(result.report.issues, [
    {
      regionId: '광주광역시/북구/일곡동',
      code: 'ambiguous-target-area',
      message: 'Target area maps to multiple collection zones: 1권역, 2권역',
    },
  ]);
});
