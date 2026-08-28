import type {
  OfficialCsvImportReport,
  OfficialHouseholdWasteRow,
} from './householdWasteCsv.js';

const OFFICIAL_API_URL = 'https://apis.data.go.kr/1741000/household_waste_info/info';

export type OfficialHouseholdWasteApiPage = {
  pageNo: number;
  numOfRows: number;
  totalCount: number;
  rows: OfficialHouseholdWasteRow[];
  sourceReport: OfficialCsvImportReport;
};

export type OfficialHouseholdWasteApiCollection = {
  totalCount: number;
  pagesFetched: number;
  rows: OfficialHouseholdWasteRow[];
  sourceReport: OfficialCsvImportReport;
};

type JsonRecord = Record<string, unknown>;

type FetchResponseLike = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

type FetchLike = (url: string) => Promise<FetchResponseLike>;

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

function formatFetchFailure(error: unknown, serviceKey: string): string {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const encodedServiceKey = encodeURIComponent(serviceKey);
  const safeMessage = rawMessage
    .replaceAll(serviceKey, '[redacted]')
    .replaceAll(encodedServiceKey, '[redacted]');

  const cause = error instanceof Error ? error.cause : undefined;
  const code = cause && typeof cause === 'object' && 'code' in cause && typeof cause.code === 'string'
    ? cause.code
    : null;

  return `Official Open API request failed: ${safeMessage}${code ? ` (${code})` : ''}`;
}

export function parseOfficialHouseholdWasteApiPage(payload: unknown): OfficialHouseholdWasteApiPage {
  const root = asRecord(payload, 'response envelope');
  const response = asRecord(root.response, 'response');
  const header = asRecord(response.header, 'header');
  const resultCode = asString(header, 'resultCode');
  if (resultCode !== '00' && resultCode !== '0') {
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
  const rows: OfficialHouseholdWasteRow[] = [];
  const errors: OfficialCsvImportReport['errors'] = [];

  rawItems.forEach((rawItem, index) => {
    const item = asRecord(rawItem, `item ${index + 1}`);
    const sourceRow = sourceOffset + index + 1;
    const sido = asString(item, 'CTPV_NM');
    const sigungu = asString(item, 'SGG_NM');
    const managementAreaName = asString(item, 'MNG_ZONE_NM');

    if (!sido || !sigungu || !managementAreaName) {
      errors.push({
        row: sourceRow,
        code: 'missing-region-key',
        message: 'Missing 시도명, 시군구명, or 관리구역명',
      });
      return;
    }

    rows.push({
      sourceRow,
      sido,
      sigungu,
      managementAreaName,
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
    });
  });

  return {
    pageNo,
    numOfRows,
    totalCount,
    rows,
    sourceReport: {
      totalRows: rawItems.length,
      acceptedRows: rows.length,
      rejectedRows: errors.length,
      errors,
    },
  };
}

export async function fetchOfficialHouseholdWasteApiRows({
  serviceKey,
  pageSize = 1000,
  fetchImpl = (url) => fetch(url),
}: {
  serviceKey: string;
  pageSize?: number;
  fetchImpl?: FetchLike;
}): Promise<OfficialHouseholdWasteApiCollection> {
  if (!serviceKey.trim()) {
    throw new Error('DATA_GO_KR_API_KEY is required');
  }
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    throw new Error('Official Open API pageSize must be a positive integer');
  }

  const rows: OfficialHouseholdWasteRow[] = [];
  const sourceReport: OfficialCsvImportReport = {
    totalRows: 0,
    acceptedRows: 0,
    rejectedRows: 0,
    errors: [],
  };
  let pageNo = 1;
  let totalCount = 0;
  let processedRows = 0;

  do {
    const url = new URL(OFFICIAL_API_URL);
    url.searchParams.set('serviceKey', serviceKey);
    url.searchParams.set('pageNo', String(pageNo));
    url.searchParams.set('numOfRows', String(pageSize));
    url.searchParams.set('returnType', 'json');

    let response: FetchResponseLike;
    try {
      response = await fetchImpl(url.toString());
    } catch (error) {
      throw new Error(formatFetchFailure(error, serviceKey));
    }

    if (!response.ok) {
      throw new Error(`Official Open API request failed with HTTP ${response.status}`);
    }

    const page = parseOfficialHouseholdWasteApiPage(await response.json());
    if (page.pageNo !== pageNo) {
      throw new Error(`Official Open API returned page ${page.pageNo} while requesting page ${pageNo}`);
    }
    if (pageNo > 1 && page.totalCount !== totalCount) {
      throw new Error('Official Open API totalCount changed during pagination');
    }
    if (page.sourceReport.totalRows === 0 && processedRows < page.totalCount) {
      throw new Error('Official Open API returned an empty page before totalCount was exhausted');
    }

    totalCount = page.totalCount;
    processedRows += page.sourceReport.totalRows;
    rows.push(...page.rows);
    sourceReport.totalRows += page.sourceReport.totalRows;
    sourceReport.acceptedRows += page.sourceReport.acceptedRows;
    sourceReport.rejectedRows += page.sourceReport.rejectedRows;
    sourceReport.errors.push(...page.sourceReport.errors);
    pageNo += 1;
  } while (processedRows < totalCount);

  if (processedRows !== totalCount) {
    throw new Error(`Official Open API returned ${processedRows} source rows for totalCount ${totalCount}`);
  }

  return {
    totalCount,
    pagesFetched: pageNo - 1,
    rows,
    sourceReport,
  };
}
