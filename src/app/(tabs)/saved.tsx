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
import { openNote } from '@/utils/navigation';

/// Offline library: notes downloaded via the bookmark button, with the
/// client-side storage quota bar from the mockup.
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
          {plural(notes.length, 'note')} · {usedMb.toFixed(2)} MB of {quotaMb.toFixed(0)} MB used
        </Text>
        <View style={{ marginTop: 12, marginBottom: 20 }}>
          <ProgressBar value={service.usedBytes / QUOTA_BYTES} />
        </View>
        {notes.length === 0 ? (
          <Text style={[type.bodyMedium, { textAlign: 'center', paddingVertical: 40 }]}>
            No notes saved yet.{'\n'}Tap the bookmark on a note to save it for offline reading.
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
  const { type } = useTheme();

  const open = async () => {
    const cached = await service.getCachedNote(note.noteId).catch(() => null);
    if (!cached) {
      toast('Could not open this note.');
      return;
    }
    openNote(cached);
  };

  return (
    <AppCard onPress={open} style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={type.titleMedium} numberOfLines={2}>
            {note.title}
          </Text>
          <Text style={[type.bodySmall, { marginTop: 4 }]}>
            {note.subjectName} · {formatBytes(note.sizeBytes)}
          </Text>
        </View>
        <OutlinedButton label="Remove" onPress={() => service.removeNote(note.noteId)} style={{ marginLeft: 12 }} />
      </View>
    </AppCard>
  );
}
