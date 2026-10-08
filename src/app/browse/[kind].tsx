import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { AppCard } from '@/components/AppCard';
import { Loading, Message } from '@/components/Feedback';
import { countLabel, isContentKind, kindInfo } from '@/config/contentKinds';
import { countFor, type Subject } from '@/models/types';
import { useAuth } from '@/services/AuthProvider';
import { SubjectsService } from '@/services/subjectsService';
import { useTheme } from '@/theme/ThemeProvider';
import { openSubject } from '@/utils/navigation';
import { subjectIconFor } from '@/utils/subjectIcons';
import { useSubscription } from '@/utils/useSubscription';

/// Module grid for one kind of material — tap a module to see its items.
/// Students only see modules that hold something of this kind; admins see
/// every module.
export default function BrowseKindScreen() {
  const { kind: kindParam } = useLocalSearchParams<{ kind: string }>();
  const kind = isContentKind(kindParam) ? kindParam : 'note';
  const info = kindInfo(kind);
  const { isAdmin } = useAuth();
  const { colors, type } = useTheme();
  const subjects = useSubscription<Subject[]>((onData, onError) => SubjectsService.watchSubjects(onData, onError), []);

  const list = (subjects.data ?? []).filter((s) => isAdmin || countFor(s, kind) > 0);

  let body;
  if (subjects.waiting && subjects.data === undefined) body = <Loading />;
  else if (subjects.error) body = <Message text={`Could not load modules: ${subjects.error.message}`} />;
  else if (list.length === 0) body = <Message text={`No ${info.label.toLowerCase()} yet — check back soon.`} />;
  else
    body = (
      <FlatList
        // Pad odd counts so the last card stays half-width, like a grid.
        data={[...list, ...(list.length % 2 === 1 ? [null] : [])]}
        keyExtractor={(s) => s?.id ?? 'spacer'}
        numColumns={2}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 }}
        columnWrapperStyle={{ gap: 12 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item }) =>
          item == null ? (
            <View style={{ flex: 1 }} />
          ) : (
            <AppCard onPress={() => openSubject(item, kind)} style={{ flex: 1, aspectRatio: 1.1 }}>
              <View style={{ flex: 1, justifyContent: 'space-between' }}>
                <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                  <MaterialIcons name={subjectIconFor(item.iconKey)} size={24} color="#FFFFFF" />
                </View>
                <Text style={type.titleMedium} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={type.bodySmall}>{countLabel(countFor(item, kind), kind)}</Text>
              </View>
            </AppCard>
          )
        }
      />
    );

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: info.label }} />
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
