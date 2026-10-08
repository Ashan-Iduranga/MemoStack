import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  type GestureResponderEvent,
  useWindowDimensions,
  View,
} from 'react-native';

import { PrimaryButton, TextButton } from '@/components/Buttons';
import { Loading } from '@/components/Feedback';
import { AppTextField } from '@/components/Inputs';
import { LinkDialog } from '@/components/LinkDialog';
import { ModulePicker, moduleChoice, resolveModule } from '@/components/ModulePicker';
import { PillChip } from '@/components/Pills';
import { useToast } from '@/components/Toast';
import {
  DIFFICULTIES,
  isDifficulty,
  kindInfo,
  NOTE_KINDS,
  type Difficulty,
  type NoteKind,
} from '@/config/contentKinds';
import { QuillEditor, type QuillEditorHandle } from '@/editor/QuillEditor';
import { imageUrlsIn, textOf, withHostedImagesOnly } from '@/models/delta';
import { noteBody, noteImageUrls, type DeltaOp, type Note, type Subject } from '@/models/types';
import { useAuth } from '@/services/AuthProvider';
import { ImagePermissionError, ImagesService, ImageUploadError, type ImageSource } from '@/services/imagesService';
import { NotesService } from '@/services/notesService';
import { SubjectsService } from '@/services/subjectsService';
import { fonts, useTheme } from '@/theme/ThemeProvider';
import { useSubscription } from '@/utils/useSubscription';

/// One autosaved draft per kind. Plain notes keep the original key so a
/// draft written before kinds existed still restores.
export const draftKey = (kind: NoteKind) => (kind === 'note' ? 'upload_draft_v1' : `upload_draft_${kind}_v1`);

type EditorTarget = 'body' | 'answer';

const capitalize = (word: string) => word.replace(/^./, (c) => c.toUpperCase());

/// Admin's composer for notes, activities and practicals: title, module,
/// and a rich-text body with images. Activities and practicals add a
/// difficulty and a second editor for the answer, which students reveal
/// with a tap; practicals also list what's needed. With no `note` it
/// writes a new item of `kind` (with an autosaved local draft) and goes
/// back on publish; with a `note` it edits that note — including moving it
/// to another kind — and goes back on save. A module typed in via "Add new
/// module" is reused if one with that name already exists.
///
/// Images upload to Cloudinary the moment they're inserted (the Deltas
/// only ever hold https URLs). Every upload made while composing is
/// tracked in `uploads`, so ones that end up unused — removed from the
/// text, or the draft discarded — are deleted again instead of piling up.
export function NoteEditor({ note, kind: newKind = 'note' }: { note?: Note; kind?: NoteKind }) {
  const isEditing = note != null;
  const draftStorageKey = draftKey(newKind);
  const { currentUser } = useAuth();
  const toast = useToast();
  const { colors, type } = useTheme();
  const screen = useWindowDimensions();
  const editor = useRef<QuillEditorHandle>(null);
  const answerEditor = useRef<QuillEditorHandle>(null);
  const editorFor = (target: EditorTarget) => (target === 'body' ? editor : answerEditor).current;
  // The latest touch that started inside an editor (toolbar included).
  // Touch events bubble, so the screen sees that same touch next and knows
  // not to blur that editor for it.
  const editorTouch = useRef<{ timestamp: number; target: EditorTarget } | null>(null);

  const [kind, setKind] = useState<NoteKind>(note?.kind ?? newKind);
  const [title, setTitle] = useState(note?.title ?? '');
  const [subjectSelection, setSubjectSelection] = useState<string | null>(note?.subjectId ?? null);
  const [newModuleName, setNewModuleName] = useState('');
  const [delta, setDelta] = useState<DeltaOp[]>(() => (note ? noteBody(note) : []));
  const [plainText, setPlainText] = useState(() => (note ? textOf(noteBody(note)) : ''));
  const [answerDelta, setAnswerDelta] = useState<DeltaOp[]>(() => note?.answerDelta ?? []);
  const [answerText, setAnswerText] = useState(() => (note ? textOf(note.answerDelta) : ''));
  const [difficulty, setDifficulty] = useState<Difficulty>(note?.difficulty ?? '');
  const [requirements, setRequirements] = useState(note?.requirements ?? '');
  const [uploads, setUploads] = useState<string[]>([]);
  const [restoringDraft, setRestoringDraft] = useState(!isEditing);
  const [publishing, setPublishing] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [linkDialog, setLinkDialog] = useState<{ currentUrl: string | null; target: EditorTarget } | null>(null);
  const hasAnswerSection = kind !== 'note';
  const singular = kindInfo(kind).singular;

  const modules = useSubscription<Subject[]>((onData, onError) => SubjectsService.watchSubjects(onData, onError), []);
  const currentModules = modules.data ?? [];

  // Restore the autosaved draft (new notes only).
  useEffect(() => {
    if (isEditing) return;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(draftStorageKey);
        if (raw) {
          const data = JSON.parse(raw) as Record<string, unknown>;
          setTitle(typeof data.title === 'string' ? data.title : '');
          setSubjectSelection(typeof data.subjectSelection === 'string' ? data.subjectSelection : null);
          setNewModuleName(typeof data.newModuleName === 'string' ? data.newModuleName : '');
          if (Array.isArray(data.uploads)) setUploads(data.uploads.filter((u): u is string => typeof u === 'string'));
          if (Array.isArray(data.delta) && data.delta.length > 0) {
            setDelta(data.delta as DeltaOp[]);
            setPlainText(textOf(data.delta as DeltaOp[]));
          }
          if (Array.isArray(data.answerDelta) && data.answerDelta.length > 0) {
            setAnswerDelta(data.answerDelta as DeltaOp[]);
            setAnswerText(textOf(data.answerDelta as DeltaOp[]));
          }
          setDifficulty(isDifficulty(data.difficulty) ? data.difficulty : '');
          setRequirements(typeof data.requirements === 'string' ? data.requirements : '');
        }
      } catch {
        // Corrupt or old-shape draft — start fresh instead of crashing.
      }
      setRestoringDraft(false);
    })();
  }, [isEditing, draftStorageKey]);

  // Debounced draft save, 500ms after the last change.
  useEffect(() => {
    if (isEditing || restoringDraft) return;
    const timer = setTimeout(() => {
      const draft = { title, subjectSelection, newModuleName, delta, answerDelta, difficulty, requirements, uploads };
      AsyncStorage.setItem(draftStorageKey, JSON.stringify(draft)).catch(() => {});
    }, 500);
    return () => clearTimeout(timer);
  }, [
    isEditing,
    restoringDraft,
    draftStorageKey,
    title,
    subjectSelection,
    newModuleName,
    delta,
    answerDelta,
    difficulty,
    requirements,
    uploads,
  ]);

  // Editing has no draft: leaving without saving deletes this visit's uploads.
  const uploadsRef = useRef(uploads);
  useEffect(() => {
    uploadsRef.current = uploads;
  }, [uploads]);
  useEffect(() => {
    if (!isEditing) return;
    return () => {
      ImagesService.deleteAll(uploadsRef.current);
    };
  }, [isEditing]);

  // An editor's keyboard belongs to its WebView, which tapping elsewhere
  // doesn't blur — so any touch outside an editor blurs it explicitly.
  const onScreenTouch = (e: GestureResponderEvent) => {
    const touch = editorTouch.current;
    const touched = touch?.timestamp === e.nativeEvent.timestamp ? touch.target : null;
    if (touched !== 'body') editor.current?.blur();
    if (touched !== 'answer') answerEditor.current?.blur();
  };

  const onEditorChange = useCallback((nextDelta: DeltaOp[], text: string) => {
    setDelta(nextDelta);
    setPlainText(text);
  }, []);

  const onAnswerChange = useCallback((nextDelta: DeltaOp[], text: string) => {
    setAnswerDelta(nextDelta);
    setAnswerText(text);
  }, []);

  const addImage = async (source: ImageSource, target: EditorTarget) => {
    if (!currentUser) return;
    setImageBusy(true);
    try {
      const localUri = await ImagesService.pick(source);
      if (localUri == null) return;
      const url = await ImagesService.upload(localUri, currentUser.uid);
      setUploads((prev) => [...prev, url]);
      editorFor(target)?.insertImage(url);
    } catch (e) {
      if (!(e instanceof ImagePermissionError || e instanceof ImageUploadError)) console.warn('Adding image failed', e);
      toast(
        e instanceof ImagePermissionError
          ? `Allow ${source === 'camera' ? 'camera' : 'photo'} access in Settings to add images.`
          : e instanceof ImageUploadError
            ? `Image upload was rejected: ${e.message}`
            : "Couldn't upload the image — check your connection and try again.",
      );
    } finally {
      setImageBusy(false);
    }
  };

  // A native alert rather than a custom sheet: iOS can't present the
  // picker while a React Native modal is still animating closed.
  const chooseImageSource = (target: EditorTarget) => {
    Alert.alert('Add image', undefined, [
      { text: 'Choose from library', onPress: () => addImage('library', target) },
      { text: 'Take photo', onPress: () => addImage('camera', target) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  /// Deletes this session's uploads that the final body and answer don't use.
  const cleanUpUploads = (final: Pick<Note, 'contentDelta' | 'answerDelta'>) => {
    const used = new Set(noteImageUrls(final));
    ImagesService.deleteAll(uploads.filter((url) => !used.has(url)));
    setUploads([]);
  };

  const resetDraft = async () => {
    await AsyncStorage.removeItem(draftStorageKey);
    setTitle('');
    setNewModuleName('');
    setSubjectSelection(null);
    setDelta([]);
    setPlainText('');
    setAnswerDelta([]);
    setAnswerText('');
    setDifficulty('');
    setRequirements('');
    editor.current?.setContents([]);
    answerEditor.current?.setContents([]);
  };

  const discardDraft = () => {
    Alert.alert('Discard draft?', 'The title, text and any uploaded images will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          cleanUpUploads({ contentDelta: [], answerDelta: [] });
          resetDraft();
        },
      },
    ]);
  };

  const publish = async () => {
    if (!currentUser) return;
    editor.current?.blur();
    answerEditor.current?.blur();
    const content = withHostedImagesOnly(delta);
    const answer = hasAnswerSection ? withHostedImagesOnly(answerDelta) : [];
    // An answer of only whitespace counts as none (no "Show answer").
    const answerContent = answerText.trim().length > 0 || imageUrlsIn(answer).length > 0 ? answer : [];
    const trimmedTitle = title.trim();
    const body = plainText.trim();
    if (trimmedTitle.length === 0) return toast('Please add a title.');
    if (body.length === 0 && imageUrlsIn(content).length === 0) return toast(`Please write the ${singular} content.`);
    if (requirements.trim().length > 300) return toast('Keep "You\'ll need" under 300 characters.');

    const choice = moduleChoice(currentModules, subjectSelection, newModuleName);
    if ('problem' in choice) return toast(choice.problem);

    setPublishing(true);
    try {
      const { subjectId, subjectName } = await resolveModule(choice);

      const wordCount = body.length === 0 ? 0 : body.split(/\s+/).length;
      const next: Note = {
        id: note?.id ?? '',
        kind,
        title: trimmedTitle,
        subjectId,
        subjectName,
        authorUid: note?.authorUid ?? currentUser.uid,
        authorName: note?.authorName ?? currentUser.name,
        contentDelta: content,
        answerDelta: answerContent,
        difficulty: kind === 'note' ? '' : difficulty,
        requirements: kind === 'practical' ? requirements.trim() : '',
        plainText: body,
        excerpt: body.length > 160 ? `${body.substring(0, 160)}…` : body,
        wordCount,
        readTimeMinutes: Math.min(999, Math.max(1, Math.ceil(wordCount / 200))),
        voteScore: note?.voteScore ?? 0,
        viewCount: note?.viewCount ?? 0,
        createdAt: note?.createdAt ?? null,
        updatedAt: null,
      };

      if (note) {
        await NotesService.updateNote(next, note);
        cleanUpUploads(next);
        uploadsRef.current = [];
        router.back();
        toast(`${capitalize(singular)} updated.`);
        return;
      }

      await NotesService.publishNote(next);
      cleanUpUploads(next);
      await resetDraft();
      if (router.canGoBack()) router.back();
      toast(`${capitalize(singular)} published.`);
    } catch {
      toast(
        isEditing
          ? "Couldn't save changes — check your connection and try again."
          : "Couldn't publish — check your connection and try again. Your draft is kept.",
      );
    } finally {
      setPublishing(false);
    }
  };

  if (restoringDraft) return <Loading />;

  const hasDraft =
    title.length > 0 || plainText.trim().length > 0 || answerText.trim().length > 0 || uploads.length > 0;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        onTouchStart={onScreenTouch}
      >
        {!isEditing && (
          <View style={styles.draftRow}>
            <Text style={[type.bodySmall, { color: colors.tagUniversityText, flex: 1 }]}>
              Drafts save on this device as you type.
            </Text>
            {hasDraft && <TextButton label="Discard" color={colors.danger} onPress={discardDraft} />}
          </View>
        )}
        {isEditing && (
          <>
            <Text style={styles.label(colors.textPrimary)}>Type</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {NOTE_KINDS.map((k) => (
                <PillChip key={k} label={kindInfo(k).label} selected={kind === k} onPress={() => setKind(k)} />
              ))}
            </View>
          </>
        )}
        <Text style={styles.label(colors.textPrimary)}>Title</Text>
        <AppTextField value={title} onChangeText={setTitle} placeholder="Hash tables — collision handling" />

        <Text style={[styles.label(colors.textPrimary), { marginTop: 20 }]}>Module</Text>
        <ModulePicker
          modules={currentModules}
          loading={modules.waiting && modules.data === undefined}
          selection={subjectSelection}
          onSelect={setSubjectSelection}
          newName={newModuleName}
          onNewName={setNewModuleName}
        />

        {hasAnswerSection && (
          <>
            <Text style={[styles.label(colors.textPrimary), { marginTop: 20 }]}>Difficulty (optional)</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {DIFFICULTIES.map((d) => (
                <PillChip
                  key={d.key}
                  label={d.label}
                  selected={difficulty === d.key}
                  onPress={() => setDifficulty(difficulty === d.key ? '' : d.key)}
                />
              ))}
            </View>
          </>
        )}
        {kind === 'practical' && (
          <>
            <Text style={[styles.label(colors.textPrimary), { marginTop: 20 }]}>You&apos;ll need (optional)</Text>
            <AppTextField
              value={requirements}
              onChangeText={setRequirements}
              placeholder="e.g. Python 3, VS Code, a breadboard"
            />
          </>
        )}

        <Text style={[styles.label(colors.textPrimary), { marginTop: 20 }]}>
          {kind === 'note' ? 'Note' : kind === 'activity' ? 'Task' : 'Instructions'}
        </Text>
        <View onTouchStart={(e) => (editorTouch.current = { timestamp: e.nativeEvent.timestamp, target: 'body' })}>
          <QuillEditor
            ref={editor}
            initialDelta={delta}
            placeholder={
              kind === 'note'
                ? 'Type your notes. Use the toolbar for headings, lists, links and images.'
                : `Describe the ${singular}. Use the toolbar for headings, lists, links and images.`
            }
            height={Math.max(300, Math.round(screen.height * (hasAnswerSection ? 0.4 : 0.5)))}
            imageBusy={imageBusy}
            onChange={onEditorChange}
            onRequestImage={() => chooseImageSource('body')}
            onRequestLink={(currentUrl) => setLinkDialog({ currentUrl, target: 'body' })}
          />
        </View>

        {hasAnswerSection && (
          <>
            <Text style={[styles.label(colors.textPrimary), { marginTop: 20, marginBottom: 2 }]}>Answer (optional)</Text>
            <Text style={[type.bodySmall, { color: colors.tagUniversityText, marginBottom: 8 }]}>
              Hidden from students until they tap &quot;Show answer&quot;.
            </Text>
            <View
              onTouchStart={(e) => (editorTouch.current = { timestamp: e.nativeEvent.timestamp, target: 'answer' })}
            >
              <QuillEditor
                ref={answerEditor}
                initialDelta={answerDelta}
                placeholder="The solution, worked steps or expected output."
                height={Math.max(240, Math.round(screen.height * 0.3))}
                imageBusy={imageBusy}
                onChange={onAnswerChange}
                onRequestImage={() => chooseImageSource('answer')}
                onRequestLink={(currentUrl) => setLinkDialog({ currentUrl, target: 'answer' })}
              />
            </View>
          </>
        )}

        <PrimaryButton
          label={isEditing ? 'Save changes' : `Publish ${singular}`}
          loading={publishing}
          onPress={imageBusy ? null : publish}
          style={{ marginTop: 20 }}
        />
      </ScrollView>

      {linkDialog != null && (
        <LinkDialog
          currentUrl={linkDialog.currentUrl}
          onClose={() => setLinkDialog(null)}
          onSubmit={(url, text) => editorFor(linkDialog.target)?.setLink(url, text)}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = {
  ...StyleSheet.create({
    content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
    draftRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  }),
  label: (color: string) => ({ color, fontFamily: fonts.semibold, fontSize: 14, marginBottom: 8 }),
};
