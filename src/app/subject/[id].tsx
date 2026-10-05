import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';

import { Loading, Message } from '@/components/Feedback';
import { NoteListTile } from '@/components/NoteWidgets';
import { PillChip } from '@/components/Pills';
import type { Note, Subject } from '@/models/types';
import { NotesService } from '@/services/notesService';
import { SubjectsService } from '@/services/subjectsService';
import { handoff } from '@/utils/handoff';
import { openNote } from '@/utils/navigation';
import { useSubscription } from '@/utils/useSubscription';

/// Notes within one subject, toggle between "Top" (votes) and "New" (recency).
export default function SubjectNotesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [subject, setSubject] = useState<Subject | null | undefined>(() => handoff.getSubject(id));
  const [sortByVotes, setSortByVotes] = useState(true);

  useEffect(() => {
    if (subject !== undefined) return;
    SubjectsService.getSubject(id)
      .then(setSubject)
      .catch(() => setSubject(null));
  }, [id, subject]);

  const notes = useSubscription<Note[]>(
    (onData, onError) => NotesService.watchBySubject(id, { sortByVotes }, onData, onError),
    [id, sortByVotes],
  );

  let body;
  if (notes.waiting && notes.data === undefined) body = <Loading />;
  else if (notes.error) body = <Message text={`Could not load notes: ${notes.error.message}`} />;
  else if ((notes.data ?? []).length === 0) body = <Message text="No notes in this subject yet." />;
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
      <Stack.Screen options={{ title: subject?.name ?? '' }} />
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12 }}>
        <PillChip label="Top" selected={sortByVotes} onPress={() => setSortByVotes(true)} />
        <PillChip label="New" selected={!sortByVotes} onPress={() => setSortByVotes(false)} />
      </View>
      {body}
    </View>
  );
}
