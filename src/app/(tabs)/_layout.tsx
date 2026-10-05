import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Tabs } from 'expo-router';
import { View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDailyActivity } from '@/hooks/useDailyActivity';
import { useAuth } from '@/services/AuthProvider';
import { fonts, useTheme } from '@/theme/ThemeProvider';
import type { IconName } from '@/utils/subjectIcons';

/// Persistent bottom nav: Home/Browse/Saved/You for students, plus Upload
/// for admins. Pushed screens (note reader, module notes, note editor)
/// live in the root stack, so they cover this bar entirely.
export default function TabLayout() {
  const { isAdmin, currentUser } = useAuth();
  useDailyActivity(currentUser?.uid);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const icon = (outline: IconName, filled: IconName) =>
    function TabIcon({ focused, color }: { focused: boolean; color: ColorValue }) {
      return (
        <View
          style={{
            width: 56,
            height: 30,
            borderRadius: 15,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: focused ? colors.tagSubjectFill : 'transparent',
          }}
        >
          <MaterialIcons name={focused ? filled : outline} size={24} color={color} />
        </View>
      );
    };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.cardBackground,
          borderTopColor: colors.divider,
          // Explicit height: with `height: undefined` the bar sized to its
          // padding only, so the items overflowed into the home-indicator
          // area outside the bar's bounds and stopped receiving touches on iOS.
          // 8 top padding + 30 icon pill + 4 gap + ~16 label + 2 bottom slack.
          height: 60 + insets.bottom,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 12, marginTop: 4 },
        sceneStyle: { backgroundColor: colors.pageBackground },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home', 'home') }} />
      <Tabs.Screen name="browse" options={{ title: 'Browse', tabBarIcon: icon('grid-view', 'grid-view') }} />
      <Tabs.Screen
        name="manage"
        options={{
          title: 'Upload',
          tabBarIcon: icon('add-circle-outline', 'add-circle'),
          href: isAdmin ? undefined : null,
        }}
      />
      <Tabs.Screen name="saved" options={{ title: 'Saved', tabBarIcon: icon('bookmark-outline', 'bookmark') }} />
      <Tabs.Screen name="profile" options={{ title: 'You', tabBarIcon: icon('person-outline', 'person') }} />
    </Tabs>
  );
}
