import {
  collection,
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
  sum,
  updateDoc,
  where,
  FirestoreError,
  type QueryConstraint,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { imageUrlsIn } from '@/models/delta';
import { noteDisplayText, noteFromDoc, noteToCreateMap, noteToUpdateMap, type Note } from '@/models/types';

import { ImagesService } from './imagesService';

export type Unsubscribe = () => void;
type OnError = (error: Error) => void;

const notesCol = () => collection(db, 'notes');
const subjectRef = (id: string) => doc(db, 'subjects', id);

export interface AuthorStats {
  notesCount: number;
  totalVotes: number;
}

/// All Firestore reads/writes for notes, voting, and view counts.
export const NotesService = {
  /// Every note, newest first — the admin's Manage notes list.
  watchAll(onData: (notes: Note[]) => void, onError: OnError, max = 500): Unsubscribe {
    const q = query(notesCol(), orderBy('createdAt', 'desc'), limit(max));
    return onSnapshot(q, (snap) => onData(snap.docs.map(noteFromDoc)), onError);
  },

  /// Browse-by-subject list, sorted by votes ("Top") or recency ("New").
  watchBySubject(
    subjectId: string,
    options: { sortByVotes?: boolean; limit?: number },
    onData: (notes: Note[]) => void,
    onError: OnError,
  ): Unsubscribe {
    const { sortByVotes = true, limit: max = 50 } = options;
    const q = query(
      notesCol(),
      where('subjectId', '==', subjectId),
      orderBy(sortByVotes ? 'voteScore' : 'createdAt', 'desc'),
      limit(max),
    );
    return onSnapshot(q, (snap) => onData(snap.docs.map(noteFromDoc)), onError);
  },

  /// Bounded, structurally-filtered fetch + client-side text filter —
  /// Firestore has no full-text search; fine at this project's scale.
  /// `queryText` matches against title, module name, and body text.
  async search({ subjectId, queryText = '', max = 300 }: { subjectId?: string; queryText?: string; max?: number }) {
    const constraints: QueryConstraint[] = [];
    if (subjectId) constraints.push(where('subjectId', '==', subjectId));
    constraints.push(orderBy('createdAt', 'desc'), limit(max));
    const snap = await getDocs(query(notesCol(), ...constraints));
    let notes = snap.docs.map(noteFromDoc);
    const needle = queryText.trim().toLowerCase();
    if (needle.length > 0) {
      notes = notes.filter(
        (n) =>
          n.title.toLowerCase().includes(needle) ||
          n.subjectName.toLowerCase().includes(needle) ||
          noteDisplayText(n).toLowerCase().includes(needle),
      );
    }
    return notes;
  },

  async getNote(noteId: string): Promise<Note | null> {
    const snap = await getDoc(doc(db, 'notes', noteId));
    if (!snap.exists()) return null;
    return noteFromDoc(snap);
  },

  /// Publishes a note and bumps its subject's denormalized `notesCount` in
  /// one atomic transaction.
  async publishNote(note: Note): Promise<void> {
    const noteRef = doc(notesCol());
    await runTransaction(db, async (tx) => {
      tx.set(noteRef, noteToCreateMap(note));
      tx.update(subjectRef(note.subjectId), { notesCount: increment(1) });
    });
  },

  /// Saves an edit. If the note moved to another module, both modules'
  /// `notesCount` move with it in the same transaction. Images the edit
  /// removed are deleted from Storage once the save has succeeded.
  async updateNote(note: Note, previous: Note): Promise<void> {
    const noteRef = doc(db, 'notes', note.id);
    if (previous.subjectId === note.subjectId) {
      await updateDoc(noteRef, noteToUpdateMap(note));
    } else {
      await runTransaction(db, async (tx) => {
        tx.update(noteRef, noteToUpdateMap(note));
        tx.update(subjectRef(previous.subjectId), { notesCount: increment(-1) });
        tx.update(subjectRef(note.subjectId), { notesCount: increment(1) });
      });
    }
    const kept = new Set(imageUrlsIn(note.contentDelta));
    await ImagesService.deleteAll(imageUrlsIn(previous.contentDelta).filter((url) => !kept.has(url)));
  },

  /// Deletes the note, its module's count, and then its images.
  async deleteNote(note: Note): Promise<void> {
    await runTransaction(db, async (tx) => {
      tx.delete(doc(db, 'notes', note.id));
      tx.update(subjectRef(note.subjectId), { notesCount: increment(-1) });
    });
    await ImagesService.deleteAll(imageUrlsIn(note.contentDelta));
  },

  /// Bumps once per reader visit — call on mount, not on re-render.
  async incrementViewCount(noteId: string): Promise<void> {
    await updateDoc(doc(db, 'notes', noteId), { viewCount: increment(1) });
  },

  watchHasVoted(noteId: string, uid: string, onData: (voted: boolean) => void): Unsubscribe {
    return onSnapshot(
      doc(db, 'notes', noteId, 'votes', uid),
      (snap) => onData(snap.exists()),
      () => {},
    );
  },

  /// Upvote toggle: create-or-delete the `votes/{uid}` doc and move
  /// `voteScore` by exactly +/-1, both in one transaction (doc ID = uid
  /// structurally prevents double-voting). Returns the new voted state.
  async toggleVote(noteId: string, uid: string): Promise<boolean> {
    const noteRef = doc(db, 'notes', noteId);
    const voteRef = doc(db, 'notes', noteId, 'votes', uid);
    return runTransaction(db, async (tx) => {
      const voteDoc = await tx.get(voteRef);
      if (voteDoc.exists()) {
        tx.delete(voteRef);
        tx.update(noteRef, { voteScore: increment(-1) });
        return false;
      }
      tx.set(voteRef, { votedAt: serverTimestamp() });
      tx.update(noteRef, { voteScore: increment(1) });
      return true;
    });
  },

  /// Profile stat tiles — cheap aggregate reads, no full-document scan.
  /// `sum('voteScore')` under the `authorUid` filter needs the composite
  /// index (authorUid ASC, voteScore ASC) in firestore.indexes.json. Until
  /// it's deployed and built, Firestore answers `failed-precondition`, and
  /// the totals are computed from the author's notes instead.
  async getAuthorStats(authorUid: string): Promise<AuthorStats> {
    const q = query(notesCol(), where('authorUid', '==', authorUid));
    try {
      const snap = await getAggregateFromServer(q, { notes: count(), votes: sum('voteScore') });
      const data = snap.data();
      return { notesCount: data.notes ?? 0, totalVotes: Math.trunc(data.votes ?? 0) };
    } catch (e) {
      if (!(e instanceof FirestoreError && e.code === 'failed-precondition')) throw e;
      const docs = (await getDocs(q)).docs;
      const totalVotes = docs.reduce((total, d) => {
        const score = d.data().voteScore;
        return total + (typeof score === 'number' ? score : 0);
      }, 0);
      return { notesCount: docs.length, totalVotes: Math.trunc(totalVotes) };
    }
  },
};
