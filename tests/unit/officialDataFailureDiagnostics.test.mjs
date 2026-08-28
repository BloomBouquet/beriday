import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOfficialDataFailureDiagnostics } from '../../dist-tests/src/data/canonical/officialDataFailureDiagnostics.js';

test('summarizes validation failure causes without copying raw error messages', () => {
  const diagnostics = buildOfficialDataFailureDiagnostics({
    schemaVersion: 1,
    importedAt: '2026-08-28T03:11:37.000Z',
    regions: [{ id: '광주광역시/북구/일곡동' }],
    rules: [],
    reports: {
      source: {
        totalRows: 7398,
        acceptedRows: 7398,
        rejectedRows: 0,
        errors: [],
      },
      mapping: {
        selectableRegions: 1200,
        unresolvedRows: 40,
        ambiguousTargetAreas: 12,
        issues: [],
      },
      normalization: {
        totalRows: 0,
        acceptedRows: 0,
        rejectedRows: 0,
        ambiguousRows: 0,
        regionsCovered: 0,
        importedAt: '2026-08-28T03:11:37.000Z',
        errors: [
          { row: 1, code: 'invalid-general-schedule', message: 'sensitive raw schedule A' },
          { row: 2, code: 'invalid-general-schedule', message: 'sensitive raw schedule B' },
          { row: 3, code: 'invalid-food-schedule', message: 'sensitive raw schedule C' },
        ],
      },
      adapter: {
        sourceRows: 7398,
        expandedRows: 0,
        skippedSourceRows: 7398,
        errors: [
          { row: 1, code: 'unsupported-no-collection-days', message: 'raw source value A' },
          { row: 2, code: 'unsupported-no-collection-days', message: 'raw source value B' },
        ],
      },
    },
  });

  assert.deepEqual(diagnostics, {
    sourceRows: 7398,
    acceptedSourceRows: 7398,
    rejectedSourceRows: 0,
    selectableRegions: 1200,
    unresolvedTargetAreaRows: 40,
    ambiguousTargetAreas: 12,
    adapterSourceRows: 7398,
    adapterExpandedRows: 0,
    adapterSkippedSourceRows: 7398,
    adapterErrorCodes: { 'unsupported-no-collection-days': 2 },
    normalizationRows: 0,
    normalizationAcceptedRows: 0,
    normalizationRejectedRows: 0,
    normalizationErrorCodes: {
      'invalid-food-schedule': 1,
      'invalid-general-schedule': 2,
    },
    producedRules: 0,
  });

  assert.doesNotMatch(JSON.stringify(diagnostics), /raw source value|sensitive raw schedule/);
});
