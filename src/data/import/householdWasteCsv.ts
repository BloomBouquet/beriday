export type OfficialHouseholdWasteRow = {
  sourceRow: number;
  sido: string;
  sigungu: string;
  managementAreaName: string;
  targetAreaNames: string[];
  generalMethod: string;
  foodMethod: string;
  recyclingMethod: string;
  generalWeekdays: string;
  foodWeekdays: string;
  recyclingWeekdays: string;
  generalStartTime: string;
  generalEndTime: string;
  foodStartTime: string;
  foodEndTime: string;
  recyclingStartTime: string;
  recyclingEndTime: string;
  noCollectionDays: string;
  authorityName: string;
  authorityContact: string;
  sourceUpdatedAt: string;
};

export type OfficialCsvImportError = {
  row: number;
  code: string;
  message: string;
};

export type OfficialCsvImportReport = {
  totalRows: number;
  acceptedRows: number;
  rejectedRows: number;
  errors: OfficialCsvImportError[];
};

export type OfficialCsvImportResult = {
  rows: OfficialHouseholdWasteRow[];
  report: OfficialCsvImportReport;
};

const REQUIRED_HEADERS = [
  '시도명',
  '시군구명',
  '관리구역명',
  '관리구역대상지역명',
  '생활쓰레기배출방법',
  '음식물쓰레기배출방법',
  '재활용품배출방법',
  '생활쓰레기배출요일',
  '음식물쓰레기배출요일',
  '재활용품배출요일',
  '생활쓰레기배출시작시각',
  '생활쓰레기배출종료시각',
  '음식물쓰레기배출시작시각',
  '음식물쓰레기배출종료시각',
  '재활용품배출시작시각',
  '재활용품배출종료시각',
  '미수거일',
  '관리부서명',
  '관리부서전화번호',
  '데이터기준일자',
] as const;

type RequiredHeader = (typeof REQUIRED_HEADERS)[number];

function stripUtf8Bom(input: string): string {
  return input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
}

function parseCsvMatrix(input: string): string[][] {
  const text = stripUtf8Bom(input);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && field.length === 0) {
      inQuotes = true;
      continue;
    }

    if (character === ',') {
      row.push(field);
      field = '';
      continue;
    }

    if (character === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }

    if (character === '\r') {
      if (text[index + 1] === '\n') continue;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }

    field += character ?? '';
  }

  if (inQuotes) {
    throw new Error('Unterminated quoted CSV field');
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function isEmptyRow(row: readonly string[]): boolean {
  return row.every((value) => value.trim().length === 0);
}

function buildHeaderIndex(headerRow: readonly string[]): Map<string, number> {
  const indexByHeader = new Map<string, number>();

  headerRow.forEach((header, index) => {
    const normalizedHeader = header.trim();
    if (normalizedHeader && !indexByHeader.has(normalizedHeader)) {
      indexByHeader.set(normalizedHeader, index);
    }
  });

  const missing = REQUIRED_HEADERS.filter((header) => !indexByHeader.has(header));
  if (missing.length > 0) {
    throw new Error(`Missing required official CSV headers: ${missing.join(', ')}`);
  }

  return indexByHeader;
}

function getValue(
  row: readonly string[],
  indexByHeader: ReadonlyMap<string, number>,
  header: RequiredHeader,
): string {
  const index = indexByHeader.get(header);
  if (index === undefined) {
    throw new Error(`Missing required official CSV header: ${header}`);
  }
  return (row[index] ?? '').trim();
}

function parseTargetAreaNames(raw: string): string[] {
  const normalized = raw.trim();
  if (!normalized || normalized === '없음') return [];

  return normalized
    .split('+')
    .map((name) => name.trim())
    .filter(Boolean);
}

function toOfficialRow(
  sourceRow: readonly string[],
  indexByHeader: ReadonlyMap<string, number>,
  sourceRowNumber: number,
): OfficialHouseholdWasteRow {
  return {
    sourceRow: sourceRowNumber,
    sido: getValue(sourceRow, indexByHeader, '시도명'),
    sigungu: getValue(sourceRow, indexByHeader, '시군구명'),
    managementAreaName: getValue(sourceRow, indexByHeader, '관리구역명'),
    targetAreaNames: parseTargetAreaNames(
      getValue(sourceRow, indexByHeader, '관리구역대상지역명'),
    ),
    generalMethod: getValue(sourceRow, indexByHeader, '생활쓰레기배출방법'),
    foodMethod: getValue(sourceRow, indexByHeader, '음식물쓰레기배출방법'),
    recyclingMethod: getValue(sourceRow, indexByHeader, '재활용품배출방법'),
    generalWeekdays: getValue(sourceRow, indexByHeader, '생활쓰레기배출요일'),
    foodWeekdays: getValue(sourceRow, indexByHeader, '음식물쓰레기배출요일'),
    recyclingWeekdays: getValue(sourceRow, indexByHeader, '재활용품배출요일'),
    generalStartTime: getValue(sourceRow, indexByHeader, '생활쓰레기배출시작시각'),
    generalEndTime: getValue(sourceRow, indexByHeader, '생활쓰레기배출종료시각'),
    foodStartTime: getValue(sourceRow, indexByHeader, '음식물쓰레기배출시작시각'),
    foodEndTime: getValue(sourceRow, indexByHeader, '음식물쓰레기배출종료시각'),
    recyclingStartTime: getValue(sourceRow, indexByHeader, '재활용품배출시작시각'),
    recyclingEndTime: getValue(sourceRow, indexByHeader, '재활용품배출종료시각'),
    noCollectionDays: getValue(sourceRow, indexByHeader, '미수거일'),
    authorityName: getValue(sourceRow, indexByHeader, '관리부서명'),
    authorityContact: getValue(sourceRow, indexByHeader, '관리부서전화번호'),
    sourceUpdatedAt: getValue(sourceRow, indexByHeader, '데이터기준일자'),
  };
}

export function parseOfficialHouseholdWasteCsv(csv: string): OfficialCsvImportResult {
  const matrix = parseCsvMatrix(csv);
  const firstNonEmptyIndex = matrix.findIndex((row) => !isEmptyRow(row));

  if (firstNonEmptyIndex === -1) {
    throw new Error('Missing required official CSV headers: CSV is empty');
  }

  const headerRow = matrix[firstNonEmptyIndex];
  if (!headerRow) {
    throw new Error('Missing required official CSV headers: CSV is empty');
  }

  const indexByHeader = buildHeaderIndex(headerRow);
  const dataRows = matrix.slice(firstNonEmptyIndex + 1).filter((row) => !isEmptyRow(row));
  const rows: OfficialHouseholdWasteRow[] = [];
  const errors: OfficialCsvImportError[] = [];

  dataRows.forEach((sourceRow, index) => {
    const sourceRowNumber = index + 1;
    const row = toOfficialRow(sourceRow, indexByHeader, sourceRowNumber);

    if (!row.sido || !row.sigungu || !row.managementAreaName) {
      errors.push({
        row: sourceRowNumber,
        code: 'missing-region-key',
        message: 'Missing 시도명, 시군구명, or 관리구역명',
      });
      return;
    }

    rows.push(row);
  });

  return {
    rows,
    report: {
      totalRows: dataRows.length,
      acceptedRows: rows.length,
      rejectedRows: errors.length,
      errors,
    },
  };
}
