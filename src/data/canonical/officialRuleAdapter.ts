import { normalizeRows } from '../../domain/waste/normalize.js';
import type { CollectionRule, Region } from '../../domain/waste/types.js';
import type { ValidationReport } from '../../domain/waste/normalize.js';
import { makeRegionId, parseWeekdays } from '../../domain/waste/parse.js';
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

type NoCollectionSemantics =
  | { kind: 'concrete-dates'; value: string }
  | { kind: 'none'; value: '' }
  | { kind: 'recurring-weekdays'; weekdays: number[]; raw: string }
  | { kind: 'unsupported'; raw: string };

type RecurringNoCollectionDays = {
  row: number;
  raw: string;
  weekdays: number[];
};

const NO_EXCLUSION_MARKERS = new Set(['없음', '-', '해당없음', '해당 없음']);

function normalizeWeekdays(raw: string): string {
  return raw.replaceAll('+', ',').trim();
}

function toTimeRange(startRaw: string, endRaw: string): string {
  const start = startRaw.trim();
  const end = endRaw.trim();
  if (!start || !end) return '';
  return `${start}-${end}`;
}

function parseConcreteNoCollectionDays(value: string): string | null {
  const tokens = value
    .split(/[+\s,\/]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) return '';
  if (!tokens.every((token) => /^\d{4}-\d{2}-\d{2}$/.test(token))) return null;
  return tokens.join(',');
}

function parseRecurringNoCollectionWeekdays(value: string): number[] | null {
  let normalized = value
    .replace(/^매주\s+/, '')
    .replace(/\s*미수거\s*$/, '')
    .trim();

  if (normalized === '주말') return [0, 6];
  normalized = normalizeWeekdays(normalized);
  return parseWeekdays(normalized);
}

function classifyNoCollectionDays(raw: string): NoCollectionSemantics {
  const value = raw.trim();
  if (!value || NO_EXCLUSION_MARKERS.has(value)) return { kind: 'none', value: '' };

  const concreteDates = parseConcreteNoCollectionDays(value);
  if (concreteDates !== null) return { kind: 'concrete-dates', value: concreteDates };

  const recurringWeekdays = parseRecurringNoCollectionWeekdays(value);
  if (recurringWeekdays) {
    return { kind: 'recurring-weekdays', weekdays: recurringWeekdays, raw: value };
  }

  return { kind: 'unsupported', raw: value };
}

function overlapsWeekdays(rule: CollectionRule, excludedWeekdays: readonly number[]): boolean {
  return excludedWeekdays.some((weekday) => rule.weekdays.includes(weekday));
}

export function adaptOfficialRowsToCollectionRules(
  rows: readonly OfficialHouseholdWasteRow[],
  importedAt: string,
): OfficialRuleAdapterResult {
  const mapping = buildTargetAreaCatalog(rows);
  const selectableRegionIds = new Set(mapping.regions.map((region) => region.id));
  const rawRows = [];
  const errors: OfficialRuleAdapterError[] = [];
  const unsupportedNoCollectionSourceIds = new Set<string>();
  const recurringNoCollectionBySourceId = new Map<string, RecurringNoCollectionDays>();

  for (const row of rows) {
    const sourceId = `household-waste:${row.sourceRow}`;
    const noCollectionDays = classifyNoCollectionDays(row.noCollectionDays);

    if (noCollectionDays.kind === 'unsupported') {
      unsupportedNoCollectionSourceIds.add(sourceId);
      errors.push({
        row: row.sourceRow,
        code: 'unsupported-no-collection-days',
        message: `Cannot safely convert 미수거일 to concrete excluded dates: ${row.noCollectionDays}`,
      });
    } else if (noCollectionDays.kind === 'recurring-weekdays') {
      recurringNoCollectionBySourceId.set(sourceId, {
        row: row.sourceRow,
        raw: noCollectionDays.raw,
        weekdays: noCollectionDays.weekdays,
      });
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
        noCollectionDays: noCollectionDays.kind === 'concrete-dates' ? noCollectionDays.value : '',
        authorityName: row.authorityName,
        authorityContact: row.authorityContact,
        sourceUpdatedAt: row.sourceUpdatedAt,
      });
    }
  }

  const normalized = normalizeRows(rawRows, importedAt);
  const overlappingRecurringSourceIds = new Set<string>();
  const rules = normalized.rules.map((rule) => {
    if (unsupportedNoCollectionSourceIds.has(rule.provenance.sourceId)) {
      return { ...rule, confidence: 'ambiguous' as const };
    }

    const recurring = recurringNoCollectionBySourceId.get(rule.provenance.sourceId);
    if (recurring && overlapsWeekdays(rule, recurring.weekdays)) {
      overlappingRecurringSourceIds.add(rule.provenance.sourceId);
      return { ...rule, confidence: 'ambiguous' as const };
    }

    return rule;
  });

  for (const sourceId of overlappingRecurringSourceIds) {
    const recurring = recurringNoCollectionBySourceId.get(sourceId);
    if (!recurring) continue;
    errors.push({
      row: recurring.row,
      code: 'unsupported-no-collection-days',
      message: `Cannot safely apply recurring 미수거일 weekdays to overlapping schedules: ${recurring.raw}`,
    });
  }
  errors.sort((a, b) => a.row - b.row);

  const ambiguousRows = new Set(
    rules
      .filter((rule) => rule.confidence === 'ambiguous')
      .map((rule) => rule.provenance.sourceId),
  ).size;

  return {
    regions: mapping.regions,
    rules,
    mappingReport: mapping.report,
    normalizationReport: {
      ...normalized.report,
      ambiguousRows,
    },
    adapterReport: {
      sourceRows: rows.length,
      expandedRows: rawRows.length,
      skippedSourceRows: 0,
      errors,
    },
  };
}
