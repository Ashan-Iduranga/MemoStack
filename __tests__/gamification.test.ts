import { LEVELS, MAX_READS_PER_DAY, XP } from '@/config/gamification';
import { applyActivity, levelFor, liveStreak, totalXp, weekDays, type ActivityState } from '@/gamification/activity';
import { addDays, colomboDate, weekStart } from '@/gamification/dates';

const fresh: ActivityState = {
  xp: 0,
  currentStreak: 0,
  longestStreak: 0,
  lastActiveDate: '',
  weekActiveDates: [],
  readsToday: { date: '', noteIds: [] },
};

describe('dates', () => {
  test('colomboDate rolls over at 18:30 UTC', () => {
    expect(colomboDate(new Date('2026-10-05T18:29:00Z'))).toBe('2026-10-05');
    expect(colomboDate(new Date('2026-10-05T18:30:00Z'))).toBe('2026-10-06');
  });

  test('addDays crosses months and years', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  test('weekStart is the Monday', () => {
    expect(weekStart('2026-10-05')).toBe('2026-10-05'); // Monday
    expect(weekStart('2026-10-11')).toBe('2026-10-05'); // Sunday
    expect(weekStart('2026-10-07')).toBe('2026-10-05');
  });
});

describe('applyActivity', () => {
  test('first open starts a streak and awards daily XP', () => {
    const result = applyActivity(fresh, { kind: 'open' }, '2026-10-05')!;
    expect(result.xpGained).toBe(XP.dailyOpen);
    expect(result.patch).toMatchObject({
      xp: XP.dailyOpen,
      currentStreak: 1,
      longestStreak: 1,
      lastActiveDate: '2026-10-05',
      weekActiveDates: ['2026-10-05'],
    });
  });

  test('a second open the same day changes nothing', () => {
    const day1 = { ...fresh, ...applyActivity(fresh, { kind: 'open' }, '2026-10-05')!.patch };
    expect(applyActivity(day1, { kind: 'open' }, '2026-10-05')).toBeNull();
  });

  test('consecutive days extend the streak; a gap resets it', () => {
    const prev = { ...fresh, currentStreak: 3, longestStreak: 5, lastActiveDate: '2026-10-05' };
    expect(applyActivity(prev, { kind: 'open' }, '2026-10-06')!.patch.currentStreak).toBe(4);
    const reset = applyActivity(prev, { kind: 'open' }, '2026-10-08')!.patch;
    expect(reset.currentStreak).toBe(1);
    expect(reset.longestStreak).toBe(5);
  });

  test('reaching 7 days adds the streak bonus', () => {
    const prev = { ...fresh, currentStreak: 6, longestStreak: 6, lastActiveDate: '2026-10-05' };
    const result = applyActivity(prev, { kind: 'open' }, '2026-10-06')!;
    expect(result.xpGained).toBe(XP.dailyOpen + XP.streakBonus);
    expect(result.patch.longestStreak).toBe(7);
  });

  test('reads earn XP once per note per day', () => {
    const today = '2026-10-05';
    const first = applyActivity(fresh, { kind: 'read', noteId: 'a' }, today)!;
    expect(first.xpGained).toBe(XP.dailyOpen + XP.noteRead);
    const after = { ...fresh, ...first.patch };
    expect(applyActivity(after, { kind: 'read', noteId: 'a' }, today)).toBeNull();
    expect(applyActivity(after, { kind: 'read', noteId: 'b' }, today)!.xpGained).toBe(XP.noteRead);
    // Next day the same note counts again.
    expect(applyActivity(after, { kind: 'read', noteId: 'a' }, '2026-10-06')!.patch.readsToday).toEqual({
      date: '2026-10-06',
      noteIds: ['a'],
    });
  });

  test('read XP stops at the daily cap', () => {
    const noteIds = Array.from({ length: MAX_READS_PER_DAY }, (_, i) => `n${i}`);
    const prev = { ...fresh, lastActiveDate: '2026-10-05', currentStreak: 1, readsToday: { date: '2026-10-05', noteIds } };
    expect(applyActivity(prev, { kind: 'read', noteId: 'extra' }, '2026-10-05')).toBeNull();
  });

  test('the week list drops last week', () => {
    const prev = {
      ...fresh,
      currentStreak: 2,
      lastActiveDate: '2026-10-04', // Sunday
      weekActiveDates: ['2026-10-03', '2026-10-04'],
    };
    expect(applyActivity(prev, { kind: 'open' }, '2026-10-05')!.patch.weekActiveDates).toEqual(['2026-10-05']);
  });

  test('a clock set back counts nothing', () => {
    const prev = { ...fresh, currentStreak: 2, lastActiveDate: '2026-10-05' };
    expect(applyActivity(prev, { kind: 'open' }, '2026-10-04')).toBeNull();
  });
});

describe('display helpers', () => {
  test('liveStreak expires after a missed day', () => {
    const state = { currentStreak: 4, lastActiveDate: '2026-10-05' };
    expect(liveStreak(state, '2026-10-06')).toBe(4);
    expect(liveStreak(state, '2026-10-07')).toBe(0);
  });

  test('weekDays marks active, today and future days', () => {
    const days = weekDays('2026-10-07', ['2026-10-05', '2026-10-07']);
    expect(days.map((d) => d.active)).toEqual([true, false, true, false, false, false, false]);
    expect(days[2].isToday).toBe(true);
    expect(days[3].isFuture).toBe(true);
  });

  test('totalXp adds note and upvote XP, ignoring negative votes', () => {
    expect(totalXp(30, { notesCount: 2, totalVotes: 5 })).toBe(30 + 2 * XP.noteCreated + 5 * XP.upvoteReceived);
    expect(totalXp(30, { notesCount: 0, totalVotes: -4 })).toBe(30);
  });

  test('totalXp adds quiz completions and perfect scores', () => {
    expect(totalXp(0, { notesCount: 0, totalVotes: 0 }, { completed: 3, perfect: 1 })).toBe(
      3 * XP.quizCompleted + XP.quizPerfect,
    );
  });

  test('levelFor picks the level and progress', () => {
    expect(levelFor(0)).toMatchObject({ level: 1, title: LEVELS[0].title, progress: 0 });
    const mid = levelFor((LEVELS[1].minXp + LEVELS[2].minXp) / 2);
    expect(mid.level).toBe(2);
    expect(mid.progress).toBeCloseTo(0.5);
    expect(levelFor(1e9)).toMatchObject({ level: LEVELS.length, nextXp: null, progress: 1 });
  });
});
