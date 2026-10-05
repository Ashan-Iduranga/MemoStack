import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppCard } from '@/components/AppCard';
import { OutlinedButton, PrimaryButton, TextButton } from '@/components/Buttons';
import { Loading, Message } from '@/components/Feedback';
import { AppTextField } from '@/components/Inputs';
import { TagPill } from '@/components/Pills';
import { useToast } from '@/components/Toast';
import type { Note, NoteRequest } from '@/models/types';
import { useAuth } from '@/services/AuthProvider';
import { NotesService } from '@/services/notesService';
import { RequestsService } from '@/services/requestsService';
import { useTheme } from '@/theme/ThemeProvider';
import { timeAgo } from '@/utils/format';
import { useSubscription } from '@/utils/useSubscription';

/// One note request: details, upvote, and — for the requester or an
/// admin — "Mark fulfilled" by linking an existing note.
export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const request = useSubscription<NoteRequest | null>(
    (onData, onError) => RequestsService.watchRequest(id, onData, onError),
    [id],
  );

  if (request.waiting && request.data === undefined) return <Loading />;
  if (request.error) return <Message text="Couldn't load this request — check your connection." />;
  if (request.data == null) return <Message text="This request was deleted." />;
  return <RequestBody request={request.data} />;
}

function RequestBody({ request }: { request: NoteRequest }) {
  const { currentUser, isAdmin } = useAuth();
  const toast = useToast();
  const { colors, type } = useTheme();
  const [picking, setPicking] = useState(false);
  const uid = currentUser?.uid;
  const isRequester = uid === request.requesterUid;
  const canManage = isRequester || isAdmin;

  const fulfil = (note: Note) => {
    setPicking(false);
    Alert.alert('Mark as fulfilled?', `Link "${note.title}" to this request.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark fulfilled',
        onPress: () =>
          RequestsService.fulfil(request.id, note)
            .then(() => toast('Request marked fulfilled.'))
            .catch(() => toast("Couldn't update the request — try again.")),
      },
    ]);
  };

  const remove = () => {
    Alert.alert('Delete request?', 'This removes it for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          RequestsService.deleteRequest(request.id)
            .then(() => router.back())
            .catch(() => toast("Couldn't delete the request — try again.")),
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TagPill label={request.subject} tone="subject" />
        <TagPill label={request.status === 'fulfilled' ? 'Fulfilled' : 'Open'} tone={request.status === 'fulfilled' ? 'offline' : 'meta'} />
      </View>
      <Text style={[type.headlineMedium, { marginTop: 12 }]}>{request.topic}</Text>
      <Text style={[type.bodyMedium, { color: colors.textSecondary, marginTop: 4 }]}>
        Requested by {isRequester ? 'you' : request.requesterName}
        {request.createdAt ? ` · ${timeAgo(request.createdAt)}` : ''}
        {request.grade.length > 0 ? ` · ${request.grade}` : ''}
      </Text>
      {request.details.length > 0 && <Text style={[type.bodyLarge, { marginTop: 16 }]}>{request.details}</Text>}

      <View style={styles.actions}>
        {uid != null && <VoteButton requestId={request.id} uid={uid} count={request.voteCount} />}
      </View>

      {request.status === 'fulfilled' ? (
        <AppCard
          style={{ marginTop: 24 }}
          onPress={() => router.push({ pathname: '/note/[id]', params: { id: request.fulfilledNoteId } })}
        >
          <Text style={[type.labelSmall, { color: colors.success }]}>FULFILLED WITH</Text>
          <View style={styles.linkRow}>
            <MaterialIcons name="description" size={20} color={colors.accent} />
            <Text style={[type.titleMedium, { flex: 1, marginLeft: 8 }]} numberOfLines={2}>
              {request.fulfilledNoteTitle}
            </Text>
            <MaterialIcons name="chevron-right" size={22} color={colors.textSecondary} />
          </View>
        </AppCard>
      ) : (
        canManage && (
          <PrimaryButton label="Mark fulfilled" icon="task-alt" onPress={() => setPicking(true)} style={{ marginTop: 24 }} />
        )
      )}
      {canManage && (
        <TextButton label="Delete request" color={colors.danger} onPress={remove} style={styles.delete} />
      )}

      <NotePicker visible={picking} initialQuery={request.topic} onPick={fulfil} onClose={() => setPicking(false)} />
    </ScrollView>
  );
}

function VoteButton({ requestId, uid, count }: { requestId: string; uid: string; count: number }) {
  const [hasVoted, setHasVoted] = useState(false);
  useEffect(() => RequestsService.watchHasVoted(requestId, uid, setHasVoted), [requestId, uid]);
  return (
    <OutlinedButton
      label={`${hasVoted ? 'Upvoted' : 'Upvote'} · ${count}`}
      icon={hasVoted ? 'thumb-up' : 'thumb-up-off-alt'}
      onPress={() => {
        RequestsService.toggleVote(requestId, uid).catch(() => {});
      }}
    />
  );
}

/// Bottom sheet to search existing notes and pick one.
function NotePicker({
  visible,
  initialQuery,
  onPick,
  onClose,
}: {
  visible: boolean;
  initialQuery: string;
  onPick: (note: Note) => void;
  onClose: () => void;
}) {
  const { colors, type } = useTheme();
  const insets = useSafeAreaInsets();
  const [queryText, setQueryText] = useState(initialQuery);
  const [results, setResults] = useState<{ notes?: Note[]; error?: boolean } | null>(null);

  // Debounced search while the sheet is open.
  useEffect(() => {
    if (!visible) return;
    let live = true;
    const timer = setTimeout(() => {
      setResults(null);
      NotesService.search({ queryText, max: 300 })
        .then((notes) => live && setResults({ notes: notes.slice(0, 50) }))
        .catch(() => live && setResults({ error: true }));
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [visible, queryText]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.cardBackground, paddingBottom: insets.bottom + 8 }]}>
          <Text style={[type.titleMedium, { paddingHorizontal: 20 }]}>Link a note</Text>
          <AppTextField
            value={queryText}
            onChangeText={setQueryText}
            prefixIcon="search"
            placeholder="Search notes"
            autoFocus
            style={{ marginHorizontal: 16, marginVertical: 12 }}
          />
          {results == null ? (
            <Loading inline />
          ) : results.error ? (
            <Message inline text="Couldn't search notes — check your connection." />
          ) : results.notes!.length === 0 ? (
            <Message inline text="No notes match." />
          ) : (
            <FlatList
              data={results.notes}
              keyExtractor={(n) => n.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => onPick(item)}
                  android_ripple={{ color: colors.divider }}
                  style={styles.option}
                >
                  <Text style={type.bodyLarge} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={type.bodySmall}>{item.subjectName}</Text>
                </Pressable>
              )}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 32 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  linkRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  delete: { alignSelf: 'center', marginTop: 16 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%', paddingTop: 16 },
  option: { paddingHorizontal: 20, paddingVertical: 12 },
});
