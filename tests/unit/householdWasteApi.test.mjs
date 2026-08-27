import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOfficialHouseholdWasteApiPage } from '../../dist-tests/src/data/import/householdWasteApi.js';

test('adapts one official Open API item to the existing household-waste row contract', () => {
  const result = parseOfficialHouseholdWasteApiPage({
    response: {
      header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' },
      body: {
        dataType: 'JSON',
        pageNo: 1,
        numOfRows: 100,
        totalCount: 7398,
        items: {
          item: [
            {
              CTPV_NM: '광주광역시',
              SGG_NM: '북구',
              MNG_ZONE_NM: '1권역',
              MNG_ZONE_TRGT_RGN_NM: '일곡동+매곡동',
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
            },
          ],
        },
      },
    },
  });

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
