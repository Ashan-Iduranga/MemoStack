import { Timestamp, serverTimestamp, type DocumentSnapshot } from 'firebase/firestore';

import type { ActivityState } from '@/gamification/activity';

import { deltaFromText, textOf } from './delta';

type Data = Record<string, unknown>;

const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);
const int = (v: unknown, fallback: number) => (typeof v === 'number' ? Math.trunc(v) : fallback);
const date = (v: unknown) => (v instanceof Timestamp ? v.toDate() : null);
const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/// Profile fields the owner edits in Edit Profile. Sign-up writes the
/// same `name` / `university` / `degreeProgram` fields, so all three
/// screens share one shape. `university` is shown as "Institution",
/// `degreeProgram` as "Degree", `uniYear` as "Year" (a `UNI_YEARS` key).
export interface ProfileFields {
  name: string;
  bio: string;
  university: string;
  degreeProgram: string;
  uniYear: string;
  location: string;
}

/// A registered student (or admin) account, mirrored in the
/// `users/{uid}` Firestore document. Docs created before the profile
/// and gamification fields existed read as their zero values.
export interface AppUser extends ProfileFields, ActivityState {
  uid: string;
  email: string;
  isAdmin: boolean;
  createdAt: Date | null;
  /// Custom avatar (Cloudinary https URL), or '' for none.
  photoURL: string;
  /// The sign-in provider's photo (e.g. Google), saved on sign-in, or ''.
  authPhotoURL: string;
}

/// Fields from before Year/Degree replaced the A/L year and stream. They
/// can't be converted (an A/L year isn't a university year), so
/// `ProfileService.watchProfile` deletes them from the user's own doc.
export const LEGACY_PROFILE_FIELDS = ['alYear', 'alStream'] as const;

export function appUserFromData(uid: string, data: Data): AppUser {
  const reads = (data.readsToday ?? {}) as Data;
  return {
    uid,
    name: str(data.name),
    email: str(data.email),
    university: str(data.university),
    degreeProgram: str(data.degreeProgram),
    isAdmin: data.isAdmin === true,
    createdAt: date(data.createdAt),
    bio: str(data.bio),
    uniYear: str(data.uniYear),
    location: str(data.location),
    photoURL: str(data.photoURL),
    authPhotoURL: str(data.authPhotoURL),
    xp: int(data.xp, 0),
    currentStreak: int(data.currentStreak, 0),
    longestStreak: int(data.longestStreak, 0),
    lastActiveDate: str(data.lastActiveDate),
    weekActiveDates: strings(data.weekActiveDates),
    readsToday: { date: str(reads.date), noteIds: strings(reads.noteIds) },
  };
}

/// A new account's doc: profile and gamification fields start empty.
export function appUserToMap(
  user: Pick<AppUser, 'uid' | 'name' | 'email' | 'university' | 'degreeProgram' | 'isAdmin'>,
) {
  return {
    name: user.name,
    email: user.email,
    university: user.university,
    degreeProgram: user.degreeProgram,
    isAdmin: user.isAdmin,
    createdAt: serverTimestamp(),
    bio: '',
    uniYear: '',
    location: '',
    photoURL: '',
    authPhotoURL: '',
    xp: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: '',
    weekActiveDates: [],
    readsToday: { date: '', noteIds: [] },
  };
}

/// A module (e.g. "Data Structures"), doc `subjects/{id}`. Modules are a
/// flat list — not tied to any university's year/semester structure.
export interface Subject {
  id: string;
  name: string;
  iconKey: string;
  notesCount: number;
  order: number;
  createdAt: Date | null;
}

export function subjectFromDoc(doc: DocumentSnapshot): Subject {
  const data = (doc.data() ?? {}) as Data;
  return {
    id: doc.id,
    name: str(data.name),
    iconKey: str(data.iconKey, 'menuBook'),
    notesCount: int(data.notesCount, 0),
    order: int(data.order, 0),
    createdAt: date(data.createdAt),
  };
}

/// A published note, doc `notes/{id}`. The body is a Quill 2 Delta stored
/// as a plain array (Firestore's native type — no stringify/parse step).
/// Images are embeds pointing at Cloudinary https URLs; the
/// `plainText` / `excerpt` / `wordCount` fields are derived from the Delta
/// at publish time for search and list cards.
export interface Note {
  id: string;
  title: string;
  subjectId: string;
  subjectName: string;
  authorUid: string;
  authorName: string;
  contentDelta: DeltaOp[];
  plainText: string;
  excerpt: string;
  wordCount: number;
  readTimeMinutes: number;
  voteScore: number;
  viewCount: number;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export type DeltaOp = { insert?: unknown; attributes?: Record<string, unknown> } & Data;

export function noteFromDoc(doc: DocumentSnapshot): Note {
  const data = (doc.data() ?? {}) as Data;
  return {
    id: doc.id,
    title: str(data.title),
    subjectId: str(data.subjectId),
    subjectName: str(data.subjectName),
    authorUid: str(data.authorUid),
    authorName: str(data.authorName),
    contentDelta: Array.isArray(data.contentDelta) ? (data.contentDelta as DeltaOp[]) : [],
    plainText: str(data.plainText),
    excerpt: str(data.excerpt),
    wordCount: int(data.wordCount, 0),
    readTimeMinutes: int(data.readTimeMinutes, 1),
    voteScore: int(data.voteScore, 0),
    viewCount: int(data.viewCount, 0),
    createdAt: date(data.createdAt),
    updatedAt: date(data.updatedAt),
  };
}

/// Body text for search. Falls back to the Delta's text when `plainText`
/// is blank — notes added by hand in the console may skip that field.
export function noteDisplayText(note: Note): string {
  if (note.plainText.trim().length > 0) return note.plainText;
  return textOf(note.contentDelta);
}

/// Body to render or edit: the stored Delta, or — for hand-added notes
/// with only plain text — that text as a single paragraph.
export function noteBody(note: Note): DeltaOp[] {
  return note.contentDelta.length > 0 ? note.contentDelta : deltaFromText(note.plainText);
}

export function noteToCreateMap(note: Note) {
  return {
    title: note.title,
    subjectId: note.subjectId,
    subjectName: note.subjectName,
    authorUid: note.authorUid,
    authorName: note.authorName,
    contentDelta: note.contentDelta,
    plainText: note.plainText,
    excerpt: note.excerpt,
    wordCount: note.wordCount,
    readTimeMinutes: note.readTimeMinutes,
    voteScore: 0,
    viewCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

/// Fields an admin may update — deliberately excludes
/// authorUid/createdAt/voteScore/viewCount, matching the rules'
/// `hasAny` deny-list for the admin-edit branch.
export function noteToUpdateMap(note: Note) {
  return {
    title: note.title,
    subjectId: note.subjectId,
    subjectName: note.subjectName,
    contentDelta: note.contentDelta,
    plainText: note.plainText,
    excerpt: note.excerpt,
    wordCount: note.wordCount,
    readTimeMinutes: note.readTimeMinutes,
    updatedAt: serverTimestamp(),
  };
}

/// A student's request for a note on a topic, doc `noteRequests/{id}`.
/// Upvoted like notes (`votes/{uid}` subcollection + `voteCount`); the
/// requester or an admin marks it fulfilled by linking an existing note.
export interface NoteRequest {
  id: string;
  subject: string;
  topic: string;
  grade: string;
  details: string;
  requesterUid: string;
  requesterName: string;
  voteCount: number;
  status: 'open' | 'fulfilled';
  fulfilledNoteId: string;
  fulfilledNoteTitle: string;
  createdAt: Date | null;
  fulfilledAt: Date | null;
}

export function noteRequestFromDoc(doc: DocumentSnapshot): NoteRequest {
  const data = (doc.data() ?? {}) as Data;
  return {
    id: doc.id,
    subject: str(data.subject),
    topic: str(data.topic),
    grade: str(data.grade),
    details: str(data.details),
    requesterUid: str(data.requesterUid),
    requesterName: str(data.requesterName),
    voteCount: int(data.voteCount, 0),
    status: data.status === 'fulfilled' ? 'fulfilled' : 'open',
    fulfilledNoteId: str(data.fulfilledNoteId),
    fulfilledNoteTitle: str(data.fulfilledNoteTitle),
    createdAt: date(data.createdAt),
    fulfilledAt: date(data.fulfilledAt),
  };
}

/// A user's message from Send feedback, doc `feedback/{id}`. Only admins
/// can read these (the You tab's Feedback card).
export interface FeedbackItem {
  id: string;
  type: string;
  message: string;
  uid: string;
  /// Sender's name at the time; '' for messages sent before it was saved.
  name: string;
  platform: string;
  createdAt: Date | null;
}

export function feedbackFromDoc(doc: DocumentSnapshot): FeedbackItem {
  const data = (doc.data() ?? {}) as Data;
  return {
    id: doc.id,
    type: str(data.type, 'other'),
    message: str(data.message),
    uid: str(data.uid),
    name: str(data.name),
    platform: str(data.platform),
    createdAt: date(data.createdAt),
  };
}

/// A locally-cached note for offline reading. Lives only in the saved
/// notes manifest on the device — never synced to Firestore.
export interface SavedNote {
  noteId: string;
  title: string;
  subjectName: string;
  sizeBytes: number;
  savedAt: string;
}
