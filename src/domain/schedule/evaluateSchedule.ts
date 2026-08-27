import type { CollectionRule, RuleProvenance, TimeWindow, WasteCategory } from '../waste/types.js';
import {
  findNextAvailable,
  getSeoulParts,
  shiftSeoulDate,
  timeToMinutes,
} from './nextAvailable.js';

export type ScheduleStatus = 'available' | 'upcoming' | 'closed' | 'unavailable' | 'needs-verification';

export type ScheduleResult = {
  category: WasteCategory;
  status: ScheduleStatus;
  currentWindow: TimeWindow | null;
  nextAvailableAt: string | null;
  instructions: string[];
  provenance: RuleProvenance[];
};

const CATEGORY_ORDER: WasteCategory[] = ['general', 'food', 'recycling', 'bulk', 'other'];

function isCrossMidnight(window: TimeWindow): boolean {
  if (!window.start || !window.end) return false;
  return timeToMinutes(window.end) <= timeToMinutes(window.start);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function findActiveWindow(rules: CollectionRule[], now: Date): TimeWindow | null {
  const today = getSeoulParts(now);
  const yesterday = shiftSeoulDate(today, -1);
  const nowMinutes = today.hour * 60 + today.minute;

  for (const rule of rules) {
    if (rule.confidence !== 'verified') continue;

    if (rule.weekdays.includes(yesterday.weekday) && !rule.excludedDates.includes(yesterday.dateKey)) {
      for (const window of rule.timeWindows) {
        if (!window.start || !window.end || !isCrossMidnight(window)) continue;
        if (nowMinutes < timeToMinutes(window.end)) return window;
      }
    }

    if (!rule.weekdays.includes(today.weekday) || rule.excludedDates.includes(today.dateKey)) continue;

    for (const window of rule.timeWindows) {
      if (!window.start) continue;
      const start = timeToMinutes(window.start);
      if (window.end === null) {
        if (nowMinutes >= start) return window;
        continue;
      }

      const end = timeToMinutes(window.end);
      if (isCrossMidnight(window)) {
        if (nowMinutes >= start) return window;
      } else if (nowMinutes >= start && nowMinutes < end) {
        return window;
      }
    }
  }

  return null;
}

function findUpcomingTodayWindow(rules: CollectionRule[], now: Date): { window: TimeWindow; at: string } | null {
  const today = getSeoulParts(now);
  const nowMinutes = today.hour * 60 + today.minute;
  let best: { window: TimeWindow; at: string; minutes: number } | null = null;

  for (const rule of rules) {
    if (rule.confidence !== 'verified') continue;
    if (!rule.weekdays.includes(today.weekday) || rule.excludedDates.includes(today.dateKey)) continue;

    for (const window of rule.timeWindows) {
      if (!window.start) continue;
      const start = timeToMinutes(window.start);
      if (start <= nowMinutes) continue;
      const hour = Math.floor(start / 60);
      const minute = start % 60;
      const at = new Date(Date.UTC(today.year, today.month - 1, today.day, hour, minute) - 9 * 60 * 60 * 1000).toISOString();
      if (!best || start < best.minutes) best = { window, at, minutes: start };
    }
  }

  return best ? { window: best.window, at: best.at } : null;
}

function hasTodaySchedule(rules: CollectionRule[], now: Date): boolean {
  const today = getSeoulParts(now);
  return rules.some(
    (rule) =>
      rule.confidence === 'verified' &&
      rule.weekdays.includes(today.weekday) &&
      !rule.excludedDates.includes(today.dateKey) &&
      rule.timeWindows.some((window) => window.start !== null),
  );
}

export function evaluateSchedule(rules: CollectionRule[], now: Date): ScheduleResult[] {
  const grouped = new Map<WasteCategory, CollectionRule[]>();
  for (const rule of rules) {
    const group = grouped.get(rule.category) ?? [];
    group.push(rule);
    grouped.set(rule.category, group);
  }

  const results: ScheduleResult[] = [];
  for (const category of CATEGORY_ORDER) {
    const group = grouped.get(category);
    if (!group?.length) continue;

    const instructions = unique(group.flatMap((rule) => rule.instructions));
    const provenance = group.map((rule) => rule.provenance);

    if (group.some((rule) => rule.confidence === 'ambiguous')) {
      results.push({
        category,
        status: 'needs-verification',
        currentWindow: null,
        nextAvailableAt: null,
        instructions,
        provenance,
      });
      continue;
    }

    const active = findActiveWindow(group, now);
    if (active) {
      results.push({ category, status: 'available', currentWindow: active, nextAvailableAt: null, instructions, provenance });
      continue;
    }

    const upcoming = findUpcomingTodayWindow(group, now);
    if (upcoming) {
      results.push({
        category,
        status: 'upcoming',
        currentWindow: upcoming.window,
        nextAvailableAt: upcoming.at,
        instructions,
        provenance,
      });
      continue;
    }

    const status: ScheduleStatus = hasTodaySchedule(group, now) ? 'closed' : 'unavailable';
    results.push({
      category,
      status,
      currentWindow: null,
      nextAvailableAt: findNextAvailable(group, now),
      instructions,
      provenance,
    });
  }

  return results;
}
