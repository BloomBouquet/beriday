import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
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

function canonicalBundle() {
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

function validationReport() {
  return {
    schemaVersion: 1,
    importedAt,
    sourceUpdatedAt,
    sourceRows: 10,
    acceptedRows: 9,
    rejectedRows: 1,
    ambiguousRows: 0,
    coveredRegions: 3,
    rules: 3,
    criticalErrors: [],
    warnings: [],
  };
}

async function runScript(script, args) {
  return execFileAsync(process.execPath, [script, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}

async function setupFixture(prefix) {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  const asset = path.join(dir, 'official-data.json');
  const report = path.join(dir, 'official-data-validation.json');
  const runtimeRoot = path.join(dir, 'runtime');
  await writeFile(asset, `${JSON.stringify(canonicalBundle(), null, 2)}\n`, 'utf8');
  await writeFile(report, `${JSON.stringify(validationReport(), null, 2)}\n`, 'utf8');
  return { dir, asset, report, runtimeRoot };
}

function cliArgs({ asset, report, runtimeRoot }) {
  return [
    '--asset', asset,
    '--report', report,
    '--runtime-root', runtimeRoot,
  ];
}

test('build runtime cli writes manifest and municipality shards while removing stale output', async () => {
  const fixture = await setupFixture('beriday-runtime-build-');

  try {
    await mkdir(fixture.runtimeRoot, { recursive: true });
    await writeFile(path.join(fixture.runtimeRoot, 'stale.json'), '{"stale":true}\n', 'utf8');

    await runScript('scripts/build-runtime-data.mjs', cliArgs(fixture));

    const rootFiles = await readdir(fixture.runtimeRoot);
    assert.deepEqual(rootFiles.sort(), ['manifest.json', 'shards']);

    const manifestText = await readFile(path.join(fixture.runtimeRoot, 'manifest.json'), 'utf8');
    const manifest = JSON.parse(manifestText);
    assert.equal(manifest.regionCount, 3);
    assert.equal(manifest.ruleCount, 3);
    assert.deepEqual(manifest.source, { totalRows: 10, acceptedRows: 9, rejectedRows: 1 });
    assert.ok(manifestText.endsWith('\n'));

    const shardFiles = await readdir(path.join(fixture.runtimeRoot, 'shards'));
    assert.equal(shardFiles.length, 2);
    assert.ok(shardFiles.every((file) => /^municipality-[0-9a-f]{8}\.json$/.test(file)));
  } finally {
    await rm(fixture.dir, { recursive: true, force: true });
  }
});

test('verify runtime cli accepts generated runtime data and rejects a corrupted shard', async () => {
  const fixture = await setupFixture('beriday-runtime-verify-');

  try {
    await runScript('scripts/build-runtime-data.mjs', cliArgs(fixture));
    await assert.doesNotReject(
      runScript('scripts/verify-runtime-data.mjs', cliArgs(fixture)),
    );

    const manifest = JSON.parse(await readFile(path.join(fixture.runtimeRoot, 'manifest.json'), 'utf8'));
    const [shardId] = Object.keys(manifest.shards);
    const shardPath = path.join(fixture.runtimeRoot, manifest.shards[shardId].path);
    const shard = JSON.parse(await readFile(shardPath, 'utf8'));
    shard.rules = [];
    await writeFile(shardPath, `${JSON.stringify(shard, null, 2)}\n`, 'utf8');

    await assert.rejects(
      runScript('scripts/verify-runtime-data.mjs', cliArgs(fixture)),
      (error) => {
        assert.match(error.stderr, /runtime shard|runtime rule|metadata count/i);
        return true;
      },
    );
  } finally {
    await rm(fixture.dir, { recursive: true, force: true });
  }
});

test('verify runtime cli rejects manifest paths outside the shard directory', async () => {
  const fixture = await setupFixture('beriday-runtime-path-');

  try {
    await runScript('scripts/build-runtime-data.mjs', cliArgs(fixture));
    const manifestPath = path.join(fixture.runtimeRoot, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const [shardId] = Object.keys(manifest.shards);
    manifest.shards[shardId].path = '../official-data.json';
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

    await assert.rejects(
      runScript('scripts/verify-runtime-data.mjs', cliArgs(fixture)),
      (error) => {
        assert.match(error.stderr, /runtime manifest|shard path|invalid shard metadata/i);
        return true;
      },
    );
  } finally {
    await rm(fixture.dir, { recursive: true, force: true });
  }
});
