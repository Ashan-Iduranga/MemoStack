import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppCard } from '@/components/AppCard';
import { Avatar } from '@/components/Avatar';
import { IconButton, OutlinedButton, TextButton } from '@/components/Buttons';
import { Loading, Message } from '@/components/Feedback';
import { FeedbackCard } from '@/components/FeedbackCard';
import { CardTitle, InfoRow, MenuRow, RankCard, StatTile, StreakWeekCard } from '@/components/ProfileWidgets';
import { ScreenHeader } from '@/components/ScreenHeader';
import { uniYearLabel } from '@/config/profileOptions';
import { levelFor, liveStreak, totalXp } from '@/gamification/activity';
import { colomboDate } from '@/gamification/dates';
import type { AppUser } from '@/models/types';
import { useAuth } from '@/services/AuthProvider';
import { FollowService } from '@/services/followService';
import { NotesService, type AuthorStats } from '@/services/notesService';
import { avatarUrl, ProfileService } from '@/services/profileService';
import { useTheme } from '@/theme/ThemeProvider';
import { formatCount } from '@/utils/format';
import { useSubscription } from '@/utils/useSubscription';

/// The signed-in user's profile: avatar, bio, education, follow counts,
/// XP / level / rank, and this week's streak. The profile doc is live;
/// note-derived XP and follow counts reload whenever the tab is shown.
export default function ProfileScreen() {
  const auth = useAuth();
  const uid = auth.currentUser?.uid ?? '';
  const [reloadKey, setReloadKey] = useState(0);

  const profile = useSubscription<AppUser>(
    (onData, onError) => (uid ? ProfileService.watchProfile(uid, onData, onError) : () => {}),
    [uid, reloadKey],
  );
  const extras = useProfileExtras(uid, reloadKey);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ScreenHeader title="You" />
      {profile.data == null ? (
        profile.error != null ? (
          <View style={{ flex: 1 }}>
            <Message text="Couldn't load your profile — check your connection." />
            <TextButton label="Retry" onPress={() => setReloadKey((k) => k + 1)} style={styles.centered} />
          </View>
        ) : (
          <Loading />
        )
      ) : (
        <ProfileBody
          user={profile.data}
          extras={extras}
          onRetry={() => setReloadKey((k) => k + 1)}
          onSignOut={() => auth.signOut()}
        />
      )}
    </SafeAreaView>
  );
}

interface Extras {
  authored: AuthorStats | null;
  follows: { followers: number; following: number } | null;
  failed: boolean;
}

/// Author stats (for derived XP) and follow counts, refreshed on focus.
function useProfileExtras(uid: string, reloadKey: number): Extras {
  const [extras, setExtras] = useState<Extras>({ authored: null, follows: null, failed: false });
  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      let cancelled = false;
      const fail = (e: unknown) => {
        console.warn('Loading profile stats failed', e);
        if (!cancelled) setExtras((prev) => ({ ...prev, failed: true }));
      };
      NotesService.getAuthorStats(uid)
        .then((authored) => !cancelled && setExtras((prev) => ({ ...prev, authored, failed: false })))
        .catch(fail);
      FollowService.getCounts(uid)
        .then((follows) => !cancelled && setExtras((prev) => ({ ...prev, follows })))
        .catch(fail);
      return () => {
        cancelled = true;
      };
      // `reloadKey` isn't read; changing it (Retry) refetches.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [uid, reloadKey]),
  );
  return extras;
}

function ProfileBody({
  user,
  extras,
  onRetry,
  onSignOut,
}: {
  user: AppUser;
  extras: Extras;
  onRetry: () => void;
  onSignOut: () => void;
}) {
  const { colors, type, isDark, toggle } = useTheme();
  const today = colomboDate();
  const xp = extras.authored != null ? totalXp(user.xp, extras.authored) : null;
  const level = xp != null ? levelFor(xp) : null;
  const education = [
    user.university.length > 0 && { icon: 'school' as const, text: user.university },
    user.degreeProgram.length > 0 && { icon: 'menu-book' as const, text: user.degreeProgram },
    user.uniYear.length > 0 && { icon: 'event' as const, text: uniYearLabel(user.uniYear) },
  ].filter((row) => row !== false);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <View style={styles.header}>
        <Avatar uri={avatarUrl(user)} name={user.name} size={72} />
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={type.headlineMedium} numberOfLines={2}>
            {user.name}
          </Text>
          {user.location.length > 0 && (
            <View style={styles.inline}>
              <MaterialIcons name="place" size={16} color={colors.textSecondary} />
              <Text style={[type.bodyMedium, { color: colors.textSecondary, marginLeft: 4 }]}>{user.location}</Text>
            </View>
          )}
          {level != null && (
            <Text style={[type.labelLarge, { color: colors.accent, marginTop: 2 }]}>
              Level {level.level} · {level.title}
            </Text>
          )}
        </View>
        <IconButton
          name="edit"
          color={colors.accent}
          accessibilityLabel="Edit profile"
          onPress={() => router.push('/edit-profile')}
        />
      </View>
      {user.bio.length > 0 ? (
        <Text style={[type.bodyMedium, { marginTop: 12 }]}>{user.bio}</Text>
      ) : (
        <TextButton label="Add a short bio" onPress={() => router.push('/edit-profile')} style={styles.addBio} />
      )}

      <AppCard style={{ marginTop: 16 }}>
        <CardTitle icon="school" title="Education" />
        {education.length > 0 ? (
          education.map((row) => <InfoRow key={row.text} icon={row.icon} text={row.text} />)
        ) : (
          <TextButton
            label="Add your institution, degree and year"
            onPress={() => router.push('/edit-profile')}
            style={styles.addBio}
          />
        )}
      </AppCard>

      <View style={styles.stats}>
        <StatTile value={extras.follows ? formatCount(extras.follows.followers) : '—'} label="Followers" />
        <StatTile value={extras.follows ? formatCount(extras.follows.following) : '—'} label="Following" />
        <StatTile value={xp != null ? formatCount(xp) : '—'} label="XP" />
      </View>
      {extras.failed && (
        <View style={styles.inline}>
          <Text style={[type.bodySmall, { color: colors.tagUniversityText, flex: 1 }]}>
            {"Couldn't load your stats — check your connection."}
          </Text>
          <TextButton label="Retry" onPress={onRetry} />
        </View>
      )}

      <View style={{ marginTop: 16 }}>
        <StreakWeekCard
          today={today}
          activeDates={user.weekActiveDates}
          currentStreak={liveStreak(user, today)}
          longestStreak={user.longestStreak}
        />
      </View>

      <View style={{ marginTop: 16 }}>
        <RankCard info={level} xp={xp} />
      </View>

      {user.isAdmin && (
        <View style={{ marginTop: 16 }}>
          <FeedbackCard />
        </View>
      )}

      <AppCard style={{ marginTop: 16 }} padding={0}>
        <MenuRow icon="post-add" label="Request a note" onPress={() => router.push('/requests')} />
        <View style={[styles.divider, { backgroundColor: colors.divider }]} />
        <MenuRow icon="feedback" label="Send feedback" onPress={() => router.push('/feedback')} />
        <View style={[styles.divider, { backgroundColor: colors.divider }]} />
        <View style={styles.switchRow}>
          <MaterialIcons name="dark-mode" size={22} color={colors.accent} />
          <Text style={[type.bodyLarge, { flex: 1, marginLeft: 14 }]}>Dark theme</Text>
          <Switch
            value={isDark}
            onValueChange={toggle}
            trackColor={{ true: colors.accent, false: colors.divider }}
            thumbColor="#FFFFFF"
          />
        </View>
      </AppCard>

      <OutlinedButton label="Sign out" icon="logout" onPress={onSignOut} style={{ marginTop: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  inline: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  addBio: { alignSelf: 'flex-start', paddingHorizontal: 0, marginTop: 4 },
  centered: { alignSelf: 'center', marginBottom: 24 },
  stats: { flexDirection: 'row', gap: 12, marginTop: 16 },
  divider: { height: 1, marginLeft: 52 },
  switchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 6 },
});
