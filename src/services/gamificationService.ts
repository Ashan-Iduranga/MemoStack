import { doc, runTransaction } from 'firebase/firestore';

import { applyActivity, type Activity } from '@/gamification/activity';
import { colomboDate } from '@/gamification/dates';
import { db } from '@/lib/firebase';
import { appUserFromData } from '@/models/types';

/// Writes streak and XP changes to the user's own profile. The rules in
/// `src/gamification/activity.ts` decide what changes; this only runs
/// them in a transaction so two activities at once can't double-count.
export const GamificationService = {
  /// Records an app open or note read for today (Colombo time). Returns
  /// the XP gained — 0 if today already counted it.
  async recordActivity(uid: string, activity: Activity, now: Date = new Date()): Promise<number> {
    const ref = doc(db, 'users', uid);
    return runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return 0;
      const result = applyActivity(appUserFromData(uid, snap.data()), activity, colomboDate(now));
      if (result == null) return 0;
      tx.update(ref, result.patch);
      return result.xpGained;
    });
  },
};
