import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOfficialDataBundle } from '../../dist-tests/src/data/canonical/officialDataBundle.js';
import {
  loadOfficialDataAsset,
  serializeOfficialDataAsset,
} from '../../dist-tests/src/data/canonical/officialDataAsset.js';

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

const csv = `${headers}\n광주광역시,북구,1권역,일곡동,종량제봉투,전용용기,분리배출,월+수+금,화+목,수+금,19:00,02:00,18:00,23:00,20:00,02:00,2026-09-01,청소행정과,062-000-0000,2026-08-25`;
const importedAt = '2026-08-27T15:30:00.000Z';

function bundle() {
  return buildOfficialDataBundle(csv, importedAt);
}

test('serializes the same bundle to the same pretty JSON with exactly one trailing newline', () => {
  const first = serializeOfficialDataAsset(bundle());
  const second = serializeOfficialDataAsset(bundle());

  assert.equal(first, second);
  assert.ok(first.startsWith('{\n  "schemaVersion": 1,'));
  assert.ok(first.endsWith('\n'));
  assert.ok(!first.endsWith('\n\n'));
});

test('loads a serialized schema v1 asset back to the same bundle', () => {
  const expected = bundle();
  const text = serializeOfficialDataAsset(expected);

  assert.deepEqual(loadOfficialDataAsset(text), expected);
});

test('rejects malformed JSON with an asset-specific error', () => {
  assert.throws(
    () => loadOfficialDataAsset('{not-json'),
    /Invalid official data asset JSON/,
  );
});

test('rejects unsupported schema versions', () => {
  const parsed = JSON.parse(serializeOfficialDataAsset(bundle()));
  parsed.schemaVersion = 2;

  assert.throws(
    () => loadOfficialDataAsset(JSON.stringify(parsed)),
    /Unsupported official data asset schemaVersion: 2/,
  );
});

test('rejects missing or invalid required top-level fields', () => {
  assert.throws(
    () => loadOfficialDataAsset(JSON.stringify({ schemaVersion: 1 })),
    /Invalid official data asset: importedAt must be a string/,
  );

  assert.throws(
    () => loadOfficialDataAsset(JSON.stringify({
      schemaVersion: 1,
      importedAt,
      regions: {},
      rules: [],
      reports: {},
    })),
    /Invalid official data asset: regions must be an array/,
  );
});
