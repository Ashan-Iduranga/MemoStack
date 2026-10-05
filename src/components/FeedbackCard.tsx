import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppCard } from '@/components/AppCard';
import { TextButton } from '@/components/Buttons';
import { Loading, Message } from '@/components/Feedback';
import { PillChip, TagPill } from '@/components/Pills';
import { CardTitle } from '@/components/ProfileWidgets';
import { FEEDBACK_TYPES } from '@/config/profileOptions';
import type { FeedbackItem } from '@/models/types';
import { FeedbackService } from '@/services/feedbackService';
import { useTheme } from '@/theme/ThemeProvider';
import { timeAgo } from '@/utils/format';
import { useSubscription } from '@/utils/useSubscription';

const COLLAPSED_COUNT = 3;
type Filter = 'all' | FeedbackItem['type'];

/// Admin-only: the latest messages from Send feedback, live, with a type
/// filter. Tap a message to read it in full.
export function FeedbackCard() {
  const { type } = useTheme();
  const [filter, setFilter] = useState<Filter>('all');
  const [showAll, setShowAll] = useState(false);
  const feedback = useSubscription<FeedbackItem[]>(
    (onData, onError) => FeedbackService.watchRecent(onData, onError),
    [],
  );

  const items = (feedback.data ?? []).filter((f) => filter === 'all' || f.type === filter);
  const visible = showAll ? items : items.slice(0, COLLAPSED_COUNT);

  let body;
  if (feedback.waiting && feedback.data === undefined) body = <Loading inline />;
  else if (feedback.error) body = <Message inline text="Couldn't load feedback — check your connection." />;
  else if (items.length === 0)
    body = <Message inline text={filter === 'all' ? 'No feedback yet.' : 'No feedback of this type.'} />;
  else
    body = (
      <>
        {visible.map((item) => (
          <FeedbackRow key={item.id} item={item} />
        ))}
        {items.length > COLLAPSED_COUNT && (
          <TextButton
            label={showAll ? 'Show less' : `Show all (${items.length})`}
            onPress={() => setShowAll((v) => !v)}
            style={styles.more}
          />
        )}
      </>
    );

  return (
    <AppCard>
      <CardTitle
        icon="inbox"
        title="User feedback"
        trailing={feedback.data != null && <Text style={type.bodySmall}>{feedback.data.length}</Text>}
      />
      <View style={styles.filters}>
        <PillChip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
        {FEEDBACK_TYPES.map((t) => (
          <PillChip key={t.key} label={t.label} selected={filter === t.key} onPress={() => setFilter(t.key)} />
        ))}
      </View>
      {body}
    </AppCard>
  );
}

function FeedbackRow({ item }: { item: FeedbackItem }) {
  const { colors, type } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const label = FEEDBACK_TYPES.find((t) => t.key === item.type)?.label ?? 'Other';
  const meta = [item.name || 'A student', item.platform, item.createdAt && timeAgo(item.createdAt)]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      onPress={() => setExpanded((v) => !v)}
      accessibilityRole="button"
      accessibilityHint={expanded ? 'Collapses the message' : 'Shows the full message'}
      style={[styles.row, { borderTopColor: colors.divider }]}
    >
      <View style={styles.rowTop}>
        <TagPill label={label} tone={item.type === 'idea' ? 'subject' : 'meta'} />
        <Text style={[type.bodySmall, { flex: 1, marginLeft: 8 }]} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      <Text style={[type.bodyMedium, { marginTop: 6 }]} numberOfLines={expanded ? undefined : 3}>
        {item.message}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, marginBottom: 4 },
  row: { borderTopWidth: 1, paddingVertical: 12, marginTop: 8 },
  rowTop: { flexDirection: 'row', alignItems: 'center' },
  more: { alignSelf: 'center', marginTop: 4 },
});
