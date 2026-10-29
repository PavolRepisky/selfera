import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useColorScheme, View } from 'react-native';

import { ChallengeRow, challengeDetail } from '@/components/ChallengeRow';
import { EmptyState } from '@/components/EmptyState';
import { Pill } from '@/components/Pill';
import { NATIVE_HEADER, ScreenScroll } from '@/components/Screen';import { SearchBar } from '@/components/SearchBar';
import { Text } from '@/components/Text';
import { colors, colorsFor, layout, spacing } from '@/constants/theme';
import type { ChallengeCategory } from '@/data/challenges';
import {
  CATEGORIES,
  LENGTHS,
  PHASES,
  lengthBucket,
  matchedTask,
  matchesQuery,
  useChallengeCards,
  useCreatedChallengeCards,
  type ChallengeCard,
  type LengthBucket,
} from '@/hooks/useChallengeCards';

/**
 * The one place to look through eras, opened the same from Discover's search
 * and its See all: every era listed, a search field over them and a row of
 * chips under it — yours, each topic, each length — that filter the list and
 * tap off again. A query matches names, topics and tasks, so "walk" finds
 * the rounds that have you walking and says which task it found. Results are
 * grouped the way rounds run — starting soon (the only ones anyone can
 * join), under way, finished. Nothing found offers to start that era
 * yourself. Each opens on its page like any other, where yours can be edited
 * or deleted from its ⋯.
 */
export default function ChallengeSearchScreen() {
  const router = useRouter();
  // The same page either way; only the search button brings the keyboard up
  // with it, See all leaves it down to look through the list.
  const typing = useLocalSearchParams<{ all?: string }>().all !== '1';
  const listed = useChallengeCards();
  const created = useCreatedChallengeCards();
  // Yours are in the listings too; Created by you's copy replaces that
  // entry, so each shows once and as something you made.
  // A round that started with nobody in it has nothing to look at and can't
  // be joined, so it isn't listed — unless it's yours.
  const cards = useMemo(
    () =>
      [...listed.filter((card) => !created.some((c) => c.id === card.id)), ...created].filter(
        (card) => card.phase === 'upcoming' || card.members !== 0 || card.createdByMe,
      ),
    [listed, created],
  );
  const scheme = colorsFor(useColorScheme());
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState<ChallengeCategory>();
  const [length, setLength] = useState<LengthBucket>();
  const [ownOnly, setOwnOnly] = useState(false);

  // Only the topics that have an era to show.
  const topics = CATEGORIES.filter((name) => cards.some((card) => card.category === name));

  const results = useMemo(
    () =>
      cards
        .filter(
          (card) =>
            matchesQuery(card, query) &&
            (!topic || card.category === topic) &&
            (!length || lengthBucket(card.days) === length) &&
            (!ownOnly || card.createdByMe),
        )
        .sort((a, b) => (a.start?.getTime() ?? 0) - (b.start?.getTime() ?? 0)),
    [cards, query, topic, length, ownOnly],
  );
  // Soonest first while a round can still be joined; the latest first once
  // it can't.
  const groups = PHASES.map((p) => {
    const inPhase = results.filter((card) => card.phase === p.key);
    return { ...p, cards: p.key === 'upcoming' ? inPhase : inPhase.reverse() };
  }).filter((g) => g.cards.length > 0);

  const open = (card: ChallengeCard) => () =>
    router.push({ pathname: '/feed/[id]', params: { id: card.id } });

  const detailFor = (card: ChallengeCard) =>
    card.phase === 'upcoming'
      ? [card.category, `${card.days} days`].filter(Boolean).join(' · ')
      : challengeDetail(card, false);

  // A filter's chip: on, it's filled and taps off again. Off, it's grey
  // with ink type on the iPhone too, not the system's blue capsule — a row
  // of blue chips would read as a row of calls to act.
  const chip = (key: string, label: string, on: boolean, onPress: () => void) => (
    <Pill
      key={key}
      label={label}
      tone={on ? 'solid' : 'muted'}
      grey
      labelVariant="metaBold"
      trailingIcon={on ? 'close' : undefined}
      style={on ? undefined : styles.chip}
      onPress={onPress}
    />
  );

  const filterRow = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={styles.rowBleed}
      contentContainerStyle={styles.filterRow}
    >
      {created.length > 0
        ? chip('own', 'Created by you', ownOnly, () => setOwnOnly((o) => !o))
        : null}
      {topics.map((name) =>
        chip(name, name, topic === name, () =>
          setTopic((current) => (current === name ? undefined : name)),
        ),
      )}
      {LENGTHS.map((l) =>
        chip(l.key, l.label, length === l.key, () =>
          setLength((current) => (current === l.key ? undefined : l.key)),
        ),
      )}
    </ScrollView>
  );

  return (
    <ScreenScroll
      header={
        NATIVE_HEADER ? (
          // On the iPhone, the system's own search field in the bar, with its
          // Cancel taking the page away the way the drawn one's does.
          <Stack.Screen
            options={{
              headerShown: true,
              title: 'Search',
              // The same bar every other page has: no fill, the page under it.
              headerTransparent: true,
              headerBlurEffect: isLiquidGlassAvailable() ? undefined : 'systemChromeMaterial',
              // No scroll-edge blur, as `ScreenHeader` sets every other bar.
              scrollEdgeEffects: { top: 'hidden' },
              // Bar items and the field's Cancel in the system blue, as on
              // every other page.
              headerTintColor: scheme.systemAccent,
              headerTitleStyle: { color: scheme.ink },
              headerSearchBarOptions: {
                placeholder: 'Name, topic or task',
                autoFocus: typing,
                hideWhenScrolling: false,
                tintColor: scheme.systemAccent,
                onChangeText: (e) => setQuery(e.nativeEvent.text),
                onCancelButtonPress: () => router.back(),
              },
            }}
          />
        ) : (
        <View style={styles.bar}>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder="Name, topic or task"
            autoFocus={typing}
            tone="sunken"
            rightIcon={query ? 'close' : undefined}
            onRightIconPress={() => setQuery('')}
            style={styles.field}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            hitSlop={spacing.sm}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text variant="copyBold">Cancel</Text>
          </Pressable>
        </View>
        )
      }
    >
      {filterRow}
      {results.length === 0 ? (
        <EmptyState
          icon="search"
          title={
            query.trim()
              ? ownOnly
                ? `None of yours match "${query.trim()}"`
                : `No eras match "${query.trim()}"`
              : 'No eras match these filters'
          }
          hint="Take a filter off, or start this one yourself — friends can join on the day it begins."
          action={{
            label: query.trim() ? `Create "${query.trim()}"` : 'Create an era',
            onPress: () => router.push('/challenge/create'),
          }}
        />
      ) : (
        groups.map((group) => (
          <View key={group.key} style={styles.section}>
            <View style={styles.groupHeading}>
              <Text variant="copyBold" color={colors.inkMuted}>
                {group.label}
              </Text>
              <Text variant="metaBold" color={colors.inkMuted}>
                {group.cards.length}
              </Text>
            </View>
            {group.cards.map((card) => {
              const task = matchedTask(card, query);
              return (
                <ChallengeRow
                  key={card.id}
                  card={card}
                  detail={detailFor(card)}
                  note={task ? `Task: ${task.toLowerCase()}` : undefined}
                  onPress={open(card)}
                />
              );
            })}
          </View>
        ))
      )}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.inline,
  },
  field: {
    flex: 1,
  },
  section: {
    marginBottom: layout.section,
  },
  // The filter row runs to the screen's edges, so its chips scroll in from
  // under them.
  // The name a size up from its count, the two sat on one baseline.
  groupHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  rowBleed: {
    marginHorizontal: -layout.gutter,
    marginBottom: layout.section,
  },
  filterRow: {
    paddingHorizontal: layout.gutter,
    gap: layout.stack,
  },
  // The palette's fill rather than the warm `muted` pill, matching the
  // search field above it.
  chip: {
    backgroundColor: colors.surfaceSunken,
  },
  pressed: {
    opacity: 0.85,
  },
});
