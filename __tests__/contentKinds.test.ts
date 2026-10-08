// Only the pure helpers are under test; keep Firebase out of Jest.
jest.mock('firebase/firestore', () => ({ Timestamp: class {}, serverTimestamp: () => null }));

import type { DocumentSnapshot } from 'firebase/firestore';

import { countLabel, isContentKind, isNoteKind } from '@/config/contentKinds';
import {
  countField,
  countFor,
  hasAnswer,
  noteFromDoc,
  noteImageUrls,
  noteToCreateMap,
  subjectFromDoc,
  type Note,
} from '@/models/types';

const snapshot = (id: string, data: Record<string, unknown>) => ({ id, data: () => data }) as unknown as DocumentSnapshot;

describe('content kinds', () => {
  test('recognises kinds', () => {
    expect(isContentKind('paper')).toBe(true);
    expect(isContentKind('papers')).toBe(false);
    expect(isNoteKind('practical')).toBe(true);
    expect(isNoteKind('quiz')).toBe(false);
  });

  test('countLabel uses the right singular and plural', () => {
    expect(countLabel(1, 'activity')).toBe('1 activity');
    expect(countLabel(3, 'activity')).toBe('3 activities');
    expect(countLabel(0, 'quiz')).toBe('0 quizzes');
    expect(countLabel(2, 'note')).toBe('2 notes');
  });
});

describe('module counts', () => {
  const subject = subjectFromDoc(
    snapshot('s1', { name: 'Networks', notesCount: 4, counts: { activity: 2, paper: 1, bogus: 9, practical: 'x' } }),
  );

  test('notes count comes from notesCount, others from counts', () => {
    expect(countFor(subject, 'note')).toBe(4);
    expect(countFor(subject, 'activity')).toBe(2);
    expect(countFor(subject, 'paper')).toBe(1);
    expect(countFor(subject, 'practical')).toBe(0);
    expect(countFor(subject, 'quiz')).toBe(0);
  });

  test('ignores unknown or non-numeric counts', () => {
    expect(subject.counts).toEqual({ activity: 2, paper: 1 });
  });

  test('a module doc without counts reads as empty', () => {
    expect(subjectFromDoc(snapshot('s2', { name: 'Old', notesCount: 1 })).counts).toEqual({});
  });

  test('countField names the field to increment', () => {
    expect(countField('note')).toBe('notesCount');
    expect(countField('practical')).toBe('counts.practical');
  });
});

describe('notes with kinds', () => {
  const A = 'https://res.cloudinary.com/demo/a.jpg';
  const B = 'https://res.cloudinary.com/demo/b.jpg';

  test('a note doc without kind reads as a plain note', () => {
    const note = noteFromDoc(snapshot('n1', { title: 'Old note', difficulty: 'extreme' }));
    expect(note.kind).toBe('note');
    expect(note.answerDelta).toEqual([]);
    expect(note.difficulty).toBe('');
    expect(note.requirements).toBe('');
  });

  test('reads activity fields', () => {
    const note = noteFromDoc(
      snapshot('n2', { kind: 'practical', difficulty: 'hard', requirements: 'Python', answerDelta: [{ insert: 'x\n' }] }),
    );
    expect(note).toMatchObject({ kind: 'practical', difficulty: 'hard', requirements: 'Python' });
    expect(hasAnswer(note)).toBe(true);
  });

  test('noteImageUrls covers body and answer without duplicates', () => {
    const note = {
      contentDelta: [{ insert: { image: A } }, { insert: '\n' }],
      answerDelta: [{ insert: { image: B } }, { insert: { image: A } }],
    };
    expect(noteImageUrls(note)).toEqual([A, B]);
  });

  test('a blank answer is no answer', () => {
    expect(hasAnswer({ answerDelta: [{ insert: '  \n' }] } as unknown as Note)).toBe(false);
    expect(hasAnswer({ answerDelta: [{ insert: { image: A } }] } as unknown as Note)).toBe(true);
  });

  test('a plain note never stores answer, difficulty or requirements', () => {
    const map = noteToCreateMap({
      kind: 'note',
      answerDelta: [{ insert: 'leftover\n' }],
      difficulty: 'easy',
      requirements: 'x',
    } as unknown as Note);
    expect(map).toMatchObject({ kind: 'note', answerDelta: [], difficulty: '', requirements: '' });
  });

  test('only practicals keep requirements', () => {
    const map = noteToCreateMap({ kind: 'activity', answerDelta: [], difficulty: 'easy', requirements: 'x' } as unknown as Note);
    expect(map).toMatchObject({ kind: 'activity', difficulty: 'easy', requirements: '' });
  });
});
