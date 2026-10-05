import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { TextStyle } from 'react-native';

import { darkPalette, lightPalette, type Palette } from './colors';

const PREFS_KEY = 'memostack_theme_mode';

/// Font families loaded in the root layout. Everything is set in Inter —
/// a single clean sans face keeps headings and body easy to scan.
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

/// Material 3 type scale sizes, with bold Inter for the
/// display/headline/title roles.
function buildTypography(p: Palette) {
  const base: TextStyle = { color: p.textPrimary, fontFamily: fonts.regular };
  return {
    displayMedium: { ...base, fontFamily: fonts.bold, fontSize: 45, lineHeight: 52 },
    headlineMedium: { ...base, fontFamily: fonts.bold, fontSize: 26, lineHeight: 34 },
    titleLarge: { ...base, fontFamily: fonts.bold, fontSize: 20, lineHeight: 26 },
    titleMedium: { ...base, fontFamily: fonts.semibold, fontSize: 16, lineHeight: 24 },
    bodyLarge: { ...base, fontSize: 16, lineHeight: 24 },
    bodyMedium: { ...base, fontSize: 14, lineHeight: 20 },
    bodySmall: { ...base, color: p.textSecondary, fontSize: 12, lineHeight: 16 },
    labelLarge: { ...base, fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20 },
    labelSmall: { ...base, fontFamily: fonts.medium, fontSize: 11, lineHeight: 16 },
  } satisfies Record<string, TextStyle>;
}

export type Typography = ReturnType<typeof buildTypography>;

interface ThemeValue {
  isDark: boolean;
  colors: Palette;
  type: Typography;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

/// Persists the user's light/dark preference locally so it's available
/// before Firebase auth resolves (and doesn't need to sync across devices).
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(PREFS_KEY)
      .then((stored) => setIsDark(stored === 'dark'))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const toggle = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      AsyncStorage.setItem(PREFS_KEY, next ? 'dark' : 'light').catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo<ThemeValue>(() => {
    const colors = isDark ? darkPalette : lightPalette;
    return { isDark, colors, type: buildTypography(colors), toggle };
  }, [isDark, toggle]);

  if (!loaded) return null;
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}
