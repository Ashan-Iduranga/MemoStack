import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Text, View } from 'react-native';

import { AppCard } from '@/components/AppCard';
import { SaveOfflineButton } from '@/components/NoteWidgets';
import { TagPill } from '@/components/Pills';
import { difficultyLabel } from '@/config/contentKinds';
import type { Quiz, QuizAttempt } from '@/models/quiz';
import { useSavedNotes } from '@/services/SavedNotesProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { plural, timeAgo } from '@/utils/format';

/// Bookmark toggle that saves a quiz (and its images) for taking offline.
export function SaveQuizButton({ quiz, compact = false }: { quiz: Quiz; compact?: boolean }) {
  const service = useSavedNotes();
  return (
    <SaveOfflineButton
      itemId={quiz.id}
      save={() => service.saveQuiz(quiz)}
      savedMessage="Saved — you can take this quiz offline."
      compact={compact}
    />
  );
}

/// "Best 8/10", or null before the first attempt.
export function bestLabel(attempt: QuizAttempt | null | undefined): string | null {
  if (attempt == null) return null;
  return `Best ${Math.min(attempt.bestScore, attempt.total)}/${attempt.total}`;
}

/// A quiz summary card for module lists: module and difficulty tags,
/// title, description, question count and the student's best score.
export function QuizListTile({
  quiz,
  attempt,
  onPress,
}: {
  quiz: Quiz;
  attempt: QuizAttempt | undefined;
  onPress: () => void;
}) {
  const { colors, type } = useTheme();
  const best = bestLabel(attempt);
  return (
    <AppCard onPress={onPress} style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <TagPill label={quiz.subjectName} tone="subject" />
          {quiz.difficulty !== '' && <TagPill label={difficultyLabel(quiz.difficulty)} />}
          {attempt?.perfect && <TagPill label="100%" tone="offline" />}
        </View>
        <SaveQuizButton quiz={quiz} compact />
      </View>
      <Text style={[type.titleLarge, { marginTop: 10 }]} numberOfLines={2}>
        {quiz.title}
      </Text>
      {quiz.description !== '' && (
        <Text style={[type.bodyMedium, { marginTop: 6 }]} numberOfLines={2}>
          {quiz.description}
        </Text>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
        <MaterialIcons name="quiz" size={16} color={colors.accent} />
        <Text style={[type.bodySmall, { marginLeft: 4 }]}>{plural(quiz.questions.length, 'question')}</Text>
        {best != null && (
          <>
            <MaterialIcons name="emoji-events" size={16} color={colors.success} style={{ marginLeft: 16 }} />
            <Text style={[type.bodySmall, { marginLeft: 4 }]}>{best}</Text>
          </>
        )}
        <View style={{ flex: 1 }} />
        {quiz.createdAt && <Text style={type.bodySmall}>{timeAgo(quiz.createdAt)}</Text>}
      </View>
    </AppCard>
  );
}
