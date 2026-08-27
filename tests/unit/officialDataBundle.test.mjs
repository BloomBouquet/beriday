import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOfficialDataBundle } from '../../dist-tests/src/data/canonical/officialDataBundle.js';

const headers = [
  '시도명',
  '시군구명',
  '관리구역명',
  '관리구역대상지역명',
  '생활쓰레기배출방법',
  '음식물쓰레기배출방법',
  '재활용품배출방법',
  '생활쓰레기배출요일',
  '음식물쓰레기배출요일',
  '재활용품배출요일',
  '생활쓰레기배출시작시각',
  '생활쓰레기배출종료시각',
  '음식물쓰레기배출시작시각',
  '음식물쓰레기배출종료시각',
  '재활용품배출시작시각',
  '재활용품배출종료시각',
  '미수거일',
  '관리부서명',
  '관리부서전화번호',
  '데이터기준일자',
].join(',');

const importedAt = '2026-08-27T15:30:00.000Z';

function validRow({ targetAreas = '일곡동+매곡동', noCollectionDays = '2026-09-01' } = {}) {
  return [
    '광주광역시',
    '북구',
    '1권역',
    targetAreas,
    '종량제봉투',
    '전용용기',
    '분리배출',
    '월+수+금',
    '화+목',
    '수+금',
    '19:00',
    '02:00',
    '18:00',
    '23:00',
    '20:00',
    '02:00',
    noCollectionDays,
    '청소행정과',
    '062-000-0000',
    '2026-08-25',
  ].join(',');
}

test('builds a versioned deterministic bundle from official CSV through parser and rule adapter', () => {
  const csv = `${headers}\n${validRow()}`;

  const first = buildOfficialDataBundle(csv, importedAt);
  const second = buildOfficialDataBundle(csv, importedAt);

  assert.deepEqual(first, second);
  assert.equal(first.schemaVersion, 1);
  assert.equal(first.importedAt, importedAt);
  assert.deepEqual(
    first.regions.map((region) => region.id),
    ['광주광역시/북구/매곡동', '광주광역시/북구/일곡동'],
  );
  assert.equal(first.rules.length, 6);
  assert.deepEqual(
    first.rules.map((rule) => rule.id),
    [...first.rules.map((rule) => rule.id)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
  );
  assert.equal(first.reports.source.totalRows, 1);
  assert.equal(first.reports.source.acceptedRows, 1);
  assert.equal(first.reports.mapping.selectableRegions, 2);
  assert.equal(first.reports.adapter.skippedSourceRows, 0);
  assert.equal(first.reports.normalization.errors.length, 0);
});

test('orders bundle ids by locale-independent UTF-16 code units', () => {
  const csv = `${headers}\n${validRow({ targetAreas: '가동+A동' })}`;

  const bundle = buildOfficialDataBundle(csv, importedAt);

  assert.deepEqual(
    bundle.regions.map((region) => region.id),
    ['광주광역시/북구/A동', '광주광역시/북구/가동'],
  );
  assert.deepEqual(
    bundle.rules.map((rule) => rule.id),
    [...bundle.rules.map((rule) => rule.id)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
  );
});

test('keeps source parser rejection counts while adapting only accepted rows', () => {
  const invalid = validRow().replace('광주광역시,북구,', '광주광역시,,');
  const valid = validRow({ targetAreas: '일곡동' });
  const csv = `${headers}\n${invalid}\n${valid}`;

  const bundle = buildOfficialDataBundle(csv, importedAt);

  assert.equal(bundle.reports.source.totalRows, 2);
  assert.equal(bundle.reports.source.acceptedRows, 1);
  assert.equal(bundle.reports.source.rejectedRows, 1);
  assert.deepEqual(bundle.reports.source.errors, [
    { row: 1, code: 'missing-region-key', message: 'Missing 시도명, 시군구명, or 관리구역명' },
  ]);
  assert.deepEqual(bundle.regions.map((region) => region.id), ['광주광역시/북구/일곡동']);
  assert.equal(bundle.rules.length, 3);
  assert.equal(bundle.rules[0].provenance.sourceId, 'household-waste:2');
});

test('retains conservative adapter errors and emits no rules for unsupported no-collection semantics', () => {
  const csv = `${headers}\n${validRow({ targetAreas: '일곡동', noCollectionDays: '명절+임시공휴일' })}`;

  const bundle = buildOfficialDataBundle(csv, importedAt);

  assert.deepEqual(bundle.regions.map((region) => region.id), ['광주광역시/북구/일곡동']);
  assert.deepEqual(bundle.rules, []);
  assert.equal(bundle.reports.adapter.skippedSourceRows, 1);
  assert.deepEqual(bundle.reports.adapter.errors, [
    {
      row: 1,
      code: 'unsupported-no-collection-days',
      message: 'Cannot safely convert 미수거일 to concrete excluded dates: 명절+임시공휴일',
    },
  ]);
});

test('fails fast on a CSV that does not satisfy the official header contract', () => {
  assert.throws(
    () => buildOfficialDataBundle('시도명,시군구명\n광주광역시,북구', importedAt),
    /Missing required official CSV headers/,
  );
});
