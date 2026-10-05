import type { Note, Subject } from '@/models/types';

/// Routes only carry string params, but some screens are opened with an
/// object already in hand (e.g. a note rebuilt from the offline cache,
/// which must open without a Firestore read). Callers stash the object here
/// before navigating; the screen reads it by id, falling back to
/// Firestore if it's missing (e.g. after a reload).
const notes = new Map<string, Note>();
const subjects = new Map<string, Subject>();

export const handoff = {
  putNote(note: Note) {
    notes.set(note.id, note);
  },
  getNote(id: string): Note | undefined {
    return notes.get(id);
  },
  putSubject(subject: Subject) {
    subjects.set(subject.id, subject);
  },
  getSubject(id: string): Subject | undefined {
    return subjects.get(id);
  },
};
