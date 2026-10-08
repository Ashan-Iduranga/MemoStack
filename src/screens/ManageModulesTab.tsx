import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppCard } from '@/components/AppCard';
import { OutlinedButton, PrimaryButton, TextButton } from '@/components/Buttons';
import { ActionSheet, Loading, Message } from '@/components/Feedback';
import { AppTextField } from '@/components/Inputs';
import { useToast } from '@/components/Toast';
import { CONTENT_KINDS, countLabel } from '@/config/contentKinds';
import { countFor, type Subject } from '@/models/types';
import { SubjectsService } from '@/services/subjectsService';
import { useTheme } from '@/theme/ThemeProvider';
import { plural } from '@/utils/format';
import { subjectIconFor, subjectIcons } from '@/utils/subjectIcons';
import { useSubscription } from '@/utils/useSubscription';

/// "3 notes · 1 activity", or "Empty".
function contentsLabel(subject: Subject): string {
  const parts = CONTENT_KINDS.filter((k) => countFor(subject, k.key) > 0).map((k) =>
    countLabel(countFor(subject, k.key), k.key),
  );
  return parts.length === 0 ? 'Empty' : parts.join(' · ');
}

/// Every module with Add / Edit (name + icon) / Delete. Renaming updates
/// the module name on all its notes; deleting removes its notes too.
export function ManageModulesTab() {
  const { colors, type } = useTheme();
  const toast = useToast();
  const subjects = useSubscription<Subject[]>((onData, onError) => SubjectsService.watchSubjects(onData, onError), []);
  // `undefined` = dialog closed, `null` = adding, a Subject = editing it.
  const [editing, setEditing] = useState<Subject | null | undefined>(undefined);
  const [menuFor, setMenuFor] = useState<Subject | null>(null);

  const save = async (subject: Subject | null, name: string, iconKey: string) => {
    try {
      if (subject == null) {
        await SubjectsService.createSubject(name, iconKey);
        toast('Module added.');
      } else {
        await SubjectsService.updateSubject(subject, name, iconKey);
        toast('Module updated.');
      }
    } catch (e) {
      toast(`Could not save module: ${e}`);
    }
  };

  const confirmDelete = async (subject: Subject) => {
    let noteCount: number;
    try {
      noteCount = await SubjectsService.countNotes(subject.id);
    } catch (e) {
      toast(`Could not check notes in this module: ${e}`);
      return;
    }
    Alert.alert(
      `Delete "${subject.name}"?`,
      noteCount === 0
        ? 'This module has no notes.'
        : `This also deletes everything in it (${plural(noteCount, 'item')}) for everyone. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await SubjectsService.deleteSubject(subject.id);
              toast('Module deleted.');
            } catch (e) {
              toast(`Could not delete module: ${e}`);
            }
          },
        },
      ],
    );
  };

  if (subjects.waiting && subjects.data === undefined) return <Loading />;
  if (subjects.error) return <Message text={`Could not load modules: ${subjects.error.message}`} />;
  const list = subjects.data ?? [];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 }}>
        <OutlinedButton label="Add module" icon="add" onPress={() => setEditing(null)} />
        <View style={{ height: 16 }} />
        {list.length === 0 && <Message inline text="No modules yet." />}
        {list.map((subject) => (
          <AppCard key={subject.id} onPress={() => setEditing(subject)} padding={0} style={{ marginBottom: 10 }}>
            <View style={styles.row}>
              <MaterialIcons name={subjectIconFor(subject.iconKey)} size={24} color={colors.accent} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={type.titleMedium}>{subject.name}</Text>
                <Text style={type.bodySmall}>{contentsLabel(subject)}</Text>
              </View>
              <Pressable onPress={() => setMenuFor(subject)} hitSlop={8} style={{ padding: 8 }} accessibilityLabel="Module actions">
                <MaterialIcons name="more-vert" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>
          </AppCard>
        ))}
      </ScrollView>
      <ActionSheet
        visible={menuFor != null}
        title={menuFor?.name}
        onClose={() => setMenuFor(null)}
        actions={
          menuFor
            ? [
                { label: 'Edit', onPress: () => setEditing(menuFor) },
                { label: 'Delete', destructive: true, onPress: () => confirmDelete(menuFor) },
              ]
            : []
        }
      />
      {editing !== undefined && (
        <ModuleDialog
          subject={editing}
          onCancel={() => setEditing(undefined)}
          onSubmit={(name, iconKey) => {
            const subject = editing;
            setEditing(undefined);
            save(subject, name, iconKey);
          }}
        />
      )}
    </View>
  );
}

/// Name + icon form. Rejects a name another module already uses.
function ModuleDialog({
  subject,
  onCancel,
  onSubmit,
}: {
  subject: Subject | null;
  onCancel: () => void;
  onSubmit: (name: string, iconKey: string) => void;
}) {
  const { colors, type } = useTheme();
  const [name, setName] = useState(subject?.name ?? '');
  const [iconKey, setIconKey] = useState(subject?.iconKey ?? 'menuBook');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const submit = async () => {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError('Please enter a module name.');
      return;
    }
    setChecking(true);
    setError(null);
    try {
      const clash = await SubjectsService.findByName(trimmed, subject?.id);
      if (clash) {
        setError(`A module named "${clash.name}" already exists.`);
        return;
      }
      onSubmit(trimmed, iconKey);
    } catch (e) {
      setError(`Could not check module names: ${e}`);
    } finally {
      setChecking(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={[styles.dialog, { backgroundColor: colors.cardBackground }]}>
          <Text style={type.headlineMedium}>{subject == null ? 'Add module' : 'Edit module'}</Text>
          <AppTextField
            value={name}
            onChangeText={setName}
            placeholder="e.g. Data Structures"
            autoFocus={subject == null}
            autoCapitalize="words"
            onSubmitEditing={submit}
            error={error}
            style={{ marginTop: 16 }}
          />
          <Text style={[type.labelLarge, { marginTop: 16, marginBottom: 8 }]}>Icon</Text>
          <View style={styles.iconGrid}>
            {Object.entries(subjectIcons).map(([key, icon]) => {
              const selected = iconKey === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setIconKey(key)}
                  accessibilityLabel={`Icon ${key}`}
                  style={[styles.iconChoice, { backgroundColor: selected ? colors.accent : colors.tagSubjectFill }]}
                >
                  <MaterialIcons name={icon} size={24} color={selected ? '#FFFFFF' : colors.tagSubjectText} />
                </Pressable>
              );
            })}
          </View>
          <View style={styles.actions}>
            <TextButton label="Cancel" onPress={onCancel} />
            <PrimaryButton
              label={subject == null ? 'Add' : 'Save'}
              loading={checking}
              onPress={submit}
              style={{ alignSelf: 'auto', height: 44, paddingHorizontal: 24, marginLeft: 8 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 4, paddingVertical: 8 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  dialog: { borderRadius: 28, padding: 24 },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconChoice: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 24 },
});
