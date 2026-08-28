import test from 'node:test';
import assert from 'node:assert/strict';

let runtimeDataAssets;
try {
  runtimeDataAssets = await import('../../dist-tests/src/data/canonical/runtimeDataAssets.js');
} catch {
  runtimeDataAssets = null;
}

function rule(id, regionId, category) {
  return {
    id,
    regionId,
    category,
    weekdays: [1, 3, 5],
    timeWindows: [{ start: '19:00', end: '23:00' }],
    excludedDates: [],
    instructions: ['공식 안내에 따라 배출'],
    confidence: 'verified',
    provenance: {
      sourceId: `source:${id}`,
      sourceName: '행정안전부 전국생활쓰레기배출정보표준데이터',
      sourceUrl: 'https://www.data.go.kr/data/15025450/standard.do',
      sourceUpdatedAt: '2026-07-14',
      importedAt: '2026-08-28T04:39:01.000Z',
      authorityName: '청소행정과',
      authorityContact: '000-000-0000',
    },
  };
}

const bundle = {
  schemaVersion: 1,
  importedAt: '2026-08-28T04:39:01.000Z',
  regions: [
    {
      id: '광주광역시/북구/일곡동',
      sido: '광주광역시',
      sigungu: '북구',
      areaName: '일곡동',
      displayName: '광주광역시 북구 일곡동',
    },
    {
      id: '서울특별시/강남구/역삼동',
      sido: '서울특별시',
      sigungu: '강남구',
      areaName: '역삼동',
      displayName: '서울특별시 강남구 역삼동',
    },
  ],
  rules: [
    rule('gwangju-general', '광주광역시/북구/일곡동', 'general'),
    rule('gwangju-food', '광주광역시/북구/일곡동', 'food'),
    rule('seoul-general', '서울특별시/강남구/역삼동', 'general'),
  ],
  reports: {
    source: {
      totalRows: 10,
      acceptedRows: 9,
      rejectedRows: 1,
      errors: [],
    },
    mapping: {},
    normalization: {},
    adapter: {},
  },
};

test('builds a lightweight manifest and one deterministic shard per region', () => {
  assert.equal(typeof runtimeDataAssets?.buildOfficialRuntimeAssets, 'function');

  const result = runtimeDataAssets.buildOfficialRuntimeAssets(bundle);

  assert.equal(result.manifest.schemaVersion, 1);
  assert.equal(result.manifest.importedAt, bundle.importedAt);
  assert.equal(result.manifest.regions.length, 2);
  assert.deepEqual(result.manifest.summary, {
    totalRows: 10,
    acceptedRows: 9,
    rejectedRows: 1,
    coveredRegions: 2,
    rules: 3,
  });

  assert.equal(result.shards.length, 2);
  assert.equal(new Set(result.shards.map((shard) => shard.path)).size, 2);

  const gwangjuEntry = result.manifest.regions.find((region) => region.id === '광주광역시/북구/일곡동');
  assert.ok(gwangjuEntry);
  const gwangjuShard = result.shards.find((shard) => shard.path === gwangjuEntry.shardPath);
  assert.ok(gwangjuShard);
  assert.equal(gwangjuShard.asset.regionId, gwangjuEntry.id);
  assert.deepEqual(gwangjuShard.asset.rules.map((item) => item.id), ['gwangju-food', 'gwangju-general']);
  assert.ok(gwangjuShard.asset.rules.every((item) => item.regionId === gwangjuEntry.id));

  const seoulEntry = result.manifest.regions.find((region) => region.id === '서울특별시/강남구/역삼동');
  assert.ok(seoulEntry);
  const seoulShard = result.shards.find((shard) => shard.path === seoulEntry.shardPath);
  assert.ok(seoulShard);
  assert.deepEqual(seoulShard.asset.rules.map((item) => item.id), ['seoul-general']);
});
