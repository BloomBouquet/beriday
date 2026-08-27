import type { CollectionRule, Region } from '../../domain/waste/types.js';
import {
  parseOfficialHouseholdWasteCsv,
  type OfficialCsvImportReport,
} from '../import/householdWasteCsv.js';
import {
  adaptOfficialRowsToCollectionRules,
  type OfficialRuleAdapterReport,
} from './officialRuleAdapter.js';
import type { ValidationReport } from '../../domain/waste/normalize.js';
import type { TargetAreaMappingReport } from './targetAreaMapping.js';

export type OfficialDataBundleReports = {
  source: OfficialCsvImportReport;
  mapping: TargetAreaMappingReport;
  normalization: ValidationReport;
  adapter: OfficialRuleAdapterReport;
};

export type OfficialDataBundle = {
  schemaVersion: 1;
  importedAt: string;
  regions: Region[];
  rules: CollectionRule[];
  reports: OfficialDataBundleReports;
};

function sortById<T extends { id: string }>(items: readonly T[]): T[] {
  return [...items].sort((left, right) => left.id.localeCompare(right.id, 'ko'));
}

export function buildOfficialDataBundle(csv: string, importedAt: string): OfficialDataBundle {
  const parsed = parseOfficialHouseholdWasteCsv(csv);
  const adapted = adaptOfficialRowsToCollectionRules(parsed.rows, importedAt);

  return {
    schemaVersion: 1,
    importedAt,
    regions: sortById(adapted.regions),
    rules: sortById(adapted.rules),
    reports: {
      source: parsed.report,
      mapping: adapted.mappingReport,
      normalization: adapted.normalizationReport,
      adapter: adapted.adapterReport,
    },
  };
}
