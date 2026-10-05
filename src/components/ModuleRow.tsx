import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Subject } from '@/models/types';
import { fonts, useTheme } from '@/theme/ThemeProvider';
import { plural } from '@/utils/format';
import { subjectIconFor } from '@/utils/subjectIcons';

/// Bold section title with an optional trailing action ("See all").
export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.header}>
      <Text style={[styles.headerText, { color: colors.textPrimary }]}>{title}</Text>
      {action}
    </View>
  );
}

/// Full-width module list row: icon badge, module name, note count and a
/// chevron, on a soft grey tile.
export function ModuleRow({ subject, onPress }: { subject: Subject; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.divider }}
      style={({ pressed }) => [styles.row, { backgroundColor: colors.tileBackground }, pressed && { opacity: 0.85 }]}
    >
      <View style={[styles.badge, { backgroundColor: colors.tagSubjectFill }]}>
        <MaterialIcons name={subjectIconFor(subject.iconKey)} size={22} color={colors.accent} />
      </View>
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
          {subject.name}
        </Text>
        <Text style={[styles.meta, { color: colors.textSecondary }]}>{plural(subject.notesCount, 'note')}</Text>
      </View>
      <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  headerText: { flex: 1, fontFamily: fonts.bold, fontSize: 18 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  badge: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: fonts.semibold, fontSize: 15 },
  meta: { fontFamily: fonts.regular, fontSize: 12.5, marginTop: 2 },
});
