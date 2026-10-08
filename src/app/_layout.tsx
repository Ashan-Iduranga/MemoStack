import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastProvider } from '@/components/Toast';
import { AuthProvider, useAuth } from '@/services/AuthProvider';
import { SavedNotesProvider } from '@/services/SavedNotesProvider';
import { fonts, ThemeProvider, useTheme } from '@/theme/ThemeProvider';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <SavedNotesProvider>
              <RootNavigator />
            </SavedNotesProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/// Routes to login, email verification, or the app depending on auth
/// state. Screens whose guard turns false are
/// removed and the user lands on the first allowed screen.
function RootNavigator() {
  const auth = useAuth();
  const { colors, isDark } = useTheme();
  // Keep the splash up until the first auth check finishes, so students
  // don't see the login screen flash before being signed in. Later loads
  // show the spinner overlay instead.
  const [ready, setReady] = useState(false);
  if (!ready && !auth.isLoading) setReady(true);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  const verified = auth.isSignedIn && auth.isEmailVerified;

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBackground }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.pageBackground },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: { fontFamily: fonts.medium, fontSize: 20 },
          contentStyle: { backgroundColor: colors.pageBackground },
        }}
      >
        <Stack.Protected guard={verified}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="note/[id]" options={{ title: '' }} />
          <Stack.Screen name="browse/[kind]" options={{ title: '', headerBackTitle: 'Browse' }} />
          <Stack.Screen name="subject/[id]" options={{ title: '' }} />
          <Stack.Screen name="edit-note/[id]" options={{ title: 'Edit' }} />
          <Stack.Screen name="new-note/[kind]" options={{ title: '', headerBackTitle: 'Upload' }} />
          <Stack.Screen name="quiz/[id]" options={{ title: '' }} />
          <Stack.Screen name="new-quiz" options={{ title: 'New quiz', headerBackTitle: 'Upload' }} />
          <Stack.Screen name="edit-quiz/[id]" options={{ title: 'Edit quiz' }} />
          {/* Without `headerBackTitle`, iOS labels the back button with the
              previous route's name, "(tabs)". */}
          <Stack.Screen name="edit-profile" options={{ title: 'Edit profile', headerBackTitle: 'Profile' }} />
          <Stack.Screen name="feedback" options={{ title: 'Send feedback', headerBackTitle: 'Profile' }} />
          {/* Reachable from Home or Profile, so an icon-only back button. */}
          <Stack.Screen
            name="requests/index"
            options={{ title: 'Note requests', headerBackButtonDisplayMode: 'minimal' }}
          />
          <Stack.Screen name="requests/new" options={{ title: 'Request a note', headerBackButtonDisplayMode: 'minimal' }} />
          <Stack.Screen name="requests/[id]" options={{ title: 'Request' }} />
        </Stack.Protected>
        <Stack.Protected guard={auth.isSignedIn && !auth.isEmailVerified}>
          <Stack.Screen name="verify-email" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={!auth.isSignedIn}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="register" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
      {auth.isLoading && (
        <View style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: colors.pageBackground }]}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { alignItems: 'center', justifyContent: 'center' },
});
