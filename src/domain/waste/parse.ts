import type { TimeWindow } from './types.js';

const WEEKDAY: Record<string, number> = {
  일: 0,
  월: 1,
  화: 2,
  수: 3,
  목: 4,
  금: 5,
  토: 6,
};

export function parseWeekdays(raw: string): number[] | null {
  const value = raw.trim();
  if (!value) return null;
  if (value === '매일') return [0, 1, 2, 3, 4, 5, 6];

  const normalized = value.replaceAll('요일', '').replace(/[·ㆍ]/g, ',');
  const tokens = normalized.split(/[\s,\/]+/).filter(Boolean);
  if (!tokens.length) return null;

  const days: number[] = [];
  for (const token of tokens) {
    const day = WEEKDAY[token];
    if (day === undefined) return null;
    if (!days.includes(day)) days.push(day);
  }
  return days.sort((a, b) => a - b);
}

function normalizeHourMinute(hourRaw: string, minuteRaw = '0'): string | null {
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function parseTimeWindows(raw: string): TimeWindow[] | null {
  const value = raw.trim();
  if (!value) return null;

  const after = value.match(/^(\d{1,2})시(?:\s*(\d{1,2})분)?\s*이후$/);
  if (after) {
    const start = normalizeHourMinute(after[1]!, after[2] ?? '0');
    return start ? [{ start, end: null }] : null;
  }

  const range = value.match(/^(\d{1,2})(?::(\d{2}))?\s*[~\-–]\s*(\d{1,2})(?::(\d{2}))?$/);
  if (!range) return null;
  const start = normalizeHourMinute(range[1]!, range[2] ?? '0');
  const end = normalizeHourMinute(range[3]!, range[4] ?? '0');
  if (!start || !end) return null;
  return [{ start, end }];
}

export function makeRegionId(sido: string, sigungu: string, areaName: string): string {
  const parts = [sido, sigungu, areaName].map((value) => value.trim());
  if (parts.some((value) => !value)) throw new Error('Region key requires sido, sigungu, and areaName');
  return parts.join('/');
}
