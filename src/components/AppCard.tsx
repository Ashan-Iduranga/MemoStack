import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

/// Flat, borderless tile on a soft grey fill — the base building block of
/// MemoStack's layout. Pressable (with a ripple) when `onPress` is given.
export function AppCard({
  children,
  onPress,
  style,
  padding = 16,
  radius = 16,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  padding?: ViewStyle['padding'];
  radius?: number;
}) {
  const { colors } = useTheme();
  const cardStyle: ViewStyle = {
    backgroundColor: colors.tileBackground,
    borderRadius: radius,
    padding,
    overflow: 'hidden',
  };
  if (!onPress) return <View style={[cardStyle, style]}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.divider }}
      style={({ pressed }) => [cardStyle, style, pressed && { opacity: 0.92 }]}
    >
      {children}
    </Pressable>
  );
}
