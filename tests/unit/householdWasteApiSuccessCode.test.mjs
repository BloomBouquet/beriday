import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOfficialHouseholdWasteApiPage } from '../../dist-tests/src/data/import/householdWasteApi.js';

function successPayload(resultCode) {
  return {
    response: {
      header: { resultCode, resultMsg: 'NORMAL SERVICE.' },
      body: {
        pageNo: 1,
        numOfRows: 1,
        totalCount: 1,
        items: {
          item: [{
            CTPV_NM: '광주광역시',
            SGG_NM: '북구',
            MNG_ZONE_NM: '1권역',
            MNG_ZONE_TRGT_RGN_NM: '일곡동',
          }],
        },
      },
    },
  };
}

test('accepts the live API success code in string and numeric forms', () => {
  for (const resultCode of ['0', 0]) {
    const result = parseOfficialHouseholdWasteApiPage(successPayload(resultCode));
    assert.equal(result.totalCount, 1);
    assert.equal(result.rows.length, 1);
  }
});
