import type { IconName } from '@/utils/subjectIcons';

/// The five kinds of study material, in Browse/Upload order. Keys are
/// stored data (`notes.kind`, `subjects.counts.<key>`) — relabel freely,
/// never rename a key. Notes, activities and practicals live in `notes`
/// (they share the editor and reader); quizzes and papers get their own
/// collections.
export const CONTENT_KINDS = [
  {
    key: 'note',
    label: 'Notes',
    singular: 'note',
    icon: 'menu-book',
    description: 'Short reads on every topic',
  },
  {
    key: 'quiz',
    label: 'Quizzes',
    singular: 'quiz',
    icon: 'quiz',
    description: 'Test yourself',
  },
  {
    key: 'paper',
    label: 'Papers',
    singular: 'paper',
    icon: 'description',
    description: 'Past exam papers',
  },
  {
    key: 'activity',
    label: 'Activities',
    singular: 'activity',
    icon: 'edit-note',
    description: 'Try it, then check the answer',
  },
  {
    key: 'practical',
    label: 'Practicals',
    singular: 'practical',
    icon: 'science',
    description: 'Lab work with solutions',
  },
] as const satisfies readonly { key: string; label: string; singular: string; icon: IconName; description: string }[];

export type ContentKind = (typeof CONTENT_KINDS)[number]['key'];

/// The kinds stored as docs in `notes` (written with the note editor).
export const NOTE_KINDS = ['note', 'activity', 'practical'] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

/// Kinds whose screens exist yet. The others show "Coming soon".
export const AVAILABLE_KINDS: readonly ContentKind[] = [...NOTE_KINDS, 'quiz'];

export const DIFFICULTIES = [
  { key: 'easy', label: 'Easy' },
  { key: 'medium', label: 'Medium' },
  { key: 'hard', label: 'Hard' },
] as const;

export type Difficulty = (typeof DIFFICULTIES)[number]['key'] | '';

export const isContentKind = (v: unknown): v is ContentKind => CONTENT_KINDS.some((k) => k.key === v);
export const isNoteKind = (v: unknown): v is NoteKind => (NOTE_KINDS as readonly unknown[]).includes(v);

export const isDifficulty = (v: unknown): v is Exclude<Difficulty, ''> => DIFFICULTIES.some((d) => d.key === v);

export const kindInfo = (kind: ContentKind) => CONTENT_KINDS.find((k) => k.key === kind)!;

export const difficultyLabel = (key: string) => DIFFICULTIES.find((d) => d.key === key)?.label ?? '';

/// "1 activity" / "3 activities" / "2 quizzes".
export function countLabel(count: number, kind: ContentKind): string {
  const { singular, label } = kindInfo(kind);
  return `${count} ${count === 1 ? singular : label.toLowerCase()}`;
}
