/// Every XP, streak and level rule in one place. Change values here; the
/// logic in `src/gamification/` reads them. `firestore.rules` mirrors the
/// stored-XP values (`dailyOpen`, `noteRead`, `streakBonus`,
/// `STREAK_BONUS_EVERY`, `MAX_READS_PER_DAY`) and the time zone offset —
/// search it for "gamification.ts" and keep them in sync.

/// XP per action.
export const XP = {
  /// First activity of the day (opening the app or reading a note).
  dailyOpen: 10,
  /// Reading a note — once per note per day.
  noteRead: 5,
  /// Each note the user has published (derived, never stored).
  noteCreated: 20,
  /// Each net upvote on the user's notes (derived, never stored).
  upvoteReceived: 2,
  /// Completing a quiz for the first time (derived, never stored).
  quizCompleted: 15,
  /// Scoring 100% on a quiz, once per quiz (derived, never stored).
  quizPerfect: 10,
  /// Reaching a streak that's a multiple of `STREAK_BONUS_EVERY` days.
  streakBonus: 50,
};

export const STREAK_BONUS_EVERY = 7;

/// Reads earning XP per day; stops a scripted read loop farming XP.
/// Mirrored in firestore.rules.
export const MAX_READS_PER_DAY = 40;

/// Days are counted in Asia/Colombo time: UTC+05:30, no daylight saving.
export const TIMEZONE_OFFSET_MINUTES = 330;

/// Levels in order; a user is at the highest level whose `minXp` their
/// total XP reaches. Level numbers are the 1-based position here.
export const LEVELS: { minXp: number; title: string }[] = [
  { minXp: 0, title: 'Newcomer' },
  { minXp: 100, title: 'Learner' },
  { minXp: 250, title: 'Explorer' },
  { minXp: 500, title: 'Scholar' },
  { minXp: 900, title: 'Achiever' },
  { minXp: 1500, title: 'Mentor' },
  { minXp: 2500, title: 'Expert' },
  { minXp: 4000, title: 'Master' },
  { minXp: 6000, title: 'Legend' },
];
