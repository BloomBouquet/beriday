import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWeeklySchedule } from '../../dist-tests/src/domain/schedule/buildWeeklySchedule.js';

const provenance = {
  sourceId: 'official-household-waste',
  sourceName: '행정안전부 전국생활쓰레기배출정보표준데이터',
  sourceUrl: 'https://www.data.go.kr/data/15025450/standard.do',
  sourceUpdatedAt: '2026-08-25',
  importedAt: '2026-08-28T00:00:00.000Z',
  authorityName: '북구청',
  authorityContact: '062-000-0000',
};

function rule({ id, category, weekdays, start, end, confidence = 'verified', excludedDates = [] }) {
  return {
    id,
    regionId: '광주광역시/북구/테스트동',
    category,
    weekdays,
    timeWindows: [{ start, end }],
    excludedDates,
    instructions: [],
    confidence,
    provenance,
  };
}

test('projects the current Seoul Monday-Sunday week using the existing schedule engine', () => {
  const schedule = buildWeeklySchedule(
    [
      rule({ id: 'recycling-mon', category: 'recycling', weekdays: [1], start: '08:00', end: '10:00' }),
      rule({ id: 'general-fri', category: 'general', weekdays: [5], start: '19:00', end: '23:00' }),
      rule({ id: 'food-ambiguous', category: 'food', weekdays: [5], start: '18:00', end: '23:00', confidence: 'ambiguous' }),
    ],
    new Date('2026-08-28T11:00:00.000Z'),
  );

  assert.deepEqual(schedule.days.map((day) => day.dateKey), [
    '2026-08-24',
    '2026-08-25',
    '2026-08-26',
    '2026-08-27',
    '2026-08-28',
    '2026-08-29',
    '2026-08-30',
  ]);
  assert.deepEqual(schedule.days.map((day) => day.weekday), [1, 2, 3, 4, 5, 6, 0]);
  assert.deepEqual(schedule.days[0].scheduledCategories, ['recycling']);
  assert.deepEqual(schedule.days[4].scheduledCategories, ['general']);
  assert.deepEqual(schedule.needsVerification, ['food']);
});

test('does not place an excluded verified schedule on that weekly day', () => {
  const schedule = buildWeeklySchedule(
    [
      rule({
        id: 'general-fri-excluded',
        category: 'general',
        weekdays: [5],
        start: '19:00',
        end: '23:00',
        excludedDates: ['2026-08-28'],
      }),
    ],
    new Date('2026-08-28T11:00:00.000Z'),
  );

  assert.deepEqual(schedule.days[4].scheduledCategories, []);
});

test('keeps a Seoul Sunday in the same Monday-Sunday week across a year boundary', () => {
  const schedule = buildWeeklySchedule([], new Date('2027-01-03T03:00:00.000Z'));

  assert.deepEqual(schedule.days.map((day) => day.dateKey), [
    '2026-12-28',
    '2026-12-29',
    '2026-12-30',
    '2026-12-31',
    '2027-01-01',
    '2027-01-02',
    '2027-01-03',
  ]);
  assert.deepEqual(schedule.days.map((day) => day.weekday), [1, 2, 3, 4, 5, 6, 0]);
});
