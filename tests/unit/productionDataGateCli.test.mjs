import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

function makeBundle() {
  return {
    schemaVersion: 1,
    importedAt: '2026-08-28T00:00:00.000Z',
    regions: [{ id: 'r1', sido: '서울특별시', sigungu: '강남구', areaName: '역삼동', displayName: '서울특별시 강남구 역삼동' }],
    rules: [{
      id: 'rule-1', regionId: 'r1', category: 'general', weekdays: [1],
      timeWindows: [{ start: '20:00', end: '23:00' }], excludedDates: [], instructions: [], confidence: 'verified',
      provenance: {
        sourceId: 'source-1', sourceName: 'official', sourceUrl: 'https://www.data.go.kr/data/15075534/fileData.do',
        sourceUpdatedAt: '2026-08-27', importedAt: '2026-08-28T00:00:00.000Z', authorityName: null, authorityContact: null,
      },
    }],
    reports: {
      source: { totalRows: 1, acceptedRows: 1, rejectedRows: 0, errors: [] },
      mapping: { selectableRegions: 1, unresolvedRows: 0, ambiguousTargetAreas: 0, issues: [] },
      normalization: { totalRows: 1, acceptedRows: 1, rejectedRows: 0, ambiguousRows: 0, regionsCovered: 1, importedAt: '2026-08-28T00:00:00.000Z', errors: [] },
      adapter: { sourceRows: 1, expandedRows: 1, skippedSourceRows: 0, errors: [] },
    },
  };
}

function makeReport() {
  return {
    schemaVersion: 1,
    importedAt: '2026-08-28T00:00:00.000Z',
    sourceUpdatedAt: '2026-08-27',
    sourceRows: 1,
    acceptedRows: 1,
    rejectedRows: 0,
    ambiguousRows: 0,
    coveredRegions: 1,
    rules: 1,
    criticalErrors: [],
    warnings: [],
  };
}

async function runCli(args) {
  return execFileAsync(process.execPath, ['scripts/verify-production-data.mjs', ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}

test('verifies an explicit production asset and validation report pair', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'beriday-production-gate-'));
  const asset = path.join(dir, 'official-data.json');
  const report = path.join(dir, 'official-data-validation.json');

  try {
    await writeFile(asset, `${JSON.stringify(makeBundle(), null, 2)}\n`, 'utf8');
    await writeFile(report, `${JSON.stringify(makeReport(), null, 2)}\n`, 'utf8');

    const result = await runCli(['--asset', asset, '--report', report]);
    const output = JSON.parse(result.stdout);

    assert.equal(output.coveredRegions, 1);
    assert.equal(output.rules, 1);
    assert.equal(output.warnings, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('fails with concise usage when required paths are missing', async () => {
  await assert.rejects(
    runCli([]),
    (error) => {
      assert.match(error.stderr, /--asset <json> --report <json>/);
      return true;
    },
  );
});
