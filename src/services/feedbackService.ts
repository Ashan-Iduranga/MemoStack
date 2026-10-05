import { addDoc, collection, limit, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { Platform } from 'react-native';

import type { FeedbackType } from '@/config/profileOptions';
import { db } from '@/lib/firebase';
import { feedbackFromDoc, type FeedbackItem } from '@/models/types';

import type { Unsubscribe } from './notesService';

/// Users can only create feedback; admins can also read it (the You tab's
/// Feedback card). The sender's name is stored on the message because
/// admins can't read other users' profiles.
export const FeedbackService = {
  async submit(sender: { uid: string; name: string }, type: FeedbackType, message: string): Promise<void> {
    await addDoc(collection(db, 'feedback'), {
      uid: sender.uid,
      name: sender.name,
      type,
      message,
      platform: Platform.OS,
      createdAt: serverTimestamp(),
    });
  },

  /// Newest feedback first, live (admins only).
  watchRecent(onData: (items: FeedbackItem[]) => void, onError: (e: Error) => void, max = 50): Unsubscribe {
    const q = query(collection(db, 'feedback'), orderBy('createdAt', 'desc'), limit(max));
    return onSnapshot(q, (snap) => onData(snap.docs.map(feedbackFromDoc)), onError);
  },
};
