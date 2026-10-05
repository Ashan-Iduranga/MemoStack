import { LEVELS, MAX_READS_PER_DAY, STREAK_BONUS_EVERY, XP } from '@/config/gamification';

import { addDays, weekStart } from './dates';

/// Pure streak / XP / level logic. `GamificationService` runs
/// `applyActivity` inside a Firestore transaction; screens use the rest.

/// The gamification fields of `users/{uid}`. `xp` holds only XP earned by
/// the user's own activity; see `totalXp` for the full figure.
export interface ActivityState {
  xp: number;
  currentStreak: number;
  longestStreak: number;
  /// Colombo day ('YYYY-MM-DD') of the latest activity, or '' if none.
  lastActiveDate: string;
  /// Active days of the week containing `lastActiveDate`.
  weekActiveDates: string[];
  /// Notes that earned read XP on `readsToday.date`.
  readsToday: { date: string; noteIds: string[] };
}

export type Activity = { kind: 'open' } | { kind: 'read'; noteId: string };

/// Applies one activity on `today`. Returns the fields to write and the
/// XP gained, or null if nothing changes (already counted today).
export function applyActivity(
  prev: ActivityState,
  activity: Activity,
  today: string,
): { patch: Partial<ActivityState>; xpGained: number } | null {
  const patch: Partial<ActivityState> = {};
  let xpGained = 0;

  // A device clock set back behind the last active day: count nothing
  // rather than rewrite the streak from the past.
  if (prev.lastActiveDate !== '' && today < prev.lastActiveDate) return null;

  if (prev.lastActiveDate !== today) {
    const streak = prev.lastActiveDate === addDays(today, -1) ? prev.currentStreak + 1 : 1;
    const monday = weekStart(today);
    patch.currentStreak = streak;
    patch.longestStreak = Math.max(prev.longestStreak, streak);
    patch.lastActiveDate = today;
    patch.weekActiveDates = [...prev.weekActiveDates.filter((d) => d >= monday && d < today), today];
    xpGained += XP.dailyOpen;
    if (streak % STREAK_BONUS_EVERY === 0) xpGained += XP.streakBonus;
  }

  if (activity.kind === 'read') {
    const reads = prev.readsToday.date === today ? prev.readsToday.noteIds : [];
    if (!reads.includes(activity.noteId) && reads.length < MAX_READS_PER_DAY) {
      patch.readsToday = { date: today, noteIds: [...reads, activity.noteId] };
      xpGained += XP.noteRead;
    }
  }

  if (Object.keys(patch).length === 0) return null;
  patch.xp = prev.xp + xpGained;
  return { patch, xpGained };
}

/// The streak to show: the stored one only lasts while the user was
/// active today or yesterday.
export function liveStreak(state: Pick<ActivityState, 'currentStreak' | 'lastActiveDate'>, today: string): number {
  return state.lastActiveDate === today || state.lastActiveDate === addDays(today, -1) ? state.currentStreak : 0;
}

/// The seven days (Mon–Sun) of `today`'s week, for the streak circles.
export function weekDays(
  today: string,
  activeDates: string[],
): { date: string; label: string; active: boolean; isToday: boolean; isFuture: boolean }[] {
  const monday = weekStart(today);
  const active = new Set(activeDates);
  return ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, i) => {
    const date = addDays(monday, i);
    return { date, label, active: active.has(date), isToday: date === today, isFuture: date > today };
  });
}

/// Stored activity XP plus XP derived from the user's notes and the
/// upvotes on them (derived so voters never write the author's profile).
export function totalXp(storedXp: number, authored: { notesCount: number; totalVotes: number }): number {
  return storedXp + XP.noteCreated * authored.notesCount + XP.upvoteReceived * Math.max(0, authored.totalVotes);
}

export interface LevelInfo {
  level: number;
  title: string;
  minXp: number;
  /// XP where the next level starts; null at the top level.
  nextXp: number | null;
  /// 0–1 progress through the current level (1 at the top level).
  progress: number;
}

export function levelFor(xp: number): LevelInfo {
  let index = 0;
  while (index + 1 < LEVELS.length && xp >= LEVELS[index + 1].minXp) index++;
  const { minXp, title } = LEVELS[index];
  const nextXp = LEVELS[index + 1]?.minXp ?? null;
  const progress = nextXp == null ? 1 : Math.min(1, Math.max(0, (xp - minXp) / (nextXp - minXp)));
  return { level: index + 1, title, minXp, nextXp, progress };
}
