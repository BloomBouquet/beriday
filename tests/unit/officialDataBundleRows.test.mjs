import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOfficialDataBundleFromRows } from '../../dist-tests/src/data/canonical/officialDataBundle.js';

const importedAt = '2026-08-28T00:00:00.000Z';

const row = {
  sourceRow: 1,
  sido: '광주광역시',
  sigungu: '북구',
  managementAreaName: '1권역',
  targetAreaNames: ['일곡동'],
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
  noCollectionDays: '2026-09-01',
  authorityName: '청소행정과',
  authorityContact: '062-000-0000',
  sourceUpdatedAt: '2026-08-25',
};

test('builds the same canonical schema from pre-parsed official API rows', () => {
  const sourceReport = {
    totalRows: 1,
    acceptedRows: 1,
    rejectedRows: 0,
    errors: [],
  };

  const bundle = buildOfficialDataBundleFromRows([row], sourceReport, importedAt);

  assert.equal(bundle.schemaVersion, 1);
  assert.equal(bundle.importedAt, importedAt);
  assert.deepEqual(bundle.regions.map((region) => region.id), ['광주광역시/북구/일곡동']);
  assert.equal(bundle.rules.length, 3);
  assert.deepEqual(bundle.reports.source, sourceReport);
  assert.equal(bundle.reports.adapter.sourceRows, 1);
});
