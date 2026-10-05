import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/Buttons';
import { AppTextField } from '@/components/Inputs';
import { PillChip } from '@/components/Pills';
import { useToast } from '@/components/Toast';
import { FEEDBACK_TYPES, LIMITS, type FeedbackType } from '@/config/profileOptions';
import { useAuth } from '@/services/AuthProvider';
import { FeedbackService } from '@/services/feedbackService';
import { useTheme } from '@/theme/ThemeProvider';

/// Sends a bug report, idea or other message to the `feedback` collection.
export default function FeedbackScreen() {
  const user = useAuth().currentUser;
  const toast = useToast();
  const { type } = useTheme();
  const [kind, setKind] = useState<FeedbackType>('bug');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!user) return;
    if (message.trim().length === 0) return setError('Please write a message.');
    setError(null);
    setSending(true);
    try {
      await FeedbackService.submit(user, kind, message.trim());
      toast('Thanks — your feedback was sent.');
      router.back();
    } catch {
      toast("Couldn't send feedback — check your connection and try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={type.bodyMedium}>Found a bug or have an idea? Tell us — we read every message.</Text>
        <Text style={[type.titleMedium, styles.label]}>Type</Text>
        <View style={styles.chips}>
          {FEEDBACK_TYPES.map((t) => (
            <PillChip key={t.key} label={t.label} selected={kind === t.key} onPress={() => setKind(t.key)} />
          ))}
        </View>
        <Text style={[type.titleMedium, styles.label]}>Message</Text>
        <AppTextField
          value={message}
          onChangeText={setMessage}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          maxLength={LIMITS.feedback}
          placeholder={kind === 'bug' ? 'What happened, and what did you expect?' : 'Your message'}
          error={error}
        />
        <Text style={[type.bodySmall, styles.counter]}>
          {message.length}/{LIMITS.feedback}
        </Text>
        <PrimaryButton label="Send feedback" icon="send" loading={sending} onPress={submit} style={{ marginTop: 16 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 32 },
  label: { marginTop: 20, marginBottom: 10 },
  chips: { flexDirection: 'row', gap: 8 },
  counter: { alignSelf: 'flex-end', marginTop: 6 },
});
