import type { CollectionRule, TimeWindow } from '../waste/types.js';

const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000;
const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export type SeoulDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
  dateKey: string;
};

const seoulFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  weekday: 'short',
});

export function getSeoulParts(date: Date): SeoulDateParts {
  const parts = Object.fromEntries(
    seoulFormatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );

  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  const weekday = WEEKDAY_INDEX[parts.weekday ?? ''];

  if (![year, month, day, hour, minute, weekday].every((value) => Number.isInteger(value))) {
    throw new Error('Failed to derive Asia/Seoul date parts');
  }

  return {
    year,
    month,
    day,
    hour,
    minute,
    weekday: weekday!,
    dateKey: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  };
}

export function seoulLocalToUtc(year: number, month: number, day: number, hour: number, minute: number): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - SEOUL_OFFSET_MS);
}

export function shiftSeoulDate(parts: SeoulDateParts, days: number): SeoulDateParts {
  const shifted = seoulLocalToUtc(parts.year, parts.month, parts.day + days, 12, 0);
  return getSeoulParts(shifted);
}

export function timeToMinutes(value: string): number {
  const [hourRaw, minuteRaw] = value.split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) throw new Error(`Invalid HH:mm value: ${value}`);
  return hour * 60 + minute;
}

function startDateForWindow(parts: SeoulDateParts, window: TimeWindow): Date | null {
  if (!window.start) return null;
  const startMinutes = timeToMinutes(window.start);
  return seoulLocalToUtc(parts.year, parts.month, parts.day, Math.floor(startMinutes / 60), startMinutes % 60);
}

export function findNextAvailable(rules: CollectionRule[], now: Date, maxDays = 14): string | null {
  const nowParts = getSeoulParts(now);
  let earliestMs: number | null = null;

  for (let offset = 0; offset <= maxDays; offset += 1) {
    const day = offset === 0 ? nowParts : shiftSeoulDate(nowParts, offset);

    for (const rule of rules) {
      if (rule.confidence !== 'verified') continue;
      if (!rule.weekdays.includes(day.weekday)) continue;
      if (rule.excludedDates.includes(day.dateKey)) continue;

      for (const window of rule.timeWindows) {
        const candidate = startDateForWindow(day, window);
        if (!candidate || candidate.getTime() <= now.getTime()) continue;
        const candidateMs = candidate.getTime();
        if (earliestMs === null || candidateMs < earliestMs) earliestMs = candidateMs;
      }
    }

    if (earliestMs !== null) return new Date(earliestMs).toISOString();
  }

  return null;
}
