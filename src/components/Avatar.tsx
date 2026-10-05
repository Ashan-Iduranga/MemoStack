import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { fonts, useTheme } from '@/theme/ThemeProvider';
import { initialsFor } from '@/utils/format';

/// Round profile picture. The initials are always drawn underneath, and
/// the photo (if any) on top — so while it loads, or if it fails to load,
/// the initials show instead of an empty circle.
export function Avatar({ uri, name, size = 56 }: { uri: string | null; name: string; size?: number }) {
  const { colors } = useTheme();
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const circle = { width: size, height: size, borderRadius: size / 2 };
  const showPhoto = uri != null && uri !== failedUri;

  return (
    <View style={[circle, styles.circle, { backgroundColor: colors.accent }]}>
      <Text
        style={[styles.initials, { fontSize: Math.round(size * 0.36), lineHeight: Math.round(size * 0.46) }]}
        allowFontScaling={false}
      >
        {initialsFor(name)}
      </Text>
      {showPhoto && (
        <Image
          source={{ uri }}
          onError={() => setFailedUri(uri)}
          accessibilityIgnoresInvertColors
          style={[StyleSheet.absoluteFill, circle]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initials: { color: '#FFFFFF', fontFamily: fonts.bold, textAlign: 'center' },
});
