/// Quiz limits. `firestore.rules` mirrors MAX_QUESTIONS and the title /
/// description lengths — search it for "quiz.ts" and keep them in sync.
export const QUIZ_LIMITS = {
  maxQuestions: 50,
  minOptions: 2,
  maxOptions: 6,
  title: 120,
  description: 300,
  question: 500,
  option: 200,
  explanation: 1000,
};

/// Admin's new-quiz draft on this device (AsyncStorage key).
export const QUIZ_DRAFT_KEY = 'quiz_draft_v1';
