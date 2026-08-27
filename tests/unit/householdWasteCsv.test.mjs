import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOfficialHouseholdWasteCsv } from '../../dist-tests/src/data/import/householdWasteCsv.js';

const headers = [
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
].join(',');

test('parses official headers, BOM, target areas, and quoted commas without losing source meaning', () => {
  const csv = `\uFEFF${headers}\r\n광주광역시,북구,1권역,일곡동+매곡동,"규격봉투에 넣고, 지정 장소 배출",전용용기,투명봉투,일+월+화+수+목+금,일+화+목,수+금,19:00,02:00,18:00,23:00,20:00,02:00,명절+임시공휴일,청소행정과,062-000-0000,2026-08-25`;

  const result = parseOfficialHouseholdWasteCsv(csv);

  assert.equal(result.report.totalRows, 1);
  assert.equal(result.report.acceptedRows, 1);
  assert.equal(result.report.rejectedRows, 0);
  assert.deepEqual(result.rows[0], {
    sido: '광주광역시',
    sigungu: '북구',
    managementAreaName: '1권역',
    targetAreaNames: ['일곡동', '매곡동'],
    generalMethod: '규격봉투에 넣고, 지정 장소 배출',
    foodMethod: '전용용기',
    recyclingMethod: '투명봉투',
    generalWeekdays: '일+월+화+수+목+금',
    foodWeekdays: '일+화+목',
    recyclingWeekdays: '수+금',
    generalStartTime: '19:00',
    generalEndTime: '02:00',
    foodStartTime: '18:00',
    foodEndTime: '23:00',
    recyclingStartTime: '20:00',
    recyclingEndTime: '02:00',
    noCollectionDays: '명절+임시공휴일',
    authorityName: '청소행정과',
    authorityContact: '062-000-0000',
    sourceUpdatedAt: '2026-08-25',
  });
});

test('supports quoted newlines and escaped quotes in official text fields', () => {
  const csv = `${headers}\n서울특별시,중구,전체,없음,"봉투에 \"\"일반\"\" 쓰레기를 넣고\n문 앞에 배출",미운영,분리배출,월+수+금,미운영,화+목,18:00,23:00,00:00,00:00,20:00,23:00,,청소과,02-000-0000,2026-08-25`;

  const result = parseOfficialHouseholdWasteCsv(csv);

  assert.equal(result.report.acceptedRows, 1);
  assert.equal(result.rows[0].generalMethod, '봉투에 "일반" 쓰레기를 넣고\n문 앞에 배출');
  assert.deepEqual(result.rows[0].targetAreaNames, []);
});

test('rejects source rows with missing required region keys instead of inventing locations', () => {
  const csv = `${headers}\n광주광역시,,1권역,일곡동,봉투,전용용기,분리배출,월,화,수,18:00,23:00,18:00,23:00,18:00,23:00,,청소과,062-000-0000,2026-08-25`;

  const result = parseOfficialHouseholdWasteCsv(csv);

  assert.equal(result.report.totalRows, 1);
  assert.equal(result.report.acceptedRows, 0);
  assert.equal(result.report.rejectedRows, 1);
  assert.equal(result.rows.length, 0);
  assert.deepEqual(result.report.errors, [
    { row: 1, code: 'missing-region-key', message: 'Missing 시도명, 시군구명, or 관리구역명' },
  ]);
});

test('fails fast when the official CSV header contract is missing', () => {
  assert.throws(
    () => parseOfficialHouseholdWasteCsv('시도명,시군구명\n광주광역시,북구'),
    /Missing required official CSV headers/,
  );
});
