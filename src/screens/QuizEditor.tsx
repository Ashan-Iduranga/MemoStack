import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { IconButton, OutlinedButton, PrimaryButton, TextButton } from '@/components/Buttons';
import { Loading } from '@/components/Feedback';
import { AppTextField } from '@/components/Inputs';
import { ModulePicker, moduleChoice, resolveModule } from '@/components/ModulePicker';
import { PillChip } from '@/components/Pills';
import { useToast } from '@/components/Toast';
import { DIFFICULTIES, isDifficulty, type Difficulty } from '@/config/contentKinds';
import { QUIZ_DRAFT_KEY, QUIZ_LIMITS } from '@/config/quiz';
import {
  emptyQuestion,
  questionsFrom,
  quizImageUrls,
  quizProblem,
  tidyQuestions,
  type Quiz,
  type QuizQuestion,
} from '@/models/quiz';
import type { Subject } from '@/models/types';
import { useAuth } from '@/services/AuthProvider';
import { ImagePermissionError, ImagesService, ImageUploadError, type ImageSource } from '@/services/imagesService';
import { QuizzesService } from '@/services/quizzesService';
import { SubjectsService } from '@/services/subjectsService';
import { fonts, useTheme } from '@/theme/ThemeProvider';
import { useSubscription } from '@/utils/useSubscription';

/// Whether a stored quiz draft has anything worth resuming (Create tile).
export function quizDraftHasContent(raw: string): boolean {
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (typeof data.title === 'string' && data.title.trim() !== '') return true;
    return questionsFrom(data.questions).some(
      (q) => q.text.trim() !== '' || q.imageUrl !== '' || q.options.some((o) => o.trim() !== ''),
    );
  } catch {
    return false;
  }
}

/// Admin's quiz composer: title, description, module, difficulty, and a
/// list of multiple-choice questions (text, optional image, 2–6 options
/// with one marked correct, optional explanation). With no `quiz` it
/// writes a new one with an autosaved local draft; with a `quiz` it edits
/// that one. Images upload when added and are tracked in `uploads`, so
/// unused ones are deleted again — the same rules as `NoteEditor`.
export function QuizEditor({ quiz }: { quiz?: Quiz }) {
  const isEditing = quiz != null;
  const { currentUser } = useAuth();
  const toast = useToast();
  const { colors, type } = useTheme();

  const [title, setTitle] = useState(quiz?.title ?? '');
  const [description, setDescription] = useState(quiz?.description ?? '');
  const [subjectSelection, setSubjectSelection] = useState<string | null>(quiz?.subjectId ?? null);
  const [newModuleName, setNewModuleName] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>(quiz?.difficulty ?? '');
  const [questions, setQuestions] = useState<QuizQuestion[]>(() => quiz?.questions ?? [emptyQuestion()]);
  const [uploads, setUploads] = useState<string[]>([]);
  const [restoringDraft, setRestoringDraft] = useState(!isEditing);
  const [publishing, setPublishing] = useState(false);
  const [imageBusyFor, setImageBusyFor] = useState<string | null>(null);

  const modules = useSubscription<Subject[]>((onData, onError) => SubjectsService.watchSubjects(onData, onError), []);
  const currentModules = modules.data ?? [];

  // Restore the autosaved draft (new quizzes only).
  useEffect(() => {
    if (isEditing) return;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(QUIZ_DRAFT_KEY);
        if (raw) {
          const data = JSON.parse(raw) as Record<string, unknown>;
          setTitle(typeof data.title === 'string' ? data.title : '');
          setDescription(typeof data.description === 'string' ? data.description : '');
          setSubjectSelection(typeof data.subjectSelection === 'string' ? data.subjectSelection : null);
          setNewModuleName(typeof data.newModuleName === 'string' ? data.newModuleName : '');
          setDifficulty(isDifficulty(data.difficulty) ? data.difficulty : '');
          const saved = questionsFrom(data.questions);
          if (saved.length > 0) setQuestions(saved);
          if (Array.isArray(data.uploads)) setUploads(data.uploads.filter((u): u is string => typeof u === 'string'));
        }
      } catch {
        // Corrupt or old-shape draft — start fresh instead of crashing.
      }
      setRestoringDraft(false);
    })();
  }, [isEditing]);

  // Debounced draft save, 500ms after the last change.
  useEffect(() => {
    if (isEditing || restoringDraft) return;
    const timer = setTimeout(() => {
      const draft = { title, description, subjectSelection, newModuleName, difficulty, questions, uploads };
      AsyncStorage.setItem(QUIZ_DRAFT_KEY, JSON.stringify(draft)).catch(() => {});
    }, 500);
    return () => clearTimeout(timer);
  }, [isEditing, restoringDraft, title, description, subjectSelection, newModuleName, difficulty, questions, uploads]);

  // Editing has no draft: leaving without saving deletes this visit's uploads.
  const uploadsRef = useRef(uploads);
  useEffect(() => {
    uploadsRef.current = uploads;
  }, [uploads]);
  useEffect(() => {
    if (!isEditing) return;
    return () => {
      ImagesService.deleteAll(uploadsRef.current);
    };
  }, [isEditing]);

  const updateQuestion = (id: string, change: (q: QuizQuestion) => QuizQuestion) =>
    setQuestions((prev) => prev.map((q) => (q.id === id ? change(q) : q)));

  const moveQuestion = (index: number, by: -1 | 1) =>
    setQuestions((prev) => {
      const target = index + by;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const removeQuestion = (q: QuizQuestion, index: number) => {
    const blank = q.text.trim() === '' && q.imageUrl === '' && q.options.every((o) => o.trim() === '');
    const remove = () => setQuestions((prev) => prev.filter((x) => x.id !== q.id));
    if (blank) return remove();
    Alert.alert(`Remove question ${index + 1}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: remove },
    ]);
  };

  const addImage = async (source: ImageSource, questionId: string) => {
    if (!currentUser) return;
    setImageBusyFor(questionId);
    try {
      const localUri = await ImagesService.pick(source);
      if (localUri == null) return;
      const url = await ImagesService.upload(localUri, currentUser.uid);
      setUploads((prev) => [...prev, url]);
      updateQuestion(questionId, (q) => ({ ...q, imageUrl: url }));
    } catch (e) {
      if (!(e instanceof ImagePermissionError || e instanceof ImageUploadError)) console.warn('Adding image failed', e);
      toast(
        e instanceof ImagePermissionError
          ? `Allow ${source === 'camera' ? 'camera' : 'photo'} access in Settings to add images.`
          : e instanceof ImageUploadError
            ? `Image upload was rejected: ${e.message}`
            : "Couldn't upload the image — check your connection and try again.",
      );
    } finally {
      setImageBusyFor(null);
    }
  };

  // A native alert rather than a custom sheet: iOS can't present the
  // picker while a React Native modal is still animating closed.
  const chooseImageSource = (questionId: string) => {
    Alert.alert('Add image', undefined, [
      { text: 'Choose from library', onPress: () => addImage('library', questionId) },
      { text: 'Take photo', onPress: () => addImage('camera', questionId) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  /// Deletes this session's uploads that the final questions don't use.
  const cleanUpUploads = (final: QuizQuestion[]) => {
    const used = new Set(quizImageUrls({ questions: final }));
    ImagesService.deleteAll(uploads.filter((url) => !used.has(url)));
    setUploads([]);
  };

  const resetDraft = async () => {
    await AsyncStorage.removeItem(QUIZ_DRAFT_KEY);
    setTitle('');
    setDescription('');
    setSubjectSelection(null);
    setNewModuleName('');
    setDifficulty('');
    setQuestions([emptyQuestion()]);
  };

  const discardDraft = () => {
    Alert.alert('Discard draft?', 'The title, questions and any uploaded images will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          cleanUpUploads([]);
          resetDraft();
        },
      },
    ]);
  };

  const publish = async () => {
    if (!currentUser) return;
    const tidy = tidyQuestions(questions);
    const problem = quizProblem(title, tidy);
    if (problem) return toast(problem);
    if (description.trim().length > QUIZ_LIMITS.description)
      return toast(`Keep the description under ${QUIZ_LIMITS.description} characters.`);
    const choice = moduleChoice(currentModules, subjectSelection, newModuleName);
    if ('problem' in choice) return toast(choice.problem);

    setPublishing(true);
    try {
      const { subjectId, subjectName } = await resolveModule(choice);
      const next: Quiz = {
        id: quiz?.id ?? '',
        title: title.trim(),
        description: description.trim(),
        subjectId,
        subjectName,
        authorUid: quiz?.authorUid ?? currentUser.uid,
        authorName: quiz?.authorName ?? currentUser.name,
        difficulty,
        questions: tidy,
        createdAt: quiz?.createdAt ?? null,
        updatedAt: null,
      };

      if (quiz) {
        await QuizzesService.updateQuiz(next, quiz);
        cleanUpUploads(tidy);
        uploadsRef.current = [];
        router.back();
        toast('Quiz updated.');
        return;
      }

      await QuizzesService.publishQuiz(next);
      cleanUpUploads(tidy);
      await resetDraft();
      if (router.canGoBack()) router.back();
      toast('Quiz published.');
    } catch {
      toast(
        isEditing
          ? "Couldn't save changes — check your connection and try again."
          : "Couldn't publish — check your connection and try again. Your draft is kept.",
      );
    } finally {
      setPublishing(false);
    }
  };

  if (restoringDraft) return <Loading />;

  const hasDraft =
    title.length > 0 ||
    description.length > 0 ||
    uploads.length > 0 ||
    questions.some((q) => q.text.trim() !== '' || q.options.some((o) => o.trim() !== ''));

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!isEditing && (
          <View style={styles.draftRow}>
            <Text style={[type.bodySmall, { color: colors.tagUniversityText, flex: 1 }]}>
              Drafts save on this device as you type.
            </Text>
            {hasDraft && <TextButton label="Discard" color={colors.danger} onPress={discardDraft} />}
          </View>
        )}

        <Text style={styles.label(colors.textPrimary)}>Title</Text>
        <AppTextField value={title} onChangeText={setTitle} placeholder="Sorting algorithms — quick check" />

        <Text style={[styles.label(colors.textPrimary), { marginTop: 20 }]}>Description (optional)</Text>
        <AppTextField
          value={description}
          onChangeText={setDescription}
          placeholder="What this quiz covers"
          multiline
        />

        <Text style={[styles.label(colors.textPrimary), { marginTop: 20 }]}>Module</Text>
        <ModulePicker
          modules={currentModules}
          loading={modules.waiting && modules.data === undefined}
          selection={subjectSelection}
          onSelect={setSubjectSelection}
          newName={newModuleName}
          onNewName={setNewModuleName}
        />

        <Text style={[styles.label(colors.textPrimary), { marginTop: 20 }]}>Difficulty (optional)</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {DIFFICULTIES.map((d) => (
            <PillChip
              key={d.key}
              label={d.label}
              selected={difficulty === d.key}
              onPress={() => setDifficulty(difficulty === d.key ? '' : d.key)}
            />
          ))}
        </View>

        <Text style={[styles.label(colors.textPrimary), { marginTop: 28, marginBottom: 2 }]}>
          Questions ({questions.length})
        </Text>
        <Text style={[type.bodySmall, { color: colors.tagUniversityText, marginBottom: 12 }]}>
          Tap the circle next to the right answer. Students see questions and options in a random order.
        </Text>
        {questions.map((q, i) => (
          <QuestionCard
            key={q.id}
            index={i}
            count={questions.length}
            question={q}
            imageBusy={imageBusyFor === q.id}
            onChange={(change) => updateQuestion(q.id, change)}
            onMove={(by) => moveQuestion(i, by)}
            onRemove={() => removeQuestion(q, i)}
            onAddImage={imageBusyFor == null ? () => chooseImageSource(q.id) : null}
          />
        ))}
        {questions.length < QUIZ_LIMITS.maxQuestions && (
          <OutlinedButton
            label="Add question"
            icon="add"
            onPress={() => setQuestions((prev) => [...prev, emptyQuestion()])}
            style={{ alignSelf: 'flex-start' }}
          />
        )}

        <PrimaryButton
          label={isEditing ? 'Save changes' : 'Publish quiz'}
          loading={publishing}
          onPress={imageBusyFor != null ? null : publish}
          style={{ marginTop: 24 }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function QuestionCard({
  index,
  count,
  question: q,
  imageBusy,
  onChange,
  onMove,
  onRemove,
  onAddImage,
}: {
  index: number;
  count: number;
  question: QuizQuestion;
  imageBusy: boolean;
  onChange: (change: (q: QuizQuestion) => QuizQuestion) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
  onAddImage: (() => void) | null;
}) {
  const { colors, type } = useTheme();

  const setOption = (i: number, text: string) =>
    onChange((prev) => ({ ...prev, options: prev.options.map((o, j) => (j === i ? text : o)) }));

  const removeOption = (i: number) =>
    onChange((prev) => ({
      ...prev,
      options: prev.options.filter((_, j) => j !== i),
      correctIndex: i < prev.correctIndex ? prev.correctIndex - 1 : i === prev.correctIndex ? 0 : prev.correctIndex,
    }));

  return (
    // Bordered rather than an AppCard: the fields inside are already grey tiles.
    <View style={[styles.card, { borderColor: colors.divider, backgroundColor: colors.cardBackground }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={[type.titleMedium, { flex: 1 }]}>Question {index + 1}</Text>
        {index > 0 && <IconButton name="arrow-upward" size={20} onPress={() => onMove(-1)} accessibilityLabel="Move up" />}
        {index < count - 1 && (
          <IconButton name="arrow-downward" size={20} onPress={() => onMove(1)} accessibilityLabel="Move down" />
        )}
        {count > 1 && (
          <IconButton name="delete-outline" size={20} color={colors.danger} onPress={onRemove} accessibilityLabel="Remove question" />
        )}
      </View>

      <AppTextField
        value={q.text}
        onChangeText={(text) => onChange((prev) => ({ ...prev, text }))}
        placeholder="Type the question"
        multiline
        style={{ marginTop: 8 }}
      />

      {q.imageUrl !== '' ? (
        <View style={{ marginTop: 10 }}>
          <Image source={{ uri: q.imageUrl }} style={[styles.image, { backgroundColor: colors.divider }]} resizeMode="contain" />
          <TextButton
            label="Remove image"
            color={colors.danger}
            onPress={() => onChange((prev) => ({ ...prev, imageUrl: '' }))}
            style={{ alignSelf: 'flex-start' }}
          />
        </View>
      ) : imageBusy ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 12, alignSelf: 'flex-start' }} />
      ) : (
        <TextButton
          label="+ Add image"
          onPress={onAddImage ?? (() => {})}
          style={{ alignSelf: 'flex-start', marginTop: 4, opacity: onAddImage ? 1 : 0.5 }}
        />
      )}

      <Text style={[styles.label(colors.textPrimary), { marginTop: 10 }]}>Options</Text>
      {q.options.map((option, i) => {
        const correct = q.correctIndex === i;
        return (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Pressable
              onPress={() => onChange((prev) => ({ ...prev, correctIndex: i }))}
              hitSlop={8}
              accessibilityRole="radio"
              accessibilityState={{ checked: correct }}
              accessibilityLabel={`Mark option ${i + 1} correct`}
              style={{ paddingRight: 8 }}
            >
              <MaterialIcons
                name={correct ? 'check-circle' : 'radio-button-unchecked'}
                size={24}
                color={correct ? colors.success : colors.textSecondary}
              />
            </Pressable>
            <AppTextField
              value={option}
              onChangeText={(text) => setOption(i, text)}
              placeholder={`Option ${i + 1}`}
              style={{ flex: 1 }}
            />
            {q.options.length > QUIZ_LIMITS.minOptions && (
              <IconButton name="close" size={18} color={colors.textSecondary} onPress={() => removeOption(i)} accessibilityLabel="Remove option" />
            )}
          </View>
        );
      })}
      {q.options.length < QUIZ_LIMITS.maxOptions && (
        <TextButton
          label="+ Add option"
          onPress={() => onChange((prev) => ({ ...prev, options: [...prev.options, ''] }))}
          style={{ alignSelf: 'flex-start' }}
        />
      )}

      <Text style={[styles.label(colors.textPrimary), { marginTop: 10 }]}>Explanation (optional)</Text>
      <AppTextField
        value={q.explanation}
        onChangeText={(explanation) => onChange((prev) => ({ ...prev, explanation }))}
        placeholder="Why the answer is right — shown after answering"
        multiline
      />
    </View>
  );
}

const styles = {
  ...StyleSheet.create({
    content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
    draftRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    card: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 14 },
    image: { width: '100%', height: 180, borderRadius: 12 },
  }),
  label: (color: string) => ({ color, fontFamily: fonts.semibold, fontSize: 14, marginBottom: 8 }),
};
