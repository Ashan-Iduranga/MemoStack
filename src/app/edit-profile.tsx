import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppCard } from '@/components/AppCard';
import { Avatar } from '@/components/Avatar';
import { PrimaryButton, TextButton } from '@/components/Buttons';
import { Loading, Message } from '@/components/Feedback';
import { AppDropdown, AppTextField, SuggestTextField } from '@/components/Inputs';
import { useToast } from '@/components/Toast';
import { DEGREE_SUGGESTIONS, LIMITS, UNI_YEARS, uniYearLabel } from '@/config/profileOptions';
import type { AppUser, ProfileFields } from '@/models/types';
import { useAuth } from '@/services/AuthProvider';
import { ImagePermissionError, ImageUploadError, type ImageSource } from '@/services/imagesService';
import { avatarUrl, ProfileService } from '@/services/profileService';
import { useTheme } from '@/theme/ThemeProvider';
import { writeErrorMessage } from '@/utils/errors';
import { useSubscription } from '@/utils/useSubscription';
import { sriLankanUniversities, Validators } from '@/utils/validators';

const NOT_SET = '';
const AVATAR_SIZE = 96;
const INSTITUTIONS = sriLankanUniversities.filter((u) => u !== 'Other');

/// Edits the signed-in user's own profile (`users/{uid}`) — the same
/// fields sign-up saves (name, institution, degree) plus bio, year and
/// location. The photo is saved as soon as it's uploaded.
export default function EditProfileScreen() {
  const uid = useAuth().currentUser?.uid ?? '';
  const [retry, setRetry] = useState(0);
  const profile = useSubscription<AppUser>(
    (onData, onError) => (uid ? ProfileService.watchProfile(uid, onData, onError) : () => {}),
    [uid, retry],
  );
  // The form starts from the first snapshot; later snapshots (e.g. a new
  // photo) only update the avatar, never overwrite what's being typed.
  const [initial, setInitial] = useState<ProfileFields | null>(null);
  if (initial == null && profile.data != null) setInitial(pickProfileFields(profile.data));

  if (initial == null || profile.data == null) {
    if (profile.error) {
      return (
        <View style={{ flex: 1 }}>
          <Message text="Couldn't load your profile — check your connection." />
          <TextButton label="Retry" onPress={() => setRetry((n) => n + 1)} style={styles.retry} />
        </View>
      );
    }
    return <Loading />;
  }
  return <EditProfileForm uid={uid} initial={initial} live={profile.data} />;
}

function pickProfileFields(user: AppUser): ProfileFields {
  const { name, bio, university, degreeProgram, uniYear, location } = user;
  return { name, bio, university, degreeProgram, uniYear, location };
}

function EditProfileForm({ uid, initial, live }: { uid: string; initial: ProfileFields; live: AppUser }) {
  const auth = useAuth();
  const toast = useToast();
  const { colors, type } = useTheme();

  const [fields, setFields] = useState<ProfileFields>(initial);
  const [errors, setErrors] = useState<{ name?: string | null; bio?: string | null }>({});
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (key: keyof ProfileFields) => (value: string) => setFields((f) => ({ ...f, [key]: value }));

  const cleaned: ProfileFields = {
    name: fields.name.trim(),
    bio: fields.bio.trim(),
    university: fields.university.trim(),
    degreeProgram: fields.degreeProgram.trim(),
    uniYear: fields.uniYear,
    location: fields.location.trim(),
  };
  const dirty = (Object.keys(cleaned) as (keyof ProfileFields)[]).some((key) => cleaned[key] !== initial[key]);

  const changePhoto = async (source: ImageSource) => {
    setUploading(true);
    try {
      const url = await ProfileService.changePhoto(uid, source);
      if (url != null) toast('Profile photo updated.');
    } catch (e) {
      toast(
        e instanceof ImagePermissionError
          ? `Allow ${source === 'camera' ? 'camera' : 'photo'} access in Settings to change your photo.`
          : e instanceof ImageUploadError
            ? `Photo upload was rejected: ${e.message}`
            : writeErrorMessage(e, 'update your photo'),
      );
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = () => {
    ProfileService.removePhoto(uid)
      .then(() => toast('Profile photo removed.'))
      .catch((e) => toast(writeErrorMessage(e, 'remove your photo')));
  };

  const choosePhoto = () => {
    if (uploading) return;
    Alert.alert('Profile photo', undefined, [
      { text: 'Choose from library', onPress: () => changePhoto('library') },
      { text: 'Take photo', onPress: () => changePhoto('camera') },
      ...(live.photoURL.length > 0
        ? [{ text: 'Remove photo', style: 'destructive' as const, onPress: removePhoto }]
        : []),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const save = async () => {
    const nextErrors = {
      name: Validators.required(cleaned.name, 'Name'),
      bio: cleaned.bio.length > LIMITS.bio ? `Bio must be ${LIMITS.bio} characters or fewer` : null,
    };
    setErrors(nextErrors);
    if (nextErrors.name || nextErrors.bio) return;
    setSaving(true);
    try {
      await ProfileService.updateProfile(uid, cleaned);
      // Notes use the cached name as `authorName`; refresh it too.
      await auth.refreshUser().catch(() => {});
      toast('Profile updated.');
      router.back();
    } catch (e) {
      toast(writeErrorMessage(e, 'save your profile'));
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.photoBlock}>
          <Pressable
            onPress={choosePhoto}
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
            style={styles.avatarWrap}
          >
            <Avatar uri={avatarUrl(live)} name={fields.name || live.name} size={AVATAR_SIZE} />
            {uploading && (
              <View style={[StyleSheet.absoluteFill, styles.uploading]}>
                <ActivityIndicator color="#FFFFFF" />
              </View>
            )}
            <View style={[styles.camera, { backgroundColor: colors.accent, borderColor: colors.pageBackground }]}>
              <MaterialIcons name="photo-camera" size={16} color="#FFFFFF" />
            </View>
          </Pressable>
          {uploading ? (
            <Text style={[type.bodySmall, { marginTop: 12 }]}>Uploading photo…</Text>
          ) : (
            <TextButton label="Change photo" onPress={choosePhoto} style={{ marginTop: 4 }} />
          )}
        </View>

        <AppCard style={{ marginTop: 12 }}>
          <AppTextField
            label="Display name"
            prefixIcon="person-outline"
            value={fields.name}
            onChangeText={set('name')}
            maxLength={LIMITS.name}
            autoCapitalize="words"
            error={errors.name}
          />
          <AppTextField
            label="Bio"
            prefixIcon="notes"
            value={fields.bio}
            onChangeText={set('bio')}
            maxLength={LIMITS.bio}
            multiline
            placeholder="A line about you and what you study"
            error={errors.bio}
            style={styles.gap}
          />
          <Text style={[type.bodySmall, styles.counter]}>
            {fields.bio.length}/{LIMITS.bio}
          </Text>
          <AppTextField
            label="Location"
            prefixIcon="place"
            value={fields.location}
            onChangeText={set('location')}
            maxLength={LIMITS.location}
            placeholder="e.g. Kandy"
            autoCapitalize="words"
            style={styles.gap}
          />
        </AppCard>

        <Text style={[type.titleMedium, styles.section]}>Education</Text>
        <AppCard>
          <SuggestTextField
            label="Institution"
            prefixIcon="school"
            value={fields.university}
            onChangeText={set('university')}
            suggestions={INSTITUTIONS}
            maxLength={LIMITS.institution}
            autoCapitalize="words"
          />
          <View style={styles.gap}>
            <SuggestTextField
              label="Degree"
              prefixIcon="menu-book"
              value={fields.degreeProgram}
              onChangeText={set('degreeProgram')}
              suggestions={DEGREE_SUGGESTIONS}
              maxLength={LIMITS.degree}
              placeholder="e.g. BSc (Hons) Software Engineering"
            />
          </View>
          <AppDropdown<string>
            label="Year"
            value={fields.uniYear.length > 0 ? fields.uniYear : null}
            items={[NOT_SET, ...UNI_YEARS.map((y) => y.key)]}
            itemLabel={(key) => (key === NOT_SET ? 'Not set' : uniYearLabel(key))}
            placeholder="Not set"
            onChange={set('uniYear')}
            style={styles.gap}
          />
        </AppCard>

        <PrimaryButton
          label="Save changes"
          loading={saving}
          onPress={dirty && !uploading ? save : null}
          style={{ marginTop: 24 }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 },
  retry: { alignSelf: 'center', marginBottom: 24 },
  photoBlock: { alignItems: 'center' },
  avatarWrap: { width: AVATAR_SIZE, height: AVATAR_SIZE },
  uploading: {
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  camera: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gap: { marginTop: 12 },
  section: { marginTop: 24, marginBottom: 8 },
  counter: { alignSelf: 'flex-end', marginTop: 4, marginRight: 4 },
});
