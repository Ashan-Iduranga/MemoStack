import { Stack, useLocalSearchParams } from 'expo-router';

import { isNoteKind, kindInfo } from '@/config/contentKinds';
import { NoteEditor } from '@/screens/NoteEditor';

/// Upload → Create: write a new note, activity or practical.
export default function NewNoteScreen() {
  const { kind: kindParam } = useLocalSearchParams<{ kind: string }>();
  const kind = isNoteKind(kindParam) ? kindParam : 'note';
  const singular = kindInfo(kind).singular;
  return (
    <>
      <Stack.Screen options={{ title: `New ${singular}` }} />
      <NoteEditor key={kind} kind={kind} />
    </>
  );
}
