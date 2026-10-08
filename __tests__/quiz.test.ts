// Only the pure helpers are under test; keep Firebase out of Jest.
jest.mock('firebase/firestore', () => ({ Timestamp: class {}, serverTimestamp: () => null }));

import type { DocumentSnapshot } from 'firebase/firestore';

import { QUIZ_LIMITS } from '@/config/quiz';
import {
  nextAttempt,
  quizFromDoc,
  quizImageUrls,
  quizProblem,
  quizToCreateMap,
  scoreAnswers,
  shuffleQuestions,
  tidyQuestions,
  type Quiz,
  type QuizQuestion,
} from '@/models/quiz';

const snapshot = (id: string, data: Record<string, unknown>) => ({ id, data: () => data }) as unknown as DocumentSnapshot;

const question = (over: Partial<QuizQuestion> = {}): QuizQuestion => ({
  id: 'q',
  text: 'What is 2 + 2?',
  imageUrl: '',
  options: ['3', '4', '5', '22'],
  correctIndex: 1,
  explanation: '',
  ...over,
});

/// Deterministic rng for shuffle tests.
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

describe('reading quizzes', () => {
  test('skips questions that cannot be answered', () => {
    const quiz = quizFromDoc(
      snapshot('z1', {
        title: 'Arithmetic',
        difficulty: 'extreme',
        questions: [
          { id: 'a', text: 'ok', options: ['x', 'y'], correctIndex: 0 },
          { id: 'b', text: 'bad index', options: ['x', 'y'], correctIndex: 5 },
          { id: 'c', text: 'one option', options: ['x'], correctIndex: 0 },
          'junk',
        ],
      }),
    );
    expect(quiz.difficulty).toBe('');
    expect(quiz.questions.map((q) => q.id)).toEqual(['a']);
  });

  test('the create map stores questionCount and the author', () => {
    const quiz = { questions: [question(), question({ id: 'r' })], authorUid: 'u1', difficulty: '' } as unknown as Quiz;
    expect(quizToCreateMap(quiz)).toMatchObject({ questionCount: 2, authorUid: 'u1' });
  });

  test('quizImageUrls lists each image once', () => {
    const A = 'https://res.cloudinary.com/demo/a.jpg';
    expect(quizImageUrls({ questions: [question({ imageUrl: A }), question(), question({ imageUrl: A })] })).toEqual([A]);
  });
});

describe('validation', () => {
  test('a good quiz passes', () => {
    expect(quizProblem('Sums', tidyQuestions([question({ text: '  2+2? ' })]))).toBeNull();
  });

  test('catches the common mistakes', () => {
    expect(quizProblem(' ', [question()])).toMatch(/title/);
    expect(quizProblem('T', [])).toMatch(/at least one/);
    expect(quizProblem('T', [question({ text: '' })])).toMatch(/Question 1 needs text/);
    expect(quizProblem('T', [question(), question({ options: ['a', ''] })])).toMatch(/Question 2: fill in/);
    expect(quizProblem('T', [question({ options: ['a'] })])).toMatch(/2–6 options/);
    expect(quizProblem('T', [question({ options: ['Yes', 'yes'] })])).toMatch(/duplicate/);
    expect(quizProblem('T', [question({ correctIndex: 4 })])).toMatch(/correct answer/);
    expect(quizProblem('T', Array.from({ length: QUIZ_LIMITS.maxQuestions + 1 }, () => question()))).toMatch(/at most/);
  });

  test('an image alone is enough for the question', () => {
    expect(quizProblem('T', [question({ text: '', imageUrl: 'https://x/y.jpg' })])).toBeNull();
  });
});

describe('taking a quiz', () => {
  const questions = [
    question({ id: 'a', options: ['w', 'x', 'y', 'z'], correctIndex: 2 }),
    question({ id: 'b', options: ['p', 'q'], correctIndex: 0 }),
    question({ id: 'c', options: ['1', '2', '3'], correctIndex: 1 }),
  ];

  test('shuffling keeps every question and its right answer', () => {
    for (let seed = 1; seed < 20; seed++) {
      const out = shuffleQuestions(questions, seeded(seed));
      expect(out.map((q) => q.id).sort()).toEqual(['a', 'b', 'c']);
      for (const q of out) {
        const original = questions.find((o) => o.id === q.id)!;
        expect([...q.options].sort()).toEqual([...original.options].sort());
        expect(q.options[q.correctIndex]).toBe(original.options[original.correctIndex]);
      }
    }
  });

  test('shuffling does not change the input', () => {
    shuffleQuestions(questions, seeded(3));
    expect(questions[0].options).toEqual(['w', 'x', 'y', 'z']);
  });

  test('scores right answers, skipped ones count as wrong', () => {
    expect(scoreAnswers(questions, [2, 0, 1])).toBe(3);
    expect(scoreAnswers(questions, [2, 1, null])).toBe(1);
    expect(scoreAnswers(questions, [])).toBe(0);
  });
});

describe('attempts', () => {
  test('first completion', () => {
    expect(nextAttempt(null, 7, 10)).toMatchObject({
      lastScore: 7,
      bestScore: 7,
      perfect: false,
      attemptCount: 1,
      firstCompletion: true,
      firstPerfect: false,
      newBest: false,
    });
  });

  test('best never drops and perfect sticks', () => {
    const prev = { bestScore: 10, total: 10, perfect: true, attemptCount: 2 };
    expect(nextAttempt(prev, 4, 10)).toMatchObject({ lastScore: 4, bestScore: 10, perfect: true, attemptCount: 3 });
    expect(nextAttempt(prev, 4, 10).firstPerfect).toBe(false);
  });

  test('a better score is a new best; a first 100% is a first perfect', () => {
    const prev = { bestScore: 6, total: 10, perfect: false, attemptCount: 1 };
    expect(nextAttempt(prev, 8, 10)).toMatchObject({ bestScore: 8, newBest: true, firstPerfect: false });
    expect(nextAttempt(prev, 10, 10)).toMatchObject({ bestScore: 10, perfect: true, firstPerfect: true });
  });

  test('an edited quiz (different length) starts a fresh best', () => {
    const prev = { bestScore: 10, total: 10, perfect: true, attemptCount: 1 };
    expect(nextAttempt(prev, 3, 8)).toMatchObject({ bestScore: 3, total: 8, perfect: true, newBest: false });
  });
});
