import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';

import { AppCard } from '@/components/AppCard';
import { PrimaryButton } from '@/components/Buttons';
import { AppDropdown, AppTextField } from '@/components/Inputs';
import { useToast } from '@/components/Toast';
import { LIMITS } from '@/config/profileOptions';
import type { Subject } from '@/models/types';
import { useAuth } from '@/services/AuthProvider';
import { RequestsService } from '@/services/requestsService';
import { SubjectsService } from '@/services/subjectsService';
import { useTheme } from '@/theme/ThemeProvider';
import { useSubscription } from '@/utils/useSubscription';

const OTHER = '__other__';

/// Form for a new note request. `topic` may be prefilled (e.g. from a
/// Home search with no results).
export default function NewRequestScreen() {
  const params = useLocalSearchParams<{ topic?: string }>();
  const user = useAuth().currentUser;
  const toast = useToast();
  const { type } = useTheme();

  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [otherSubject, setOtherSubject] = useState('');
  const [topic, setTopic] = useState(params.topic ?? '');
  const [grade, setGrade] = useState('');
  const [details, setDetails] = useState('');
  const [errors, setErrors] = useState<{ subject?: string; topic?: string }>({});
  const [saving, setSaving] = useState(false);

  const modules = useSubscription<Subject[]>((onData, onError) => SubjectsService.watchSubjects(onData, onError), []);
  const subjects = modules.data ?? [];
  const subjectLabel = (id: string) => (id === OTHER ? 'Other subject' : (subjects.find((s) => s.id === id)?.name ?? ''));

  const submit = async () => {
    if (!user) return;
    const subject = (subjectId === OTHER ? otherSubject : subjectId ? subjectLabel(subjectId) : '').trim();
    const nextErrors = {
      subject: subject.length === 0 ? 'Choose or name a subject.' : undefined,
      topic: topic.trim().length === 0 ? 'What topic do you need notes on?' : undefined,
    };
    setErrors(nextErrors);
    if (nextErrors.subject || nextErrors.topic) return;

    setSaving(true);
    try {
      const id = await RequestsService.createRequest(
        { subject, topic: topic.trim(), grade: grade.trim(), details: details.trim() },
        user,
      );
      toast('Request posted.');
      router.replace({ pathname: '/requests/[id]', params: { id } });
    } catch {
      toast("Couldn't post the request — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={type.bodyMedium}>
          {"Can't find notes you need? Ask for them — other students can upvote your request."}
        </Text>
        <AppCard style={{ marginTop: 16 }}>
          <AppDropdown<string>
            label="Subject"
            value={subjectId}
            items={[...subjects.map((s) => s.id), OTHER]}
            itemLabel={subjectLabel}
            placeholder={modules.waiting && modules.data === undefined ? 'Loading subjects…' : 'Select a subject'}
            onChange={setSubjectId}
          />
          {subjectId === OTHER && (
            <AppTextField
              label="Subject name"
              value={otherSubject}
              onChangeText={setOtherSubject}
              maxLength={LIMITS.requestSubject}
              autoCapitalize="words"
              style={styles.gap}
            />
          )}
          {errors.subject && <Text style={[type.bodySmall, styles.error]}>{errors.subject}</Text>}
          <AppTextField
            label="Topic"
            value={topic}
            onChangeText={setTopic}
            maxLength={LIMITS.requestTopic}
            placeholder="e.g. AVL tree rotations"
            error={errors.topic}
            style={styles.gap}
          />
          <AppTextField
            label="Grade / year (optional)"
            value={grade}
            onChangeText={setGrade}
            maxLength={LIMITS.requestGrade}
            placeholder="e.g. 2nd Year"
            style={styles.gap}
          />
          <AppTextField
            label="Details (optional)"
            value={details}
            onChangeText={setDetails}
            maxLength={LIMITS.requestDetails}
            multiline
            placeholder="What exactly should the notes cover?"
            style={styles.gap}
          />
        </AppCard>
        <PrimaryButton label="Post request" icon="send" loading={saving} onPress={submit} style={{ marginTop: 20 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 32 },
  gap: { marginTop: 12 },
  error: { marginTop: 6, marginLeft: 14 },
});
