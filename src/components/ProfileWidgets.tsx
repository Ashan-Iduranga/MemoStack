import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppCard } from '@/components/AppCard';
import { ProgressBar } from '@/components/Pills';
import { weekDays, type LevelInfo } from '@/gamification/activity';
import { fonts, useTheme } from '@/theme/ThemeProvider';
import { plural } from '@/utils/format';
import type { IconName } from '@/utils/subjectIcons';

/// Number over a label, on a soft tile (profile stats row).
export function StatTile({ value, label }: { value: string; label: string }) {
  const { colors, type } = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: colors.tagUniversityFill }]}>
      <Text style={[type.titleLarge, { color: colors.accent }]}>{value}</Text>
      <Text style={[type.bodySmall, { color: colors.tagUniversityText, marginTop: 4 }]}>{label}</Text>
    </View>
  );
}

/// Card title with a leading icon.
export function CardTitle({ icon, title, trailing }: { icon: IconName; title: string; trailing?: ReactNode }) {
  const { colors, type } = useTheme();
  return (
    <View style={styles.cardTitle}>
      <MaterialIcons name={icon} size={20} color={colors.accent} />
      <Text style={[type.titleMedium, { flex: 1, marginLeft: 8 }]}>{title}</Text>
      {trailing}
    </View>
  );
}

/// Icon + text line inside a card (education details, etc.).
export function InfoRow({ icon, text }: { icon: IconName; text: string }) {
  const { colors, type } = useTheme();
  return (
    <View style={styles.infoRow}>
      <MaterialIcons name={icon} size={18} color={colors.textSecondary} />
      <Text style={[type.bodyMedium, { flex: 1, marginLeft: 10 }]}>{text}</Text>
    </View>
  );
}

/// Level, rank title and progress to the next level.
export function RankCard({ info, xp }: { info: LevelInfo | null; xp: number | null }) {
  const { colors, type } = useTheme();
  return (
    <AppCard>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={[styles.badge, { backgroundColor: colors.tagSubjectFill }]}>
          <MaterialIcons name="military-tech" size={28} color={colors.tagSubjectText} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[type.labelSmall, { color: colors.textSecondary }]}>RANK</Text>
          <Text style={type.titleLarge}>{info?.title ?? '—'}</Text>
        </View>
        {info != null && (
          <View style={[styles.levelPill, { backgroundColor: colors.accent }]}>
            <Text style={styles.levelText}>Lv {info.level}</Text>
          </View>
        )}
      </View>
      <View style={{ marginTop: 14 }}>
        <ProgressBar value={info?.progress ?? 0} />
        <Text style={[type.bodySmall, { marginTop: 6 }]}>
          {info == null || xp == null
            ? ' '
            : info.nextXp == null
              ? `Top level reached · ${xp} XP`
              : `${xp} / ${info.nextXp} XP · ${info.nextXp - xp} to Level ${info.level + 1}`}
        </Text>
      </View>
    </AppCard>
  );
}

/// This week's active days as M–S circles, with current and longest streak.
export function StreakWeekCard({
  today,
  activeDates,
  currentStreak,
  longestStreak,
}: {
  today: string;
  activeDates: string[];
  currentStreak: number;
  longestStreak: number;
}) {
  const { colors, type } = useTheme();
  return (
    <AppCard>
      <CardTitle icon="local-fire-department" title={`${plural(currentStreak, 'day')} streak`} />
      <View style={styles.week}>
        {weekDays(today, activeDates).map((day) => {
          const ring = day.isToday && !day.active;
          return (
            <View key={day.date} style={{ alignItems: 'center' }}>
              <View
                style={[
                  styles.dayCircle,
                  {
                    backgroundColor: day.active ? colors.accent : day.isFuture ? 'transparent' : colors.divider,
                    borderColor: ring ? colors.accent : day.isFuture ? colors.divider : 'transparent',
                  },
                ]}
              >
                {day.active ? (
                  <MaterialIcons name="check" size={18} color="#FFFFFF" />
                ) : (
                  <Text
                    style={{
                      fontFamily: fonts.semibold,
                      fontSize: 13,
                      color: ring ? colors.accent : colors.textSecondary,
                    }}
                  >
                    {Number(day.date.slice(8))}
                  </Text>
                )}
              </View>
              <Text style={[type.labelSmall, { color: colors.textSecondary, marginTop: 4 }]}>{day.label}</Text>
            </View>
          );
        })}
      </View>
      <View style={[styles.streakFooter, { borderTopColor: colors.divider }]}>
        <View style={{ flex: 1 }}>
          <Text style={type.bodySmall}>Current</Text>
          <Text style={type.titleMedium}>{plural(currentStreak, 'day')}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={type.bodySmall}>Longest</Text>
          <Text style={type.titleMedium}>{plural(longestStreak, 'day')}</Text>
        </View>
      </View>
    </AppCard>
  );
}

/// Tappable list row with a leading icon and a chevron.
export function MenuRow({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const { colors, type } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      android_ripple={{ color: colors.divider }}
      style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.7 }]}
    >
      <MaterialIcons name={icon} size={22} color={colors.accent} />
      <Text style={[type.bodyLarge, { flex: 1, marginLeft: 14 }]}>{label}</Text>
      <MaterialIcons name="chevron-right" size={22} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, alignItems: 'center', paddingVertical: 16, borderRadius: 16 },
  cardTitle: { flexDirection: 'row', alignItems: 'center' },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  badge: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  levelPill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  levelText: { color: '#FFFFFF', fontFamily: fonts.semibold, fontSize: 13 },
  week: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakFooter: { flexDirection: 'row', marginTop: 16, paddingTop: 12, borderTopWidth: 1 },
  menuRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
});
