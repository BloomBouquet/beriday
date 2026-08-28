import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOfficialRuntimeData,
  loadOfficialRuntimeManifest,
  loadOfficialRuntimeShard,
  serializeOfficialRuntimeManifest,
  serializeOfficialRuntimeShard,
  verifyOfficialRuntimeData,
} from '../../dist-tests/src/data/runtime/officialRuntimeData.js';

const importedAt = '2026-08-28T00:00:00.000Z';
const sourceUpdatedAt = '2026-07-14';

function region(id, sido, sigungu, areaName) {
  return { id, sido, sigungu, areaName, displayName: `${sido} ${sigungu} ${areaName}` };
}

function rule(id, regionId, category = 'general') {
  return {
    id,
    regionId,
    category,
    weekdays: [1, 3, 5],
    timeWindows: [{ start: '19:00', end: '23:00' }],
    excludedDates: [],
    instructions: ['종량제봉투에 배출'],
    confidence: 'verified',
    provenance: {
      sourceId: `source:${id}`,
      sourceName: '행정안전부 생활쓰레기배출정보',
      sourceUrl: 'https://www.data.go.kr/',
      sourceUpdatedAt,
      importedAt,
      authorityName: '담당기관',
      authorityContact: '000-000-0000',
    },
  };
}

function bundle() {
  return {
    schemaVersion: 1,
    importedAt,
    regions: [
      region('광주광역시/북구/일곡동', '광주광역시', '북구', '일곡동'),
      region('광주광역시/북구/용봉동', '광주광역시', '북구', '용봉동'),
      region('서울특별시/강남구/역삼동', '서울특별시', '강남구', '역삼동'),
    ],
    rules: [
      rule('rule-1', '광주광역시/북구/일곡동'),
      rule('rule-2', '광주광역시/북구/용봉동', 'food'),
      rule('rule-3', '서울특별시/강남구/역삼동', 'recycling'),
    ],
    reports: {
      source: { totalRows: 10, acceptedRows: 9, rejectedRows: 1, errors: [] },
      mapping: { sourceRows: 3, mappedRows: 3, skippedRows: 0, regions: 3, errors: [] },
      normalization: { acceptedRows: 3, rejectedRows: 0, ambiguousRows: 0, errors: [] },
      adapter: { sourceRows: 3, skippedSourceRows: 0, emittedRules: 3, errors: [] },
    },
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('groups selectable regions by municipality and preserves source summary', () => {
  const canonical = bundle();
  const runtime = buildOfficialRuntimeData(canonical, sourceUpdatedAt);

  assert.equal(runtime.manifest.regionCount, 3);
  assert.equal(runtime.manifest.ruleCount, 3);
  assert.deepEqual(runtime.manifest.source, {
    totalRows: 10,
    acceptedRows: 9,
    rejectedRows: 1,
  });
  assert.equal(Object.keys(runtime.shards).length, 2);

  const ilgok = runtime.manifest.regions.find((entry) => entry.regionId === '광주광역시/북구/일곡동');
  const yongbong = runtime.manifest.regions.find((entry) => entry.regionId === '광주광역시/북구/용봉동');
  const yeoksam = runtime.manifest.regions.find((entry) => entry.regionId === '서울특별시/강남구/역삼동');

  assert.ok(ilgok);
  assert.ok(yongbong);
  assert.ok(yeoksam);
  assert.equal(ilgok.shardId, yongbong.shardId);
  assert.notEqual(ilgok.shardId, yeoksam.shardId);
  assert.equal(runtime.manifest.shards[ilgok.shardId].path, `shards/${ilgok.shardId}.json`);
  assert.doesNotThrow(() => verifyOfficialRuntimeData(canonical, sourceUpdatedAt, runtime));
});

test('serializes and loads runtime manifest and shards deterministically', () => {
  const runtime = buildOfficialRuntimeData(bundle(), sourceUpdatedAt);
  const manifestText = serializeOfficialRuntimeManifest(runtime.manifest);
  assert.ok(manifestText.endsWith('\n'));
  assert.deepEqual(loadOfficialRuntimeManifest(manifestText), runtime.manifest);

  for (const shard of Object.values(runtime.shards)) {
    const shardText = serializeOfficialRuntimeShard(shard);
    assert.ok(shardText.endsWith('\n'));
    assert.deepEqual(loadOfficialRuntimeShard(shardText), shard);
  }
});

test('rejects unsupported runtime schema versions', () => {
  assert.throws(
    () => loadOfficialRuntimeManifest(JSON.stringify({ schemaVersion: 2 })),
    /schema version/i,
  );
  assert.throws(
    () => loadOfficialRuntimeShard(JSON.stringify({ schemaVersion: 2 })),
    /schema version/i,
  );
});

test('fails verification when canonical region membership is missing', () => {
  const canonical = bundle();
  const runtime = buildOfficialRuntimeData(canonical, sourceUpdatedAt);
  runtime.manifest.regions = runtime.manifest.regions.slice(1);
  runtime.manifest.regionCount -= 1;

  assert.throws(
    () => verifyOfficialRuntimeData(canonical, sourceUpdatedAt, runtime),
    /region count|region membership/i,
  );
});

test('fails verification when a rule is duplicated across shards', () => {
  const canonical = bundle();
  const runtime = buildOfficialRuntimeData(canonical, sourceUpdatedAt);
  const shards = Object.values(runtime.shards);
  shards[1].rules.push(clone(shards[0].rules[0]));
  shards[1].regionIds.push(shards[0].rules[0].regionId);

  assert.throws(
    () => verifyOfficialRuntimeData(canonical, sourceUpdatedAt, runtime),
    /duplicate|rule membership/i,
  );
});

test('fails verification when a shard contains a foreign-region rule', () => {
  const canonical = bundle();
  const runtime = buildOfficialRuntimeData(canonical, sourceUpdatedAt);
  const shards = Object.values(runtime.shards);
  const foreignRule = clone(shards[0].rules[0]);
  shards[1].rules.push(foreignRule);

  assert.throws(
    () => verifyOfficialRuntimeData(canonical, sourceUpdatedAt, runtime),
    /outside|region/i,
  );
});

test('fails verification when runtime timestamps or source summary drift', () => {
  const canonical = bundle();
  const stale = buildOfficialRuntimeData(canonical, sourceUpdatedAt);
  stale.manifest.importedAt = '2026-08-27T00:00:00.000Z';
  assert.throws(() => verifyOfficialRuntimeData(canonical, sourceUpdatedAt, stale), /importedAt/i);

  const sourceDrift = buildOfficialRuntimeData(canonical, sourceUpdatedAt);
  sourceDrift.manifest.source.acceptedRows = 8;
  assert.throws(() => verifyOfficialRuntimeData(canonical, sourceUpdatedAt, sourceDrift), /source summary/i);
});

test('fails verification when a manifest region references an unknown shard', () => {
  const canonical = bundle();
  const runtime = buildOfficialRuntimeData(canonical, sourceUpdatedAt);
  runtime.manifest.regions[0].shardId = 'municipality-deadbeef';

  assert.throws(
    () => verifyOfficialRuntimeData(canonical, sourceUpdatedAt, runtime),
    /unknown shard/i,
  );
});
