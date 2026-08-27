import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

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

const validCsv = `${headers}\n광주광역시,북구,1권역,일곡동,종량제봉투,전용용기,분리배출,월+수+금,화+목,수+금,19:00,02:00,18:00,23:00,20:00,02:00,2026-09-01,청소행정과,062-000-0000,2026-08-25`;

async function runCli(args) {
  return execFileAsync(process.execPath, ['scripts/build-official-data.mjs', ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}

test('builds a deterministic schema v1 JSON asset from an explicit CSV input and importedAt', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'beriday-build-cli-'));
  const input = path.join(dir, 'official.csv');
  const output = path.join(dir, 'nested', 'official-data.json');
  const importedAt = '2026-08-27T15:45:00.000Z';

  try {
    await writeFile(input, validCsv, 'utf8');

    await runCli([
      '--input', input,
      '--output', output,
      '--imported-at', importedAt,
    ]);

    const text = await readFile(output, 'utf8');
    const asset = JSON.parse(text);

    assert.equal(asset.schemaVersion, 1);
    assert.equal(asset.importedAt, importedAt);
    assert.equal(asset.regions[0].id, '광주광역시/북구/일곡동');
    assert.ok(text.endsWith('\n'));
    assert.ok(!text.endsWith('\n\n'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('fails with a concise usage error when required arguments are missing', async () => {
  await assert.rejects(
    runCli([]),
    (error) => {
      assert.match(error.stderr, /Usage: node scripts\/build-official-data\.mjs --input <csv> --output <json> --imported-at <timestamp>/);
      return true;
    },
  );
});
