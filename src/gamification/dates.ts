import { TIMEZONE_OFFSET_MINUTES } from '@/config/gamification';

/// Calendar days as 'YYYY-MM-DD' strings in Asia/Colombo time. Strings
/// compare and sort chronologically, and store as-is in Firestore. A fixed
/// offset is exact (Sri Lanka has no daylight saving) and doesn't depend on
/// the JS engine's time zone data.

const DAY_MS = 24 * 60 * 60 * 1000;

/// The Colombo calendar day containing `now`.
export function colomboDate(now: Date = new Date()): string {
  return new Date(now.getTime() + TIMEZONE_OFFSET_MINUTES * 60 * 1000).toISOString().slice(0, 10);
}

const toUtc = (day: string) => Date.parse(`${day}T00:00:00Z`);

export function addDays(day: string, days: number): string {
  return new Date(toUtc(day) + days * DAY_MS).toISOString().slice(0, 10);
}

/// The Monday starting `day`'s week.
export function weekStart(day: string): string {
  const fromMonday = (new Date(toUtc(day)).getUTCDay() + 6) % 7;
  return addDays(day, -fromMonday);
}
