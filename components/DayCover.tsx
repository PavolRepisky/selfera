import { Image } from 'expo-image';
import { useState } from 'react';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

import { absoluteFill, colors, colorsFor, layout, type } from '@/constants/theme';
import { clock24 } from '@/lib/format';
import type { ImageSourcePropType } from '@/lib/imageSource';
import { MosaicArrangement } from './PhotoCollage';
import { Placeholder } from './Placeholder';
import { Text } from './Text';

/**
 * The width a cover is laid out at before it's scaled into its tile — the
 * size of a shared card, so the lettering keeps the proportions it was set
 * at whatever size of grid it lands in.
 */
const COVER_WIDTH = 280;
/** A post's shape, width over height: 3:4 upright, the BeReal frame — a
 * phone shot's own shape, so a single photo isn't cropped to a square,
 * while still short of a full-page photo in a feed of many posts. Shared
 * by the post on Community and its tile on a profile, so a day keeps one
 * shape wherever it shows. */
export const POST_RATIO = 3 / 4;
/** The shade behind the day and era name: a soft oval held close round
 * the two lines, darker at its heart than it was — the reference cover's,
 * which sits tight under its lettering rather than washing the middle. */
const SHADE_WIDTH = 190;
const SHADE_HEIGHT = 115;
/** How dark the shade is at its middle — enough to hold white script over a
 * bright photo, fading out before it reads as a patch. */
const SHADE_OPACITY = 0.85;
/** Halfway out, the shade still holds this share of its middle's darkness,
 * so it reads as an oval rather than a dark dot fading at once. */
const SHADE_HALFWAY = 0.65;
/** Whether that oval sits behind the lettering. */
const SHOW_SHADE = true;
/** The day's own drop, in the cover's layout: close in and
 * a touch below the letters, so it outlines them darkly rather than
 * glowing round them. */
const LETTERING_SHADOW_RADIUS = 2.5;
const LETTERING_SHADOW_OFFSET = { width: 0, height: 0.75 };
/** The photo slides' faint drop (4 blur, 1 down on screen), taken into the
 * cover's layout by a 390pt phone's scale — under the era name and the
 * wordmark. The wordmark on a slide is scaled up whole, its drop with it,
 * so the same numbers land the same there too. */
const SLIDE_SHADOW_RADIUS = (4 * COVER_WIDTH) / 390;
const SLIDE_SHADOW_OFFSET = { width: 0, height: COVER_WIDTH / 390 };
/** The era's name drawn up under the day: the script's line box leaves
 * room under its letters, and the name reads as the day's own when it
 * sits close. */
const ERA_DROP = 2;
/** "Selfera" at the foot, held back so it signs the cover without being
 * read before the day. */
const MARK_OPACITY = 0.6;
/** How far up from the foot it sits, in the cover's own layout — 14pt on a
 * post scaled to a 390pt phone, clear of the edge without floating off it. */
const MARK_INSET = (14 * COVER_WIDTH) / 390;

/** Whether the cover carries the day: "Day N/75" in script. The photos
 * stay undimmed — the shade and the lettering's own drop hold it. */
const SHOW_DAY = true;
/** Whether the era's name sits under the day. */
const SHOW_ERA = true;

/** Past this many photos a piece is too small to carry its time. */
const MAX_CAPTIONED = 6;
/** Scaled below this — a tile three to a row — the small print shrinks to
 * specks that read as noise, so a tile carries the day alone. */
const CAPTION_MIN_SCALE = 0.6;
/** Blur on the lettering's drop shadow — the day stamp's own. */
const CAPTION_SHADOW_RADIUS = 12;
/** Room either side of a caption inside its piece, at the card's width. */
const CAPTION_INSET = 6;

/** Handed to `Image`/`Placeholder` as often as the arrangement itself. */
const PIECE = { flex: 1 } as const;

export interface DayCoverCell {
  key: string;
  photo?: ImageSourcePropType | null;
  seed?: string | null;
  /** When the task was shot, "07:57" — laid over its photo. */
  time?: string;
  /** The task the photo proves — under its time, where `tasks` asks for it. */
  label?: string;
}

/** A shot's time as the app prints it everywhere — the cover and a post's
 * own photos alike — on the 24-hour clock: "07:57", whatever form it was
 * stored in. */
export const shotClock = (time: string) => clock24(time.trim());

export interface DayCoverProps {
  /** The day's photos, in its grid's order. */
  cells: readonly DayCoverCell[];
  day: number;
  /** The era's length — "/75" after the day. */
  totalDays?: number;
  /** Under the day: the era's name. */
  kicker: string;
  /** The cover's height over its width — 1 for a square tile, 4/3 for an
   * upright one. */
  ratio?: number;
  /** Each photo's time in its middle — only on a cover made to share, and
   * only when its switch is on; the app's own covers carry the photos and
   * the day alone. */
  times?: boolean;
  /** Each photo's task under its time — only on a cover made to share,
   * which is seen big enough to read it. */
  tasks?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * A finished day as its cover — the face a day wears in a grid, before it's
 * opened: its photos edge to edge with no seam; across the middle of the
 * cover the day in script over the era's name, on a soft shadow; and
 * "Selfera", faint, at its foot. A cover made to share can also carry each
 * photo's time, and its task, very small in its middle.
 *
 * Laid out at a fixed card width and scaled whole into whatever box it's
 * given, so a tile in any grid is a true miniature of the same cover.
 */
export function DayCover({
  cells,
  day,
  totalDays,
  kicker,
  ratio = 1,
  times = false,
  tasks = false,
  style,
}: DayCoverProps) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const { width, height } = box;
  const scale = width / COVER_WIDTH;
  const coverHeight = COVER_WIDTH * ratio;
  const small = scale < CAPTION_MIN_SCALE;
  const captioned = !small && cells.length <= MAX_CAPTIONED;
  // A plain string for the SVG — the same in light and dark, since it sits
  // on the photos.
  const shade = colorsFor('light').coverShade;

  return (
    <View
      style={[styles.root, style]}
      pointerEvents="none"
      onLayout={(e) => {
        const { width: w, height: h } = e.nativeEvent.layout;
        setBox({ width: w, height: h });
      }}
    >
      {width > 0 ? (
        <View
          style={[
            styles.inner,
            {
              width: COVER_WIDTH,
              height: coverHeight,
              // Centred on the box, then scaled about that centre — which
              // lands it exactly edge to edge.
              left: (width - COVER_WIDTH) / 2,
              top: (height - coverHeight) / 2,
              transform: [{ scale }],
            },
          ]}
        >
          <MosaicArrangement
            cells={cells}
            seam={0}
            renderCell={(cell) => (
              <View key={cell.key} style={PIECE}>
                {cell.photo ? (
                  <Image source={cell.photo} style={absoluteFill} contentFit="cover" />
                ) : (
                  <Placeholder seed={cell.seed ?? cell.key} radius={0} style={absoluteFill} />
                )}
                {captioned && ((times && cell.time) || (tasks && cell.label)) ? (
                  <View style={styles.caption}>
                    {times && cell.time ? (
                      <Text variant="coverCaption" color={colors.onMedia} style={styles.shadow}>
                        {shotClock(cell.time)}
                      </Text>
                    ) : null}
                    {tasks && cell.label ? (
                      <Text
                        variant="coverCaption"
                        color={colors.onMedia}
                        numberOfLines={2}
                        style={[styles.shadow, styles.centred]}
                      >
                        {cell.label}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
            )}
          />
          {SHOW_DAY ? (
            <View style={styles.middle}>
              {SHOW_SHADE ? (
                <Svg width={SHADE_WIDTH} height={SHADE_HEIGHT} style={styles.shade}>
                  <Defs>
                    <RadialGradient id="coverShade" cx="50%" cy="50%" rx="50%" ry="50%">
                      <Stop offset="0" stopColor={shade} stopOpacity={SHADE_OPACITY} />
                      <Stop offset="0.5" stopColor={shade} stopOpacity={SHADE_OPACITY * SHADE_HALFWAY} />
                      <Stop offset="1" stopColor={shade} stopOpacity={0} />
                    </RadialGradient>
                  </Defs>
                  <Ellipse
                    cx={SHADE_WIDTH / 2}
                    cy={SHADE_HEIGHT / 2}
                    rx={SHADE_WIDTH / 2}
                    ry={SHADE_HEIGHT / 2}
                    fill="url(#coverShade)"
                  />
                </Svg>
              ) : null}
              <Text variant="coverDay" color={colors.onMedia} style={styles.letteringShadow}>
                {totalDays ? `Day ${day}/${totalDays}` : `Day ${day}`}
              </Text>
              {SHOW_ERA ? (
                <Text
                  variant="coverEra"
                  color={colors.onMedia}
                  numberOfLines={1}
                  style={[styles.slideShadow, styles.centred, styles.era]}
                >
                  {kicker}
                </Text>
              ) : null}
            </View>
          ) : null}

          {small ? null : <CoverMark />}
        </View>
      ) : null}
    </View>
  );
}

/**
 * "Selfera", faint, centred at the foot — the cover's own mark, laid over
 * whatever box it's put in. `width` is that box's width: outside a cover
 * (a post's photo slides) the mark is scaled from the cover's own layout
 * width, so it lands at the size and inset the cover shows it at beside
 * it. Inside a cover, already scaled whole, it's left unset.
 */
export function CoverMark({ width }: { width?: number }) {
  const scale = width ? width / COVER_WIDTH : 1;
  // Scaling the word alone grows it about its own middle, so its foot drops
  // by half the growth — given back here, so it lands exactly where the
  // cover, scaled whole, puts it.
  const drop = (type.coverMark.lineHeight * (scale - 1)) / 2;
  return (
    <View pointerEvents="none" style={[styles.foot, { paddingBottom: MARK_INSET * scale + drop }]}>
      <Text
        variant="coverMark"
        color={colors.onMedia}
        style={[styles.mark, styles.slideShadow, scale !== 1 && { transform: [{ scale }] }]}
      >
        {/* All lower case, as a wordmark rather than the app's name in a
            sentence. */}
        selfera
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...absoluteFill,
    overflow: 'hidden',
  },
  inner: {
    position: 'absolute',
  },
  // A photo's time in the middle of its piece, as the reference prints it.
  caption: {
    ...absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: CAPTION_INSET,
  },
  shadow: {
    textShadowColor: colors.onMediaShadow,
    textShadowRadius: CAPTION_SHADOW_RADIUS,
  },
  letteringShadow: {
    textShadowColor: colors.coverLetteringShadow,
    textShadowOffset: LETTERING_SHADOW_OFFSET,
    textShadowRadius: LETTERING_SHADOW_RADIUS,
  },
  // The slides' own faint drop, scaled into the cover's layout like the
  // type it sits under.
  slideShadow: {
    textShadowColor: colors.shotStampShadow,
    textShadowOffset: SLIDE_SHADOW_OFFSET,
    textShadowRadius: SLIDE_SHADOW_RADIUS,
  },
  centred: {
    textAlign: 'center',
  },
  era: {
    marginTop: -ERA_DROP,
  },
  middle: {
    ...absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: layout.gutter,
  },
  // Centred behind the two lines, whatever their length.
  shade: {
    position: 'absolute',
  },
  foot: {
    ...absoluteFill,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  mark: {
    opacity: MARK_OPACITY,
  },
});

export default DayCover;
