import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_NOTE_KEY = 'memostack_last_note_id';
const PROGRESS_PREFIX = 'memostack_progress_';

/// Tracks the student's last-read note and per-note scroll progress
/// locally, powering Home's "Continue reading" card.
export const ReadingProgress = {
  async setLastRead(noteId: string, progress: number): Promise<void> {
    await AsyncStorage.multiSet([
      [LAST_NOTE_KEY, noteId],
      [`${PROGRESS_PREFIX}${noteId}`, String(Math.min(1, Math.max(0, progress)))],
    ]);
  },

  getLastNoteId(): Promise<string | null> {
    return AsyncStorage.getItem(LAST_NOTE_KEY);
  },

  async getProgress(noteId: string): Promise<number> {
    const raw = await AsyncStorage.getItem(`${PROGRESS_PREFIX}${noteId}`);
    const value = raw == null ? 0 : Number(raw);
    return Number.isFinite(value) ? value : 0;
  },
};
