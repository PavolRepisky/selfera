import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { EmptyState } from '@/components/EmptyState';
import { Pill } from '@/components/Pill';
import { NATIVE_HEADER, ScreenScroll } from '@/components/Screen';
import { LongPressMenu } from '@/components/LongPressMenu';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SwipeRow } from '@/components/SwipeRow';
import { SearchBar } from '@/components/SearchBar';
import { Text } from '@/components/Text';
import { colors, layout, tapSlop, type } from '@/constants/theme';
import { type Friend } from '@/data/content';
import { useSocial } from '@/hooks/useSocial';
import { fetchSuggestions, searchPeople, type Suggestion } from '@/lib/backend/social';

/** How long typing has to pause before a search goes out — each keystroke
 * isn't a question worth asking the server. */
const SEARCH_PAUSE_MS = 300;

/** The friends you share with someone, named up to two by the faces shown,
 * the rest folded into "+ N more". */
function mutualLabel(faces: readonly Friend[], count: number) {
  const names = faces.map((friend) => friend.name).join(', ');
  const more = count - faces.length;
  return more > 0 ? `${names} + ${more} more` : names;
}

/** A suggestion's face — a step over a post's, since the row is the person. */
const ROW_AVATAR = 52;
/** The mutual friends' faces under a suggestion's handle: small enough to
 * sit on the badge line beside their names. */
const MUTUAL_AVATAR = 18;
/** How far each mutual face tucks under the one before it. */
const MUTUAL_OVERLAP = 8;
/** The white ring that keeps overlapping faces apart. */
const MUTUAL_RING = 2;
/** The dismiss cross: quiet beside the Add pill, so it reads as a way out
 * rather than a second action. */
const DISMISS_GLYPH = 16;
/** Suggestions shown before See all opens the rest. */
const SUGGESTION_PEEK = 4;

/**
 * Finding people to do it with, opened from Community's corner button and
 * laid out the way the canvas's "16 Better · Find friends" board is: a
 * search, then the people — no invite card, which was dropped from the page.
 *
 * Anyone who has asked to be your friend comes first, under Requests, with
 * Accept and a cross to turn it down. Suggestions are friends of your
 * friends, most shared first, then others in your challenge — each with the
 * faces of friends you share, an Add and a cross to set them aside. A search
 * is separate from them: while something is typed, the page is only
 * "Results", matched by name or username across every account, friends
 * marked as such. Adding someone sends a request, exactly as the Members feed
 * does: the pill turns to "Request sent" and a second tap takes it back.
 */
export default function AddFriendsScreen() {
  const router = useRouter();
  const { relations, members, refreshToday, toggleRequest, accept, decline } = useSocial();
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  // Set aside for this visit only — nothing remembers a "not now" yet.
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const dismiss = (id: string) => setDismissed((prev) => new Set(prev).add(id));

  // Requests and friends as they stand now, and friends of friends.
  const [friendsOfFriends, setFriendsOfFriends] = useState<Suggestion[]>([]);
  // Whether that first look has come back, so the empty page waits for it
  // rather than flashing before the suggestions land.
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);
  useEffect(() => {
    refreshToday();
    fetchSuggestions()
      .then(setFriendsOfFriends)
      .catch(() => {})
      .finally(() => setSuggestionsLoaded(true));
  }, [refreshToday]);

  // Friends of friends first; then others in your challenge, who aren't
  // friends (the Members tab never lists those) and haven't come up already.
  // Anyone who has already asked you is under Requests, not suggested again.
  const suggestions = useMemo(() => {
    const seen = new Set(friendsOfFriends.map((s) => s.person.id));
    const asked = new Set(relations.incoming.map((p) => p.id));
    const fromRound: Suggestion[] = members
      .filter((person) => !seen.has(person.id))
      .map((person) => ({ person, mutuals: [], mutualCount: 0 }));
    return [...friendsOfFriends, ...fromRound].filter(
      (s) =>
        !dismissed.has(s.person.id) &&
        !relations.friends.has(s.person.id) &&
        !asked.has(s.person.id),
    );
  }, [friendsOfFriends, members, dismissed, relations.friends, relations.incoming]);
  const shownSuggestions = showAll ? suggestions : suggestions.slice(0, SUGGESTION_PEEK);

  const requests = relations.incoming;

  // A search is its own list, not a filter on the suggestions: it looks
  // through every account — friends included, so a name you already have
  // still turns up — and while it's running the page is only its results.
  const searchTerm = query.trim().toLowerCase().replace(/^@/, '');
  const [results, setResults] = useState<Friend[]>([]);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    if (!searchTerm) {
      setResults([]);
      return;
    }
    setSearching(true);
    let live = true;
    const timer = setTimeout(() => {
      searchPeople(searchTerm)
        .then((found) => live && setResults(found))
        .catch(() => live && setResults([]))
        .finally(() => live && setSearching(false));
    }, SEARCH_PAUSE_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [searchTerm]);

  const renderPerson = (
    person: Friend,
    dismissable: boolean,
    shared?: { faces: readonly Friend[]; count: number },
  ) => {
    const isFriend = relations.friends.has(person.id);
    const isRequested = relations.outgoing.has(person.id);
    const mutuals = !isFriend && shared && shared.count > 0 ? shared : null;
    const openPerson = () => router.push({ pathname: '/friend/[id]', params: { id: person.id } });
    // Swiped, a row offers what its own buttons do — adding them, and on a
    // suggestion hiding it; held, the same and their page.
    const quick = [
      ...(isFriend
        ? []
        : [
            {
              label: isRequested ? 'Cancel' : 'Add',
              tone: isRequested ? ('muted' as const) : ('primary' as const),
              onPress: () => toggleRequest(person.id),
            },
          ]),
      ...(dismissable
        ? [{ label: 'Hide', tone: 'destructive' as const, onPress: () => dismiss(person.id) }]
        : []),
    ];
    return (
      <LongPressMenu
        key={person.id}
        actions={[
          { label: 'View profile', icon: 'person-circle-outline', onPress: openPerson },
          ...(isFriend
            ? []
            : [
                isRequested
                  ? { label: 'Cancel request', icon: 'person-remove-outline' as const, onPress: () => toggleRequest(person.id) }
                  : { label: 'Add friend', icon: 'person-add-outline' as const, onPress: () => toggleRequest(person.id) },
              ]),
          ...(dismissable
            ? [{ label: 'Hide', icon: 'close-circle-outline' as const, destructive: true, onPress: () => dismiss(person.id) }]
            : []),
        ]}
      >
        <SwipeRow actions={quick}>
          <View style={styles.row}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${person.name}'s profile`}
              onPress={() => router.push({ pathname: '/friend/[id]', params: { id: person.id } })}
              style={({ pressed }) => [styles.person, pressed && styles.pressed]}
            >
              <Avatar source={person.avatar} size={ROW_AVATAR} />
              <View style={styles.personText}>
                <Text variant="copyBold" numberOfLines={1}>
                  {person.name}
                </Text>
                <Text variant="meta" color={colors.inkMuted} numberOfLines={1}>
                  {person.handle}
                </Text>
                {/* Who you already share, by face — the reason to add someone
                    you haven't met on here yet. */}
                {mutuals ? (
                  <View style={styles.mutuals}>
                    <View style={styles.mutualFaces}>
                      {mutuals.faces.map((friend, i) => (
                        <Avatar
                          key={friend.id}
                          source={friend.avatar}
                          size={MUTUAL_AVATAR + MUTUAL_RING * 2}
                          style={[styles.mutualFace, i > 0 && styles.mutualTucked]}
                        />
                      ))}
                    </View>
                    <Text variant="badge" color={colors.inkMuted} numberOfLines={1}>
                      {mutualLabel(mutuals.faces, mutuals.count)}
                    </Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
            {isFriend ? (
              <Pill tone="muted" size="sm" bold icon="people-outline" label="Friends" />
            ) : (
              // The Members feed's own pill: a request, not a friend yet, so just
              // the words once sent, and a second tap takes it back. The Add
              // carries the person-with-a-plus the Friends pill's people
              // answer, so the two read as one action and its outcome.
              <Pill
                tone={isRequested ? 'muted' : 'solid'}
                bold
                icon={isRequested ? undefined : 'person-add-outline'}
                label={isRequested ? 'Request sent' : 'Add'}
                onPress={() => toggleRequest(person.id)}
              />
            )}
            {dismissable ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Hide ${person.name}`}
                hitSlop={tapSlop(DISMISS_GLYPH)}
                onPress={() => dismiss(person.id)}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Ionicons name="close" size={DISMISS_GLYPH} color={colors.inkMuted} />
              </Pressable>
            ) : null}
          </View>
        </SwipeRow>
      </LongPressMenu>
    );
  };

  return (
    <View style={styles.screenRoot}>
      <ScreenScroll
        tone="plain"
        onRefresh={refreshToday}
        header={
          <ScreenHeader
            plainTitle="Find friends"
            search={{ placeholder: 'Search by name or username', onChangeText: setQuery }}
          />
        }
      >
        {/* The iPhone has the system's field in the bar instead. */}
        {NATIVE_HEADER ? null : (
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name or username"
            style={styles.search}
          />
        )}

        {searchTerm ? (
          <>
            <View style={styles.sectionHeading}>
              <Text variant="sectionHeading">Results</Text>
              <Text variant="metaBold" color={colors.inkMuted}>
                {String(results.length)}
              </Text>
            </View>
            {results.length ? (
              <View>{results.map((person) => renderPerson(person, false))}</View>
            ) : searching ? null : (
              <EmptyState
                icon="search-outline"
                title="No one by that name"
                hint="Try a username or another spelling."
              />
            )}
          </>
        ) : (
          <>
            {/* Someone waiting on you comes before anyone you might ask:
                their face, Accept, and a cross to turn it down. */}
            {requests.length ? (
              <>
                <View style={styles.sectionHeading}>
                  <Text variant="sectionHeading">Requests</Text>
                  <Text variant="metaBold" color={colors.inkMuted}>
                    {String(requests.length)}
                  </Text>
                </View>
                <View>
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
                          onPress={() => router.push({ pathname: '/friend/[id]', params: { id: person.id } })}
                          style={({ pressed }) => [styles.person, pressed && styles.pressed]}
                        >
                          <Avatar source={person.avatar} size={ROW_AVATAR} />
                          <View style={styles.personText}>
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
              </>
            ) : null}

            {suggestions.length ? (
              <>
                <View style={styles.sectionHeading}>
                  <Text variant="sectionHeading">Suggested for you</Text>
                  {suggestions.length > SUGGESTION_PEEK && !showAll ? (
                    <Pressable
                      accessibilityRole="button"
                      hitSlop={tapSlop(type.metaBold.lineHeight)}
                      onPress={() => setShowAll(true)}
                      style={({ pressed }) => pressed && styles.pressed}
                    >
                      <Text variant="metaBold" color={colors.inkMuted}>
                        See all
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
                <View>
                  {shownSuggestions.map((s) =>
                    renderPerson(s.person, true, { faces: s.mutuals, count: s.mutualCount }),
                  )}
                </View>
              </>
            ) : null}

            {/* Nobody asking and nobody to suggest: the search is the only
                way left, so the page says so. */}
            {!requests.length && !suggestions.length && suggestionsLoaded ? (
              <EmptyState
                icon="search-outline"
                title="No one to suggest yet"
                hint="Search by name or username to find someone you know."
              />
            ) : null}
          </>
        )}
      </ScreenScroll>

    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
  },
  search: {
    marginBottom: layout.section,
  },
  // A heading with its quiet count or See all at the far end — Community's
  // "Finished today".
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  personText: {
    flex: 1,
  },
  mutuals: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.pill,
    marginTop: layout.line,
  },
  mutualFaces: {
    flexDirection: 'row',
  },
  // The ring is the page's own white drawn as a border, so a face tucked
  // under the next one still reads as its own circle.
  mutualFace: {
    borderWidth: MUTUAL_RING,
    borderColor: colors.surface,
  },
  mutualTucked: {
    marginLeft: -MUTUAL_OVERLAP,
  },
  pressed: {
    opacity: 0.7,
  },
});
