import { FirebaseError } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { auth, db } from '@/lib/firebase';
import { appUserFromData, appUserToMap, type AppUser } from '@/models/types';
import { ProfileService } from '@/services/profileService';

interface AuthValue {
  currentUser: AppUser | null;
  isLoading: boolean;
  isSignedIn: boolean;
  isAdmin: boolean;
  isEmailVerified: boolean;
  pendingVerificationEmail: string | null;
  error: string | null;
  register(input: {
    name: string;
    email: string;
    password: string;
    university: string;
    degreeProgram: string;
  }): Promise<string | null>;
  signIn(email: string, password: string): Promise<string | null>;
  signOut(): Promise<void>;
  reloadUser(): Promise<void>;
  /// Re-reads `users/{uid}` without the loading overlay (after a profile edit).
  refreshUser(): Promise<void>;
  resendVerificationEmail(): Promise<string | null>;
  sendPasswordReset(email: string): Promise<string | null>;
}

const AuthContext = createContext<AuthValue | null>(null);

function friendlyAuthError(e: unknown): string {
  if (!(e instanceof FirebaseError)) return 'Something went wrong. Please try again.';
  switch (e.code) {
    case 'auth/invalid-email':
      return 'That email address looks invalid.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/user-not-found':
      return 'No account found with that email.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.';
    case 'auth/email-already-in-use':
      return 'An account already exists with that email.';
    case 'auth/weak-password':
      return 'Please choose a stronger password (6+ characters).';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    default:
      return e.message || 'Authentication failed.';
  }
}

/// Wraps Firebase Auth + the `users` collection and exposes the
/// currently signed-in AppUser (including admin status) to the app.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Bumped after `reload()` so `emailVerified` changes re-render readers.
  const [reloadTick, setReloadTick] = useState(0);

  const loadUserDoc = useCallback(async (uid: string) => {
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        const user = appUserFromData(uid, snap.data());
        // Keep the sign-in provider's photo (e.g. Google) on the user doc,
        // so the avatar can use it when there's no custom photo.
        const providerPhoto = auth.currentUser?.photoURL ?? '';
        if (providerPhoto.length > 0 && providerPhoto !== user.authPhotoURL) {
          user.authPhotoURL = providerPhoto;
          ProfileService.saveAuthPhoto(uid, providerPhoto).catch(() => {});
        }
        setAppUser(user);
      }
    } catch {
      setError('Could not load your profile. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      if (!user) {
        setAppUser(null);
        setLoading(false);
        return;
      }
      loadUserDoc(user.uid);
    });
  }, [loadUserDoc]);

  const value = useMemo<AuthValue>(
    () => ({
      currentUser: appUser,
      isLoading: loading,
      isSignedIn: appUser != null,
      isAdmin: appUser?.isAdmin ?? false,
      isEmailVerified: auth.currentUser?.emailVerified ?? false,
      pendingVerificationEmail: auth.currentUser?.email ?? null,
      error,

      async register({ name, email, password, university, degreeProgram }) {
        setError(null);
        try {
          const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
          const uid = cred.user.uid;
          await setDoc(
            doc(db, 'users', uid),
            appUserToMap({
              uid,
              name: name.trim(),
              email: email.trim(),
              university: university.trim(),
              degreeProgram: degreeProgram.trim(),
              isAdmin: false,
            }),
          );
          await updateProfile(cred.user, { displayName: name.trim() });
          await sendEmailVerification(cred.user);
          await loadUserDoc(uid);
          return null;
        } catch (e) {
          return friendlyAuthError(e);
        }
      },

      async signIn(email, password) {
        setError(null);
        try {
          await signInWithEmailAndPassword(auth, email.trim(), password);
          return null;
        } catch (e) {
          return friendlyAuthError(e);
        }
      },

      async signOut() {
        await firebaseSignOut(auth);
      },

      /// Re-fetches the current user from Firebase to pick up a
      /// verification that happened outside the app (the email link).
      async reloadUser() {
        try {
          await auth.currentUser?.reload();
        } catch {
          // If the user was deleted or the token expired, the next auth
          // state event routes back to the login screen anyway.
        }
        setReloadTick((t) => t + 1);
      },

      async refreshUser() {
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        const snap = await getDoc(doc(db, 'users', uid));
        if (snap.exists()) setAppUser(appUserFromData(uid, snap.data()));
      },

      async resendVerificationEmail() {
        try {
          if (auth.currentUser) await sendEmailVerification(auth.currentUser);
          return null;
        } catch (e) {
          return e instanceof FirebaseError
            ? friendlyAuthError(e)
            : 'Could not send verification email. Please try again.';
        }
      },

      async sendPasswordReset(email) {
        try {
          await sendPasswordResetEmail(auth, email.trim());
          return null;
        } catch (e) {
          return friendlyAuthError(e);
        }
      },
    }),
    // `auth.currentUser` isn't React state; `reloadTick` re-reads it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appUser, loading, error, loadUserDoc, reloadTick],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
