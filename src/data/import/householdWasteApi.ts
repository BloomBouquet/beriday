import type { OfficialHouseholdWasteRow } from './householdWasteCsv.js';

export type OfficialHouseholdWasteApiPage = {
  pageNo: number;
  numOfRows: number;
  totalCount: number;
  rows: OfficialHouseholdWasteRow[];
};

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid official Open API ${label}`);
  }
  return value as JsonRecord;
}

function asNumber(value: unknown, label: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid official Open API ${label}`);
  }
  return parsed;
}

function asString(record: JsonRecord, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
}

function parseTargetAreaNames(value: string): string[] {
  if (!value || value === '없음') return [];
  return value.split('+').map((name) => name.trim()).filter(Boolean);
}

export function parseOfficialHouseholdWasteApiPage(payload: unknown): OfficialHouseholdWasteApiPage {
  const root = asRecord(payload, 'response envelope');
  const response = asRecord(root.response, 'response');
  const header = asRecord(response.header, 'header');
  const resultCode = asString(header, 'resultCode');
  if (resultCode !== '00') {
    throw new Error(`Official Open API returned resultCode ${resultCode || 'unknown'}`);
  }

  const body = asRecord(response.body, 'body');
  const pageNo = asNumber(body.pageNo, 'pageNo');
  const numOfRows = asNumber(body.numOfRows, 'numOfRows');
  const totalCount = asNumber(body.totalCount, 'totalCount');
  const items = asRecord(body.items, 'items');
  const rawItems = items.item;
  if (!Array.isArray(rawItems)) {
    throw new Error('Invalid official Open API items.item');
  }

  const sourceOffset = Math.max(0, (pageNo - 1) * numOfRows);
  const rows = rawItems.map((rawItem, index): OfficialHouseholdWasteRow => {
    const item = asRecord(rawItem, `item ${index + 1}`);
    return {
      sourceRow: sourceOffset + index + 1,
      sido: asString(item, 'CTPV_NM'),
      sigungu: asString(item, 'SGG_NM'),
      managementAreaName: asString(item, 'MNG_ZONE_NM'),
      targetAreaNames: parseTargetAreaNames(asString(item, 'MNG_ZONE_TRGT_RGN_NM')),
      generalMethod: asString(item, 'LF_WST_EMSN_MTHD'),
      foodMethod: asString(item, 'FOD_WST_EMSN_MTHD'),
      recyclingMethod: asString(item, 'RCYCL_EMSN_MTHD'),
      generalWeekdays: asString(item, 'LF_WST_EMSN_DOW'),
      foodWeekdays: asString(item, 'FOD_WST_EMSN_DOW'),
      recyclingWeekdays: asString(item, 'RCYCL_EMSN_DOW'),
      generalStartTime: asString(item, 'LF_WST_EMSN_BGNG_TM'),
      generalEndTime: asString(item, 'LF_WST_EMSN_END_TM'),
      foodStartTime: asString(item, 'FOD_WST_EMSN_BGNG_TM'),
      foodEndTime: asString(item, 'FOD_WST_EMSN_END_TM'),
      recyclingStartTime: asString(item, 'RCYCL_EMSN_BGNG_TM'),
      recyclingEndTime: asString(item, 'RCYCL_EMSN_END_TM'),
      noCollectionDays: asString(item, 'UNCLLT_DAY'),
      authorityName: asString(item, 'MNG_DEPT_NM'),
      authorityContact: asString(item, 'MNG_DEPT_TELNO'),
      sourceUpdatedAt: asString(item, 'DAT_CRTR_YMD'),
    };
  });

  return { pageNo, numOfRows, totalCount, rows };
}
