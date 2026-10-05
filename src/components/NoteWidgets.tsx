import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppCard } from '@/components/AppCard';
import { OutlinedButton } from '@/components/Buttons';
import { TagPill } from '@/components/Pills';
import { useToast } from '@/components/Toast';
import type { Note } from '@/models/types';
import { useSavedNotes } from '@/services/SavedNotesProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { timeAgo } from '@/utils/format';

/// Bookmark toggle that downloads `note` into the offline cache, or
/// removes it. A compact icon on note cards, a labelled button on the
/// reader.
export function SaveNoteButton({ note, compact = false }: { note: Note; compact?: boolean }) {
  const service = useSavedNotes();
  const toast = useToast();
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const saved = service.isSaved(note.id);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (saved) {
        await service.removeNote(note.id);
        toast('Removed from saved.');
        return;
      }
      const result = await service.saveNote(note);
      if (result === 'saved') toast('Saved for offline reading.');
      if (result === 'quotaExceeded') toast('Storage limit reached — remove a saved note to free up space.');
    } catch {
      toast('Could not update saved notes.');
    } finally {
      setBusy(false);
    }
  };

  if (compact) {
    return (
      <Pressable
        onPress={toggle}
        hitSlop={8}
        accessibilityLabel={saved ? 'Remove from saved' : 'Save for offline'}
        style={styles.compact}
      >
        {busy ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : (
          <MaterialIcons
            name={saved ? 'bookmark' : 'bookmark-border'}
            size={20}
            color={saved ? colors.accent : colors.tagUniversityText}
          />
        )}
      </Pressable>
    );
  }

  return (
    <OutlinedButton
      label={saved ? 'Saved offline' : 'Save offline'}
      icon={saved ? 'bookmark' : 'bookmark-border'}
      loading={busy}
      onPress={toggle}
    />
  );
}

/// A note summary card used in search results and module lists: subject
/// tag, title, excerpt, and vote/view counts.
export function NoteListTile({ note, onPress }: { note: Note; onPress: () => void }) {
  const { colors, type } = useTheme();
  return (
    <AppCard onPress={onPress} style={{ marginBottom: 12 }}>
      <View style={styles.row}>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <TagPill label={note.subjectName} tone="subject" />
        </View>
        <SaveNoteButton note={note} compact />
      </View>
      <Text style={[type.titleLarge, { marginTop: 10 }]} numberOfLines={2}>
        {note.title}
      </Text>
      <Text style={[type.bodyMedium, { marginTop: 6 }]} numberOfLines={2}>
        {note.excerpt}
      </Text>
      <View style={[styles.row, { marginTop: 12, alignItems: 'center' }]}>
        <MaterialIcons name="thumb-up-off-alt" size={16} color={colors.accent} />
        <Text style={[type.bodySmall, { marginLeft: 4 }]}>{note.voteScore}</Text>
        <MaterialIcons name="visibility" size={16} color={colors.tagUniversityText} style={{ marginLeft: 16 }} />
        <Text style={[type.bodySmall, { marginLeft: 4 }]}>{note.viewCount}</Text>
        <View style={{ flex: 1 }} />
        {note.createdAt && <Text style={type.bodySmall}>{timeAgo(note.createdAt)}</Text>}
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  compact: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});
