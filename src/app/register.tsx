import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppCard } from '@/components/AppCard';
import { IconButton, PrimaryButton } from '@/components/Buttons';
import { AppDropdown, AppTextField } from '@/components/Inputs';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/services/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { sriLankanUniversities, Validators } from '@/utils/validators';

type Field = 'name' | 'email' | 'customUniversity' | 'degreeProgram' | 'password' | 'confirmPassword';

export default function RegisterScreen() {
  const auth = useAuth();
  const toast = useToast();
  const { colors, type } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [university, setUniversity] = useState(sriLankanUniversities[0]);
  const [customUniversity, setCustomUniversity] = useState('');
  const [degreeProgram, setDegreeProgram] = useState('');
  const [obscure, setObscure] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string | null>>>({});

  const submit = async () => {
    const next: Partial<Record<Field, string | null>> = {
      name: Validators.required(name, 'Name'),
      email: Validators.email(email),
      customUniversity: university === 'Other' ? Validators.required(customUniversity, 'University') : null,
      degreeProgram: Validators.required(degreeProgram, 'Degree program'),
      password: Validators.password(password),
      confirmPassword: Validators.password(confirmPassword),
    };
    setErrors(next);
    if (Object.values(next).some((e) => e)) return;
    if (password !== confirmPassword) {
      toast('Passwords do not match');
      return;
    }
    setLoading(true);
    const error = await auth.register({
      name,
      email,
      password,
      university: university === 'Other' ? customUniversity.trim() : university,
      degreeProgram,
    });
    setLoading(false);
    if (error) {
      toast(error);
      return;
    }
    // The auth guard swaps this screen for "Verify your email".
    toast('Account created! Check your email to verify your address.');
  };

  const eye = (
    <Pressable onPress={() => setObscure(!obscure)} hitSlop={8}>
      <MaterialIcons name={obscure ? 'visibility' : 'visibility-off'} size={22} color={colors.textSecondary} />
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <IconButton name="arrow-back" onPress={() => router.back()} accessibilityLabel="Back" />
          <Text style={[type.headlineMedium, { marginTop: 8 }]}>Create your account</Text>
          <Text style={[type.bodyMedium, { marginTop: 4 }]}>Join students across Sri Lanka sharing study material</Text>
          <AppCard style={{ marginTop: 24 }}>
            <AppTextField
              label="Full name"
              prefixIcon="person-outline"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              error={errors.name}
            />
            <AppTextField
              label="Email"
              prefixIcon="mail-outline"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.email}
              style={styles.gap}
            />
            <AppDropdown
              label="University"
              value={university}
              items={sriLankanUniversities}
              itemLabel={(v) => v}
              onChange={setUniversity}
              style={styles.gap}
            />
            {university === 'Other' && (
              <AppTextField
                label="Your university name"
                prefixIcon="school"
                value={customUniversity}
                onChangeText={setCustomUniversity}
                error={errors.customUniversity}
                style={styles.gap}
              />
            )}
            <AppTextField
              label="Degree program (e.g. BSc in Computer Science)"
              prefixIcon="menu-book"
              value={degreeProgram}
              onChangeText={setDegreeProgram}
              error={errors.degreeProgram}
              style={styles.gap}
            />
            <AppTextField
              label="Password"
              prefixIcon="lock-outline"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={obscure}
              autoCapitalize="none"
              suffix={eye}
              error={errors.password}
              style={styles.gap}
            />
            <AppTextField
              label="Confirm password"
              prefixIcon="lock-outline"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={obscure}
              autoCapitalize="none"
              error={errors.confirmPassword}
              style={styles.gap}
            />
            <PrimaryButton label="Create Account" loading={loading} onPress={submit} style={{ marginTop: 20 }} />
          </AppCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  gap: { marginTop: 16 },
});
