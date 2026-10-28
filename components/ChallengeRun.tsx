import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  useColorScheme,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, layout, radii, colorsFor, shadows } from '@/constants/theme';
import { challengeStrip } from '@/data/content';
import { DAY_MS } from '@/lib/round';
import { accentAt } from './TaskRing';
import { Text } from './Text';


/** The challenge's own photo leading its card — a list row's thumbnail, so
 * the challenge looks the same here as where it was joined. */
const CHALLENGE_THUMB = 40;

/** The lives' hearts — the size Tasks draws them at over its list. */
const HEART = 14;
/** The chevron closing the name row — a list row's disclosure arrow. */
const CHEVRON = 16;

/** Days per row of the squares: a 75-day run folds into five even rows, a
 * 30-day one into two. */
const SQUARES_PER_ROW = 15;
/** A day square's corner. The squares come out around 17pt, where even the
 * smallest radius token rounds them into dots. */
const SQUARE_RADIUS = 4;
/** Today's ring around its square — the calendar's today cell, scaled down. */
const SQUARE_TODAY_BORDER = 2;

/** How one day of the run is drawn. */
type SquareState = 'done' | 'partial' | 'missed' | 'today' | 'ahead';

/** What the card needs of one day: how many tasks got done of how many were
 * due, and whether any photo came of it. A rest day has none due, and
 * counts as done. */
export interface RunDay {
  done: number;
  total: number;
  shots: number;
}

export interface ChallengeRunProps {
  challenge: { id: string; name: string };
  startDate: Date;
  /** The run's day today; 0 before Day 1, when every square is still to
   * come and the card says when it starts instead. */
  currentDay: number;
  totalDays: number;
  /** A day's record, or null where there's none to show — left blank rather
   * than marked missed. */
  dayOf: (day: number) => RunDay | null;
  /**
   * `ink` is the solid block that stands out on its page. `quiet` is a
   * white card on the card shadow, for a page where the run is a footnote
   * rather than the lead: the type turns ink, the days still to come grey,
   * today's ring ink.
   */
  tone?: 'ink' | 'quiet';
  /** The era's lives, as hearts after the day; left out where the page
   * shows them already, as Tasks does over its list. */
  lives?: { left: number; total: number };
  /** A chevron at the end of the name, for a card that opens the era. */
  chevron?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * One day of the challenge as a square, on the card's ink: done in the
 * accent for where it sits in the run, half-filled for a day that got photos
 * but fell short, the muted grey for a day with nothing, a white ring for
 * today and a faint white wash for everything still to come.
 */
function DaySquare({
  state,
  color,
  size,
  quiet,
}: {
  state: SquareState;
  color: string;
  size: number;
  quiet?: boolean;
}) {
  const box = { width: size, height: size };
  const scheme = colorsFor(useColorScheme());
  const rest = quiet ? scheme.surfaceSunken : scheme.onInkFill;
  if (state === 'partial') {
    // Cut corner to corner, so half a day reads as half a square rather
    // than as a lighter shade of a whole one.
    return (
      <LinearGradient
        colors={[color, color, rest, rest]}
        locations={[0, 0.5, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.square, box]}
      />
    );
  }
  return (
    <View
      style={[
        styles.square,
        quiet && styles.squareQuiet,
        box,
        state === 'done' && { backgroundColor: color },
        state === 'missed' && (quiet ? styles.squareMissedQuiet : styles.squareMissed),
        state === 'today' && (quiet ? styles.squareTodayQuiet : styles.squareToday),
      ]}
    />
  );
}

const shortDate = (date: Date) =>
  date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const dateLabel = (date: Date) =>
  date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

/**
 * The challenge you're on, drawn as the whole run — one square a day — on a
 * block of ink (or, `quiet`, a white card), with its name and dates over
 * it. The profile shows it quiet, as the way into the era's page.
 */
export function ChallengeRun({
  challenge,
  startDate,
  currentDay,
  totalDays,
  dayOf,
  tone = 'ink',
  lives,
  chevron,
  style,
}: ChallengeRunProps) {
  const quiet = tone === 'quiet';
  const [squaresWidth, setSquaresWidth] = useState(0);

  const endDate = new Date(startDate.getTime() + (totalDays - 1) * DAY_MS);
  const photo = challengeStrip(challenge.id)[0];

  const squares = useMemo(
    () =>
      Array.from({ length: totalDays }, (_, index): SquareState => {
        const day = index + 1;
        if (day === currentDay) return 'today';
        if (day > currentDay) return 'ahead';
        const record = dayOf(day);
        if (!record) return 'ahead';
        if (record.done >= record.total) return 'done';
        return record.shots ? 'partial' : 'missed';
      }),
    [totalDays, currentDay, dayOf],
  );

  // Fifteen across, cut to whatever width the card leaves — worked out from
  // the measured row rather than a percentage, which `gap` would push over.
  const squareSize =
    squaresWidth > 0 ? (squaresWidth - layout.grid * (SQUARES_PER_ROW - 1)) / SQUARES_PER_ROW : 0;

  return (
    // Read out as one line; where it opens something — the profile's — the
    // button round it says so.
    <View
      accessible
      accessibilityLabel={`${challenge.name}, ${currentDay < 1 ? 'starts' : `day ${currentDay} of ${totalDays},`} ${dateLabel(startDate)} to ${dateLabel(endDate)}${lives ? `, ${lives.left} of ${lives.total} lives left` : ''}`}
      style={[styles.card, quiet && styles.cardQuiet, style]}
    >
      <View style={styles.row}>
        <Image source={photo} style={styles.thumb} contentFit="cover" />
        <View style={styles.text}>
          {/* The name, with the chevron at the row's end on a card that
              opens the era. */}
          <View style={styles.line}>
            <Text
              variant="copyBold"
              color={quiet ? colors.ink : colors.inkInverse}
              numberOfLines={1}
              style={styles.grow}
            >
              {challenge.name}
            </Text>
            {chevron ? (
              <Ionicons name="chevron-forward" size={CHEVRON} color={colors.inkMuted} />
            ) : null}
          </View>
          {/* The day, with the lives at the line's far end, under the
              chevron — both say where the run stands today. */}
          <View style={styles.line}>
            <Text variant="meta" color={colors.inkMuted} numberOfLines={1} style={styles.grow}>
              {/* Before Day 1 there's no day to count yet — only how long the
                  run is, every square still to come. */}
              {currentDay < 1 ? `${totalDays} days` : `Day ${currentDay} of ${totalDays}`}
            </Text>
            {lives ? (
              // Spent lives stay as hollow-grey hearts, so the allowance reads
              // whole: two of three, not just two.
              <View style={styles.hearts}>
                {Array.from({ length: lives.total }, (_, i) => (
                  <Ionicons
                    key={i}
                    name="heart"
                    size={HEART}
                    color={
                      i < lives.left
                        ? quiet
                          ? colors.ink
                          : colors.inkInverse
                        : quiet
                          ? colors.inkGhost
                          : colors.inkMuted
                    }
                  />
                ))}
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {/* Read out once, in the card's own label — seventy-five squares one
          by one is noise to a screen reader. */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        onLayout={(e) => setSquaresWidth(e.nativeEvent.layout.width)}
        style={styles.squares}
      >
        {squareSize > 0
          ? squares.map((state, index) => (
              <DaySquare
                key={index}
                state={state}
                // Coloured by where the day sits in the run, the way the
                // profile ring's sweep is read off where a segment sits —
                // peach early on, lavender only near the end.
                color={accentAt((index + 0.5) / squares.length)}
                size={squareSize}
                quiet={quiet}
              />
            ))
          : null}
      </View>

      {/* The run's two ends under the squares that span it: the first day
          under the first square, the last under the last. */}
      <View style={styles.dates}>
        <Text variant="meta" color={colors.inkMuted} numberOfLines={1}>
          {shortDate(startDate)}
        </Text>
        <Text variant="meta" color={colors.inkMuted} numberOfLines={1}>
          {shortDate(endDate)}
        </Text>
      </View>
    </View>
  );
}

export default ChallengeRun;

const styles = StyleSheet.create({
  // Ink rather than the fill grey, so the run you're on is the one solid
  // block on the page; the accent squares read brightest against it.
  card: {
    padding: layout.card,
    gap: layout.heading,
    borderRadius: radii.card,
    backgroundColor: colors.ink,
  },
  // A white card lifted on the card shadow — clear of the grey task rows
  // above it, without the ink block's weight. Its corner is the system
  // list's rather than the signature 32: on a profile it sits among plain
  // text and photos, where the rounder corner read as a bubble.
  cardQuiet: {
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.inline,
  },
  hearts: {
    flexDirection: 'row',
    gap: layout.line / 2,
  },
  thumb: {
    width: CHALLENGE_THUMB,
    height: CHALLENGE_THUMB,
    borderRadius: radii.sm,
  },
  text: {
    flex: 1,
  },
  // One of the two lines beside the photo, with what trails it on the same
  // line's far end — the chevron after the name, the hearts after the day.
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.stack,
  },
  grow: {
    flex: 1,
  },
  // A heading's gap under the squares is the card's own; the dates sit a
  // line's gap off them, as captions of the row rather than a block of
  // their own.
  dates: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: layout.line - layout.heading,
  },
  squares: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: layout.grid,
  },
  square: {
    borderRadius: SQUARE_RADIUS,
    backgroundColor: colors.onInkFill,
  },
  squareMissed: {
    backgroundColor: colors.inkMuted,
  },
  // On the white: days to come the fill grey, a day with nothing the
  // not-yet grey.
  squareQuiet: {
    backgroundColor: colors.surfaceSunken,
  },
  squareMissedQuiet: {
    backgroundColor: colors.inkGhost,
  },
  squareTodayQuiet: {
    borderWidth: SQUARE_TODAY_BORDER,
    borderColor: colors.ink,
  },
  squareToday: {
    borderWidth: SQUARE_TODAY_BORDER,
    borderColor: colors.inkInverse,
  },
});
