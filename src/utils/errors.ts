import { FirebaseError } from 'firebase/app';

/// User-facing message for a failed Firestore write. A rules rejection
/// ("permission-denied") isn't a connection problem — it usually means the
/// deployed firestore.rules are older than the app — so say so instead of
/// blaming the network.
export function writeErrorMessage(e: unknown, action: string): string {
  console.warn(`Couldn't ${action}`, e);
  if (e instanceof FirebaseError) {
    if (e.code === 'permission-denied') {
      return `Couldn't ${action}: the server rejected the change. The app's Firestore rules may need to be deployed.`;
    }
    if (e.code === 'unavailable' || e.code === 'deadline-exceeded') {
      return `Couldn't ${action} — check your connection and try again.`;
    }
    return `Couldn't ${action} (${e.code}). Please try again.`;
  }
  return `Couldn't ${action} — check your connection and try again.`;
}
