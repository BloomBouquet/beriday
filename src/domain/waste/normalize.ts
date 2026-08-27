import { makeRegionId, parseTimeWindows, parseWeekdays } from './parse.js';
import type { CollectionRule, Region, RuleProvenance, WasteCategory } from './types.js';

export type RawWasteRow = {
  sourceRow?: number;
  sido: string;
  sigungu: string;
  areaName: string;
  generalWeekdays?: string;
  generalTime?: string;
  generalMethod?: string;
  foodWeekdays?: string;
  foodTime?: string;
  foodMethod?: string;
  recyclingWeekdays?: string;
  recyclingTime?: string;
  recyclingMethod?: string;
  noCollectionDays?: string;
  authorityName?: string;
  authorityContact?: string;
  sourceUpdatedAt?: string;
};

export type ValidationError = { row: number; code: string; message: string };
export type ValidationReport = {
  totalRows: number;
  acceptedRows: number;
  rejectedRows: number;
  ambiguousRows: number;
  regionsCovered: number;
  importedAt: string;
  errors: ValidationError[];
};

const SOURCE_URL = 'https://www.data.go.kr/data/15075534/fileData.do?recommendDataYn=Y';
const SOURCE_NAME = '행정안전부 생활쓰레기배출정보';

type CategoryFields = {
  category: WasteCategory;
  weekdays: keyof RawWasteRow;
  time: keyof RawWasteRow;
  method: keyof RawWasteRow;
};

const CATEGORY_FIELDS: CategoryFields[] = [
  { category: 'general', weekdays: 'generalWeekdays', time: 'generalTime', method: 'generalMethod' },
  { category: 'food', weekdays: 'foodWeekdays', time: 'foodTime', method: 'foodMethod' },
  { category: 'recycling', weekdays: 'recyclingWeekdays', time: 'recyclingTime', method: 'recyclingMethod' },
];

function parseExcludedDates(raw?: string): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[\s,\/]+/)
    .map((value) => value.trim())
    .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function scheduleFingerprint(rule: CollectionRule): string {
  return JSON.stringify({ weekdays: rule.weekdays, timeWindows: rule.timeWindows });
}

function getSourceRowNumber(row: RawWasteRow, index: number): number {
  return Number.isInteger(row.sourceRow) && Number(row.sourceRow) > 0
    ? Number(row.sourceRow)
    : index + 1;
}

export function normalizeRows(rows: RawWasteRow[], importedAt: string): {
  regions: Region[];
  rules: CollectionRule[];
  report: ValidationReport;
} {
  const regions = new Map<string, Region>();
  const rules: CollectionRule[] = [];
  const errors: ValidationError[] = [];
  const acceptedSourceRows = new Set<number>();
  const rejectedSourceRows = new Set<number>();

  rows.forEach((row, index) => {
    const rowNumber = getSourceRowNumber(row, index);
    let regionId: string;
    try {
      regionId = makeRegionId(row.sido, row.sigungu, row.areaName);
    } catch {
      rejectedSourceRows.add(rowNumber);
      errors.push({ row: rowNumber, code: 'invalid-region-key', message: 'Missing sido, sigungu, or areaName' });
      return;
    }

    const region: Region = {
      id: regionId,
      sido: row.sido.trim(),
      sigungu: row.sigungu.trim(),
      areaName: row.areaName.trim(),
      displayName: [row.sido, row.sigungu, row.areaName].map((v) => v.trim()).join(' '),
    };
    regions.set(regionId, region);
    acceptedSourceRows.add(rowNumber);

    const provenance: RuleProvenance = {
      sourceId: `household-waste:${rowNumber}`,
      sourceName: SOURCE_NAME,
      sourceUrl: SOURCE_URL,
      sourceUpdatedAt: row.sourceUpdatedAt?.trim() || null,
      importedAt,
      authorityName: row.authorityName?.trim() || null,
      authorityContact: row.authorityContact?.trim() || null,
    };

    for (const fields of CATEGORY_FIELDS) {
      const rawWeekdays = String(row[fields.weekdays] ?? '').trim();
      const rawTime = String(row[fields.time] ?? '').trim();
      const method = String(row[fields.method] ?? '').trim();
      if (!rawWeekdays && !rawTime && !method) continue;

      const weekdays = parseWeekdays(rawWeekdays);
      const timeWindows = parseTimeWindows(rawTime);
      if (!weekdays || !timeWindows) {
        errors.push({
          row: rowNumber,
          code: `invalid-${fields.category}-schedule`,
          message: `Could not parse ${fields.category} weekday/time schedule`,
        });
        continue;
      }

      rules.push({
        id: `${regionId}:${fields.category}:${rowNumber}`,
        regionId,
        category: fields.category,
        weekdays,
        timeWindows,
        excludedDates: parseExcludedDates(row.noCollectionDays),
        instructions: method ? [method] : [],
        confidence: 'verified',
        provenance,
      });
    }
  });

  const byKey = new Map<string, CollectionRule[]>();
  for (const rule of rules) {
    const key = `${rule.regionId}|${rule.category}`;
    const group = byKey.get(key) ?? [];
    group.push(rule);
    byKey.set(key, group);
  }

  const ambiguousSourceRows = new Set<string>();
  for (const group of byKey.values()) {
    if (group.length < 2) continue;
    const fingerprints = new Set(group.map(scheduleFingerprint));
    if (fingerprints.size < 2) continue;
    for (const rule of group) {
      rule.confidence = 'ambiguous';
      ambiguousSourceRows.add(rule.provenance.sourceId);
    }
  }

  return {
    regions: [...regions.values()],
    rules,
    report: {
      totalRows: rows.length,
      acceptedRows: acceptedSourceRows.size,
      rejectedRows: rejectedSourceRows.size,
      ambiguousRows: ambiguousSourceRows.size,
      regionsCovered: regions.size,
      importedAt,
      errors,
    },
  };
}
