import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useToast } from '@/components/Toast';
import { CreateTab } from '@/screens/CreateTab';
import { ManageModulesTab } from '@/screens/ManageModulesTab';
import { ManageNotesTab } from '@/screens/ManageNotesTab';
import { NotesService } from '@/services/notesService';
import { fonts, useTheme } from '@/theme/ThemeProvider';

const TABS = ['Create', 'Library', 'Modules'] as const;

/// Set once this device has given every older note `kind: 'note'`.
const KINDS_BACKFILLED_KEY = 'kinds_backfilled_v1';

/// Admin-only Upload tab: create any kind of material, or edit/delete
/// what's published and the modules. All three panes stay mounted so
/// switching tabs keeps scroll positions.
export default function ManageScreen() {
  const { colors, type } = useTheme();
  const toast = useToast();
  const [tab, setTab] = useState(0);

  // Notes from before kinds existed have no `kind`, so Browse's per-kind
  // queries can't see them until this runs (see NotesService.backfillKinds).
  useEffect(() => {
    (async () => {
      try {
        if ((await AsyncStorage.getItem(KINDS_BACKFILLED_KEY)) != null) return;
        const updated = await NotesService.backfillKinds();
        await AsyncStorage.setItem(KINDS_BACKFILLED_KEY, '1');
        if (updated > 0) toast(`Updated ${updated} older notes for the new Browse.`);
      } catch {
        // Offline or rejected: try again next time the tab opens.
      }
    })();
  }, [toast]);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <Text style={[type.headlineMedium, { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 }]}>Manage</Text>
      <View style={[styles.tabBar, { borderBottomColor: colors.divider }]}>
        {TABS.map((label, i) => {
          const selected = tab === i;
          return (
            <Pressable key={label} onPress={() => setTab(i)} style={styles.tab} android_ripple={{ color: colors.divider }}>
              <Text
                style={{
                  color: selected ? colors.accent : colors.textSecondary,
                  fontFamily: selected ? fonts.semibold : fonts.medium,
                  fontSize: 14,
                }}
              >
                {label}
              </Text>
              {selected && <View style={[styles.indicator, { backgroundColor: colors.accent }]} />}
            </Pressable>
          );
        })}
      </View>
      <View style={{ flex: 1 }}>
        <View style={[styles.pane, tab !== 0 && styles.hidden]}>
          <CreateTab />
        </View>
        <View style={[styles.pane, tab !== 1 && styles.hidden]}>
          <ManageNotesTab />
        </View>
        <View style={[styles.pane, tab !== 2 && styles.hidden]}>
          <ManageModulesTab />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  indicator: { position: 'absolute', bottom: 0, left: 16, right: 16, height: 3, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  pane: StyleSheet.absoluteFill,
  hidden: { display: 'none' },
});
