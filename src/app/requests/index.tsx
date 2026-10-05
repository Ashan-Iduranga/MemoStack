import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { AppCard } from '@/components/AppCard';
import { PrimaryButton } from '@/components/Buttons';
import { Loading, Message } from '@/components/Feedback';
import { PillChip, TagPill } from '@/components/Pills';
import type { NoteRequest } from '@/models/types';
import { RequestsService, type RequestSort } from '@/services/requestsService';
import { useTheme } from '@/theme/ThemeProvider';
import { timeAgo } from '@/utils/format';
import { useSubscription } from '@/utils/useSubscription';

/// Note requests from all students: open or fulfilled, top or newest.
export default function RequestsScreen() {
  const [status, setStatus] = useState<NoteRequest['status']>('open');
  const [sort, setSort] = useState<RequestSort>('top');
  const requests = useSubscription<NoteRequest[]>(
    (onData, onError) => RequestsService.watchRequests(status, sort, onData, onError),
    [status, sort],
  );

  let body;
  if (requests.waiting && requests.data === undefined) body = <Loading />;
  else if (requests.error) body = <Message text="Couldn't load requests — check your connection." />;
  else if ((requests.data ?? []).length === 0)
    body = (
      <Message
        text={status === 'open' ? 'No open requests. Ask for the notes you need!' : 'No fulfilled requests yet.'}
      />
    );
  else
    body = (
      <FlatList
        data={requests.data}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <RequestRow request={item} />}
      />
    );

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.top}>
        <PrimaryButton label="Request a note" icon="post-add" onPress={() => router.push('/requests/new')} />
        <View style={styles.filters}>
          <PillChip label="Open" selected={status === 'open'} onPress={() => setStatus('open')} />
          <PillChip label="Fulfilled" selected={status === 'fulfilled'} onPress={() => setStatus('fulfilled')} />
          <View style={{ flex: 1 }} />
          <PillChip label="Top" selected={sort === 'top'} onPress={() => setSort('top')} />
          <PillChip label="New" selected={sort === 'new'} onPress={() => setSort('new')} />
        </View>
      </View>
      {body}
    </View>
  );
}

function RequestRow({ request }: { request: NoteRequest }) {
  const { colors, type } = useTheme();
  return (
    <AppCard onPress={() => router.push({ pathname: '/requests/[id]', params: { id: request.id } })} style={styles.row}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TagPill label={request.subject} tone="subject" />
        {request.status === 'fulfilled' && <TagPill label="Fulfilled" tone="offline" />}
      </View>
      <Text style={[type.titleMedium, { marginTop: 8 }]} numberOfLines={2}>
        {request.topic}
      </Text>
      <View style={styles.meta}>
        <MaterialIcons name="thumb-up-off-alt" size={16} color={colors.accent} />
        <Text style={[type.bodySmall, { marginLeft: 4 }]}>{request.voteCount}</Text>
        {request.grade.length > 0 && <Text style={[type.bodySmall, { marginLeft: 12 }]}>{request.grade}</Text>}
        <View style={{ flex: 1 }} />
        {request.createdAt && <Text style={type.bodySmall}>{timeAgo(request.createdAt)}</Text>}
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  filters: { flexDirection: 'row', gap: 8, marginTop: 16 },
  list: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  row: { marginBottom: 12 },
  meta: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
});
