import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect, useEffectEvent, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppCard } from '@/components/AppCard';
import { PrimaryButton, TextButton } from '@/components/Buttons';
import { useToast } from '@/components/Toast';
import { auth as firebaseAuth } from '@/lib/firebase';
import { useAuth } from '@/services/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';

/// Blocks access to the app until the signed-in user has verified their
/// email address. This catches registrations made with a typo'd or
/// non-existent email: the student can never get past this screen
/// without a working inbox to click the link.
export default function VerifyEmailScreen() {
  const auth = useAuth();
  const toast = useToast();
  const { colors, type } = useTheme();
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const poll = useEffectEvent(() => auth.reloadUser());

  // Poll quietly so a student who verifies in their phone's email app gets
  // in without having to come back and tap "I've verified".
  useEffect(() => {
    const id = setInterval(() => poll(), 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const checkNow = async () => {
    setChecking(true);
    await auth.reloadUser();
    setChecking(false);
    if (!firebaseAuth.currentUser?.emailVerified) {
      toast('Still not verified. Check your inbox (and spam folder) and try again.');
    }
  };

  const resend = async () => {
    if (cooldown > 0) return;
    setResending(true);
    const error = await auth.resendVerificationEmail();
    setResending(false);
    setCooldown(30);
    toast(error ?? 'Verification email sent.');
  };

  const email = auth.pendingVerificationEmail ?? 'your email address';

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content}>
        <MaterialIcons name="mark-email-unread" size={56} color={colors.textPrimary} />
        <Text style={[type.headlineMedium, { marginTop: 20, textAlign: 'center' }]}>Verify your email</Text>
        <Text style={[type.bodyMedium, { marginTop: 8, textAlign: 'center' }]}>
          We&apos;ve sent a verification link to {email}. That address didn&apos;t look valid or reachable — please
          open the link to confirm it before continuing, or try again with a different email.
        </Text>
        <AppCard style={{ marginTop: 24, alignSelf: 'stretch' }}>
          <PrimaryButton label="I've verified — continue" loading={checking} onPress={checkNow} />
          <PrimaryButton
            label={cooldown > 0 ? `Resend email (${cooldown}s)` : 'Resend verification email'}
            loading={resending}
            onPress={cooldown > 0 ? null : resend}
            style={{ marginTop: 12 }}
          />
        </AppCard>
        <TextButton
          label="Use a different email — sign out"
          onPress={() => auth.signOut()}
          style={{ marginTop: 16 }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 32 },
});
