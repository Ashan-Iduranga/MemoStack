import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';

/// Centered spinner, with vertical padding when inline in a list.
export function Loading({ inline = false }: { inline?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={inline ? styles.inline : styles.fill}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}

/// Centered message (empty / error states).
export function Message({ text, inline = false }: { text: string; inline?: boolean }) {
  const { type } = useTheme();
  return (
    <View style={inline ? styles.inline : styles.fill}>
      <Text style={[type.bodyMedium, { textAlign: 'center' }]}>{text}</Text>
    </View>
  );
}

export interface MenuAction {
  label: string;
  destructive?: boolean;
  onPress: () => void;
}

/// Bottom-sheet list of actions (e.g. a list row's "more" menu).
export function ActionSheet({
  visible,
  title,
  actions,
  onClose,
}: {
  visible: boolean;
  title?: string;
  actions: MenuAction[];
  onClose: () => void;
}) {
  const { colors, type } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={[styles.sheet, { backgroundColor: colors.cardBackground, paddingBottom: insets.bottom + 8 }]}>
          {title != null && (
            <Text style={[type.titleMedium, { paddingHorizontal: 20, paddingBottom: 8 }]} numberOfLines={1}>
              {title}
            </Text>
          )}
          {actions.map((action) => (
            <Pressable
              key={action.label}
              android_ripple={{ color: colors.divider }}
              style={styles.action}
              onPress={() => {
                onClose();
                action.onPress();
              }}
            >
              <Text style={[type.bodyLarge, action.destructive && { color: colors.danger }]}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  inline: { paddingVertical: 24, alignItems: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 16 },
  action: { paddingHorizontal: 20, paddingVertical: 16 },
});
