import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { fonts, useTheme } from '@/theme/ThemeProvider';
import type { IconName } from '@/utils/subjectIcons';

/// Solid, full-width accent button. Shows a
/// spinner and ignores taps while `loading`; dims when `onPress` is null.
export function PrimaryButton({
  label,
  onPress,
  loading = false,
  icon,
  style,
}: {
  label: string;
  onPress: (() => void) | null;
  loading?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const disabled = loading || onPress == null;
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
      style={({ pressed }) => [
        styles.primary,
        { backgroundColor: colors.accent, opacity: onPress == null && !loading ? 0.5 : pressed ? 0.9 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <View style={styles.row}>
          {icon && <MaterialIcons name={icon} size={20} color="#FFFFFF" style={{ marginRight: 8 }} />}
          <Text style={styles.primaryText}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

/// Bordered button, with an optional leading icon.
export function OutlinedButton({
  label,
  onPress,
  icon,
  disabled = false,
  loading = false,
  style,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      android_ripple={{ color: colors.tagSubjectFill }}
      style={({ pressed }) => [
        styles.outlined,
        { borderColor: colors.divider, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.accent} style={{ marginRight: 8 }} />
      ) : (
        icon && <MaterialIcons name={icon} size={18} color={colors.accent} style={{ marginRight: 8 }} />
      )}
      <Text style={[styles.outlinedText, { color: colors.accent }]}>{label}</Text>
    </Pressable>
  );
}

/// Borderless text button.
export function TextButton({
  label,
  onPress,
  color,
  style,
}: {
  label: string;
  onPress: () => void;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={6} style={({ pressed }) => [styles.text, pressed && { opacity: 0.6 }, style]}>
      <Text style={[styles.textLabel, { color: color ?? colors.accent }]}>{label}</Text>
    </Pressable>
  );
}

/// Round icon-only button.
export function IconButton({
  name,
  onPress,
  color,
  size = 24,
  accessibilityLabel,
}: {
  name: IconName;
  onPress: () => void;
  color?: string;
  size?: number;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.icon, pressed && { backgroundColor: colors.divider }]}
    >
      <MaterialIcons name={name} size={size} color={color ?? colors.textPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primary: {
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  primaryText: { color: '#FFFFFF', fontFamily: fonts.semibold, fontSize: 16 },
  outlined: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    minHeight: 40,
    overflow: 'hidden',
  },
  outlinedText: { fontFamily: fonts.medium, fontSize: 14 },
  text: { paddingHorizontal: 8, paddingVertical: 8 },
  textLabel: { fontFamily: fonts.semibold, fontSize: 14 },
  icon: { padding: 8, borderRadius: 999 },
});
