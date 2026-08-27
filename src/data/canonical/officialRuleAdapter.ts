import { normalizeRows } from '../../domain/waste/normalize.js';
import type { CollectionRule, Region } from '../../domain/waste/types.js';
import type { ValidationReport } from '../../domain/waste/normalize.js';
import { makeRegionId } from '../../domain/waste/parse.js';
import type { OfficialHouseholdWasteRow } from '../import/householdWasteCsv.js';
import { buildTargetAreaCatalog } from './targetAreaMapping.js';
import type { TargetAreaMappingReport } from './targetAreaMapping.js';

export type OfficialRuleAdapterError = {
  row: number;
  code: 'unsupported-no-collection-days';
  message: string;
};

export type OfficialRuleAdapterReport = {
  sourceRows: number;
  expandedRows: number;
  skippedSourceRows: number;
  errors: OfficialRuleAdapterError[];
};

export type OfficialRuleAdapterResult = {
  regions: Region[];
  rules: CollectionRule[];
  mappingReport: TargetAreaMappingReport;
  normalizationReport: ValidationReport;
  adapterReport: OfficialRuleAdapterReport;
};

function normalizeWeekdays(raw: string): string {
  return raw.replaceAll('+', ',').trim();
}

function toTimeRange(startRaw: string, endRaw: string): string {
  const start = startRaw.trim();
  const end = endRaw.trim();
  if (!start || !end) return '';
  return `${start}-${end}`;
}

function normalizeConcreteNoCollectionDays(raw: string): {
  supported: boolean;
  value: string;
} {
  const value = raw.trim();
  if (!value) return { supported: true, value: '' };

  const tokens = value
    .split(/[+\s,\/]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) return { supported: true, value: '' };
  if (!tokens.every((token) => /^\d{4}-\d{2}-\d{2}$/.test(token))) {
    return { supported: false, value: '' };
  }

  return { supported: true, value: tokens.join(',') };
}

export function adaptOfficialRowsToCollectionRules(
  rows: readonly OfficialHouseholdWasteRow[],
  importedAt: string,
): OfficialRuleAdapterResult {
  const mapping = buildTargetAreaCatalog(rows);
  const selectableRegionIds = new Set(mapping.regions.map((region) => region.id));
  const rawRows = [];
  const errors: OfficialRuleAdapterError[] = [];
  const skippedSourceRows = new Set<number>();

  for (const row of rows) {
    const noCollectionDays = normalizeConcreteNoCollectionDays(row.noCollectionDays);
    if (!noCollectionDays.supported) {
      skippedSourceRows.add(row.sourceRow);
      errors.push({
        row: row.sourceRow,
        code: 'unsupported-no-collection-days',
        message: `Cannot safely convert 미수거일 to concrete excluded dates: ${row.noCollectionDays}`,
      });
      continue;
    }

    const targetAreaNames = [...new Set(row.targetAreaNames.map((name) => name.trim()).filter(Boolean))];
    for (const areaName of targetAreaNames) {
      const regionId = makeRegionId(row.sido, row.sigungu, areaName);
      if (!selectableRegionIds.has(regionId)) continue;

      rawRows.push({
        sourceRow: row.sourceRow,
        sido: row.sido,
        sigungu: row.sigungu,
        areaName,
        generalWeekdays: normalizeWeekdays(row.generalWeekdays),
        generalTime: toTimeRange(row.generalStartTime, row.generalEndTime),
        generalMethod: row.generalMethod,
        foodWeekdays: normalizeWeekdays(row.foodWeekdays),
        foodTime: toTimeRange(row.foodStartTime, row.foodEndTime),
        foodMethod: row.foodMethod,
        recyclingWeekdays: normalizeWeekdays(row.recyclingWeekdays),
        recyclingTime: toTimeRange(row.recyclingStartTime, row.recyclingEndTime),
        recyclingMethod: row.recyclingMethod,
        noCollectionDays: noCollectionDays.value,
        authorityName: row.authorityName,
        authorityContact: row.authorityContact,
        sourceUpdatedAt: row.sourceUpdatedAt,
      });
    }
  }

  const normalized = normalizeRows(rawRows, importedAt);

  return {
    regions: mapping.regions,
    rules: normalized.rules,
    mappingReport: mapping.report,
    normalizationReport: normalized.report,
    adapterReport: {
      sourceRows: rows.length,
      expandedRows: rawRows.length,
      skippedSourceRows: skippedSourceRows.size,
      errors,
    },
  };
}
