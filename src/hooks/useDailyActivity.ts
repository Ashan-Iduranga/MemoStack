import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { colomboDate } from '@/gamification/dates';
import { GamificationService } from '@/services/gamificationService';

/// Counts "opened the app today" toward the streak and daily XP — on
/// mount and whenever the app returns to the foreground on a new day.
/// Fire-and-forget: offline or a rejected write just retries next time.
export function useDailyActivity(uid: string | undefined) {
  const recordedDay = useRef<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    const record = () => {
      const today = colomboDate();
      if (recordedDay.current === today) return;
      GamificationService.recordActivity(uid, { kind: 'open' })
        .then(() => {
          recordedDay.current = today;
        })
        .catch(() => {});
    };
    record();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') record();
    });
    return () => sub.remove();
  }, [uid]);
}
