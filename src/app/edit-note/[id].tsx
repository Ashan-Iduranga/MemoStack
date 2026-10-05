import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { Loading, Message } from '@/components/Feedback';
import type { Note } from '@/models/types';
import { NoteEditor } from '@/screens/NoteEditor';
import { NotesService } from '@/services/notesService';
import { handoff } from '@/utils/handoff';

export default function EditNoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [note, setNote] = useState<Note | null | undefined>(() => handoff.getNote(id));

  useEffect(() => {
    if (note !== undefined) return;
    NotesService.getNote(id)
      .then(setNote)
      .catch(() => setNote(null));
  }, [id, note]);

  if (note === undefined) return <Loading />;
  if (note === null) return <Message text="This note is no longer available." />;
  return <NoteEditor note={note} />;
}
