import { deleteField, doc, onSnapshot, updateDoc } from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { appUserFromData, LEGACY_PROFILE_FIELDS, type AppUser, type ProfileFields } from '@/models/types';

import { ImagesService, type ImageSource } from './imagesService';
import type { Unsubscribe } from './notesService';

const userRef = (uid: string) => doc(db, 'users', uid);

/// The signed-in user's own `users/{uid}` profile (the rules only let a
/// user read and write their own).
export const ProfileService = {
  /// Live profile, so edits, photo changes, XP and streaks show at once.
  /// Also removes the retired A/L fields from the doc the first time it
  /// sees them (see `LEGACY_PROFILE_FIELDS`).
  watchProfile(uid: string, onData: (user: AppUser) => void, onError: (e: Error) => void): Unsubscribe {
    return onSnapshot(
      userRef(uid),
      (snap) => {
        if (!snap.exists()) return onError(new Error('Profile not found'));
        const data = snap.data();
        onData(appUserFromData(uid, data));
        if (LEGACY_PROFILE_FIELDS.some((key) => key in data)) {
          const cleanup = Object.fromEntries(LEGACY_PROFILE_FIELDS.map((key) => [key, deleteField()]));
          updateDoc(userRef(uid), cleanup).catch(() => {});
        }
      },
      onError,
    );
  },

  async updateProfile(uid: string, fields: ProfileFields): Promise<void> {
    await updateDoc(userRef(uid), { ...fields });
  },

  /// Picks a square photo, uploads it and saves it as the profile photo
  /// straight away. Returns the URL, or null if the user cancelled.
  async changePhoto(uid: string, source: ImageSource): Promise<string | null> {
    const localUri = await ImagesService.pick(source, { square: true, maxEdge: 512 });
    if (localUri == null) return null;
    const url = await ImagesService.upload(localUri, uid);
    try {
      await updateDoc(userRef(uid), { photoURL: url });
    } catch (e) {
      ImagesService.deleteAll([url]);
      throw e;
    }
    return url;
  },

  /// Clears the custom photo (falls back to the sign-in photo or initials).
  async removePhoto(uid: string): Promise<void> {
    await updateDoc(userRef(uid), { photoURL: '' });
  },

  /// Saves the sign-in provider's photo (e.g. Google) on the user doc.
  async saveAuthPhoto(uid: string, url: string): Promise<void> {
    await updateDoc(userRef(uid), { authPhotoURL: url });
  },
};

/// The avatar to show: a custom upload first, then the sign-in provider's
/// photo (Google serves `=s96-c` thumbnails; `=s400-c` is the same image
/// at 400px), else null for the initials fallback.
export function avatarUrl(user: Pick<AppUser, 'photoURL' | 'authPhotoURL'>): string | null {
  if (user.photoURL.length > 0) return user.photoURL;
  if (user.authPhotoURL.length > 0) return user.authPhotoURL.replace('=s96-c', '=s400-c');
  return null;
}
