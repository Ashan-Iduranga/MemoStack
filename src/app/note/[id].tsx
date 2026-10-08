import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { AppCard } from '@/components/AppCard';
import { OutlinedButton } from '@/components/Buttons';
import { Loading, Message } from '@/components/Feedback';
import { NoteKindTags, SaveNoteButton } from '@/components/NoteWidgets';
import { TagPill } from '@/components/Pills';
import { QuillViewer } from '@/editor/QuillViewer';
import { withImageUrls } from '@/models/delta';
import { hasAnswer, noteBody, type DeltaOp, type Note } from '@/models/types';
import { useAuth } from '@/services/AuthProvider';
import { GamificationService } from '@/services/gamificationService';
import { NotesService } from '@/services/notesService';
import { useSavedNotes } from '@/services/SavedNotesProvider';
import { fonts, useTheme } from '@/theme/ThemeProvider';
import { timeAgo } from '@/utils/format';
import { handoff } from '@/utils/handoff';

/// Read-only note view: tags, metadata, the formatted body (with images),
/// the hidden answer of an activity or practical, and the upvote toggle.
export default function NoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [note, setNote] = useState<Note | null | undefined>(() => handoff.getNote(id));
  const uid = useAuth().currentUser?.uid;
  const viewCounted = useRef(false);

  useEffect(() => {
    if (note !== undefined) return;
    NotesService.getNote(id)
      .then(setNote)
      .catch(() => setNote(null));
  }, [id, note]);

  useEffect(() => {
    if (viewCounted.current) return;
    viewCounted.current = true;
    // Fire-and-forget: opening a saved note offline mustn't surface an error.
    NotesService.incrementViewCount(id).catch(() => {});
    // Streak + read XP (once per note per day; see gamification/activity.ts).
    if (uid) GamificationService.recordActivity(uid, { kind: 'read', noteId: id }).catch(() => {});
  }, [id, uid]);

  if (note === undefined) return <Loading />;
  if (note === null) return <Message text="This note is no longer available." />;
  return <NoteBody note={note} />;
}

function NoteBody({ note }: { note: Note }) {
  const { colors, type } = useTheme();
  const uid = useAuth().currentUser?.uid;
  const readable = useReadableBody(note);
  return (
    <>
      <Stack.Screen options={{ title: note.subjectName }} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 16 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <TagPill label={note.subjectName} tone="subject" />
          <NoteKindTags note={note} />
        </View>
        <View style={{ flexDirection: 'row', marginTop: 16 }}>
          <View style={{ width: 5, borderRadius: 3, backgroundColor: colors.accent, marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={type.headlineMedium}>{note.title}</Text>
            <Text style={[type.bodyMedium, { color: colors.textSecondary, marginTop: 4 }]}>
              by {note.authorName}
              {note.createdAt ? ` · ${timeAgo(note.createdAt)}` : ''} · {note.readTimeMinutes} min read
            </Text>
          </View>
        </View>
        {note.kind === 'practical' && note.requirements.trim() !== '' && (
          <Text style={[type.bodyMedium, { marginTop: 14 }]}>
            <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold }}>You&apos;ll need: </Text>
            {note.requirements}
          </Text>
        )}
        <View style={{ height: 1, backgroundColor: colors.divider, marginTop: 20 }} />
        <View style={{ marginTop: 20 }}>{readable != null && <QuillViewer delta={readable.body} />}</View>
        {readable != null && hasAnswer(note) && <AnswerReveal answer={readable.answer} />}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 32 }}>
          {uid != null && <VoteButton noteId={note.id} uid={uid} />}
          <SaveNoteButton note={note} />
        </View>
      </ScrollView>
    </>
  );
}

/// The solution of an activity or practical, hidden until the student
/// taps "Show answer" so they try it first.
function AnswerReveal({ answer }: { answer: DeltaOp[] }) {
  const { colors, type } = useTheme();
  const [shown, setShown] = useState(false);
  if (!shown) {
    return (
      <AppCard style={{ marginTop: 28, alignItems: 'center', paddingVertical: 20 }}>
        <MaterialIcons name="lock-outline" size={24} color={colors.textSecondary} />
        <Text style={[type.bodyMedium, { marginTop: 6, marginBottom: 14 }]}>Answer hidden — try it first.</Text>
        <OutlinedButton label="Show answer" icon="visibility" onPress={() => setShown(true)} />
      </AppCard>
    );
  }
  return (
    <View style={{ marginTop: 28 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <MaterialIcons name="check-circle-outline" size={20} color={colors.success} />
        <Text style={[type.titleMedium, { marginLeft: 6 }]}>Answer</Text>
      </View>
      <View style={{ height: 1, backgroundColor: colors.divider, marginTop: 12, marginBottom: 16 }} />
      <QuillViewer delta={answer} />
    </View>
  );
}

/// The note's body and answer, with images swapped for on-device copies
/// when the note is saved for offline reading (null while those load).
function useReadableBody(note: Note): { body: DeltaOp[]; answer: DeltaOp[] } | null {
  const { isSaved, getOfflineImages } = useSavedNotes();
  const saved = isSaved(note.id);
  const [offline, setOffline] = useState<{ noteId: string; images: Record<string, string> } | null>(null);

  useEffect(() => {
    if (!saved) return;
    let live = true;
    getOfflineImages(note.id)
      .catch(() => ({}))
      .then((images) => {
        if (live) setOffline({ noteId: note.id, images });
      });
    return () => {
      live = false;
    };
    // `getOfflineImages` changes identity whenever the saved list does;
    // `saved` already covers the change that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id, saved]);

  return useMemo(() => {
    if (!saved) return { body: noteBody(note), answer: note.answerDelta };
    if (offline?.noteId !== note.id) return null;
    return {
      body: withImageUrls(noteBody(note), offline.images),
      answer: withImageUrls(note.answerDelta, offline.images),
    };
  }, [note, saved, offline]);
}

function VoteButton({ noteId, uid }: { noteId: string; uid: string }) {
  const [hasVoted, setHasVoted] = useState(false);

  useEffect(() => NotesService.watchHasVoted(noteId, uid, setHasVoted), [noteId, uid]);

  return (
    <OutlinedButton
      label={hasVoted ? 'Upvoted' : 'Upvote'}
      icon={hasVoted ? 'thumb-up' : 'thumb-up-off-alt'}
      onPress={() => {
        NotesService.toggleVote(noteId, uid).catch(() => {});
      }}
    />
  );
}
