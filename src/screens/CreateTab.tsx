import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppCard } from '@/components/AppCard';
import { AVAILABLE_KINDS, CONTENT_KINDS, isNoteKind, NOTE_KINDS, type ContentKind } from '@/config/contentKinds';
import { imageUrlsIn, textOf } from '@/models/delta';
import type { DeltaOp } from '@/models/types';
import { QUIZ_DRAFT_KEY } from '@/config/quiz';
import { draftKey } from '@/screens/NoteEditor';
import { quizDraftHasContent } from '@/screens/QuizEditor';
import { useTheme } from '@/theme/ThemeProvider';
import { openNewNote, openNewQuiz } from '@/utils/navigation';

/// Upload → Create: one tile per kind of material. Notes, activities and
/// practicals open the note editor, quizzes the quiz editor; a tile shows
/// "Draft saved" when that kind has an unfinished draft on this device.
export function CreateTab() {
  const { type } = useTheme();
  const [drafts, setDrafts] = useState<ContentKind[]>([]);

  // Re-check on focus: publishing or discarding in the editor clears a draft.
  useFocusEffect(
    useCallback(() => {
      let live = true;
      AsyncStorage.multiGet([...NOTE_KINDS.map(draftKey), QUIZ_DRAFT_KEY])
        .then((entries) => {
          if (!live) return;
          const found: ContentKind[] = NOTE_KINDS.filter((_, i) => entries[i][1] != null && hasContent(entries[i][1]!));
          const quizDraft = entries[NOTE_KINDS.length][1];
          if (quizDraft != null && quizDraftHasContent(quizDraft)) found.push('quiz');
          setDrafts(found);
        })
        .catch(() => {});
      return () => {
        live = false;
      };
    }, []),
  );

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 }}>
      <Text style={[type.bodyMedium, { marginBottom: 14 }]}>What would you like to add?</Text>
      <View style={styles.grid}>
        {CONTENT_KINDS.map((k) => (
          <View key={k.key} style={styles.cell}>
            <CreateTile kind={k.key} hasDraft={drafts.includes(k.key)} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function CreateTile({ kind, hasDraft }: { kind: ContentKind; hasDraft: boolean }) {
  const { colors, type } = useTheme();
  const info = CONTENT_KINDS.find((k) => k.key === kind)!;
  const open = isNoteKind(kind) ? () => openNewNote(kind) : kind === 'quiz' ? openNewQuiz : null;
  const available = AVAILABLE_KINDS.includes(kind) && open != null;
  return (
    <AppCard onPress={available ? open : undefined} style={{ flex: 1 }}>
      <View style={[styles.badge, { backgroundColor: available ? colors.accent : colors.tagUniversityFill }]}>
        <MaterialIcons name={info.icon} size={24} color={available ? '#FFFFFF' : colors.tagUniversityText} />
      </View>
      <Text style={[type.titleMedium, { marginTop: 14 }]} numberOfLines={1}>
        New {info.singular}
      </Text>
      <Text
        style={[type.bodySmall, { marginTop: 2, color: hasDraft ? colors.accent : colors.textSecondary }]}
        numberOfLines={1}
      >
        {!available ? 'Coming soon' : hasDraft ? 'Draft saved' : ' '}
      </Text>
    </AppCard>
  );
}

/// A stored draft with a title or any body/answer text worth resuming.
function hasContent(raw: string): boolean {
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    const delta = (v: unknown) =>
      Array.isArray(v) && (textOf(v as DeltaOp[]).trim() !== '' || imageUrlsIn(v as DeltaOp[]).length > 0);
    return (typeof data.title === 'string' && data.title.trim() !== '') || delta(data.delta) || delta(data.answerDelta);
  } catch {
    return false;
  }
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  cell: { width: '50%', paddingHorizontal: 6, marginBottom: 12 },
  badge: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
