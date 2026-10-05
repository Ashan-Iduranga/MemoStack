import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ManageModulesTab } from '@/screens/ManageModulesTab';
import { ManageNotesTab } from '@/screens/ManageNotesTab';
import { NoteEditor } from '@/screens/NoteEditor';
import { fonts, useTheme } from '@/theme/ThemeProvider';

const TABS = ['New note', 'Notes', 'Modules'] as const;

/// Admin-only Upload tab: write a new note, or edit/delete existing notes
/// and modules. All three panes stay mounted so switching tabs keeps the
/// half-written note and scroll positions.
export default function ManageScreen() {
  const { colors, type } = useTheme();
  const [tab, setTab] = useState(0);

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
          <NoteEditor />
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
