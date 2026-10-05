import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { noteRequestFromDoc, type AppUser, type Note, type NoteRequest } from '@/models/types';

import type { Unsubscribe } from './notesService';

type OnError = (error: Error) => void;

const requestsCol = () => collection(db, 'noteRequests');
const requestRef = (id: string) => doc(db, 'noteRequests', id);

export type RequestSort = 'top' | 'new';

/// Note requests: students ask for notes, upvote each other's requests,
/// and the requester or an admin links a note to mark one fulfilled.
export const RequestsService = {
  /// Open or fulfilled requests, by votes ("top") or recency ("new").
  watchRequests(
    status: NoteRequest['status'],
    sort: RequestSort,
    onData: (requests: NoteRequest[]) => void,
    onError: OnError,
    max = 100,
  ): Unsubscribe {
    const q = query(
      requestsCol(),
      where('status', '==', status),
      orderBy(sort === 'top' ? 'voteCount' : 'createdAt', 'desc'),
      limit(max),
    );
    return onSnapshot(q, (snap) => onData(snap.docs.map(noteRequestFromDoc)), onError);
  },

  /// One request, live; null once it's deleted.
  watchRequest(id: string, onData: (request: NoteRequest | null) => void, onError: OnError): Unsubscribe {
    return onSnapshot(
      requestRef(id),
      (snap) => onData(snap.exists() ? noteRequestFromDoc(snap) : null),
      onError,
    );
  },

  async createRequest(
    fields: Pick<NoteRequest, 'subject' | 'topic' | 'grade' | 'details'>,
    user: Pick<AppUser, 'uid' | 'name'>,
  ): Promise<string> {
    const ref = await addDoc(requestsCol(), {
      ...fields,
      requesterUid: user.uid,
      requesterName: user.name,
      voteCount: 0,
      status: 'open',
      fulfilledNoteId: '',
      fulfilledNoteTitle: '',
      createdAt: serverTimestamp(),
      fulfilledAt: null,
    });
    return ref.id;
  },

  watchHasVoted(id: string, uid: string, onData: (voted: boolean) => void): Unsubscribe {
    return onSnapshot(
      doc(db, 'noteRequests', id, 'votes', uid),
      (snap) => onData(snap.exists()),
      () => {},
    );
  },

  /// Same scheme as `NotesService.toggleVote`: the `votes/{uid}` doc and
  /// a +/-1 `voteCount` change in one transaction. Returns the new state.
  async toggleVote(id: string, uid: string): Promise<boolean> {
    const voteRef = doc(db, 'noteRequests', id, 'votes', uid);
    return runTransaction(db, async (tx) => {
      const voteDoc = await tx.get(voteRef);
      if (voteDoc.exists()) {
        tx.delete(voteRef);
        tx.update(requestRef(id), { voteCount: increment(-1) });
        return false;
      }
      tx.set(voteRef, { votedAt: serverTimestamp() });
      tx.update(requestRef(id), { voteCount: increment(1) });
      return true;
    });
  },

  async fulfil(id: string, note: Pick<Note, 'id' | 'title'>): Promise<void> {
    await updateDoc(requestRef(id), {
      status: 'fulfilled',
      fulfilledNoteId: note.id,
      fulfilledNoteTitle: note.title,
      fulfilledAt: serverTimestamp(),
    });
  },

  async deleteRequest(id: string): Promise<void> {
    await deleteDoc(requestRef(id));
  },
};
