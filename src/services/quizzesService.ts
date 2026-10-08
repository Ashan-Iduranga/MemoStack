import {
  collection,
  collectionGroup,
  count,
  doc,
  getAggregateFromServer,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  FirestoreError,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import {
  attemptFromDoc,
  nextAttempt,
  quizFromDoc,
  quizImageUrls,
  quizToCreateMap,
  quizToUpdateMap,
  type Quiz,
  type QuizAttempt,
} from '@/models/quiz';
import { countField } from '@/models/types';

import { ImagesService } from './imagesService';
import type { Unsubscribe } from './notesService';

type OnError = (error: Error) => void;

const quizzesCol = () => collection(db, 'quizzes');
const quizRef = (id: string) => doc(db, 'quizzes', id);
const attemptRef = (quizId: string, uid: string) => doc(db, 'quizzes', quizId, 'quizAttempts', uid);
const subjectRef = (id: string) => doc(db, 'subjects', id);

export interface QuizStats {
  completed: number;
  perfect: number;
}

/// All Firestore reads/writes for quizzes and students' quiz results.
export const QuizzesService = {
  /// Every quiz, newest first — the admin's library.
  watchAll(onData: (quizzes: Quiz[]) => void, onError: OnError, max = 500): Unsubscribe {
    const q = query(quizzesCol(), orderBy('createdAt', 'desc'), limit(max));
    return onSnapshot(q, (snap) => onData(snap.docs.map(quizFromDoc)), onError);
  },

  /// One module's quizzes, newest first.
  watchBySubject(subjectId: string, onData: (quizzes: Quiz[]) => void, onError: OnError, max = 50): Unsubscribe {
    const q = query(quizzesCol(), where('subjectId', '==', subjectId), orderBy('createdAt', 'desc'), limit(max));
    return onSnapshot(q, (snap) => onData(snap.docs.map(quizFromDoc)), onError);
  },

  async getQuiz(quizId: string): Promise<Quiz | null> {
    const snap = await getDoc(quizRef(quizId));
    if (!snap.exists()) return null;
    return quizFromDoc(snap);
  },

  /// Publishes a quiz and bumps its module's `counts.quiz` in one transaction.
  async publishQuiz(quiz: Quiz): Promise<void> {
    const ref = doc(quizzesCol());
    await runTransaction(db, async (tx) => {
      tx.set(ref, quizToCreateMap(quiz));
      tx.update(subjectRef(quiz.subjectId), { [countField('quiz')]: increment(1) });
    });
  },

  /// Saves an edit, moving the module count if the module changed, then
  /// deletes images the edit removed.
  async updateQuiz(quiz: Quiz, previous: Quiz): Promise<void> {
    if (previous.subjectId === quiz.subjectId) {
      await updateDoc(quizRef(quiz.id), quizToUpdateMap(quiz));
    } else {
      await runTransaction(db, async (tx) => {
        tx.update(quizRef(quiz.id), quizToUpdateMap(quiz));
        tx.update(subjectRef(previous.subjectId), { [countField('quiz')]: increment(-1) });
        tx.update(subjectRef(quiz.subjectId), { [countField('quiz')]: increment(1) });
      });
    }
    const kept = new Set(quizImageUrls(quiz));
    await ImagesService.deleteAll(quizImageUrls(previous).filter((url) => !kept.has(url)));
  },

  /// Deletes the quiz and its module's count, then its images. Students'
  /// attempt docs stay (clients can't list other users' docs), so the
  /// quiz XP they earned is kept.
  async deleteQuiz(quiz: Quiz): Promise<void> {
    await runTransaction(db, async (tx) => {
      tx.delete(quizRef(quiz.id));
      tx.update(subjectRef(quiz.subjectId), { [countField('quiz')]: increment(-1) });
    });
    await ImagesService.deleteAll(quizImageUrls(quiz));
  },

  /// The signed-in user's results on one quiz (null until completed).
  watchMyAttempt(quizId: string, uid: string, onData: (attempt: QuizAttempt | null) => void, onError: OnError) {
    return onSnapshot(
      attemptRef(quizId, uid),
      (snap) => onData(snap.exists() ? attemptFromDoc(snap) : null),
      onError,
    );
  },

  /// All of the signed-in user's quiz results, by quiz id — the "Best"
  /// line on quiz lists. One listener instead of one per quiz.
  watchMyAttempts(uid: string, onData: (attempts: Map<string, QuizAttempt>) => void, onError: OnError) {
    const q = query(collectionGroup(db, 'quizAttempts'), where('uid', '==', uid));
    return onSnapshot(
      q,
      (snap) => onData(new Map(snap.docs.map((d) => [d.ref.parent.parent?.id ?? '', attemptFromDoc(d)]))),
      onError,
    );
  },

  /// Records a finished attempt. A plain write (no transaction), so it
  /// queues while offline and syncs later; `prev` is the attempt the
  /// screen is showing. Returns what this attempt newly earned.
  saveAttempt(quiz: Quiz, uid: string, prev: QuizAttempt | null, score: number) {
    const next = nextAttempt(prev, score, quiz.questions.length);
    const write = setDoc(
      attemptRef(quiz.id, uid),
      {
        uid,
        quizId: quiz.id,
        quizTitle: quiz.title,
        subjectName: quiz.subjectName,
        lastScore: next.lastScore,
        bestScore: next.bestScore,
        total: next.total,
        perfect: next.perfect,
        attemptCount: next.attemptCount,
        updatedAt: serverTimestamp(),
        ...(prev == null && { firstCompletedAt: serverTimestamp() }),
      },
      { merge: true },
    );
    // Offline, the write resolves only once it reaches the server; the
    // local cache (and the screen) already has it, so don't wait.
    write.catch((e) => console.warn('Saving quiz attempt failed', e));
    return next;
  },

  /// Quiz XP inputs: quizzes completed, and ones scored 100% on. Needs
  /// the collection-group indexes in firestore.indexes.json; until they're
  /// built, Firestore answers `failed-precondition` and the counts come
  /// from the user's attempt docs instead.
  async getUserQuizStats(uid: string): Promise<QuizStats> {
    const mine = query(collectionGroup(db, 'quizAttempts'), where('uid', '==', uid));
    try {
      const [all, perfect] = await Promise.all([
        getAggregateFromServer(mine, { n: count() }),
        getAggregateFromServer(query(mine, where('perfect', '==', true)), { n: count() }),
      ]);
      return { completed: all.data().n, perfect: perfect.data().n };
    } catch (e) {
      if (!(e instanceof FirestoreError && e.code === 'failed-precondition')) throw e;
      const docs = (await getDocs(mine)).docs;
      return { completed: docs.length, perfect: docs.filter((d) => d.data().perfect === true).length };
    }
  },
};
