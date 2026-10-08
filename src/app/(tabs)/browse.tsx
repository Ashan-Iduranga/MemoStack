import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppCard } from '@/components/AppCard';
import { Message } from '@/components/Feedback';
import { ScreenHeader } from '@/components/ScreenHeader';
import { AVAILABLE_KINDS, CONTENT_KINDS, countLabel, type ContentKind } from '@/config/contentKinds';
import { countFor, type Subject } from '@/models/types';
import { SubjectsService } from '@/services/subjectsService';
import { useTheme } from '@/theme/ThemeProvider';
import { plural } from '@/utils/format';
import { openBrowseKind } from '@/utils/navigation';
import { useSubscription } from '@/utils/useSubscription';

/// One card per kind of material (Notes, Quizzes, Papers, Activities,
/// Practicals). Tap a card to see the modules that hold that kind. Totals
/// come from the modules' stored counts, so this costs no extra reads.
export default function BrowseScreen() {
  const { type } = useTheme();
  const subjects = useSubscription<Subject[]>((onData, onError) => SubjectsService.watchSubjects(onData, onError), []);
  const list = subjects.data;

  const stats = (kind: ContentKind) => {
    if (list === undefined) return null;
    const withKind = list.filter((s) => countFor(s, kind) > 0);
    return { total: withKind.reduce((sum, s) => sum + countFor(s, kind), 0), modules: withKind.length };
  };

  const [first, ...rest] = CONTENT_KINDS;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ScreenHeader title="Browse" />
      {subjects.error ? (
        <Message text={`Could not load modules: ${subjects.error.message}`} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 20 }}>
          <Text style={[type.bodyMedium, { marginBottom: 14 }]}>What do you want to study?</Text>
          <KindCard kind={first.key} stats={stats(first.key)} wide />
          <View style={styles.grid}>
            {rest.map((k) => (
              <View key={k.key} style={styles.cell}>
                <KindCard kind={k.key} stats={stats(k.key)} />
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function KindCard({
  kind,
  stats,
  wide = false,
}: {
  kind: ContentKind;
  stats: { total: number; modules: number } | null;
  wide?: boolean;
}) {
  const { colors, type } = useTheme();
  const info = CONTENT_KINDS.find((k) => k.key === kind)!;
  const available = AVAILABLE_KINDS.includes(kind);
  const comingSoon = !available || stats?.total === 0;
  const meta =
    stats == null
      ? ' '
      : comingSoon
        ? 'Coming soon'
        : wide
          ? `${countLabel(stats.total, kind)} · ${plural(stats.modules, 'module')}`
          : countLabel(stats.total, kind);

  return (
    <AppCard
      onPress={available ? () => openBrowseKind(kind) : undefined}
      style={wide ? { marginBottom: 12 } : { flex: 1 }}
    >
      <View style={wide ? styles.wideRow : { flex: 1 }}>
        <View style={[styles.badge, { backgroundColor: comingSoon ? colors.tagUniversityFill : colors.accent }]}>
          <MaterialIcons name={info.icon} size={24} color={comingSoon ? colors.tagUniversityText : '#FFFFFF'} />
        </View>
        <View style={wide ? { flex: 1, marginLeft: 14 } : { flex: 1, marginTop: 14 }}>
          <Text style={type.titleMedium} numberOfLines={1}>
            {info.label}
          </Text>
          <Text style={[type.bodySmall, { marginTop: 2 }]} numberOfLines={2}>
            {info.description}
          </Text>
          <Text
            style={[type.bodySmall, { marginTop: 8, color: comingSoon ? colors.textSecondary : colors.accent }]}
            numberOfLines={1}
          >
            {meta}
          </Text>
        </View>
        {wide && available && <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />}
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  cell: { width: '50%', paddingHorizontal: 6, marginBottom: 12 },
  wideRow: { flexDirection: 'row', alignItems: 'center' },
  badge: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
