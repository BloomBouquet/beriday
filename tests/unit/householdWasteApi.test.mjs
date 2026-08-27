import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchOfficialHouseholdWasteApiRows,
  parseOfficialHouseholdWasteApiPage,
} from '../../dist-tests/src/data/import/householdWasteApi.js';

function apiItem(targetAreaName, overrides = {}) {
  return {
    CTPV_NM: '광주광역시',
    SGG_NM: '북구',
    MNG_ZONE_NM: '1권역',
    MNG_ZONE_TRGT_RGN_NM: targetAreaName,
    LF_WST_EMSN_MTHD: '종량제봉투',
    FOD_WST_EMSN_MTHD: '전용용기',
    RCYCL_EMSN_MTHD: '분리배출',
    LF_WST_EMSN_DOW: '월+수+금',
    FOD_WST_EMSN_DOW: '화+목',
    RCYCL_EMSN_DOW: '수+금',
    LF_WST_EMSN_BGNG_TM: '19:00',
    LF_WST_EMSN_END_TM: '02:00',
    FOD_WST_EMSN_BGNG_TM: '18:00',
    FOD_WST_EMSN_END_TM: '23:00',
    RCYCL_EMSN_BGNG_TM: '20:00',
    RCYCL_EMSN_END_TM: '02:00',
    UNCLLT_DAY: '2026-09-01',
    MNG_DEPT_NM: '청소행정과',
    MNG_DEPT_TELNO: '062-000-0000',
    DAT_CRTR_YMD: '2026-08-25',
    ...overrides,
  };
}

function apiPage({ pageNo, numOfRows, totalCount, items }) {
  return {
    response: {
      header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
      body: {
        dataType: 'JSON',
        pageNo,
        numOfRows,
        totalCount,
        items: { item: items },
      },
    },
  };
}

test('adapts one official Open API item to the existing household-waste row contract', () => {
  const result = parseOfficialHouseholdWasteApiPage(
    apiPage({ pageNo: 1, numOfRows: 100, totalCount: 7398, items: [apiItem('일곡동+매곡동')] }),
  );

  assert.equal(result.pageNo, 1);
  assert.equal(result.numOfRows, 100);
  assert.equal(result.totalCount, 7398);
  assert.deepEqual(result.rows, [
    {
      sourceRow: 1,
      sido: '광주광역시',
      sigungu: '북구',
      managementAreaName: '1권역',
      targetAreaNames: ['일곡동', '매곡동'],
      generalMethod: '종량제봉투',
      foodMethod: '전용용기',
      recyclingMethod: '분리배출',
      generalWeekdays: '월+수+금',
      foodWeekdays: '화+목',
      recyclingWeekdays: '수+금',
      generalStartTime: '19:00',
      generalEndTime: '02:00',
      foodStartTime: '18:00',
      foodEndTime: '23:00',
      recyclingStartTime: '20:00',
      recyclingEndTime: '02:00',
      noCollectionDays: '2026-09-01',
      authorityName: '청소행정과',
      authorityContact: '062-000-0000',
      sourceUpdatedAt: '2026-08-25',
    },
  ]);
});

test('rejects API items with missing required region keys while preserving original source row numbers', () => {
  const result = parseOfficialHouseholdWasteApiPage(
    apiPage({
      pageNo: 1,
      numOfRows: 2,
      totalCount: 2,
      items: [
        apiItem('잘못된동', { SGG_NM: '' }),
        apiItem('일곡동'),
      ],
    }),
  );

  assert.deepEqual(result.rows.map((row) => row.sourceRow), [2]);
  assert.deepEqual(result.sourceReport, {
    totalRows: 2,
    acceptedRows: 1,
    rejectedRows: 1,
    errors: [
      {
        row: 1,
        code: 'missing-region-key',
        message: 'Missing 시도명, 시군구명, or 관리구역명',
      },
    ],
  });
});

test('fetches all official Open API pages by processed rows even when some source rows are rejected', async () => {
  const requestedPages = [];
  const fetchImpl = async (url) => {
    const requestUrl = new URL(url);
    const pageNo = Number(requestUrl.searchParams.get('pageNo'));
    requestedPages.push(pageNo);

    const payload = pageNo === 1
      ? apiPage({
          pageNo: 1,
          numOfRows: 2,
          totalCount: 3,
          items: [apiItem('잘못된동', { SGG_NM: '' }), apiItem('매곡동')],
        })
      : apiPage({ pageNo: 2, numOfRows: 2, totalCount: 3, items: [apiItem('운암동')] });

    return {
      ok: true,
      status: 200,
      json: async () => payload,
    };
  };

  const result = await fetchOfficialHouseholdWasteApiRows({
    serviceKey: 'test-key',
    pageSize: 2,
    fetchImpl,
  });

  assert.deepEqual(requestedPages, [1, 2]);
  assert.equal(result.totalCount, 3);
  assert.equal(result.pagesFetched, 2);
  assert.deepEqual(result.rows.map((row) => row.sourceRow), [2, 3]);
  assert.deepEqual(result.rows.map((row) => row.targetAreaNames[0]), ['매곡동', '운암동']);
  assert.deepEqual(result.sourceReport, {
    totalRows: 3,
    acceptedRows: 2,
    rejectedRows: 1,
    errors: [
      {
        row: 1,
        code: 'missing-region-key',
        message: 'Missing 시도명, 시군구명, or 관리구역명',
      },
    ],
  });
});

test('fails fast when the Open API returns an empty page before totalCount is exhausted', async () => {
  const requestedPages = [];
  const fetchImpl = async (url) => {
    const requestUrl = new URL(url);
    const pageNo = Number(requestUrl.searchParams.get('pageNo'));
    requestedPages.push(pageNo);

    return {
      ok: true,
      status: 200,
      json: async () => apiPage({ pageNo, numOfRows: 2, totalCount: 3, items: [] }),
    };
  };

  await assert.rejects(
    fetchOfficialHouseholdWasteApiRows({
      serviceKey: 'test-key',
      pageSize: 2,
      fetchImpl,
    }),
    /Official Open API returned an empty page before totalCount was exhausted/,
  );

  assert.deepEqual(requestedPages, [1]);
});
