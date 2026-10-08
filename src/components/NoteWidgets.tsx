import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppCard } from '@/components/AppCard';
import { OutlinedButton } from '@/components/Buttons';
import { TagPill } from '@/components/Pills';
import { useToast } from '@/components/Toast';
import { difficultyLabel, kindInfo } from '@/config/contentKinds';
import type { Note } from '@/models/types';
import { useSavedNotes, type SaveResult } from '@/services/SavedNotesProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { timeAgo } from '@/utils/format';

/// Bookmark toggle that downloads `note` into the offline cache, or
/// removes it. A compact icon on note cards, a labelled button on the
/// reader.
export function SaveNoteButton({ note, compact = false }: { note: Note; compact?: boolean }) {
  const service = useSavedNotes();
  return (
    <SaveOfflineButton
      itemId={note.id}
      save={() => service.saveNote(note)}
      savedMessage="Saved for offline reading."
      compact={compact}
    />
  );
}

/// The bookmark toggle behind `SaveNoteButton` and `SaveQuizButton`.
export function SaveOfflineButton({
  itemId,
  save,
  savedMessage,
  compact = false,
}: {
  itemId: string;
  save: () => Promise<SaveResult>;
  savedMessage: string;
  compact?: boolean;
}) {
  const service = useSavedNotes();
  const toast = useToast();
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const saved = service.isSaved(itemId);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (saved) {
        await service.removeNote(itemId);
        toast('Removed from saved.');
        return;
      }
      const result = await save();
      if (result === 'saved') toast(savedMessage);
      if (result === 'quotaExceeded') toast('Storage limit reached — remove a saved item to free up space.');
    } catch {
      toast('Could not update saved items.');
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

/// The kind and difficulty tags of an activity or practical (none for a
/// plain note).
export function NoteKindTags({ note }: { note: Note }) {
  if (note.kind === 'note') return null;
  return (
    <>
      <TagPill label={kindInfo(note.kind).singular.replace(/^./, (c) => c.toUpperCase())} />
      {note.difficulty !== '' && <TagPill label={difficultyLabel(note.difficulty)} />}
    </>
  );
}

/// A note summary card used in search results and module lists: subject
/// (and kind) tags, title, excerpt, and vote/view counts.
export function NoteListTile({ note, onPress }: { note: Note; onPress: () => void }) {
  const { colors, type } = useTheme();
  return (
    <AppCard onPress={onPress} style={{ marginBottom: 12 }}>
      <View style={styles.row}>
        <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <TagPill label={note.subjectName} tone="subject" />
          <NoteKindTags note={note} />
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
