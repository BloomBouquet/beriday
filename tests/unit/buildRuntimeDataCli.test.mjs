import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

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

const canonical = {
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

async function runCli(args) {
  return execFileAsync(process.execPath, ['scripts/build-runtime-data.mjs', ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}

test('builds manifest and region shards from a canonical asset while removing stale output', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'beriday-runtime-cli-'));
  const input = path.join(dir, 'official-data.json');
  const outputDir = path.join(dir, 'runtime');

  try {
    await writeFile(input, `${JSON.stringify(canonical, null, 2)}\n`, 'utf8');
    await mkdir(path.join(outputDir, 'regions'), { recursive: true });
    await writeFile(path.join(outputDir, 'regions', 'stale.json'), '{"stale":true}\n', 'utf8');

    const { stdout } = await runCli(['--input', input, '--output-dir', outputDir]);

    const manifestText = await readFile(path.join(outputDir, 'manifest.json'), 'utf8');
    const manifest = JSON.parse(manifestText);
    assert.equal(manifest.importedAt, canonical.importedAt);
    assert.equal(manifest.regions.length, 2);
    assert.deepEqual(manifest.summary, {
      totalRows: 10,
      acceptedRows: 9,
      rejectedRows: 1,
      coveredRegions: 2,
      rules: 3,
    });

    const shardFiles = await readdir(path.join(outputDir, 'regions'));
    assert.equal(shardFiles.length, 2);
    assert.equal(shardFiles.includes('stale.json'), false);

    for (const region of manifest.regions) {
      const shardText = await readFile(path.join(outputDir, region.shardPath), 'utf8');
      const shard = JSON.parse(shardText);
      assert.equal(shard.regionId, region.id);
      assert.ok(shard.rules.every((item) => item.regionId === region.id));
    }

    assert.match(stdout, /"shards":2/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('fails with a concise usage error when required runtime build arguments are missing', async () => {
  await assert.rejects(
    runCli([]),
    (error) => {
      assert.match(error.stderr, /Usage: node scripts\/build-runtime-data\.mjs --input <json> --output-dir <directory>/);
      return true;
    },
  );
});
