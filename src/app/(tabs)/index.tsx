import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconButton, OutlinedButton } from '@/components/Buttons';
import { Loading, Message } from '@/components/Feedback';
import { AppTextField } from '@/components/Inputs';
import { ModuleRow, SectionHeader } from '@/components/ModuleRow';
import { NoteListTile } from '@/components/NoteWidgets';
import type { Note, Subject } from '@/models/types';
import { useAuth } from '@/services/AuthProvider';
import { NotesService } from '@/services/notesService';
import { ReadingProgress } from '@/services/readingProgress';
import { SubjectsService } from '@/services/subjectsService';
import { fonts, useTheme } from '@/theme/ThemeProvider';
import { plural } from '@/utils/format';
import { openNote, openSubject } from '@/utils/navigation';
import { useSubscription } from '@/utils/useSubscription';

interface ContinueReading {
  note: Note;
  progress: number;
}

/// Landing tab: greeting, a blue hero banner (continue reading), a strip of
/// the newest notes, then the module list. Typing in the search box swaps
/// the sections for a flat list of matches.
export default function HomeScreen() {
  const { currentUser: user } = useAuth();
  const { colors, type, isDark, toggle } = useTheme();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<{ notes?: Note[]; error?: string } | null>(null);
  const [continueReading, setContinueReading] = useState<ContinueReading | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchToken = useRef(0);

  const subjects = useSubscription<Subject[]>((onData, onError) => SubjectsService.watchSubjects(onData, onError), []);
  const firstName = user?.name.trim().split(/\s+/)[0] ?? '';
  const searching = search.trim().length > 0;

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const noteId = await ReadingProgress.getLastNoteId();
          if (!noteId) return;
          const note = await NotesService.getNote(noteId);
          if (!note) return;
          const progress = await ReadingProgress.getProgress(noteId);
          if (!cancelled) setContinueReading({ note, progress });
        } catch {
          // Offline or note deleted — just hide the card.
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  useEffect(() => () => {
    if (debounce.current) clearTimeout(debounce.current);
  }, []);

  const onSearchChanged = (value: string) => {
    setSearch(value);
    if (debounce.current) clearTimeout(debounce.current);
    const token = ++searchToken.current;
    setResults(null);
    if (value.trim().length === 0) return;
    debounce.current = setTimeout(async () => {
      try {
        const notes = await NotesService.search({ queryText: value });
        if (token === searchToken.current) setResults({ notes });
      } catch (e) {
        if (token === searchToken.current) setResults({ error: String(e) });
      }
    }, 300);
  };

  const clearSearch = () => onSearchChanged('');

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={type.headlineMedium}>Hi {firstName.length === 0 ? 'there' : firstName}</Text>
            {user != null && user.degreeProgram.length > 0 && (
              <Text style={[type.bodySmall, { marginTop: 2 }]} numberOfLines={1}>
                {user.degreeProgram} · {user.university}
              </Text>
            )}
          </View>
          <Pressable
            onPress={toggle}
            accessibilityLabel="Toggle dark mode"
            hitSlop={6}
            style={[styles.darkToggle, { backgroundColor: colors.tileBackground }]}
          >
            <MaterialIcons name={isDark ? 'dark-mode' : 'nightlight-round'} size={20} color={colors.textPrimary} />
          </Pressable>
        </View>

        <AppTextField
          prefixIcon="search"
          placeholder="Search notes, modules, topics"
          value={search}
          onChangeText={onSearchChanged}
          returnKeyType="search"
          style={{ marginTop: 18 }}
          suffix={search.length > 0 ? <IconButton name="close" onPress={clearSearch} size={20} /> : undefined}
        />
        <View style={{ height: 20 }} />

        {searching ? (
          results == null ? (
            <Loading inline />
          ) : results.error ? (
            <Message inline text={`Could not search notes: ${results.error}`} />
          ) : results.notes!.length === 0 ? (
            <View>
              <Message inline text={`No notes match "${search.trim()}".`} />
              <OutlinedButton
                label="Request a note"
                icon="post-add"
                onPress={() => router.push({ pathname: '/requests/new', params: { topic: search.trim() } })}
                style={{ alignSelf: 'center' }}
              />
            </View>
          ) : (
            <View>
              <SectionHeader title={plural(results.notes!.length, 'result')} />
              {results.notes!.map((note) => (
                <NoteListTile key={note.id} note={note} onPress={() => openNote(note)} />
              ))}
            </View>
          )
        ) : (
          <>
            <HeroBanner continueReading={continueReading} moduleCount={subjects.data?.length} />
            <RecentNotes />
            <SectionHeader title="Modules" />
            {subjects.waiting && subjects.data === undefined ? (
              <Loading inline />
            ) : subjects.error ? (
              <Message inline text={`Could not load modules: ${subjects.error.message}`} />
            ) : (subjects.data ?? []).length === 0 ? (
              <Message inline text="No notes yet — check back soon." />
            ) : (
              subjects.data!.map((subject) => (
                <ModuleRow key={subject.id} subject={subject} onPress={() => openSubject(subject)} />
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const HERO_BACKGROUND = require('../../../assets/images/hero-student.jpg');

/// Big blue banner at the top of Home: the note you were last reading, or
/// a welcome message when there's nothing to resume. A student photo fills
/// the card, tinted and faded into the accent colour behind the text.
function HeroBanner({
  continueReading,
  moduleCount,
}: {
  continueReading: ContinueReading | null;
  moduleCount: number | undefined;
}) {
  const { colors } = useTheme();
  const progress = continueReading ? Math.min(1, Math.max(0, continueReading.progress)) : 0;

  return (
    <Pressable
      onPress={continueReading ? () => openNote(continueReading.note) : undefined}
      disabled={!continueReading}
      style={({ pressed }) => [styles.hero, { backgroundColor: colors.accent }, pressed && { opacity: 0.92 }]}
    >
      {/* The card itself has no padding (it lives on heroContent), so these
          layers span the full card edge to edge. */}
      <Image source={HERO_BACKGROUND} style={styles.heroImage} resizeMode="cover" />
      {/* Tint pulls the photo's cyan towards the accent; the gradient fades the
          left side into solid accent so the white text stays readable. */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: `${colors.accent}40` }]} />
      <LinearGradient
        colors={[`${colors.accent}F2`, `${colors.accent}B3`, `${colors.accent}00`]}
        locations={[0, 0.4, 0.65]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.heroContent}>
        {continueReading ? (
          <View style={{ maxWidth: '58%' }}>
            <Text style={styles.heroEyebrow}>CONTINUE READING</Text>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {continueReading.note.title}
            </Text>
            <Text style={styles.heroMeta} numberOfLines={1}>
              {continueReading.note.subjectName} · {Math.round(progress * 100)}% through
            </Text>
            <View style={styles.heroTrack}>
              <View style={[styles.heroFill, { width: `${progress * 100}%` }]} />
            </View>
          </View>
        ) : (
          <View style={{ maxWidth: '58%' }}>
            <Text style={styles.heroEyebrow}>MEMOSTACK</Text>
            <Text style={styles.heroTitle}>Your notes, organised by module</Text>
            <Text style={styles.heroMeta}>
              {moduleCount ? `${plural(moduleCount, 'module')} to explore` : 'Pick a module below to start reading'}
            </Text>
          </View>
        )}
      </View>
      {continueReading && (
        <View style={styles.heroPlay}>
          <MaterialIcons name="play-arrow" size={24} color={colors.accent} />
        </View>
      )}
    </Pressable>
  );
}

const RECENT_COUNT = 3;
const RECENT_SHADES = ['#2468DB', '#3A7BE8', '#4E89EA'];
const RECENT_BACKGROUND = require('../../../assets/images/note-card-books.jpg');

/// The three newest notes across all modules, as blue-tinted book cards
/// sharing one row so they all fit on screen without scrolling.
function RecentNotes() {
  const recent = useSubscription<Note[]>(
    (onData, onError) => NotesService.watchAll(onData, onError, RECENT_COUNT),
    [],
  );
  const list = (recent.data ?? []).slice(0, RECENT_COUNT);
  if (list.length === 0) return null;
  return (
    <View style={{ marginBottom: 24 }}>
      <SectionHeader title="Recent notes" />
      <View style={styles.recentRow}>
        {list.map((note, index) => (
          <RecentNoteCard key={note.id} note={note} color={RECENT_SHADES[index % RECENT_SHADES.length]!} />
        ))}
        {/* Spacers keep cards one-third wide when there are fewer than three. */}
        {Array.from({ length: RECENT_COUNT - list.length }, (_, i) => (
          <View key={`spacer-${i}`} style={{ flex: 1 }} />
        ))}
      </View>
    </View>
  );
}

function RecentNoteCard({ note, color }: { note: Note; color: string }) {
  return (
    <Pressable
      onPress={() => openNote(note)}
      style={({ pressed }) => [styles.recent, { backgroundColor: color }, pressed && { opacity: 0.9 }]}
    >
      <View style={StyleSheet.absoluteFill}>
        <Image source={RECENT_BACKGROUND} style={styles.recentImage} resizeMode="cover" />
      </View>
      {/* Tint the light illustration with the card's shade, deepening towards
          the bottom so the white title stays readable. */}
      <LinearGradient
        colors={[`${color}8C`, `${color}A6`, `${color}F2`]}
        locations={[0, 0.45, 0.8]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.recentTag}>
        <Text style={styles.recentTagText} numberOfLines={1}>
          {note.subjectName}
        </Text>
      </View>
      <View style={{ flex: 1 }} />
      <Text style={styles.recentTitle} numberOfLines={3}>
        {note.title}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
        <MaterialIcons name="schedule" size={13} color="rgba(255,255,255,0.85)" />
        <Text style={styles.recentMeta}>{note.readTimeMinutes} min</Text>
        <MaterialIcons name="thumb-up-off-alt" size={13} color="rgba(255,255,255,0.85)" style={{ marginLeft: 8 }} />
        <Text style={styles.recentMeta}>{note.voteScore}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  darkToggle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  hero: { borderRadius: 20, minHeight: 150, justifyContent: 'center', marginBottom: 24, overflow: 'hidden' },
  heroImage: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' },
  heroContent: { padding: 20 },
  heroEyebrow: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.8 },
  heroTitle: { color: '#FFFFFF', fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, marginTop: 6 },
  heroMeta: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.regular, fontSize: 13, marginTop: 6 },
  heroTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)', marginTop: 12, overflow: 'hidden' },
  heroFill: { height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
  heroPlay: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentRow: { flexDirection: 'row', gap: 10 },
  recent: { flex: 1, height: 150, borderRadius: 16, padding: 12, overflow: 'hidden' },
  recentImage: { width: '100%', height: '100%' },
  recentTag: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  recentTagText: { color: '#FFFFFF', fontFamily: fonts.semibold, fontSize: 10 },
  recentTitle: { color: '#FFFFFF', fontFamily: fonts.bold, fontSize: 14, lineHeight: 18 },
  recentMeta: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.medium, fontSize: 11, marginLeft: 3 },
});
