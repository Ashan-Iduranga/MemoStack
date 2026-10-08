import { Directory, File, Paths } from 'expo-file-system';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { isDifficulty, isNoteKind } from '@/config/contentKinds';
import { questionsFrom, quizImageUrls, type Quiz } from '@/models/quiz';
import { noteDisplayText, noteImageUrls, type Note, type SavedNote } from '@/models/types';

export const QUOTA_BYTES = 50 * 1024 * 1024;

export type SaveResult = 'saved' | 'alreadySaved' | 'quotaExceeded';

interface SavedNotesValue {
  saved: SavedNote[];
  isLoaded: boolean;
  usedBytes: number;
  isSaved(noteId: string): boolean;
  saveNote(note: Note): Promise<SaveResult>;
  saveQuiz(quiz: Quiz): Promise<SaveResult>;
  /// Removes a saved note or quiz.
  removeNote(noteId: string): Promise<void>;
  getCachedNote(noteId: string): Promise<Note | null>;
  getCachedQuiz(quizId: string): Promise<Quiz | null>;
  /// On-device copies of a saved note's images as `{ url: data URI }`
  /// (empty if the note isn't saved), for rendering without a network.
  getOfflineImages(noteId: string): Promise<Record<string, string>>;
}

const SavedNotesContext = createContext<SavedNotesValue | null>(null);

function savedDir(): Directory {
  const dir = new Directory(Paths.document, 'memostack_saved');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/// One folder per saved note holding its downloaded images.
function imagesDir(noteId: string): Directory {
  return new Directory(savedDir(), 'images', noteId);
}

/// Downloads every image of a note; returns `{ url: fileName }` for the
/// ones that succeeded (a failed image just stays online-only) and the
/// total bytes written.
async function downloadImages(noteId: string, urls: string[]) {
  const dir = imagesDir(noteId);
  if (dir.exists) dir.delete();
  dir.create({ intermediates: true });
  const files: Record<string, string> = {};
  let bytes = 0;
  await Promise.all(
    urls.map(async (url, i) => {
      try {
        const name = `${i}.jpg`;
        const file = await File.downloadFileAsync(url, new File(dir, name));
        files[url] = name;
        bytes += file.size;
      } catch {
        // Offline or deleted — the reader falls back to the URL.
      }
    }),
  );
  return { files, bytes };
}

function writeText(file: File, text: string) {
  if (!file.exists) file.create();
  file.write(text);
}

const byteLength = (text: string) => new TextEncoder().encode(text).length;

/// Offline note and quiz cache — client-only, never synced to Firestore. Stores a
/// manifest (`manifest.json`), one JSON file per saved note, and each
/// note's images under `images/{noteId}/`, all in the app's documents
/// directory, and enforces a client-side storage quota over all of it.
/// Kept in a context so every save button and the Saved tab stay in sync.
export function SavedNotesProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<SavedNote[]>([]);
  const [isLoaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const manifest = new File(savedDir(), 'manifest.json');
        if (manifest.exists) {
          const content = await manifest.text();
          setSaved(content.trim().length === 0 ? [] : (JSON.parse(content) as SavedNote[]));
        }
      } catch {
        setSaved([]);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const writeManifest = useCallback((next: SavedNote[]) => {
    writeText(new File(savedDir(), 'manifest.json'), JSON.stringify(next));
  }, []);

  const value = useMemo<SavedNotesValue>(() => {
    const usedBytes = saved.reduce((total, n) => total + n.sizeBytes, 0);
    const isSaved = (noteId: string) => saved.some((n) => n.noteId === noteId);

    /// Downloads the images, writes `{id}.json` and adds a manifest entry,
    /// unless that would go over the quota.
    const store = async (
      entry: Pick<SavedNote, 'noteId' | 'title' | 'subjectName' | 'kind'>,
      data: Record<string, unknown>,
      imageUrls: string[],
    ): Promise<SaveResult> => {
      if (isSaved(entry.noteId)) return 'alreadySaved';
      const images = await downloadImages(entry.noteId, imageUrls);
      const payload = JSON.stringify({ ...data, images: images.files });
      const bytes = byteLength(payload) + images.bytes;
      if (usedBytes + bytes > QUOTA_BYTES) {
        imagesDir(entry.noteId).delete();
        return 'quotaExceeded';
      }
      writeText(new File(savedDir(), `${entry.noteId}.json`), payload);
      const next = [...saved, { ...entry, sizeBytes: bytes, savedAt: new Date().toISOString() }];
      writeManifest(next);
      setSaved(next);
      return 'saved';
    };

    const readCached = async (id: string) => {
      const file = new File(savedDir(), `${id}.json`);
      if (!file.exists) return null;
      return JSON.parse(await file.text()) as Record<string, unknown>;
    };

    return {
      saved,
      isLoaded,
      usedBytes,
      isSaved,

      saveNote(note) {
        return store(
          { noteId: note.id, title: note.title, subjectName: note.subjectName, kind: 'note' },
          {
            id: note.id,
            kind: note.kind,
            title: note.title,
            subjectId: note.subjectId,
            subjectName: note.subjectName,
            authorUid: note.authorUid,
            authorName: note.authorName,
            contentDelta: note.contentDelta,
            answerDelta: note.answerDelta,
            difficulty: note.difficulty,
            requirements: note.requirements,
            plainText: noteDisplayText(note),
            excerpt: note.excerpt,
            wordCount: note.wordCount,
            readTimeMinutes: note.readTimeMinutes,
            voteScore: note.voteScore,
            viewCount: note.viewCount,
          },
          noteImageUrls(note),
        );
      },

      saveQuiz(quiz) {
        return store(
          { noteId: quiz.id, title: quiz.title, subjectName: quiz.subjectName, kind: 'quiz' },
          {
            id: quiz.id,
            title: quiz.title,
            description: quiz.description,
            subjectId: quiz.subjectId,
            subjectName: quiz.subjectName,
            authorUid: quiz.authorUid,
            authorName: quiz.authorName,
            difficulty: quiz.difficulty,
            questions: quiz.questions,
          },
          quizImageUrls(quiz),
        );
      },

      async removeNote(noteId) {
        const next = saved.filter((n) => n.noteId !== noteId);
        writeManifest(next);
        setSaved(next);
        const file = new File(savedDir(), `${noteId}.json`);
        if (file.exists) file.delete();
        const images = imagesDir(noteId);
        if (images.exists) images.delete();
      },

      /// Rebuilds a full Note from the cached JSON, for opening a saved
      /// note straight from the Saved tab (no Firestore round-trip).
      async getCachedNote(noteId) {
        const data = await readCached(noteId);
        if (data == null) return null;
        const s = (k: string) => (typeof data[k] === 'string' ? (data[k] as string) : '');
        const n = (k: string, d: number) => (typeof data[k] === 'number' ? (data[k] as number) : d);
        return {
          id: s('id') || noteId,
          kind: isNoteKind(data.kind) ? data.kind : 'note',
          title: s('title'),
          subjectId: s('subjectId'),
          subjectName: s('subjectName'),
          authorUid: s('authorUid'),
          authorName: s('authorName'),
          contentDelta: Array.isArray(data.contentDelta) ? (data.contentDelta as Note['contentDelta']) : [],
          answerDelta: Array.isArray(data.answerDelta) ? (data.answerDelta as Note['answerDelta']) : [],
          difficulty: isDifficulty(data.difficulty) ? data.difficulty : '',
          requirements: s('requirements'),
          plainText: s('plainText'),
          excerpt: s('excerpt'),
          wordCount: n('wordCount', 0),
          readTimeMinutes: n('readTimeMinutes', 1),
          voteScore: n('voteScore', 0),
          viewCount: n('viewCount', 0),
          createdAt: null,
          updatedAt: null,
        };
      },

      /// Rebuilds a saved quiz, for taking it offline from the Saved tab.
      async getCachedQuiz(quizId) {
        const data = await readCached(quizId);
        if (data == null) return null;
        const s = (k: string) => (typeof data[k] === 'string' ? (data[k] as string) : '');
        return {
          id: s('id') || quizId,
          title: s('title'),
          description: s('description'),
          subjectId: s('subjectId'),
          subjectName: s('subjectName'),
          authorUid: s('authorUid'),
          authorName: s('authorName'),
          difficulty: isDifficulty(data.difficulty) ? data.difficulty : '',
          questions: questionsFrom(data.questions),
          createdAt: null,
          updatedAt: null,
        };
      },

      async getOfflineImages(noteId) {
        const file = new File(savedDir(), `${noteId}.json`);
        if (!isSaved(noteId) || !file.exists) return {};
        const data = JSON.parse(await file.text()) as { images?: Record<string, string> };
        const result: Record<string, string> = {};
        await Promise.all(
          Object.entries(data.images ?? {}).map(async ([url, name]) => {
            const image = new File(imagesDir(noteId), name);
            if (image.exists) result[url] = `data:image/jpeg;base64,${await image.base64()}`;
          }),
        );
        return result;
      },
    };
  }, [saved, isLoaded, writeManifest]);

  return <SavedNotesContext.Provider value={value}>{children}</SavedNotesContext.Provider>;
}

export function useSavedNotes(): SavedNotesValue {
  const value = useContext(SavedNotesContext);
  if (!value) throw new Error('useSavedNotes must be used inside SavedNotesProvider');
  return value;
}
