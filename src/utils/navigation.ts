import { router } from 'expo-router';

import type { Note, Subject } from '@/models/types';
import { handoff } from './handoff';

export function openNote(note: Note) {
  handoff.putNote(note);
  router.push({ pathname: '/note/[id]', params: { id: note.id } });
}

export function openSubject(subject: Subject) {
  handoff.putSubject(subject);
  router.push({ pathname: '/subject/[id]', params: { id: subject.id } });
}

export function openNoteEditor(note: Note) {
  handoff.putNote(note);
  router.push({ pathname: '/edit-note/[id]', params: { id: note.id } });
}
