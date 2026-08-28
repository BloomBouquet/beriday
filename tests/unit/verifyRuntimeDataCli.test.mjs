import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
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

async function runNode(script, args) {
  return execFileAsync(process.execPath, [script, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}

test('verifies a runtime directory covers every canonical region and rule exactly once', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'beriday-runtime-verify-'));
  const input = path.join(dir, 'official-data.json');
  const runtimeDir = path.join(dir, 'runtime');

  try {
    await writeFile(input, `${JSON.stringify(canonical, null, 2)}\n`, 'utf8');
    await runNode('scripts/build-runtime-data.mjs', ['--input', input, '--output-dir', runtimeDir]);

    const { stdout } = await runNode('scripts/verify-runtime-data.mjs', [
      '--canonical', input,
      '--runtime-dir', runtimeDir,
    ]);

    assert.match(stdout, /"regions":2/);
    assert.match(stdout, /"rules":3/);
    assert.match(stdout, /"shards":2/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('rejects a runtime directory when a manifest shard is missing', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'beriday-runtime-verify-missing-'));
  const input = path.join(dir, 'official-data.json');
  const runtimeDir = path.join(dir, 'runtime');

  try {
    await writeFile(input, `${JSON.stringify(canonical, null, 2)}\n`, 'utf8');
    await runNode('scripts/build-runtime-data.mjs', ['--input', input, '--output-dir', runtimeDir]);

    const manifest = JSON.parse(await readFile(path.join(runtimeDir, 'manifest.json'), 'utf8'));
    await unlink(path.join(runtimeDir, manifest.regions[0].shardPath));

    await assert.rejects(
      runNode('scripts/verify-runtime-data.mjs', ['--canonical', input, '--runtime-dir', runtimeDir]),
      (error) => {
        assert.match(error.stderr, /Runtime shard file count mismatch/);
        return true;
      },
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
