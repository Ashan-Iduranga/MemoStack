import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppCard } from '@/components/AppCard';
import { OutlinedButton, PrimaryButton } from '@/components/Buttons';
import { Loading, Message } from '@/components/Feedback';
import { ProgressBar, TagPill } from '@/components/Pills';
import { bestLabel, SaveQuizButton } from '@/components/QuizWidgets';
import { difficultyLabel } from '@/config/contentKinds';
import { XP } from '@/config/gamification';
import { nextAttempt, scoreAnswers, shuffleQuestions, type Quiz, type QuizAttempt, type QuizQuestion } from '@/models/quiz';
import { useAuth } from '@/services/AuthProvider';
import { GamificationService } from '@/services/gamificationService';
import { QuizzesService } from '@/services/quizzesService';
import { useSavedNotes } from '@/services/SavedNotesProvider';
import { fonts, useTheme } from '@/theme/ThemeProvider';
import { plural } from '@/utils/format';
import { handoff } from '@/utils/handoff';
import { useSubscription } from '@/utils/useSubscription';

/// Take a quiz: an intro card (best score, Start), then one question at a
/// time with instant right/wrong feedback and the explanation, then the
/// results with a review. Questions and options are shuffled per attempt.
export default function QuizScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getCachedQuiz } = useSavedNotes();
  const [quiz, setQuiz] = useState<Quiz | null | undefined>(() => handoff.getQuiz(id));

  useEffect(() => {
    if (quiz !== undefined) return;
    // Offline, fall back to the saved copy.
    QuizzesService.getQuiz(id)
      .catch(() => getCachedQuiz(id))
      .then((found) => setQuiz(found))
      .catch(() => setQuiz(null));
  }, [id, quiz, getCachedQuiz]);

  if (quiz === undefined) return <Loading />;
  if (quiz === null || quiz.questions.length === 0) return <Message text="This quiz is no longer available." />;
  return <QuizRunner quiz={quiz} />;
}

type Phase =
  | { name: 'intro' }
  | { name: 'playing'; questions: QuizQuestion[]; index: number; answers: (number | null)[] }
  | { name: 'done'; questions: QuizQuestion[]; answers: (number | null)[]; result: Result };

type Result = ReturnType<typeof nextAttempt> & { score: number };

function QuizRunner({ quiz }: { quiz: Quiz }) {
  const uid = useAuth().currentUser?.uid ?? '';
  const images = useOfflineImages(quiz.id);
  const [phase, setPhase] = useState<Phase>({ name: 'intro' });
  const attempt = useSubscription<QuizAttempt | null>(
    (onData, onError) => (uid ? QuizzesService.watchMyAttempt(quiz.id, uid, onData, onError) : () => {}),
    [quiz.id, uid],
  );
  const scroll = useRef<ScrollView>(null);

  const start = () => {
    setPhase({ name: 'playing', questions: shuffleQuestions(quiz.questions), index: 0, answers: [] });
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  const finish = (questions: QuizQuestion[], answers: (number | null)[]) => {
    const score = scoreAnswers(questions, answers);
    const prev = attempt.data ?? null;
    const result = uid ? QuizzesService.saveAttempt(quiz, uid, prev, score) : nextAttempt(prev, score, questions.length);
    // Finishing a quiz counts as today's activity for the streak.
    if (uid) GamificationService.recordActivity(uid, { kind: 'open' }).catch(() => {});
    setPhase({ name: 'done', questions, answers, result: { ...result, score } });
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  return (
    <>
      <Stack.Screen options={{ title: quiz.subjectName }} />
      <ScrollView ref={scroll} contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 16 }}>
        {phase.name === 'intro' && (
          <Intro quiz={quiz} attempt={attempt.data} loadingAttempt={attempt.waiting && uid !== ''} onStart={start} />
        )}
        {phase.name === 'playing' && (
          <QuestionStep
            question={phase.questions[phase.index]}
            index={phase.index}
            total={phase.questions.length}
            picked={phase.answers[phase.index] ?? null}
            images={images}
            onPick={(option) => {
              const answers = [...phase.answers];
              answers[phase.index] = option;
              setPhase({ ...phase, answers });
            }}
            onNext={() => {
              if (phase.index + 1 < phase.questions.length) {
                setPhase({ ...phase, index: phase.index + 1 });
                scroll.current?.scrollTo({ y: 0, animated: false });
              } else {
                finish(phase.questions, phase.answers);
              }
            }}
          />
        )}
        {phase.name === 'done' && (
          <Results
            questions={phase.questions}
            answers={phase.answers}
            result={phase.result}
            onRetake={start}
          />
        )}
      </ScrollView>
    </>
  );
}

function Intro({
  quiz,
  attempt,
  loadingAttempt,
  onStart,
}: {
  quiz: Quiz;
  attempt: QuizAttempt | null | undefined;
  loadingAttempt: boolean;
  onStart: () => void;
}) {
  const { colors, type } = useTheme();
  const best = bestLabel(attempt);
  return (
    <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <TagPill label={quiz.subjectName} tone="subject" />
        <TagPill label="Quiz" />
        {quiz.difficulty !== '' && <TagPill label={difficultyLabel(quiz.difficulty)} />}
      </View>
      <View style={{ flexDirection: 'row', marginTop: 16 }}>
        <View style={{ width: 5, borderRadius: 3, backgroundColor: colors.accent, marginRight: 12 }} />
        <View style={{ flex: 1 }}>
          <Text style={type.headlineMedium}>{quiz.title}</Text>
          <Text style={[type.bodyMedium, { color: colors.textSecondary, marginTop: 4 }]}>
            by {quiz.authorName} · {plural(quiz.questions.length, 'question')}
          </Text>
        </View>
      </View>
      {quiz.description !== '' && <Text style={[type.bodyLarge, { marginTop: 16 }]}>{quiz.description}</Text>}

      <AppCard style={{ marginTop: 24 }}>
        {best != null && attempt != null ? (
          <>
            <View style={styles.row}>
              <MaterialIcons name="emoji-events" size={22} color={colors.success} />
              <Text style={[type.titleMedium, { marginLeft: 8 }]}>{best}</Text>
              {attempt.perfect && (
                <View style={{ marginLeft: 8 }}>
                  <TagPill label="100% earned" tone="offline" />
                </View>
              )}
            </View>
            <Text style={[type.bodySmall, { marginTop: 4 }]}>
              Taken {plural(attempt.attemptCount, 'time')} · last score {attempt.lastScore}/{attempt.total}
            </Text>
          </>
        ) : (
          <>
            <Text style={type.titleMedium}>Not taken yet</Text>
            <Text style={[type.bodySmall, { marginTop: 4 }]}>
              Finish it for +{XP.quizCompleted} XP, and +{XP.quizPerfect} more for a perfect score.
            </Text>
          </>
        )}
      </AppCard>

      <PrimaryButton
        label={attempt != null ? 'Retake quiz' : 'Start quiz'}
        icon="play-arrow"
        loading={loadingAttempt}
        onPress={onStart}
        style={{ marginTop: 20 }}
      />
      <View style={{ flexDirection: 'row', marginTop: 12 }}>
        <SaveQuizButton quiz={quiz} />
      </View>
    </>
  );
}

function QuestionStep({
  question: q,
  index,
  total,
  picked,
  images,
  onPick,
  onNext,
}: {
  question: QuizQuestion;
  index: number;
  total: number;
  picked: number | null;
  images: Record<string, string>;
  onPick: (option: number) => void;
  onNext: () => void;
}) {
  const { colors, type } = useTheme();
  const answered = picked != null;
  const right = picked === q.correctIndex;
  return (
    <>
      <View style={[styles.row, { marginBottom: 8 }]}>
        <Text style={[type.labelLarge, { flex: 1 }]}>
          Question {index + 1} of {total}
        </Text>
      </View>
      <ProgressBar value={(index + (answered ? 1 : 0)) / total} />

      {q.text !== '' && <Text style={[type.titleLarge, { marginTop: 20 }]}>{q.text}</Text>}
      {q.imageUrl !== '' && (
        <Image
          source={{ uri: images[q.imageUrl] ?? q.imageUrl }}
          style={[styles.image, { backgroundColor: colors.tileBackground }]}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      )}

      <View style={{ marginTop: 20, gap: 10 }}>
        {q.options.map((option, i) => {
          const isCorrect = i === q.correctIndex;
          const isPicked = i === picked;
          const state = !answered ? 'idle' : isCorrect ? 'correct' : isPicked ? 'wrong' : 'dim';
          return (
            <Pressable
              key={i}
              onPress={answered ? undefined : () => onPick(i)}
              accessibilityRole="button"
              accessibilityState={{ disabled: answered, selected: isPicked }}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: state === 'correct' ? colors.tagOfflineFill : colors.tileBackground,
                  borderColor: state === 'correct' ? colors.success : state === 'wrong' ? colors.danger : 'transparent',
                  opacity: state === 'dim' ? 0.6 : pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={[type.bodyLarge, { flex: 1 }]}>{option}</Text>
              {state === 'correct' && <MaterialIcons name="check-circle" size={22} color={colors.success} />}
              {state === 'wrong' && <MaterialIcons name="cancel" size={22} color={colors.danger} />}
            </Pressable>
          );
        })}
      </View>

      {answered && (
        <AppCard style={{ marginTop: 20 }}>
          <View style={styles.row}>
            <MaterialIcons
              name={right ? 'check-circle-outline' : 'highlight-off'}
              size={20}
              color={right ? colors.success : colors.danger}
            />
            <Text style={[type.titleMedium, { marginLeft: 6, color: right ? colors.success : colors.danger }]}>
              {right ? 'Correct!' : 'Not quite'}
            </Text>
          </View>
          {!right && (
            <Text style={[type.bodyMedium, { marginTop: 6 }]}>
              The answer is <Text style={{ fontFamily: fonts.semibold }}>{q.options[q.correctIndex]}</Text>.
            </Text>
          )}
          {q.explanation !== '' && <Text style={[type.bodyMedium, { marginTop: 8 }]}>{q.explanation}</Text>}
        </AppCard>
      )}

      <PrimaryButton
        label={index + 1 < total ? 'Next question' : 'See results'}
        onPress={answered ? onNext : null}
        style={{ marginTop: 24 }}
      />
    </>
  );
}

function Results({
  questions,
  answers,
  result,
  onRetake,
}: {
  questions: QuizQuestion[];
  answers: (number | null)[];
  result: Result;
  onRetake: () => void;
}) {
  const { colors, type } = useTheme();
  const total = questions.length;
  const pct = Math.round((result.score / total) * 100);
  const xp = (result.firstCompletion ? XP.quizCompleted : 0) + (result.firstPerfect ? XP.quizPerfect : 0);
  const headline = pct === 100 ? 'Perfect score!' : pct >= 70 ? 'Nice work!' : pct >= 40 ? 'Getting there' : 'Keep practising';
  return (
    <>
      <AppCard style={{ alignItems: 'center', paddingVertical: 28 }}>
        <Text style={type.titleMedium}>{headline}</Text>
        <Text style={[type.displayMedium, { marginTop: 8 }]}>
          {result.score}/{total}
        </Text>
        <Text style={[type.bodyMedium, { color: colors.textSecondary }]}>{pct}% correct</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 14 }}>
          {xp > 0 && <TagPill label={`+${xp} XP`} tone="offline" />}
          {result.newBest && <TagPill label="New best!" tone="subject" />}
          {!result.firstCompletion && !result.newBest && <TagPill label={`Best ${result.bestScore}/${total}`} />}
        </View>
      </AppCard>

      <Text style={[type.titleMedium, { marginTop: 28, marginBottom: 10 }]}>Review</Text>
      {questions.map((q, i) => {
        const picked = answers[i];
        const right = picked === q.correctIndex;
        return (
          <View key={q.id} style={[styles.review, { borderColor: colors.divider }]}>
            <MaterialIcons
              name={right ? 'check-circle' : 'cancel'}
              size={20}
              color={right ? colors.success : colors.danger}
              style={{ marginTop: 2 }}
            />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={type.bodyLarge}>{q.text !== '' ? q.text : `Question ${i + 1} (image)`}</Text>
              {!right && picked != null && (
                <Text style={[type.bodySmall, { marginTop: 4 }]}>Your answer: {q.options[picked]}</Text>
              )}
              <Text style={[type.bodySmall, { marginTop: 2, color: colors.success }]}>
                Answer: {q.options[q.correctIndex]}
              </Text>
            </View>
          </View>
        );
      })}

      <PrimaryButton label="Retake quiz" icon="replay" onPress={onRetake} style={{ marginTop: 24 }} />
      <OutlinedButton label="Done" onPress={() => router.back()} style={{ marginTop: 12, alignSelf: 'center' }} />
    </>
  );
}

/// On-device copies of a saved quiz's images as `{ url: data URI }`
/// (empty when the quiz isn't saved or while they load).
function useOfflineImages(quizId: string): Record<string, string> {
  const { isSaved, getOfflineImages } = useSavedNotes();
  const saved = isSaved(quizId);
  const [images, setImages] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!saved) return;
    let live = true;
    getOfflineImages(quizId)
      .catch(() => ({}))
      .then((found) => {
        if (live) setImages(found);
      });
    return () => {
      live = false;
    };
    // `getOfflineImages` changes identity whenever the saved list does;
    // `saved` already covers the change that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId, saved]);

  return saved ? images : {};
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  image: { width: '100%', height: 220, borderRadius: 12, marginTop: 16 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 56,
  },
  review: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
});
