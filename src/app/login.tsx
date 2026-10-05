import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppCard } from '@/components/AppCard';
import { PrimaryButton, TextButton } from '@/components/Buttons';
import { AppTextField } from '@/components/Inputs';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/services/AuthProvider';
import { fonts, useTheme } from '@/theme/ThemeProvider';

export default function LoginScreen() {
  const auth = useAuth();
  const toast = useToast();
  const { colors, type } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [obscure, setObscure] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const submit = async () => {
    const next = {
      email: email.trim().length === 0 ? 'Email is required' : undefined,
      password: password.length === 0 ? 'Password is required' : undefined,
    };
    setErrors(next);
    if (next.email || next.password) return;
    setLoading(true);
    const error = await auth.signIn(email, password);
    setLoading(false);
    if (error) toast(error);
  };

  const forgotPassword = async () => {
    if (email.trim().length === 0) {
      toast('Enter your email above first.');
      return;
    }
    const error = await auth.sendPasswordReset(email);
    toast(error ?? 'Password reset email sent.');
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[type.displayMedium, styles.center]}>MemoStack</Text>
          <Text style={[type.headlineMedium, styles.center, { marginTop: 28 }]}>Welcome back</Text>
          <Text style={[type.bodyMedium, styles.center, { marginTop: 6 }]}>Sign in to access your notes & papers</Text>
          <AppCard style={{ marginTop: 28, alignSelf: 'stretch' }}>
            <AppTextField
              label="Email"
              prefixIcon="mail-outline"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="next"
              error={errors.email}
            />
            <AppTextField
              label="Password"
              prefixIcon="lock-outline"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={obscure}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={submit}
              error={errors.password}
              style={{ marginTop: 16 }}
              suffix={
                <Pressable onPress={() => setObscure(!obscure)} hitSlop={8}>
                  <MaterialIcons
                    name={obscure ? 'visibility' : 'visibility-off'}
                    size={22}
                    color={colors.textSecondary}
                  />
                </Pressable>
              }
            />
            <View style={{ alignItems: 'flex-end' }}>
              <TextButton label="Forgot password?" onPress={forgotPassword} />
            </View>
            <PrimaryButton label="Sign In" loading={loading} onPress={submit} style={{ marginTop: 8 }} />
          </AppCard>
          <View style={styles.footer}>
            <Text style={type.bodyMedium}>Don&apos;t have an account? </Text>
            <Link href="/register" style={{ color: colors.accent, fontFamily: fonts.semibold, fontSize: 14 }}>
              Register
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 32 },
  center: { textAlign: 'center' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 24 },
});
