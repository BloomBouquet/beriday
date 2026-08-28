import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOfficialRuntimeAssets } from '../../dist-tests/src/data/canonical/runtimeDataAssets.js';

function region(id) {
  return {
    id,
    sido: '경기도',
    sigungu: '테스트시',
    areaName: id.split('/').at(-1),
    displayName: id,
  };
}

function bundleFor(ids) {
  return {
    schemaVersion: 1,
    importedAt: '2026-08-28T04:39:01.000Z',
    regions: ids.map(region),
    rules: [],
    reports: {
      source: { totalRows: ids.length, acceptedRows: ids.length, rejectedRows: 0, errors: [] },
      mapping: {},
      normalization: {},
      adapter: {},
    },
  };
}

test('uses bounded deterministic shard filenames for very long official region ids', () => {
  const prefix = '경기도/테스트시/';
  const firstId = `${prefix}${'매우긴공식대상지역명'.repeat(30)}A`;
  const secondId = `${prefix}${'매우긴공식대상지역명'.repeat(30)}B`;

  const first = buildOfficialRuntimeAssets(bundleFor([firstId, secondId]));
  const second = buildOfficialRuntimeAssets(bundleFor([firstId, secondId]));

  assert.deepEqual(first.shards.map((shard) => shard.path), second.shards.map((shard) => shard.path));
  assert.equal(new Set(first.shards.map((shard) => shard.path)).size, 2);
  assert.ok(first.shards.every((shard) => shard.path.startsWith('regions/')));
  assert.ok(first.shards.every((shard) => Buffer.byteLength(shard.path.split('/').at(-1), 'utf8') < 100));
});
