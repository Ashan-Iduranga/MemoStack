import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState, type ReactNode } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts, useTheme } from '@/theme/ThemeProvider';
import type { IconName } from '@/utils/subjectIcons';

/// Rounded, filled text input: optional floating label, prefix icon,
/// suffix element, and an error line underneath.
export function AppTextField({
  label,
  prefixIcon,
  suffix,
  error,
  style,
  multiline,
  ...inputProps
}: {
  label?: string;
  prefixIcon?: IconName;
  suffix?: ReactNode;
  error?: string | null;
  style?: StyleProp<ViewStyle>;
} & TextInputProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.danger : focused ? colors.accent : 'transparent';
  return (
    <View style={style}>
      <View
        style={[
          styles.field,
          { backgroundColor: colors.tileBackground, borderColor, borderWidth: 1.5 },
          multiline && { alignItems: 'flex-start' },
        ]}
      >
        {prefixIcon && (
          <MaterialIcons name={prefixIcon} size={22} color={colors.textSecondary} style={styles.prefix} />
        )}
        <View style={{ flex: 1 }}>
          {label != null && (
            <Text style={[styles.label, { color: focused ? colors.accent : colors.textSecondary }]}>{label}</Text>
          )}
          <TextInput
            {...inputProps}
            multiline={multiline}
            placeholderTextColor={colors.textSecondary}
            onFocus={(e) => {
              setFocused(true);
              inputProps.onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              inputProps.onBlur?.(e);
            }}
            style={[styles.input, { color: colors.textPrimary }]}
          />
        </View>
        {suffix}
      </View>
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

/// Free-text field with tap-to-fill suggestions shown while it's focused:
/// up to `max` entries containing the typed text (all of them when empty).
/// Needs a parent ScrollView with `keyboardShouldPersistTaps="handled"`
/// so tapping a suggestion doesn't just dismiss the keyboard.
export function SuggestTextField({
  suggestions,
  max = 4,
  value,
  onChangeText,
  ...fieldProps
}: Parameters<typeof AppTextField>[0] & {
  suggestions: readonly string[];
  max?: number;
  value: string;
  onChangeText: (text: string) => void;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const needle = value.trim().toLowerCase();
  const matches = focused
    ? suggestions.filter((s) => s.toLowerCase().includes(needle) && s.toLowerCase() !== needle).slice(0, max)
    : [];
  return (
    <View>
      <AppTextField
        {...fieldProps}
        value={value}
        onChangeText={onChangeText}
        onFocus={(e) => {
          setFocused(true);
          fieldProps.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          fieldProps.onBlur?.(e);
        }}
      />
      {matches.length > 0 && (
        <View style={styles.suggestions}>
          {matches.map((s) => (
            <Pressable
              key={s}
              onPress={() => onChangeText(s)}
              style={[styles.suggestion, { borderColor: colors.divider, backgroundColor: colors.cardBackground }]}
            >
              <Text style={[styles.suggestionText, { color: colors.textPrimary }]} numberOfLines={1}>
                {s}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

/// Dropdown: a field that opens a bottom-sheet list of options.
export function AppDropdown<T>({
  label,
  value,
  items,
  itemLabel,
  renderItem,
  onChange,
  placeholder = 'Select',
  style,
}: {
  label?: string;
  value: T | null;
  items: T[];
  itemLabel: (item: T) => string;
  renderItem?: (item: T) => ReactNode;
  onChange: (item: T) => void;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, type } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  return (
    <View style={style}>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.field, { backgroundColor: colors.tileBackground, borderColor: 'transparent', borderWidth: 1.5 }]}
      >
        <View style={{ flex: 1 }}>
          {label != null && <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>}
          <Text
            numberOfLines={1}
            style={[styles.input, { color: value == null ? colors.textSecondary : colors.textPrimary }]}
          >
            {value == null ? placeholder : itemLabel(value)}
          </Text>
        </View>
        <MaterialIcons name="arrow-drop-down" size={24} color={colors.textSecondary} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[
              styles.sheet,
              { backgroundColor: colors.cardBackground, paddingBottom: insets.bottom + 8 },
            ]}
          >
            {label != null && <Text style={[type.titleMedium, styles.sheetTitle]}>{label}</Text>}
            <FlatList
              data={items}
              keyExtractor={(item, i) => `${itemLabel(item)}-${i}`}
              renderItem={({ item }) => {
                const selected = value != null && itemLabel(item) === itemLabel(value);
                return (
                  <Pressable
                    onPress={() => {
                      setOpen(false);
                      onChange(item);
                    }}
                    android_ripple={{ color: colors.divider }}
                    style={[styles.option, selected && { backgroundColor: colors.tagSubjectFill }]}
                  >
                    {renderItem ? (
                      renderItem(item)
                    ) : (
                      <Text style={[type.bodyLarge, selected && { color: colors.accent }]}>{itemLabel(item)}</Text>
                    )}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 14,
    minHeight: 56,
    paddingVertical: 6,
  },
  prefix: { marginRight: 10 },
  label: { fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  input: { fontFamily: fonts.regular, fontSize: 16, paddingVertical: 4, minHeight: 28 },
  error: { fontFamily: fonts.regular, fontSize: 12, marginTop: 6, marginLeft: 14 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '70%', paddingTop: 16 },
  sheetTitle: { paddingHorizontal: 20, paddingBottom: 8 },
  option: { paddingHorizontal: 20, paddingVertical: 14 },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  suggestion: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, maxWidth: '100%' },
  suggestionText: { fontFamily: fonts.medium, fontSize: 13 },
});
