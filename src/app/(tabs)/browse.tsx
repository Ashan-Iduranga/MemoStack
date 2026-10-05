import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppCard } from '@/components/AppCard';
import { Loading, Message } from '@/components/Feedback';
import { ScreenHeader } from '@/components/ScreenHeader';
import type { Subject } from '@/models/types';
import { SubjectsService } from '@/services/subjectsService';
import { useTheme } from '@/theme/ThemeProvider';
import { plural } from '@/utils/format';
import { openSubject } from '@/utils/navigation';
import { subjectIconFor } from '@/utils/subjectIcons';
import { useSubscription } from '@/utils/useSubscription';

/// Module grid — tap a module to see its notes.
export default function BrowseScreen() {
  const { colors, type } = useTheme();
  const subjects = useSubscription<Subject[]>((onData, onError) => SubjectsService.watchSubjects(onData, onError), []);

  let body;
  if (subjects.waiting && subjects.data === undefined) body = <Loading />;
  else if (subjects.error) body = <Message text={`Could not load subjects: ${subjects.error.message}`} />;
  else if ((subjects.data ?? []).length === 0) body = <Message text="No subjects yet — check back soon." />;
  else
    body = (
      <FlatList
        // Pad odd counts so the last card stays half-width, like a grid.
        data={[...subjects.data!, ...(subjects.data!.length % 2 === 1 ? [null] : [])]}
        keyExtractor={(s) => s?.id ?? 'spacer'}
        numColumns={2}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 20 }}
        columnWrapperStyle={{ gap: 12 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item }) =>
          item == null ? (
            <View style={{ flex: 1 }} />
          ) : (
          <AppCard onPress={() => openSubject(item)} style={{ flex: 1, aspectRatio: 1.1 }}>
            <View style={{ flex: 1, justifyContent: 'space-between' }}>
              <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                <MaterialIcons name={subjectIconFor(item.iconKey)} size={24} color="#FFFFFF" />
              </View>
              <Text style={type.titleMedium} numberOfLines={2}>
                {item.name}
              </Text>
              <Text style={type.bodySmall}>{plural(item.notesCount, 'note')}</Text>
            </View>
          </AppCard>
          )
        }
      />
    );

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ScreenHeader title="Browse" />
      {body}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  badge: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
