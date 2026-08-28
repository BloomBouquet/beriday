import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyProductionDataPair } from '../../dist-tests/src/data/canonical/productionDataGate.js';

function makeBundle() {
  return {
    schemaVersion: 1,
    importedAt: '2026-08-28T00:00:00.000Z',
    regions: [
      { id: 'r1', sido: '서울특별시', sigungu: '강남구', areaName: '역삼동', displayName: '서울특별시 강남구 역삼동' },
    ],
    rules: [
      {
        id: 'rule-1',
        regionId: 'r1',
        category: 'general',
        weekdays: [1],
        timeWindows: [{ start: '20:00', end: '23:00' }],
        excludedDates: [],
        instructions: [],
        confidence: 'verified',
        provenance: {
          sourceId: 'source-1',
          sourceName: 'official',
          sourceUrl: 'https://www.data.go.kr/data/15075534/fileData.do',
          sourceUpdatedAt: '2026-08-27',
          importedAt: '2026-08-28T00:00:00.000Z',
          authorityName: null,
          authorityContact: null,
        },
      },
    ],
    reports: {
      source: { totalRows: 10, acceptedRows: 9, rejectedRows: 1, errors: [] },
      mapping: { selectableRegions: 1, unresolvedRows: 0, ambiguousTargetAreas: 0, issues: [] },
      normalization: {
        totalRows: 9,
        acceptedRows: 9,
        rejectedRows: 0,
        ambiguousRows: 0,
        regionsCovered: 1,
        importedAt: '2026-08-28T00:00:00.000Z',
        errors: [],
      },
      adapter: { sourceRows: 9, expandedRows: 9, skippedSourceRows: 0, errors: [] },
    },
  };
}

function makeReport() {
  return {
    schemaVersion: 1,
    importedAt: '2026-08-28T00:00:00.000Z',
    sourceUpdatedAt: '2026-08-27',
    sourceRows: 10,
    acceptedRows: 9,
    rejectedRows: 1,
    ambiguousRows: 0,
    coveredRegions: 1,
    rules: 1,
    criticalErrors: [],
    warnings: ['1 source row(s) were rejected.'],
  };
}

test('accepts a validation report that exactly matches the deployable bundle', () => {
  const result = verifyProductionDataPair(makeBundle(), makeReport());

  assert.deepEqual(result, {
    importedAt: '2026-08-28T00:00:00.000Z',
    sourceUpdatedAt: '2026-08-27',
    coveredRegions: 1,
    rules: 1,
    warnings: 1,
  });
});

test('rejects a validation report from a different refresh timestamp', () => {
  const report = makeReport();
  report.importedAt = '2026-08-27T00:00:00.000Z';

  assert.throws(
    () => verifyProductionDataPair(makeBundle(), report),
    /importedAt does not match/,
  );
});

test('rejects production data when validation contains critical errors', () => {
  const report = makeReport();
  report.criticalErrors = ['No collection rules were produced.'];

  assert.throws(
    () => verifyProductionDataPair(makeBundle(), report),
    /critical error/,
  );
});

test('rejects count drift between the deployable bundle and validation report', () => {
  const report = makeReport();
  report.rules = 2;

  assert.throws(
    () => verifyProductionDataPair(makeBundle(), report),
    /rule count does not match/,
  );
});
