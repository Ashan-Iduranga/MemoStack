import {
  addDoc,
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type WriteBatch,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { quizFromDoc, quizImageUrls } from '@/models/quiz';
import { noteFromDoc, noteImageUrls, subjectFromDoc, type Subject } from '@/models/types';

import { ImagesService } from './imagesService';
import type { Unsubscribe } from './notesService';

const subjectsCol = () => collection(db, 'subjects');
const notesCol = () => collection(db, 'notes');
const quizzesCol = () => collection(db, 'quizzes');

/// Firestore caps a batch at 500 writes.
async function commitInChunks(writes: ((b: WriteBatch) => void)[]) {
  const chunkSize = 450;
  for (let i = 0; i < writes.length; i += chunkSize) {
    const batch = writeBatch(db);
    for (const write of writes.slice(i, i + chunkSize)) write(batch);
    await batch.commit();
  }
}

export const SubjectsService = {
  /// Every module, by admin-set `order` then name. Sorted client-side so
  /// docs missing `order` (e.g. added by hand in the console) still show up.
  watchSubjects(onData: (subjects: Subject[]) => void, onError: (e: Error) => void): Unsubscribe {
    return onSnapshot(
      subjectsCol(),
      (snap) => {
        const subjects = snap.docs.map(subjectFromDoc);
        subjects.sort(
          (a, b) => a.order - b.order || a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
        );
        onData(subjects);
      },
      onError,
    );
  },

  async getSubject(subjectId: string): Promise<Subject | null> {
    const snap = await getDoc(doc(db, 'subjects', subjectId));
    if (!snap.exists()) return null;
    return subjectFromDoc(snap);
  },

  /// Case-insensitive lookup, so "data structures" and "Data Structures"
  /// can't end up as two modules. `exceptId` skips the module being renamed.
  async findByName(name: string, exceptId?: string): Promise<Subject | null> {
    const needle = name.trim().toLowerCase();
    const snap = await getDocs(subjectsCol());
    for (const d of snap.docs) {
      if (d.id === exceptId) continue;
      const subject = subjectFromDoc(d);
      if (subject.name.trim().toLowerCase() === needle) return subject;
    }
    return null;
  },

  async createSubject(name: string, iconKey = 'menuBook'): Promise<string> {
    const ref = await addDoc(subjectsCol(), {
      name: name.trim(),
      iconKey,
      notesCount: 0,
      counts: {},
      order: 0,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  },

  /// Reuses an existing module with the same name, or creates one.
  async findOrCreateSubject(name: string, iconKey = 'menuBook'): Promise<string> {
    const existing = await SubjectsService.findByName(name);
    if (existing) return existing.id;
    return SubjectsService.createSubject(name, iconKey);
  },

  /// Updates the module and, when the name changes, the denormalized
  /// `subjectName` on every note and quiz in it.
  async updateSubject(subject: Subject, name: string, iconKey: string): Promise<void> {
    const trimmed = name.trim();
    const writes: ((b: WriteBatch) => void)[] = [
      (b) => b.update(doc(db, 'subjects', subject.id), { name: trimmed, iconKey }),
    ];
    if (trimmed !== subject.name) {
      const [notes, quizzes] = await Promise.all([
        getDocs(query(notesCol(), where('subjectId', '==', subject.id))),
        getDocs(query(quizzesCol(), where('subjectId', '==', subject.id))),
      ]);
      for (const d of [...notes.docs, ...quizzes.docs]) {
        writes.push((b) => b.update(d.ref, { subjectName: trimmed, updatedAt: serverTimestamp() }));
      }
    }
    await commitInChunks(writes);
  },

  /// Live count of everything in the module (notes, activities,
  /// practicals, quizzes) — the stored counts can drift for docs added by
  /// hand in the console, so the delete warning asks Firestore directly.
  async countNotes(subjectId: string): Promise<number> {
    const [notes, quizzes] = await Promise.all([
      getCountFromServer(query(notesCol(), where('subjectId', '==', subjectId))),
      getCountFromServer(query(quizzesCol(), where('subjectId', '==', subjectId))),
    ]);
    return notes.data().count + quizzes.data().count;
  },

  /// Deletes the module and every note and quiz in it, then their images.
  async deleteSubject(subjectId: string): Promise<void> {
    const [notes, quizzes] = await Promise.all([
      getDocs(query(notesCol(), where('subjectId', '==', subjectId))),
      getDocs(query(quizzesCol(), where('subjectId', '==', subjectId))),
    ]);
    const writes: ((b: WriteBatch) => void)[] = [...notes.docs, ...quizzes.docs].map(
      (d) => (b: WriteBatch) => b.delete(d.ref),
    );
    writes.push((b) => b.delete(doc(db, 'subjects', subjectId)));
    await commitInChunks(writes);
    await ImagesService.deleteAll([
      ...notes.docs.flatMap((d) => noteImageUrls(noteFromDoc(d))),
      ...quizzes.docs.flatMap((d) => quizImageUrls(quizFromDoc(d))),
    ]);
  },
};
