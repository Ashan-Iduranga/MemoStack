import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';

import { Loading, Message } from '@/components/Feedback';
import { NoteListTile } from '@/components/NoteWidgets';
import { PillChip } from '@/components/Pills';
import { QuizListTile } from '@/components/QuizWidgets';
import { isNoteKind, kindInfo, type NoteKind } from '@/config/contentKinds';
import type { Quiz, QuizAttempt } from '@/models/quiz';
import type { Note, Subject } from '@/models/types';
import { useAuth } from '@/services/AuthProvider';
import { NotesService } from '@/services/notesService';
import { QuizzesService } from '@/services/quizzesService';
import { SubjectsService } from '@/services/subjectsService';
import { handoff } from '@/utils/handoff';
import { openNote, openQuiz } from '@/utils/navigation';
import { useSubscription } from '@/utils/useSubscription';

/// One module's notes, activities, practicals or quizzes (`kind` param,
/// notes by default).
export default function SubjectScreen() {
  const { id, kind: kindParam } = useLocalSearchParams<{ id: string; kind?: string }>();
  const [subject, setSubject] = useState<Subject | null | undefined>(() => handoff.getSubject(id));

  useEffect(() => {
    if (subject !== undefined) return;
    SubjectsService.getSubject(id)
      .then(setSubject)
      .catch(() => setSubject(null));
  }, [id, subject]);

  if (kindParam === 'quiz') return <SubjectQuizzes id={id} subject={subject} />;
  return <SubjectNotes id={id} subject={subject} kind={isNoteKind(kindParam) ? kindParam : 'note'} />;
}

/// Notes, activities or practicals, toggling between "Top" (votes) and
/// "New" (recency).
function SubjectNotes({ id, subject, kind }: { id: string; subject: Subject | null | undefined; kind: NoteKind }) {
  const info = kindInfo(kind);
  const [sortByVotes, setSortByVotes] = useState(true);

  const notes = useSubscription<Note[]>(
    (onData, onError) => NotesService.watchBySubject(id, { kind, sortByVotes }, onData, onError),
    [id, kind, sortByVotes],
  );

  let body;
  if (notes.waiting && notes.data === undefined) body = <Loading />;
  else if (notes.error) body = <Message text={`Could not load ${info.label.toLowerCase()}: ${notes.error.message}`} />;
  else if ((notes.data ?? []).length === 0) body = <Message text={`No ${info.label.toLowerCase()} in this module yet.`} />;
  else
    body = (
      <FlatList
        data={notes.data}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => <NoteListTile note={item} onPress={() => openNote(item)} />}
      />
    );

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{ title: subject ? (kind === 'note' ? subject.name : `${info.label} · ${subject.name}`) : '' }}
      />
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12 }}>
        <PillChip label="Top" selected={sortByVotes} onPress={() => setSortByVotes(true)} />
        <PillChip label="New" selected={!sortByVotes} onPress={() => setSortByVotes(false)} />
      </View>
      {body}
    </View>
  );
}

/// The module's quizzes, newest first, with the student's best scores.
function SubjectQuizzes({ id, subject }: { id: string; subject: Subject | null | undefined }) {
  const uid = useAuth().currentUser?.uid ?? '';
  const quizzes = useSubscription<Quiz[]>(
    (onData, onError) => QuizzesService.watchBySubject(id, onData, onError),
    [id],
  );
  // Best scores are extra: if they fail to load, the list still shows.
  const attempts = useSubscription<Map<string, QuizAttempt>>(
    (onData, onError) => (uid ? QuizzesService.watchMyAttempts(uid, onData, onError) : () => {}),
    [uid],
  );

  let body;
  if (quizzes.waiting && quizzes.data === undefined) body = <Loading />;
  else if (quizzes.error) body = <Message text={`Could not load quizzes: ${quizzes.error.message}`} />;
  else if ((quizzes.data ?? []).length === 0) body = <Message text="No quizzes in this module yet." />;
  else
    body = (
      <FlatList
        data={quizzes.data}
        keyExtractor={(q) => q.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <QuizListTile quiz={item} attempt={attempts.data?.get(item.id)} onPress={() => openQuiz(item)} />
        )}
      />
    );

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: subject ? `Quizzes · ${subject.name}` : '' }} />
      {body}
    </View>
  );
}
