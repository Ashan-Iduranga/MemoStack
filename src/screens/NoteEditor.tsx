import MaterialIcons from '@expo/vector-icons/MaterialIcons';
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
import { AppDropdown, AppTextField } from '@/components/Inputs';
import { LinkDialog } from '@/components/LinkDialog';
import { useToast } from '@/components/Toast';
import { QuillEditor, type QuillEditorHandle } from '@/editor/QuillEditor';
import { imageUrlsIn, textOf, withHostedImagesOnly } from '@/models/delta';
import { noteBody, type DeltaOp, type Note, type Subject } from '@/models/types';
import { useAuth } from '@/services/AuthProvider';
import { ImagePermissionError, ImagesService, ImageUploadError, type ImageSource } from '@/services/imagesService';
import { NotesService } from '@/services/notesService';
import { SubjectsService } from '@/services/subjectsService';
import { fonts, useTheme } from '@/theme/ThemeProvider';
import { useSubscription } from '@/utils/useSubscription';

const NEW_MODULE = '__new_module__';
const DRAFT_KEY = 'upload_draft_v1';

/// Admin's note composer: title, module, and a rich-text body with images.
/// With no `note` it writes a new one (embedded in the Upload tab, with an
/// autosaved local draft); with a `note` it edits that note and goes back
/// on save. A module typed in via "Add new module" is reused if one with
/// that name already exists.
///
/// Images upload to Storage the moment they're inserted (the Delta only
/// ever holds https URLs). Every upload made while composing is tracked in
/// `uploads`, so ones that end up unused — removed from the text, or the
/// draft discarded — are deleted again instead of piling up in Storage.
export function NoteEditor({ note }: { note?: Note }) {
  const isEditing = note != null;
  const { currentUser } = useAuth();
  const toast = useToast();
  const { colors, type } = useTheme();
  const screen = useWindowDimensions();
  const editor = useRef<QuillEditorHandle>(null);
  // Timestamp of the latest touch that started inside the editor (toolbar
  // included). Touch events bubble, so the screen sees that same touch next
  // and knows not to blur the editor for it.
  const editorTouch = useRef(-1);

  const [title, setTitle] = useState(note?.title ?? '');
  const [subjectSelection, setSubjectSelection] = useState<string | null>(note?.subjectId ?? null);
  const [newModuleName, setNewModuleName] = useState('');
  const [delta, setDelta] = useState<DeltaOp[]>(() => (note ? noteBody(note) : []));
  const [plainText, setPlainText] = useState(() => (note ? textOf(noteBody(note)) : ''));
  const [uploads, setUploads] = useState<string[]>([]);
  const [restoringDraft, setRestoringDraft] = useState(!isEditing);
  const [publishing, setPublishing] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [linkDialog, setLinkDialog] = useState<{ currentUrl: string | null } | null>(null);

  const modules = useSubscription<Subject[]>((onData, onError) => SubjectsService.watchSubjects(onData, onError), []);
  const currentModules = modules.data ?? [];

  // Restore the autosaved draft (new notes only).
  useEffect(() => {
    if (isEditing) return;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(DRAFT_KEY);
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
        }
      } catch {
        // Corrupt or old-shape draft — start fresh instead of crashing.
      }
      setRestoringDraft(false);
    })();
  }, [isEditing]);

  // Debounced draft save, 500ms after the last change.
  useEffect(() => {
    if (isEditing || restoringDraft) return;
    const timer = setTimeout(() => {
      AsyncStorage.setItem(DRAFT_KEY, JSON.stringify({ title, subjectSelection, newModuleName, delta, uploads })).catch(
        () => {},
      );
    }, 500);
    return () => clearTimeout(timer);
  }, [isEditing, restoringDraft, title, subjectSelection, newModuleName, delta, uploads]);

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

  // The editor's keyboard belongs to its WebView, which tapping elsewhere
  // doesn't blur — so any touch outside the editor blurs it explicitly.
  const onScreenTouch = (e: GestureResponderEvent) => {
    if (e.nativeEvent.timestamp !== editorTouch.current) editor.current?.blur();
  };

  const onEditorChange = useCallback((nextDelta: DeltaOp[], text: string) => {
    setDelta(nextDelta);
    setPlainText(text);
  }, []);

  const addImage = async (source: ImageSource) => {
    if (!currentUser) return;
    setImageBusy(true);
    try {
      const localUri = await ImagesService.pick(source);
      if (localUri == null) return;
      const url = await ImagesService.upload(localUri, currentUser.uid);
      setUploads((prev) => [...prev, url]);
      editor.current?.insertImage(url);
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
  const chooseImageSource = () => {
    Alert.alert('Add image', undefined, [
      { text: 'Choose from library', onPress: () => addImage('library') },
      { text: 'Take photo', onPress: () => addImage('camera') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  /// Deletes this session's uploads that the final body doesn't use.
  const cleanUpUploads = (finalDelta: DeltaOp[]) => {
    const used = new Set(imageUrlsIn(finalDelta));
    ImagesService.deleteAll(uploads.filter((url) => !used.has(url)));
    setUploads([]);
  };

  const resetDraft = async () => {
    await AsyncStorage.removeItem(DRAFT_KEY);
    setTitle('');
    setNewModuleName('');
    setSubjectSelection(null);
    setDelta([]);
    setPlainText('');
    editor.current?.setContents([]);
  };

  const discardDraft = () => {
    Alert.alert('Discard draft?', 'The title, text and any uploaded images will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          cleanUpUploads([]);
          resetDraft();
        },
      },
    ]);
  };

  const publish = async () => {
    if (!currentUser) return;
    editor.current?.blur();
    const content = withHostedImagesOnly(delta);
    const trimmedTitle = title.trim();
    const body = plainText.trim();
    if (trimmedTitle.length === 0) return toast('Please add a title.');
    if (body.length === 0 && imageUrlsIn(content).length === 0) return toast('Please write some note content.');

    const validIds = new Set(currentModules.map((s) => s.id));
    const pickingNew = subjectSelection == null || subjectSelection === NEW_MODULE || !validIds.has(subjectSelection);
    let moduleName: string;
    let existingSubjectId: string | null = null;
    if (pickingNew) {
      if (subjectSelection !== NEW_MODULE && subjectSelection != null) return toast('Please choose a module.');
      moduleName = newModuleName.trim();
      if (moduleName.length === 0) return toast('Please choose or name a module.');
    } else {
      const match = currentModules.find((s) => s.id === subjectSelection)!;
      existingSubjectId = match.id;
      moduleName = match.name;
    }

    setPublishing(true);
    try {
      const subjectId = existingSubjectId ?? (await SubjectsService.findOrCreateSubject(moduleName));
      if (existingSubjectId == null) {
        // Pick up the existing module's exact spelling if one matched.
        moduleName = (await SubjectsService.getSubject(subjectId))?.name ?? moduleName;
      }

      const wordCount = body.length === 0 ? 0 : body.split(/\s+/).length;
      const next: Note = {
        id: note?.id ?? '',
        title: trimmedTitle,
        subjectId,
        subjectName: moduleName,
        authorUid: note?.authorUid ?? currentUser.uid,
        authorName: note?.authorName ?? currentUser.name,
        contentDelta: content,
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
        cleanUpUploads(content);
        uploadsRef.current = [];
        router.back();
        toast('Note updated.');
        return;
      }

      await NotesService.publishNote(next);
      cleanUpUploads(content);
      await resetDraft();
      toast('Note published.');
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

  const dropdownValue =
    subjectSelection === NEW_MODULE || (subjectSelection != null && currentModules.some((s) => s.id === subjectSelection))
      ? subjectSelection
      : null;
  const moduleLabel = (id: string) =>
    id === NEW_MODULE ? 'Add new module' : (currentModules.find((s) => s.id === id)?.name ?? '');
  const hasDraft = title.length > 0 || plainText.trim().length > 0 || uploads.length > 0;

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
        <Text style={styles.label(colors.textPrimary)}>Title</Text>
        <AppTextField value={title} onChangeText={setTitle} placeholder="Hash tables — collision handling" />

        <Text style={[styles.label(colors.textPrimary), { marginTop: 20 }]}>Module</Text>
        <AppDropdown<string>
          value={dropdownValue}
          items={[...currentModules.map((s) => s.id), NEW_MODULE]}
          itemLabel={moduleLabel}
          placeholder={modules.waiting && modules.data === undefined ? 'Loading modules…' : 'Select a module'}
          onChange={setSubjectSelection}
          renderItem={(id) =>
            id === NEW_MODULE ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialIcons name="add-circle-outline" size={18} color={colors.accent} />
                <Text style={[type.bodyLarge, { marginLeft: 6, color: colors.accent }]}>Add new module</Text>
              </View>
            ) : (
              <Text style={type.bodyLarge} numberOfLines={1}>
                {moduleLabel(id)}
              </Text>
            )
          }
        />
        {dropdownValue === NEW_MODULE && (
          <AppTextField
            value={newModuleName}
            onChangeText={setNewModuleName}
            placeholder="New module name, e.g. Data Structures"
            autoCapitalize="words"
            style={{ marginTop: 10 }}
          />
        )}

        <Text style={[styles.label(colors.textPrimary), { marginTop: 20 }]}>Note</Text>
        <View onTouchStart={(e) => (editorTouch.current = e.nativeEvent.timestamp)}>
          <QuillEditor
            ref={editor}
            initialDelta={delta}
            placeholder="Type your notes. Use the toolbar for headings, lists, links and images."
            height={Math.max(300, Math.round(screen.height * 0.5))}
            imageBusy={imageBusy}
            onChange={onEditorChange}
            onRequestImage={chooseImageSource}
            onRequestLink={(currentUrl) => setLinkDialog({ currentUrl })}
          />
        </View>

        <PrimaryButton
          label={isEditing ? 'Save changes' : 'Publish note'}
          loading={publishing}
          onPress={imageBusy ? null : publish}
          style={{ marginTop: 20 }}
        />
      </ScrollView>

      {linkDialog != null && (
        <LinkDialog
          currentUrl={linkDialog.currentUrl}
          onClose={() => setLinkDialog(null)}
          onSubmit={(url, text) => editor.current?.setLink(url, text)}
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
