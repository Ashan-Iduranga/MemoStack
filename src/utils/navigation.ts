import { router } from 'expo-router';

import type { ContentKind, NoteKind } from '@/config/contentKinds';
import type { Quiz } from '@/models/quiz';
import type { Note, Subject } from '@/models/types';
import { handoff } from './handoff';

export function openNote(note: Note) {
  handoff.putNote(note);
  router.push({ pathname: '/note/[id]', params: { id: note.id } });
}

/// One module's items of `kind` (notes by default — Home's module list).
export function openSubject(subject: Subject, kind: ContentKind = 'note') {
  handoff.putSubject(subject);
  router.push({ pathname: '/subject/[id]', params: { id: subject.id, kind } });
}

/// Browse → the modules that hold `kind`.
export function openBrowseKind(kind: ContentKind) {
  router.push({ pathname: '/browse/[kind]', params: { kind } });
}

export function openNoteEditor(note: Note) {
  handoff.putNote(note);
  router.push({ pathname: '/edit-note/[id]', params: { id: note.id } });
}

/// Upload → write a new note, activity or practical.
export function openNewNote(kind: NoteKind) {
  router.push({ pathname: '/new-note/[kind]', params: { kind } });
}

export function openQuiz(quiz: Quiz) {
  handoff.putQuiz(quiz);
  router.push({ pathname: '/quiz/[id]', params: { id: quiz.id } });
}

/// Upload → write a new quiz.
export function openNewQuiz() {
  router.push('/new-quiz');
}

export function openQuizEditor(quiz: Quiz) {
  handoff.putQuiz(quiz);
  router.push({ pathname: '/edit-quiz/[id]', params: { id: quiz.id } });
}
