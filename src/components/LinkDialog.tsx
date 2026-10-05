import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { TextButton } from '@/components/Buttons';
import { AppTextField } from '@/components/Inputs';
import { useTheme } from '@/theme/ThemeProvider';
import { normalizeUrl } from '@/utils/validators';

/// Dialog for the editor's link button — render it only while open. With
/// `currentUrl` it edits (or removes) the link under the cursor; otherwise
/// it also asks for the text to show, used when nothing is selected.
export function LinkDialog({
  currentUrl,
  onSubmit,
  onClose,
}: {
  currentUrl: string | null;
  onSubmit: (url: string, text: string) => void;
  onClose: () => void;
}) {
  const { colors, type } = useTheme();
  const [url, setUrl] = useState(currentUrl ?? '');
  const [text, setText] = useState('');

  const submit = (value: string) => {
    onClose();
    onSubmit(value, text.trim());
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={[styles.dialog, { backgroundColor: colors.cardBackground }]}>
            <Text style={[type.titleLarge, { marginBottom: 16 }]}>{currentUrl ? 'Edit link' : 'Add link'}</Text>
            <AppTextField
              value={url}
              onChangeText={setUrl}
              placeholder="https://example.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              autoFocus
            />
            {currentUrl == null && (
              <AppTextField
                value={text}
                onChangeText={setText}
                placeholder="Text to show (optional)"
                style={{ marginTop: 10 }}
              />
            )}
            <View style={styles.actions}>
              {currentUrl != null && <TextButton label="Remove" color={colors.danger} onPress={() => submit('')} />}
              <View style={{ flex: 1 }} />
              <TextButton label="Cancel" color={colors.textSecondary} onPress={onClose} />
              <TextButton label="Apply" onPress={() => submit(normalizeUrl(url))} />
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  dialog: { borderRadius: 24, padding: 20 },
  actions: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
});
