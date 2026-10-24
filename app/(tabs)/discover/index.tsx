import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type ScrollViewInstance } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { ChallengeMosaic, ChallengeRow, challengeDetail } from '@/components/ChallengeRow';
import { EmptyState } from '@/components/EmptyState';
import { Pill } from '@/components/Pill';
import { NATIVE_HEADER, ScreenScroll } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { absoluteFill, colors, gradients, layout, radii, spacing } from '@/constants/theme';
import { useApp } from '@/hooks/useAppState';
import { useChallengeCards, type ChallengeCard } from '@/hooks/useChallengeCards';

/** The featured cover: the page's one picture, still short enough that the
 * first Trending rows show under it on a standard phone. */
const COVER_HEIGHT = 360;
/** How many of your friends a cover names, by face and first name. */
const COVER_FRIENDS = 2;
const COVER_FACE_SIZE = 24;
/** How many covers the Featured carousel holds — a handful to swipe
 * through, not a second catalogue. */
const FEATURED_COVERS = 3;
/** The carousel's page dots, iOS's page-control size. */
const DOT = 7;
/** How long a cover holds before the carousel turns to the next on its own —
 * long enough to read the name and who's in it. */
const COVER_HOLD_MS = 4500;
/** Trending is a short list, not the catalogue — See all is the rest. */
const TRENDING_ROWS = 5;

/** A link in running text: on the iPhone in the system blue, the colour iOS
 * gives anything tappable that isn't a button; the muted grey elsewhere. */
const LINK = NATIVE_HEADER ? colors.systemAccent : colors.inkMuted;

/**
 * Discover, kept to two things: a carousel of featured rounds as covers, and
 * the rest trending as plain rows under it. Only rounds you can still join are here — everyone starts on one shared
 * day and joining shuts when that day ends — and the one you're in isn't: Tasks is where
 * it lives. Rounds under way or finished are behind See all and search.
 *
 * Featured leads with the ones most of your friends are in, then the ones
 * most people are; Trending is the others by how many have joined. The page used to stack
 * a cover, a shelf of posters, a wall of photo tiles and small print, every
 * one of them a picture asking to be looked at.
 */
export default function DiscoverScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { reload } = useApp();
  const cards = useChallengeCards();


  const { featured, trending } = useMemo(() => {
    const open = cards.filter((card) => card.phase === 'upcoming' && !card.mine);
    const byMembers = (a: ChallengeCard, b: ChallengeCard) => (b.members ?? 0) - (a.members ?? 0);
    const ranked = [...open].sort(
      (a, b) => b.friendsIn.length - a.friendsIn.length || byMembers(a, b),
    );
    return {
      featured: ranked.slice(0, FEATURED_COVERS),
      trending: ranked.slice(FEATURED_COVERS).sort(byMembers).slice(0, TRENDING_ROWS),
    };
  }, [cards]);

  // Each cover takes the screen's whole width, one to a page; the dots under
  // them say there are more to swipe to.
  const carouselRef = useRef<ScrollViewInstance>(null);
  const [page, setPage] = useState(0);
  const pageRef = useRef(0);
  pageRef.current = page;

  // The covers turn on their own while the page is on show, until a finger
  // touches them — from then on they're the reader's to swipe, and stay put.
  const [autoTurn, setAutoTurn] = useState(true);
  useFocusEffect(
    useCallback(() => {
      if (!autoTurn || featured.length < 2) return;
      const timer = setInterval(() => {
        const next = (pageRef.current + 1) % featured.length;
        carouselRef.current?.scrollTo({ x: next * width, animated: true });
      }, COVER_HOLD_MS);
      return () => clearInterval(timer);
    }, [autoTurn, featured.length, width]),
  );
  const stopAutoTurn = () => setAutoTurn(false);

  const openChallenge = (card: ChallengeCard) =>
    router.push({ pathname: '/feed/[id]', params: { id: card.id } });
  const seeAll = () =>
    router.push({ pathname: '/challenges/search', params: { all: '1' } });

  return (
    <ScreenScroll
      tabBar
      onRefresh={reload}
      header={
        <ScreenHeader
          plainTitle="Discover"
          showBack={false}
          actions={[
            { icon: 'search', label: 'Search eras', onPress: () => router.push('/challenges/search') },
            { icon: 'add', label: 'Create an era', onPress: () => router.push('/challenge/create') },
          ]}
        />
      }
    >
      {featured.length ? (
        <>
          <View style={styles.section}>
            {/* Run to the screen edges, a whole cover to a page. */}
            <ScrollView
              ref={carouselRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              onTouchStart={stopAutoTurn}
              onScrollBeginDrag={stopAutoTurn}
              onScroll={(event) =>
                setPage(Math.round(event.nativeEvent.contentOffset.x / width))
              }
              style={styles.bleed}
            >
              {/* Each page is the screen's width with the card inset by the
                  gutter, so the next card waits wholly off screen. */}
              {featured.map((card) => (
                <View key={card.id} style={[styles.coverPage, { width }]}>
                  <Cover card={card} onPress={() => openChallenge(card)} />
                </View>
              ))}
            </ScrollView>
            {featured.length > 1 ? (
              <View style={styles.dots}>
                {featured.map((card, i) => (
                  <View key={card.id} style={[styles.dot, i === page && styles.dotOn]} />
                ))}
              </View>
            ) : null}
          </View>

          {trending.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.heading}>
                <Text variant="sectionHeading">Trending</Text>
                <Text variant="metaBold" color={LINK} accessibilityRole="link" onPress={seeAll}>
                  See all
                </Text>
              </View>
              {trending.map((card) => (
                <ChallengeRow
                  key={card.id}
                  card={card}
                  detail={challengeDetail(card, true)}
                  mosaic
                  onPress={() => openChallenge(card)}
                />
              ))}
            </View>
          ) : null}
        </>
      ) : (
        <EmptyState
          icon="calendar-outline"
          title="Nothing starting soon"
          hint="Start one yourself — even today. Friends can join until its first day ends."
          action={{ label: 'Create an era', onPress: () => router.push('/challenge/create') }}
        />
      )}
    </ScreenScroll>
  );
}

/**
 * The featured round as a cover: its photos edge to edge, how long until
 * it starts on a pill at the top, and over the shade at its foot the topic and
 * length, the name, who's in, and Join — enough to decide without opening it.
 */
function Cover({ card, onPress }: { card: ChallengeCard; onPress: () => void }) {
  // Your friends in it lead the line, by face and name; with none, how many
  // are in it at all — or, with nobody yet, that the first spot is open.
  const friends = card.friendsIn.slice(0, COVER_FRIENDS);
  const members = card.members ?? 0;
  const others = Math.max(members - friends.length, 0);
  const whoLine = friends.length
    ? `${friends.map((friend) => friend.name).join(', ')}${others ? ` + ${others.toLocaleString('en-US')}` : ''}`
    : members
      ? `${members.toLocaleString('en-US')} in it`
      : 'Be the first to join';
  const perDay = card.tasksCount === 1 ? '1 task a day' : `${card.tasksCount} tasks a day`;
  const kicker = [card.category, `${card.days} days`, perDay].filter(Boolean).join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${card.title}, ${card.statusLabel}`}
      onPress={onPress}
      style={({ pressed }) => [styles.cover, pressed && styles.pressed]}
    >
      <ChallengeMosaic photos={card.photos} style={absoluteFill} />
      <LinearGradient colors={gradients.coverShade} style={absoluteFill} />
      <Pill overMedia label={card.statusLabel} tone="floating" size="sm" bold style={styles.coverStatus} />
      <View style={styles.coverText}>
        {/* The kicker and the name are one heading, so they sit tight: the
            title's own leading is the only air between them. */}
        <View>
          <Text variant="meta" color={colors.onMediaSoft} numberOfLines={1}>
            {kicker}
          </Text>
          <Text variant="title" color={colors.onMedia} numberOfLines={2}>
            {card.title}
          </Text>
        </View>
        <View style={styles.coverFoot}>
          <View style={styles.coverFaces}>
            {friends.length ? (
              <View style={styles.faceStack}>
                {friends.map((friend, i) => (
                  <Avatar
                    key={friend.id}
                    source={friend.avatar}
                    size={COVER_FACE_SIZE}
                    style={[styles.face, i > 0 && styles.faceOverlap]}
                  />
                ))}
              </View>
            ) : null}
            <Text variant="meta" color={colors.onMedia} numberOfLines={1}>
              {whoLine}
            </Text>
          </View>
          {/* Drawn as a button but not one of its own: the whole cover is
              the tap, and a button inside a button splits it in two. */}
          {/* Centred on the who-line explicitly: a pill pins itself to the
              row's top otherwise. */}
          <Pill
            label="Join"
            tone="floating"
            overMedia
            size="lg"
            bold
            labelVariant="copyBold"
            style={styles.coverJoin}
          />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: layout.section,
  },
  bleed: {
    marginHorizontal: -layout.gutter,
  },
  coverPage: {
    paddingHorizontal: layout.gutter,
  },
  cover: {
    height: COVER_HEIGHT,
    borderRadius: radii.xl,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  coverStatus: {
    position: 'absolute',
    top: layout.card,
    left: layout.card,
  },
  coverText: {
    padding: layout.card,
    gap: layout.stack,
  },
  coverFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: layout.inline,
    marginTop: layout.line,
  },
  coverJoin: {
    alignSelf: 'center',
  },
  coverFaces: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.stack,
  },
  faceStack: {
    flexDirection: 'row',
  },
  face: {
    borderWidth: 2,
    borderColor: colors.surface,
  },
  faceOverlap: {
    marginLeft: -spacing.sm,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: layout.line,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: layout.stack,
    marginTop: layout.heading,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: radii.pill,
    backgroundColor: colors.inkGhost,
  },
  dotOn: {
    backgroundColor: colors.ink,
  },
  pressed: {
    opacity: 0.85,
  },
});
