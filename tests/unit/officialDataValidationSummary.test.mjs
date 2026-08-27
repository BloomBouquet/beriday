import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOfficialDataValidationSummary,
  serializeOfficialDataValidationSummary,
} from '../../dist-tests/src/data/canonical/officialDataValidationSummary.js';

function makeBundle() {
  return {
    schemaVersion: 1,
    importedAt: '2026-08-28T00:00:00.000Z',
    regions: [
      { id: 'r1', sido: '서울특별시', sigungu: '강남구', areaName: '역삼동', displayName: '서울특별시 강남구 역삼동' },
      { id: 'r2', sido: '부산광역시', sigungu: '해운대구', areaName: '우동', displayName: '부산광역시 해운대구 우동' },
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
          sourceUpdatedAt: '2026-08-25',
          importedAt: '2026-08-28T00:00:00.000Z',
          authorityName: null,
          authorityContact: null,
        },
      },
      {
        id: 'rule-2',
        regionId: 'r2',
        category: 'recycling',
        weekdays: [3],
        timeWindows: [{ start: '18:00', end: '22:00' }],
        excludedDates: [],
        instructions: [],
        confidence: 'ambiguous',
        provenance: {
          sourceId: 'source-2',
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
      source: {
        totalRows: 10,
        acceptedRows: 9,
        rejectedRows: 1,
        errors: [{ row: 10, code: 'invalid-region-key', message: 'invalid' }],
      },
      mapping: {
        selectableRegions: 2,
        unresolvedRows: 1,
        ambiguousTargetAreas: 1,
        issues: [],
      },
      normalization: {
        totalRows: 9,
        acceptedRows: 8,
        rejectedRows: 1,
        ambiguousRows: 2,
        regionsCovered: 2,
        importedAt: '2026-08-28T00:00:00.000Z',
        errors: [{ row: 4, code: 'invalid-general-schedule', message: 'invalid' }],
      },
      adapter: {
        sourceRows: 9,
        expandedRows: 8,
        skippedSourceRows: 1,
        errors: [{ row: 5, code: 'unsupported-no-collection-days', message: 'unsupported' }],
      },
    },
  };
}

test('builds an auditable production validation summary from a successful bundle', () => {
  const summary = buildOfficialDataValidationSummary(makeBundle());

  assert.deepEqual(summary, {
    schemaVersion: 1,
    importedAt: '2026-08-28T00:00:00.000Z',
    sourceUpdatedAt: '2026-08-27',
    sourceRows: 10,
    acceptedRows: 9,
    rejectedRows: 1,
    ambiguousRows: 2,
    coveredRegions: 2,
    rules: 2,
    criticalErrors: [],
    warnings: [
      '1 source row(s) were rejected.',
      '1 target area row(s) were unresolved.',
      '1 target area(s) were ambiguous.',
      '2 normalized source row(s) are ambiguous.',
      '1 normalization error(s) were recorded.',
      '1 source row(s) were skipped by the rule adapter.',
    ],
  });
});

test('marks an empty production bundle as critical instead of treating it as deployable', () => {
  const bundle = makeBundle();
  bundle.regions = [];
  bundle.rules = [];

  const summary = buildOfficialDataValidationSummary(bundle);

  assert.deepEqual(summary.criticalErrors, [
    'No selectable regions were produced.',
    'No collection rules were produced.',
  ]);
});

test('serializes validation summaries deterministically with one trailing newline', () => {
  const summary = buildOfficialDataValidationSummary(makeBundle());
  const serialized = serializeOfficialDataValidationSummary(summary);

  assert.equal(serialized, `${JSON.stringify(summary, null, 2)}\n`);
});
