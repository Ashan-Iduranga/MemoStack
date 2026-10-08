import { Timestamp, serverTimestamp, type DocumentSnapshot } from 'firebase/firestore';

import { isDifficulty, type Difficulty } from '@/config/contentKinds';
import { QUIZ_LIMITS } from '@/config/quiz';

type Data = Record<string, unknown>;

const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);
const int = (v: unknown, fallback: number) => (typeof v === 'number' ? Math.trunc(v) : fallback);
const date = (v: unknown) => (v instanceof Timestamp ? v.toDate() : null);

/// One multiple-choice question: plain text, an optional Cloudinary image,
/// 2–6 options of which exactly one (`correctIndex`) is right, and an
/// optional explanation shown once the student has answered.
export interface QuizQuestion {
  id: string;
  text: string;
  imageUrl: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

/// A published quiz, doc `quizzes/{id}`. The questions — answer key
/// included — live on the doc, so taking a quiz is one read and works
/// offline once saved. Scoring happens on the device.
export interface Quiz {
  id: string;
  title: string;
  description: string;
  subjectId: string;
  subjectName: string;
  authorUid: string;
  authorName: string;
  difficulty: Difficulty;
  questions: QuizQuestion[];
  createdAt: Date | null;
  updatedAt: Date | null;
}

/// A student's results on one quiz, doc `quizzes/{quizId}/quizAttempts/{uid}`.
/// The doc existing means "completed at least once" (quiz XP is derived
/// from counting these); `perfect` stays true once any attempt was 100%.
export interface QuizAttempt {
  quizId: string;
  uid: string;
  quizTitle: string;
  subjectName: string;
  lastScore: number;
  bestScore: number;
  total: number;
  perfect: boolean;
  attemptCount: number;
  firstCompletedAt: Date | null;
  updatedAt: Date | null;
}

export const newQuestionId = () => Math.random().toString(36).slice(2, 10);

export const emptyQuestion = (): QuizQuestion => ({
  id: newQuestionId(),
  text: '',
  imageUrl: '',
  options: ['', '', '', ''],
  correctIndex: 0,
  explanation: '',
});

function questionFrom(v: unknown, index: number): QuizQuestion | null {
  if (v == null || typeof v !== 'object') return null;
  const data = v as Data;
  const options = Array.isArray(data.options) ? data.options.map((o) => str(o)) : [];
  const correctIndex = int(data.correctIndex, -1);
  if (options.length < 2 || correctIndex < 0 || correctIndex >= options.length) return null;
  return {
    id: str(data.id) || `q${index}`,
    text: str(data.text),
    imageUrl: str(data.imageUrl),
    options,
    correctIndex,
    explanation: str(data.explanation),
  };
}

/// Questions from stored data, skipping any that can't be answered
/// (e.g. hand-edited in the console with a bad `correctIndex`).
export function questionsFrom(v: unknown): QuizQuestion[] {
  if (!Array.isArray(v)) return [];
  return v.map(questionFrom).filter((q): q is QuizQuestion => q != null);
}

export function quizFromData(id: string, data: Data): Quiz {
  return {
    id,
    title: str(data.title),
    description: str(data.description),
    subjectId: str(data.subjectId),
    subjectName: str(data.subjectName),
    authorUid: str(data.authorUid),
    authorName: str(data.authorName),
    difficulty: isDifficulty(data.difficulty) ? data.difficulty : '',
    questions: questionsFrom(data.questions),
    createdAt: date(data.createdAt),
    updatedAt: date(data.updatedAt),
  };
}

export function quizFromDoc(doc: DocumentSnapshot): Quiz {
  return quizFromData(doc.id, (doc.data() ?? {}) as Data);
}

const questionToMap = (q: QuizQuestion) => ({
  id: q.id,
  text: q.text,
  imageUrl: q.imageUrl,
  options: q.options,
  correctIndex: q.correctIndex,
  explanation: q.explanation,
});

/// Fields an admin may update — never authorUid/createdAt (the rules
/// check this).
export function quizToUpdateMap(quiz: Quiz) {
  return {
    title: quiz.title,
    description: quiz.description,
    subjectId: quiz.subjectId,
    subjectName: quiz.subjectName,
    difficulty: quiz.difficulty,
    questions: quiz.questions.map(questionToMap),
    questionCount: quiz.questions.length,
    updatedAt: serverTimestamp(),
  };
}

export function quizToCreateMap(quiz: Quiz) {
  return {
    ...quizToUpdateMap(quiz),
    authorUid: quiz.authorUid,
    authorName: quiz.authorName,
    createdAt: serverTimestamp(),
  };
}

/// Every image a quiz uses. Cleanup and offline saving go through this.
export function quizImageUrls(quiz: Pick<Quiz, 'questions'>): string[] {
  return [...new Set(quiz.questions.map((q) => q.imageUrl).filter((url) => url !== ''))];
}

/// Trims every text field of the editor's questions.
export function tidyQuestions(questions: QuizQuestion[]): QuizQuestion[] {
  return questions.map((q) => ({
    ...q,
    text: q.text.trim(),
    options: q.options.map((o) => o.trim()),
    explanation: q.explanation.trim(),
  }));
}

/// The first problem that stops a quiz being published, or null.
/// Expects `tidyQuestions` output.
export function quizProblem(title: string, questions: QuizQuestion[]): string | null {
  const L = QUIZ_LIMITS;
  if (title.trim().length === 0) return 'Please add a title.';
  if (title.trim().length > L.title) return `Keep the title under ${L.title} characters.`;
  if (questions.length === 0) return 'Add at least one question.';
  if (questions.length > L.maxQuestions) return `A quiz can have at most ${L.maxQuestions} questions.`;
  for (const [i, q] of questions.entries()) {
    const n = `Question ${i + 1}`;
    if (q.text.length === 0 && q.imageUrl === '') return `${n} needs text or an image.`;
    if (q.text.length > L.question) return `${n} is too long (max ${L.question} characters).`;
    if (q.options.length < L.minOptions || q.options.length > L.maxOptions)
      return `${n} needs ${L.minOptions}–${L.maxOptions} options.`;
    if (q.options.some((o) => o.length === 0)) return `${n}: fill in or remove the empty options.`;
    if (q.options.some((o) => o.length > L.option)) return `${n}: keep options under ${L.option} characters.`;
    if (new Set(q.options.map((o) => o.toLowerCase())).size !== q.options.length) return `${n} has duplicate options.`;
    if (q.correctIndex < 0 || q.correctIndex >= q.options.length) return `${n}: mark the correct answer.`;
    if (q.explanation.length > L.explanation) return `${n}: keep the explanation under ${L.explanation} characters.`;
  }
  return null;
}

function shuffled<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/// A fresh order for one attempt: questions and each question's options
/// shuffled, with `correctIndex` following the right option.
export function shuffleQuestions(questions: readonly QuizQuestion[], rng: () => number = Math.random): QuizQuestion[] {
  return shuffled(questions, rng).map((q) => {
    const order = shuffled(
      q.options.map((_, i) => i),
      rng,
    );
    return { ...q, options: order.map((i) => q.options[i]), correctIndex: order.indexOf(q.correctIndex) };
  });
}

/// How many answers are right; `answers[i]` is the option picked for
/// `questions[i]`, or null if skipped.
export function scoreAnswers(questions: readonly QuizQuestion[], answers: readonly (number | null)[]): number {
  return questions.reduce((total, q, i) => total + (answers[i] === q.correctIndex ? 1 : 0), 0);
}

/// The attempt doc after finishing with `score` out of `total`, plus what
/// it newly earned. Best score never drops — unless the quiz's question
/// count changed since (an edited quiz starts a fresh best); `perfect`
/// never resets, since its XP was already counted.
export function nextAttempt(
  prev: Pick<QuizAttempt, 'bestScore' | 'total' | 'perfect' | 'attemptCount'> | null,
  score: number,
  total: number,
): {
  lastScore: number;
  bestScore: number;
  total: number;
  perfect: boolean;
  attemptCount: number;
  firstCompletion: boolean;
  firstPerfect: boolean;
  newBest: boolean;
} {
  const sameQuiz = prev != null && prev.total === total;
  const bestScore = sameQuiz ? Math.max(prev.bestScore, score) : score;
  const perfect = (prev?.perfect ?? false) || (total > 0 && score === total);
  return {
    lastScore: score,
    bestScore,
    total,
    perfect,
    attemptCount: (prev?.attemptCount ?? 0) + 1,
    firstCompletion: prev == null,
    firstPerfect: perfect && !(prev?.perfect ?? false),
    newBest: sameQuiz && score > prev.bestScore,
  };
}

export function attemptFromDoc(doc: DocumentSnapshot): QuizAttempt {
  const data = (doc.data() ?? {}) as Data;
  return {
    quizId: str(data.quizId),
    uid: str(data.uid),
    quizTitle: str(data.quizTitle),
    subjectName: str(data.subjectName),
    lastScore: int(data.lastScore, 0),
    bestScore: int(data.bestScore, 0),
    total: int(data.total, 0),
    perfect: data.perfect === true,
    attemptCount: int(data.attemptCount, 0),
    firstCompletedAt: date(data.firstCompletedAt),
    updatedAt: date(data.updatedAt),
  };
}
