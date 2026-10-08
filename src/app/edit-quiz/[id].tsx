import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { Loading, Message } from '@/components/Feedback';
import type { Quiz } from '@/models/quiz';
import { QuizEditor } from '@/screens/QuizEditor';
import { QuizzesService } from '@/services/quizzesService';
import { handoff } from '@/utils/handoff';

export default function EditQuizScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [quiz, setQuiz] = useState<Quiz | null | undefined>(() => handoff.getQuiz(id));

  useEffect(() => {
    if (quiz !== undefined) return;
    QuizzesService.getQuiz(id)
      .then(setQuiz)
      .catch(() => setQuiz(null));
  }, [id, quiz]);

  if (quiz === undefined) return <Loading />;
  if (quiz === null) return <Message text="This quiz is no longer available." />;
  return <QuizEditor quiz={quiz} />;
}
