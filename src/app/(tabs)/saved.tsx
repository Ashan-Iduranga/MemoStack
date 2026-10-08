import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppCard } from '@/components/AppCard';
import { OutlinedButton } from '@/components/Buttons';
import { Loading } from '@/components/Feedback';
import { ProgressBar } from '@/components/Pills';
import { useToast } from '@/components/Toast';
import type { SavedNote } from '@/models/types';
import { QUOTA_BYTES, useSavedNotes } from '@/services/SavedNotesProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { formatBytes, plural } from '@/utils/format';
import { openNote, openQuiz } from '@/utils/navigation';

/// Offline library: notes and quizzes downloaded via the bookmark button,
/// with the client-side storage quota bar from the mockup.
export default function SavedOfflineScreen() {
  const service = useSavedNotes();
  const { colors, type } = useTheme();

  if (!service.isLoaded) return <Loading />;

  const notes = service.saved;
  const usedMb = service.usedBytes / (1024 * 1024);
  const quotaMb = QUOTA_BYTES / (1024 * 1024);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 }}>
        <Text style={type.headlineMedium}>Saved offline</Text>
        <Text style={[type.bodyMedium, { color: colors.tagUniversityText, marginTop: 8 }]}>
          {plural(notes.length, 'item')} · {usedMb.toFixed(2)} MB of {quotaMb.toFixed(0)} MB used
        </Text>
        <View style={{ marginTop: 12, marginBottom: 20 }}>
          <ProgressBar value={service.usedBytes / QUOTA_BYTES} />
        </View>
        {notes.length === 0 ? (
          <Text style={[type.bodyMedium, { textAlign: 'center', paddingVertical: 40 }]}>
            Nothing saved yet.{'\n'}Tap the bookmark on a note or quiz to save it for offline use.
          </Text>
        ) : (
          notes.map((note) => <SavedNoteCard key={note.noteId} note={note} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SavedNoteCard({ note }: { note: SavedNote }) {
  const service = useSavedNotes();
  const toast = useToast();
  const { colors, type } = useTheme();
  const isQuiz = note.kind === 'quiz';

  const open = async () => {
    if (isQuiz) {
      const cached = await service.getCachedQuiz(note.noteId).catch(() => null);
      if (cached) return openQuiz(cached);
    } else {
      const cached = await service.getCachedNote(note.noteId).catch(() => null);
      if (cached) return openNote(cached);
    }
    toast(`Could not open this ${isQuiz ? 'quiz' : 'note'}.`);
  };

  return (
    <AppCard onPress={open} style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={type.titleMedium} numberOfLines={2}>
            {note.title}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            {isQuiz && <MaterialIcons name="quiz" size={14} color={colors.accent} style={{ marginRight: 4 }} />}
            <Text style={type.bodySmall}>
              {isQuiz ? 'Quiz · ' : ''}
              {note.subjectName} · {formatBytes(note.sizeBytes)}
            </Text>
          </View>
        </View>
        <OutlinedButton label="Remove" onPress={() => service.removeNote(note.noteId)} style={{ marginLeft: 12 }} />
      </View>
    </AppCard>
  );
}
