import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';

import { AppCard } from '@/components/AppCard';
import { ActionSheet, Loading, Message } from '@/components/Feedback';
import { AppTextField } from '@/components/Inputs';
import { TagPill } from '@/components/Pills';
import { useToast } from '@/components/Toast';
import type { Note } from '@/models/types';
import { NotesService } from '@/services/notesService';
import { useTheme } from '@/theme/ThemeProvider';
import { timeAgo } from '@/utils/format';
import { openNoteEditor } from '@/utils/navigation';
import { useSubscription } from '@/utils/useSubscription';

/// Every published note with Edit/Delete actions, filterable by title or
/// module name.
export function ManageNotesTab() {
  const { colors, type } = useTheme();
  const toast = useToast();
  const [filter, setFilter] = useState('');
  const [menuFor, setMenuFor] = useState<Note | null>(null);
  const notes = useSubscription<Note[]>((onData, onError) => NotesService.watchAll(onData, onError), []);

  const confirmDelete = (note: Note) => {
    Alert.alert('Delete note?', `"${note.title}" will be removed for everyone. This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await NotesService.deleteNote(note);
            toast('Note deleted.');
          } catch (e) {
            toast(`Could not delete note: ${e}`);
          }
        },
      },
    ]);
  };

  let list = notes.data ?? [];
  const needle = filter.trim().toLowerCase();
  if (needle.length > 0) {
    list = list.filter(
      (n) => n.title.toLowerCase().includes(needle) || n.subjectName.toLowerCase().includes(needle),
    );
  }

  let body;
  if (notes.waiting && notes.data === undefined) body = <Loading />;
  else if (notes.error) body = <Message text={`Could not load notes: ${notes.error.message}`} />;
  else if (list.length === 0) body = <Message text={needle.length === 0 ? 'No notes published yet.' : 'No notes match.'} />;
  else
    body = (
      <FlatList
        data={list}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <AppCard onPress={() => openNoteEditor(item)} padding={0}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 4, paddingVertical: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={type.titleMedium} numberOfLines={2}>
                  {item.title}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                  <TagPill label={item.subjectName} tone="subject" />
                  {item.createdAt && <Text style={[type.bodySmall, { marginLeft: 8 }]}>{timeAgo(item.createdAt)}</Text>}
                </View>
              </View>
              <Pressable onPress={() => setMenuFor(item)} hitSlop={8} style={{ padding: 8 }} accessibilityLabel="Note actions">
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
      {body}
      <ActionSheet
        visible={menuFor != null}
        title={menuFor?.title}
        onClose={() => setMenuFor(null)}
        actions={
          menuFor
            ? [
                { label: 'Edit', onPress: () => openNoteEditor(menuFor) },
                { label: 'Delete', destructive: true, onPress: () => confirmDelete(menuFor) },
              ]
            : []
        }
      />
    </View>
  );
}
