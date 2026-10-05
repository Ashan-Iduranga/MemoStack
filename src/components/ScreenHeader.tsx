import { StyleSheet, Text, View } from 'react-native';

import { fonts, useTheme } from '@/theme/ThemeProvider';

/// Flat, left-aligned top bar for tab screens, on the page background
/// with no elevation.
export function ScreenHeader({ title }: { title: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.bar}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 60, justifyContent: 'center', paddingHorizontal: 20 },
  title: { fontFamily: fonts.bold, fontSize: 26 },
});
