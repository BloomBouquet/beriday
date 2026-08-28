import { describe, expect, it, vi } from 'vitest';
import { createOfficialRuntimeLoader } from '../../src/data/runtime/officialRuntimeLoader';

const importedAt = '2026-08-28T04:39:01.000Z';
const sourceUpdatedAt = '2026-07-14';
const gwangjuShardId = 'municipality-11111111';
const seoulShardId = 'municipality-22222222';

const manifest = {
  schemaVersion: 1,
  importedAt,
  sourceUpdatedAt,
  source: { totalRows: 10, acceptedRows: 10, rejectedRows: 0 },
  regionCount: 3,
  ruleCount: 3,
  regions: [
    {
      regionId: '광주광역시/북구/일곡동',
      sido: '광주광역시',
      sigungu: '북구',
      areaName: '일곡동',
      shardId: gwangjuShardId,
    },
    {
      regionId: '광주광역시/북구/용봉동',
      sido: '광주광역시',
      sigungu: '북구',
      areaName: '용봉동',
      shardId: gwangjuShardId,
    },
    {
      regionId: '서울특별시/강남구/역삼동',
      sido: '서울특별시',
      sigungu: '강남구',
      areaName: '역삼동',
      shardId: seoulShardId,
    },
  ],
  shards: {
    [gwangjuShardId]: {
      path: `shards/${gwangjuShardId}.json`,
      regionCount: 2,
      ruleCount: 2,
    },
    [seoulShardId]: {
      path: `shards/${seoulShardId}.json`,
      regionCount: 1,
      ruleCount: 1,
    },
  },
};

function rule(id: string, regionId: string, category = 'general') {
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

const gwangjuShard = {
  schemaVersion: 1,
  importedAt,
  sourceUpdatedAt,
  shardId: gwangjuShardId,
  regionIds: ['광주광역시/북구/일곡동', '광주광역시/북구/용봉동'],
  rules: [
    rule('rule-1', '광주광역시/북구/일곡동'),
    rule('rule-2', '광주광역시/북구/용봉동', 'food'),
  ],
};

const seoulShard = {
  schemaVersion: 1,
  importedAt,
  sourceUpdatedAt,
  shardId: seoulShardId,
  regionIds: ['서울특별시/강남구/역삼동'],
  rules: [rule('rule-3', '서울특별시/강남구/역삼동', 'recycling')],
};

function jsonResponse(value: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    text: () => Promise.resolve(JSON.stringify(value)),
  } as Response);
}

function fetchForRuntime() {
  return vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url === '/data/runtime/manifest.json') return jsonResponse(manifest);
    if (url === `/data/runtime/shards/${gwangjuShardId}.json`) return jsonResponse(gwangjuShard);
    if (url === `/data/runtime/shards/${seoulShardId}.json`) return jsonResponse(seoulShard);
    return jsonResponse({}, false, 404);
  });
}

describe('official runtime loader', () => {
  it('loads the manifest once and reuses one municipality shard for regions in the same shard', async () => {
    const fetchImpl = fetchForRuntime();
    const loader = createOfficialRuntimeLoader({ fetchImpl });

    const loadedManifest = await loader.loadManifest();
    expect(loadedManifest.regionCount).toBe(3);

    const ilgokRules = await loader.loadRulesForRegion('광주광역시/북구/일곡동');
    const yongbongRules = await loader.loadRulesForRegion('광주광역시/북구/용봉동');

    expect(ilgokRules).toEqual(gwangjuShard.rules);
    expect(yongbongRules).toEqual(gwangjuShard.rules);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      '/data/runtime/manifest.json',
      { cache: 'no-cache' },
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      `/data/runtime/shards/${gwangjuShardId}.json`,
      { cache: 'default' },
    );
  });

  it('loads a different declared shard for a different municipality', async () => {
    const fetchImpl = fetchForRuntime();
    const loader = createOfficialRuntimeLoader({ fetchImpl });

    await loader.loadRulesForRegion('광주광역시/북구/일곡동');
    const seoulRules = await loader.loadRulesForRegion('서울특별시/강남구/역삼동');

    expect(seoulRules).toEqual(seoulShard.rules);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(fetchImpl).toHaveBeenLastCalledWith(
      `/data/runtime/shards/${seoulShardId}.json`,
      { cache: 'default' },
    );
  });

  it('rejects an unknown region without constructing or fetching a shard URL', async () => {
    const fetchImpl = fetchForRuntime();
    const loader = createOfficialRuntimeLoader({ fetchImpl });

    await expect(loader.loadRulesForRegion('없는지역')).rejects.toThrow(/unknown.*region/i);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith('/data/runtime/manifest.json', { cache: 'no-cache' });
  });

  it('rejects a stale shard whose canonical timestamps differ from the manifest', async () => {
    const staleShard = { ...gwangjuShard, importedAt: '2026-08-27T00:00:00.000Z' };
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/data/runtime/manifest.json') return jsonResponse(manifest);
      return jsonResponse(staleShard);
    });
    const loader = createOfficialRuntimeLoader({ fetchImpl });

    await expect(loader.loadRulesForRegion('광주광역시/북구/일곡동')).rejects.toThrow(/importedAt|stale/i);
  });

  it('rejects a shard with metadata or membership drift', async () => {
    const malformedShard = {
      ...gwangjuShard,
      regionIds: ['광주광역시/북구/일곡동'],
      rules: [gwangjuShard.rules[0]],
    };
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/data/runtime/manifest.json') return jsonResponse(manifest);
      return jsonResponse(malformedShard);
    });
    const loader = createOfficialRuntimeLoader({ fetchImpl });

    await expect(loader.loadRulesForRegion('광주광역시/북구/일곡동')).rejects.toThrow(/metadata|region|rule/i);
  });

  it('does not cache a failed shard request and allows the next request to retry', async () => {
    let shardAttempts = 0;
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/data/runtime/manifest.json') return jsonResponse(manifest);
      shardAttempts += 1;
      if (shardAttempts === 1) return jsonResponse({}, false, 503);
      return jsonResponse(gwangjuShard);
    });
    const loader = createOfficialRuntimeLoader({ fetchImpl });

    await expect(loader.loadRulesForRegion('광주광역시/북구/일곡동')).rejects.toThrow(/503/);
    await expect(loader.loadRulesForRegion('광주광역시/북구/일곡동')).resolves.toEqual(gwangjuShard.rules);
    expect(shardAttempts).toBe(2);
  });
});
