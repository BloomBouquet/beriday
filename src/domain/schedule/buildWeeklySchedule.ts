import type { CollectionRule, WasteCategory } from '../waste/types.js';
import { evaluateSchedule } from './evaluateSchedule.js';
import { getSeoulParts, seoulLocalToUtc, shiftSeoulDate } from './nextAvailable.js';

export type WeeklyScheduleDay = {
  dateKey: string;
  weekday: number;
  scheduledCategories: WasteCategory[];
};

export type WeeklySchedule = {
  days: WeeklyScheduleDay[];
  needsVerification: WasteCategory[];
};

function mondayOffset(weekday: number): number {
  return (weekday + 6) % 7;
}

export function buildWeeklySchedule(
  rules: CollectionRule[],
  now: Date,
): WeeklySchedule {
  const nowParts = getSeoulParts(now);
  const monday = shiftSeoulDate(nowParts, -mondayOffset(nowParts.weekday));

  const needsVerification = evaluateSchedule(rules, now)
    .filter((result) => result.status === 'needs-verification')
    .map((result) => result.category);

  const verifiedRules = rules.filter((rule) => rule.confidence === 'verified');
  const days: WeeklyScheduleDay[] = [];

  for (let offset = 0; offset < 7; offset += 1) {
    const day = shiftSeoulDate(monday, offset);
    const sameDayRules = verifiedRules.filter(
      (rule) =>
        rule.weekdays.includes(day.weekday) &&
        !rule.excludedDates.includes(day.dateKey),
    );
    const dayAtNoon = seoulLocalToUtc(day.year, day.month, day.day, 12, 0);
    const scheduledCategories = evaluateSchedule(sameDayRules, dayAtNoon)
      .filter((result) => result.status !== 'unavailable' && result.status !== 'needs-verification')
      .map((result) => result.category);

    days.push({
      dateKey: day.dateKey,
      weekday: day.weekday,
      scheduledCategories,
    });
  }

  return { days, needsVerification };
}
