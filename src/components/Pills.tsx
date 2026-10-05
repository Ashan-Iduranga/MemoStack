import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fonts, useTheme } from '@/theme/ThemeProvider';

/// Tap-to-select filter chip (e.g. Top/New toggles).
export function PillChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.accent : colors.cardBackground,
          borderColor: selected ? colors.accent : colors.divider,
        },
      ]}
    >
      <Text
        style={{
          color: selected ? '#FFFFFF' : colors.textPrimary,
          fontFamily: selected ? fonts.semibold : fonts.medium,
          fontSize: 13.5,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export type TagTone = 'subject' | 'meta' | 'offline';

/// Static, non-interactive tag (subject/offline labels on note cards and
/// the reader).
export function TagPill({ label, tone = 'meta' }: { label: string; tone?: TagTone }) {
  const { colors } = useTheme();
  const [fill, text] =
    tone === 'subject'
      ? [colors.tagSubjectFill, colors.tagSubjectText]
      : tone === 'offline'
        ? [colors.tagOfflineFill, colors.tagOfflineText]
        : [colors.tagUniversityFill, colors.tagUniversityText];
  return (
    <View style={[styles.tag, { backgroundColor: fill }]}>
      <Text numberOfLines={1} style={[styles.tagText, { color: text }]}>
        {label}
      </Text>
    </View>
  );
}

/// Thin (6px) rounded progress bar.
export function ProgressBar({ value }: { value: number }) {
  const { colors } = useTheme();
  const pct = Math.min(1, Math.max(0, value)) * 100;
  return (
    <View style={[styles.track, { backgroundColor: colors.divider }]}>
      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: colors.accent }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
  tag: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start', flexShrink: 1 },
  tagText: { fontFamily: fonts.semibold, fontSize: 12 },
  track: { height: 6, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 4 },
});
