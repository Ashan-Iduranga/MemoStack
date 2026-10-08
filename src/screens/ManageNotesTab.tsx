import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';

import { AppCard } from '@/components/AppCard';
import { ActionSheet, Loading, Message } from '@/components/Feedback';
import { AppTextField } from '@/components/Inputs';
import { NoteKindTags } from '@/components/NoteWidgets';
import { PillChip, TagPill } from '@/components/Pills';
import { useToast } from '@/components/Toast';
import { difficultyLabel, kindInfo, NOTE_KINDS, type ContentKind } from '@/config/contentKinds';
import type { Quiz } from '@/models/quiz';
import type { Note } from '@/models/types';
import { NotesService } from '@/services/notesService';
import { QuizzesService } from '@/services/quizzesService';
import { useTheme } from '@/theme/ThemeProvider';
import { timeAgo } from '@/utils/format';
import { openNoteEditor, openQuizEditor } from '@/utils/navigation';
import { useSubscription } from '@/utils/useSubscription';

/// A row of the library: a note, activity or practical, or a quiz.
type Item = { id: string; title: string; subjectName: string; createdAt: Date | null } & (
  | { kind: Note['kind']; note: Note }
  | { kind: 'quiz'; quiz: Quiz }
);

const FILTER_KINDS: ContentKind[] = [...NOTE_KINDS, 'quiz'];

/// Every published note, activity, practical and quiz with Edit/Delete
/// actions, filterable by kind and by title or module name.
export function ManageNotesTab() {
  const { colors, type } = useTheme();
  const toast = useToast();
  const [filter, setFilter] = useState('');
  const [kindFilter, setKindFilter] = useState<ContentKind | null>(null);
  const [menuFor, setMenuFor] = useState<Item | null>(null);
  const notes = useSubscription<Note[]>((onData, onError) => NotesService.watchAll(onData, onError), []);
  const quizzes = useSubscription<Quiz[]>((onData, onError) => QuizzesService.watchAll(onData, onError), []);

  const edit = (item: Item) => ('quiz' in item ? openQuizEditor(item.quiz) : openNoteEditor(item.note));

  const confirmDelete = (item: Item) => {
    Alert.alert(`Delete ${kindInfo(item.kind).singular}?`, `"${item.title}" will be removed for everyone. This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await ('quiz' in item ? QuizzesService.deleteQuiz(item.quiz) : NotesService.deleteNote(item.note));
            toast('Deleted.');
          } catch (e) {
            toast(`Could not delete ${kindInfo(item.kind).singular}: ${e}`);
          }
        },
      },
    ]);
  };

  let list: Item[] = [
    ...(notes.data ?? []).map((note) => ({ ...pick(note), kind: note.kind, note })),
    ...(quizzes.data ?? []).map((quiz) => ({ ...pick(quiz), kind: 'quiz' as const, quiz })),
  ].sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  if (kindFilter != null) list = list.filter((n) => n.kind === kindFilter);
  const needle = filter.trim().toLowerCase();
  if (needle.length > 0) {
    list = list.filter(
      (n) => n.title.toLowerCase().includes(needle) || n.subjectName.toLowerCase().includes(needle),
    );
  }

  const error = notes.error ?? quizzes.error;
  let body;
  if ((notes.waiting && notes.data === undefined) || (quizzes.waiting && quizzes.data === undefined)) body = <Loading />;
  else if (error) body = <Message text={`Could not load the library: ${error.message}`} />;
  else if (list.length === 0)
    body = <Message text={needle.length === 0 && kindFilter == null ? 'Nothing published yet.' : 'Nothing matches.'} />;
  else
    body = (
      <FlatList
        data={list}
        keyExtractor={(n) => `${n.kind}-${n.id}`}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <AppCard onPress={() => edit(item)} padding={0}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 4, paddingVertical: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={type.titleMedium} numberOfLines={2}>
                  {item.title}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 6 }}>
                  <TagPill label={item.subjectName} tone="subject" />
                  {'quiz' in item ? <QuizTags quiz={item.quiz} /> : <NoteKindTags note={item.note} />}
                  {item.createdAt && <Text style={[type.bodySmall, { marginLeft: 2 }]}>{timeAgo(item.createdAt)}</Text>}
                </View>
              </View>
              <Pressable onPress={() => setMenuFor(item)} hitSlop={8} style={{ padding: 8 }} accessibilityLabel="Actions">
                <MaterialIcons name="more-vert" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>
          </AppCard>
        )}
      />
    );

  return (
    <View style={{ flex: 1 }}>
      <AppTextField
        prefixIcon="search"
        placeholder="Filter by title or module"
        value={filter}
        onChangeText={setFilter}
        style={{ marginHorizontal: 20, marginTop: 16, marginBottom: 8 }}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, paddingBottom: 8 }}>
        <PillChip label="All" selected={kindFilter == null} onPress={() => setKindFilter(null)} />
        {FILTER_KINDS.map((k) => (
          <PillChip key={k} label={kindInfo(k).label} selected={kindFilter === k} onPress={() => setKindFilter(k)} />
        ))}
      </View>
      {body}
      <ActionSheet
        visible={menuFor != null}
        title={menuFor?.title}
        onClose={() => setMenuFor(null)}
        actions={
          menuFor
            ? [
                { label: 'Edit', onPress: () => edit(menuFor) },
                { label: 'Delete', destructive: true, onPress: () => confirmDelete(menuFor) },
              ]
            : []
        }
      />
    </View>
  );
}

const pick = (x: { id: string; title: string; subjectName: string; createdAt: Date | null }) => ({
  id: x.id,
  title: x.title,
  subjectName: x.subjectName,
  createdAt: x.createdAt,
});

function QuizTags({ quiz }: { quiz: Quiz }) {
  return (
    <>
      <TagPill label={`Quiz · ${quiz.questions.length} Q`} />
      {quiz.difficulty !== '' && <TagPill label={difficultyLabel(quiz.difficulty)} />}
    </>
  );
}
