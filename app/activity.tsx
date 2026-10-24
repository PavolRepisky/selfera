import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { EmptyState } from '@/components/EmptyState';
import { Pill } from '@/components/Pill';
import { ScreenScroll } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SwipeRow } from '@/components/SwipeRow';
import { Text } from '@/components/Text';
import { colors, layout, tapSlop } from '@/constants/theme';
import { useApp } from '@/hooks/useAppState';
import { useSession } from '@/hooks/useSession';
import { useSocial } from '@/hooks/useSocial';
import { fetchActivity, type ActivityItem } from '@/lib/backend/social';
import { ago } from '@/lib/format';

/** A face in the list — the size Find friends' rows use, so the two pages
 * read as one place. */
const ROW_AVATAR = 52;
/** The decline cross: quiet beside Accept, a way out rather than a second
 * action, as on Find friends. */
const DISMISS_GLYPH = 16;
/** The dot leading a row you haven't seen yet. */
const UNREAD_DOT = 8;

/** What someone did, after their name. */
function said(item: ActivityItem): string {
  switch (item.kind) {
    case 'friend_accepted':
      return 'accepted your friend request.';
    case 'reaction':
      return `liked your Day ${item.day}.`;
    case 'comment':
      return item.text ? `commented on your Day ${item.day}: ${item.text}` : `commented on your Day ${item.day}.`;
    case 'reply':
      return item.text ? `replied to your comment: ${item.text}` : 'replied to your comment.';
    case 'invite':
      return item.eraName ? `invited you to ${item.eraName}.` : 'invited you to an era.';
  }
}

/**
 * Everything people have done that concerns you, opened from Community's
 * bell. Friend requests come first, under Requests, each with Accept and a
 * cross to turn it down — they wait there until they're answered. Under them
 * the rest, newest first: a request accepted, a comment or a heart on one of
 * your days, a reply to you, an invite into an era. Each row opens what it's
 * about. What you hadn't seen yet carries a dot and sits under New; opening
 * the page counts it all as seen, so the bell's badge clears.
 */
export default function ActivityScreen() {
  const router = useRouter();
  const { relations, accept, decline, refreshToday, markActivityRead } = useSocial();
  const { membershipId, catalog } = useApp();
  const { session } = useSession();
  const userId = session?.user.id ?? null;
  const requests = relations.incoming;

  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await fetchActivity());
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoaded(true);
    }
  }, []);

  // Read again each time the page comes up, then marked seen — the dots stay
  // on screen for this visit, so what's new can still be told apart.
  useFocusEffect(
    useCallback(() => {
      load().then(markActivityRead);
    }, [load, markActivityRead]),
  );

  const refresh = useCallback(async () => {
    await Promise.all([load(), refreshToday()]);
    markActivityRead();
  }, [load, refreshToday, markActivityRead]);

  const openPerson = (id: string) => router.push({ pathname: '/friend/[id]', params: { id } });

  const open = (item: ActivityItem) => {
    if (item.kind === 'friend_accepted') return openPerson(item.actor.id);
    if (item.kind === 'invite') {
      const listing = catalog.find((l) => l.section.roundId === item.roundId);
      if (listing) router.push({ pathname: '/feed/[id]', params: { id: listing.key } });
      return;
    }
    if (!item.membershipId || !item.day) return;
    const day = String(item.day);
    // A reply can be on someone else's day: their post, in their era.
    if (item.ownerId && item.ownerId !== userId) {
      router.push({
        pathname: '/friend/post/[id]',
        params: { id: item.ownerId, day, run: item.membershipId },
      });
      return;
    }
    // One of your own days — on a past era, named by its membership.
    router.push({
      pathname: '/day/[day]',
      params: item.membershipId === membershipId ? { day } : { day, run: item.membershipId },
    });
  };

  const fresh = items.filter((item) => item.unread);
  const earlier = items.filter((item) => !item.unread);

  const renderItem = (item: ActivityItem) => (
    <Pressable
      key={item.id}
      accessibilityRole="button"
      onPress={() => open(item)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.actor.name}'s profile`}
        onPress={() => openPerson(item.actor.id)}
      >
        <Avatar source={item.actor.avatar} size={ROW_AVATAR} />
      </Pressable>
      <View style={styles.rowText}>
        <Text variant="body" numberOfLines={3}>
          <Text variant="copyBold">{item.actor.name}</Text> {said(item)}{' '}
          <Text variant="meta" color={colors.inkMuted}>
            {ago(item.at)}
          </Text>
        </Text>
      </View>
      {item.kind === 'invite' ? (
        <Pill tone="muted" grey size="sm" bold label="View" onPress={() => open(item)} />
      ) : item.unread ? (
        <View style={styles.dot} accessibilityLabel="New" />
      ) : null}
    </Pressable>
  );

  const nothing = loaded && !failed && !requests.length && !items.length;

  return (
    <ScreenScroll tone="plain" onRefresh={refresh} header={<ScreenHeader plainTitle="Activity" />}>
      {requests.length ? (
        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <Text variant="sectionHeading">Requests</Text>
            <Text variant="metaBold" color={colors.inkMuted}>
              {String(requests.length)}
            </Text>
          </View>
          {requests.map((person) => (
            <SwipeRow
              key={person.id}
              actions={[
                { label: 'Accept', tone: 'primary', onPress: () => accept(person.id) },
                { label: 'Decline', tone: 'destructive', onPress: () => decline(person.id) },
              ]}
            >
              <View style={styles.row}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${person.name}'s profile`}
                  onPress={() => openPerson(person.id)}
                  style={({ pressed }) => [styles.person, pressed && styles.pressed]}
                >
                  <Avatar source={person.avatar} size={ROW_AVATAR} />
                  <View style={styles.rowText}>
                    <Text variant="copyBold" numberOfLines={1}>
                      {person.name}
                    </Text>
                    <Text variant="meta" color={colors.inkMuted} numberOfLines={1}>
                      {person.handle}
                    </Text>
                  </View>
                </Pressable>
                <Pill tone="solid" bold label="Accept" onPress={() => accept(person.id)} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Decline ${person.name}`}
                  hitSlop={tapSlop(DISMISS_GLYPH)}
                  onPress={() => decline(person.id)}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <Ionicons name="close" size={DISMISS_GLYPH} color={colors.inkMuted} />
                </Pressable>
              </View>
            </SwipeRow>
          ))}
        </View>
      ) : null}

      {fresh.length ? (
        <View style={styles.section}>
          <Text variant="sectionHeading" style={styles.heading}>
            New
          </Text>
          {fresh.map(renderItem)}
        </View>
      ) : null}

      {earlier.length ? (
        <View style={styles.section}>
          <Text variant="sectionHeading" style={styles.heading}>
            {fresh.length ? 'Earlier' : 'Recent'}
          </Text>
          {earlier.map(renderItem)}
        </View>
      ) : null}

      {failed && !items.length ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn’t load your activity"
          hint="Check your connection and try again."
          action={{ label: 'Try again', onPress: load }}
        />
      ) : null}

      {nothing ? (
        <EmptyState
          icon="notifications-outline"
          title="Nothing yet"
          hint="Friend requests, comments, likes and invites will show up here."
          action={{ label: 'Find friends', onPress: () => router.push('/add-friends') }}
        />
      ) : null}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: layout.section,
  },
  // A heading with its quiet count at the far end — Find friends' Requests.
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: layout.line,
  },
  heading: {
    marginBottom: layout.line,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.inline,
    paddingVertical: layout.heading,
  },
  person: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.inline,
  },
  rowText: {
    flex: 1,
  },
  // Ink, not a colour: the palette keeps red for danger and a heart.
  dot: {
    width: UNREAD_DOT,
    height: UNREAD_DOT,
    borderRadius: UNREAD_DOT / 2,
    backgroundColor: colors.ink,
  },
  pressed: {
    opacity: 0.7,
  },
});
