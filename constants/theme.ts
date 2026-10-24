import { DynamicColorIOS, Platform, type NativeColorValue } from 'react-native';

/**
 * Selfera — design tokens.
 *
 * Colours were sampled directly out of the reference screenshots
 * (reference/screens/**) rather than estimated. Nothing in components/ or
 * app/ may hardcode a colour, radius, shadow or font family — pull it from
 * here so the whole surface moves together.
 */

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

/**
 * The app's core five, settled on My Profile: black and white, one grey for
 * secondary text people still have to read, one lighter grey for what isn't
 * there yet or can't be used, and one grey for fills. A page built from these
 * alone matches the profile; the semantic tokens below point at them rather
 * than repeating the codes, so a change here moves every screen at once.
 */
export const palette = {
  black: '#141414',
  white: '#FFFFFF',
  /** Secondary text and icons: a handle, a caption, a date that has passed. */
  greyDark: '#9C9C9C',
  /** Not yet or not available: a date still to come, an unfinished segment,
   * a disabled arrow, the rows a picker hasn't landed on. */
  greyLight: '#D7D6D3',
  /** Fills: cards, calendar cells, tracks, a picker's selection band. */
  greyFill: '#F2F2F2',
  /** The one red: danger — a destructive row or button, the action that
   * can't be taken back — and a heart you've left on a post. Nothing else
   * is red. */
  red: '#E63950',
} as const;

/**
 * The same roles after dark. The iPhone follows the phone's own appearance,
 * and these are what each role turns into there: the page goes to black, the
 * cards and fills to the system's raised greys, and ink to near-white — so
 * everything filled with ink (the run card, a done tick, a solid pill) turns
 * light and the type on it turns dark, the pair swapping together. Type laid
 * on a photo is `onMedia`, which stays white either way. Android and the web
 * stay light.
 */
const DARK = {
  backgroundPlain: '#000000',
  backgroundAlt: '#000000',
  surface: '#1C1C1E',
  surfaceMuted: '#2C2C2E',
  surfaceSunken: '#2C2C2E',
  surfaceInput: '#1C1C1E',
  ink: '#F5F5F5',
  inkSoft: '#D1D1D6',
  inkMuted: '#8E8E93',
  inkGhost: '#48484A',
  inkInverse: '#141414',
  systemAccent: '#0A84FF',
  onInkFill: 'rgba(0,0,0,0.08)',
  field: '#3A3A3C',
  divider: '#2C2C2E',
  sunkenRule: '#3A3A3C',
  sheetRule: '#242426',
  destructive: '#FF5A6E',
  liked: '#FF5A6E',
  disabled: '#2C2C2E',
  disabledInk: '#636366',
  scrimLight: 'rgba(0,0,0,0.5)',
  frostBackdrop: 'rgba(0,0,0,0.3)',
  slotEdge: '#636366',
  inkAside: '#636366',
} as const;

const LIGHT = {
  /** The page every screen sits on. */
  backgroundPlain: palette.white,
  /** The settings stack's page: the palette's fill grey, so the white groups
   * on it read as cards while the screen keeps to the profile's colours. */
  backgroundAlt: palette.greyFill,

  /** Cards, the tab bar, circular icon buttons. */
  surface: palette.white,
  /** Inset panels: the invite card, "Create Daily Task+" well. */
  surfaceMuted: '#F1F0EA',
  /** Empty photo slots and "add" tiles on the wall. */
  surfaceSunken: palette.greyFill,
  /**
   * A search field's own fill, sitting straight on the page's own white
   * rather than the warm shell `surfaceSunken` was tuned against — held to a
   * lighter, barely-there sink so it doesn't read as a grey block on white.
   */
  surfaceInput: '#F5F5F5',

  /** Primary text and the solid pill buttons. */
  ink: palette.black,
  /** Softer body copy. */
  inkSoft: '#3A3A3A',
  /** Timestamps, placeholders, inactive tab labels, review bodies. */
  inkMuted: palette.greyDark,
  /**
   * The greyed-out half of the Discover/Friends switch — barely there, but a
   * touch heavier than a hairline. Sampled from the same screen.
   */
  inkGhost: palette.greyLight,
  /** Text on dark fills. */
  inkInverse: palette.white,
  /**
   * The iPhone's accent: Apple's system blue, the colour its own apps tint
   * their buttons, sliders, pickers and bar items in. Not the selected tab,
   * and not a calendar's month, which stay ink. Only the iPhone's system
   * controls take it — Android and the web keep ink, since the drawn look
   * has no accent of its own.
   */
  systemAccent: '#007AFF',
  /**
   * A second button sitting on an `ink` card beside a white one — Find
   * friends' Show code next to Share link. White held to a seventh, so it
   * reads as a lighter patch of the card rather than a grey button of its own.
   */
  onInkFill: 'rgba(255,255,255,0.14)',

  /** Text input fills and unselected control strokes. */
  field: '#CDCDCD',
  /** Hairlines, and the light pill behind the active tab. */
  divider: '#E9E8E2',
  /**
   * The seam between rows of a `surfaceSunken` card — the rules card's terms.
   * White on the light grey; in dark mode a step lighter than the card rather
   * than `surface`, which there sits darker and drew the seams as black lines.
   */
  sunkenRule: palette.white,

  /**
   * The rule across a sheet over its composer (Comments), edge to edge at a
   * full point — a step past the fill grey, which at that weight on the
   * sheet's white all but vanished; in dark mode just off the sheet's own
   * grey.
   */
  sheetRule: '#EEEEEE',

  /**
   * Destructive rows and the Restart action. A saturated red rather than the
   * washed-out pink it started as — it has to read as a warning at a glance.
   */
  destructive: palette.red,

  /** A heart you've left on a post or a story — the palette's red, the one
   * other place it's allowed, since a like is everywhere read as red. */
  liked: palette.red,


  /** Disabled primary button fill / label. */
  disabled: '#EDEBE6',
  disabledInk: palette.greyDark,



  /** Scrims. */
  scrim: 'rgba(0,0,0,0.45)',
  /** `palette.black` (#141414) at 18% — the dim behind a dialog. */
  scrimLight: 'rgba(20,20,20,0.18)',
  /**
   * The wash under a numeral or label printed straight onto a photo, where
   * there is no room for a plate behind it — the calendar's day numbers. Held
   * to a third so the picture still reads through it, which is as light as it
   * can go and still carry white text over a sunlit shot.
   */
  scrimPhoto: 'rgba(0,0,0,0.34)',
  /**
   * A locked photo's own scrim — past the canvas's quarter, which read too
   * light on a phone. The hiding is done by
   * the photo's blur, which a locked post applies to the image itself on
   * every platform; this only settles the blur back so the white lock pill
   * reads over it. `ink`'s own tone rather than flat black, so it still reads
   * as this app's own shadow and not a generic overlay.
   */
  scrimLock: 'rgba(20,20,20,0.45)',

  /** The barely-there dim behind a popover; the lens does the rest. */
  frostBackdrop: 'rgba(0,0,0,0.04)',

  /**
   * Full-bleed media surfaces — the story viewer, the camera, the black
   * transition behind a pushed photo route. Deliberately pure black rather than
   * the warm shell: the photo has to be the only light on the screen.
   */
  mediaBackdrop: '#000000',
  /** Secondary copy over a photo — white, pulled back so it recedes. */
  onMediaSoft: 'rgba(255,255,255,0.8)',
  /** Unfilled half of a progress track over a photo. */
  onMediaTrack: 'rgba(255,255,255,0.4)',
  /** Ring around the shutter — white held off full strength so the solid
   * button inside still reads as the brighter of the two. */
  onMediaBorder: 'rgba(255,255,255,0.55)',
  /** The soft drop under white type laid on a photo — just enough to lift it
   * off a bright patch of the shot without reading as an outline. */
  onMediaShadow: 'rgba(0,0,0,0.35)',
  /** Type and glyphs laid straight on a photo or the camera's black — white
   * in light and dark alike, since the picture under it doesn't change. */
  onMedia: palette.white,
  /** A tick on a filled choice — `systemAccent` on the iPhone, ink elsewhere
   * — white in light and dark alike, as on the system's own blue controls. */
  onAccent: palette.white,
  /** `onInkFill`'s white seventh, held on the camera's black where the ink
   * card's version would turn dark with the rest of the app. */
  onMediaFill: 'rgba(255,255,255,0.14)',
  /**
   * The time printed on each of a post's photos as it opens — white with
   * only a breath of warmth, the reference cover's cream (#F9F7E6) taken
   * most of the way to white so it reads as paper, not yellow. The same in
   * light and dark alike: it sits on photos, which don't change with the
   * phone's appearance.
   */
  seal: '#FCFCF7',
  /** The soft dark pool behind a cover's day and era name, so the white
   * script holds over a bright photo — drawn as a fading gradient, the
   * colour here at its centre. */
  coverShade: palette.black,
  /** The tight drop under a cover's day and era name — darker than the
   * soft `onMediaShadow`, since it's drawn close in and has to hold white
   * over a bright photo on its own. The same in light and dark. */
  coverLetteringShadow: 'rgba(0,0,0,0.55)',
  /** The dashed edge of an open slot in Tasks' post — between `inkGhost`,
   * which vanishes on the slot's grey, and `inkMuted`, which reads as a
   * drawn box rather than a place a photo goes. */
  slotEdge: '#B5B4B1',
  /** A count set beside a section heading — "3 of 6 friends" on Community.
   * The same step between `inkGhost` and `inkMuted` as `slotEdge`: at the
   * reading grey it competed with the heading, at the ghost grey it faded
   * out. */
  inkAside: '#B5B4B1',
  /** The time and task across a posted photo's middle — white, as the
   * cover's lettering before them is. The same in light and dark, since it
   * sits on photos. */
  shotStamp: palette.white,
  /** The faint drop under that yellow — barely there, only enough to keep
   * it from washing out on a bright shot. */
  shotStampShadow: 'rgba(0,0,0,0.2)',
} as const;

type Role = keyof typeof LIGHT;

/**
 * A theme colour: a plain string, or on the iPhone the adaptive native value.
 * Narrower than React Native's `ColorValue`, which since RN 0.88 also allows
 * null and a number — values the theme never holds, and that icon and SVG
 * colour props refuse.
 */
export type ThemeColor = string | NativeColorValue;

/** A role's colour: on the iPhone one that follows the phone's appearance by
 * itself, wherever it is used; elsewhere the light one. */
const adaptive = (role: Role): ThemeColor => {
  const dark = (DARK as Partial<Record<Role, string>>)[role];
  return Platform.OS === 'ios' && dark
    ? (DynamicColorIOS({ light: LIGHT[role], dark }) as NativeColorValue)
    : LIGHT[role];
};

export const colors = Object.fromEntries(
  (Object.keys(LIGHT) as Role[]).map((role) => [role, adaptive(role)]),
) as Record<Role, ThemeColor>;

/**
 * Each role as a plain string for one appearance, for the few places that
 * can't take an adaptive colour — a SwiftUI control's tint, a gradient's
 * stops — and so pick by `useColorScheme()` themselves.
 */
export const colorsFor = (scheme: string | null | undefined): Record<Role, string> =>
  scheme === 'dark' && Platform.OS === 'ios' ? { ...LIGHT, ...DARK } : { ...LIGHT };

/**
 * Each appearance as the Theme page's little phone draws it, whatever
 * the app is showing now — the dark phone stays dark on a light page, and
 * on Android, which has no dark colours of its own. Taken from the same two
 * maps the app itself runs on, so the preview is what you'd get.
 */
export const appearancePreview = {
  light: {
    page: LIGHT.backgroundPlain,
    block: LIGHT.surfaceSunken,
    bar: LIGHT.ink,
    line: LIGHT.inkMuted,
  },
  dark: {
    page: DARK.backgroundPlain,
    block: DARK.surface,
    bar: DARK.inkSoft,
    line: DARK.inkGhost,
  },
  /** The phone's own edge, light or dark — enough to hold the white one off
   * the white card. */
  edge: LIGHT.inkGhost,
} as const;

export const gradients = {
  /**
   * The app's one accent, the only colour that sits beside `palette`: peach
   * into rose into lavender, in the order it is drawn — clockwise round My
   * Profile's task ring from 12 o'clock, and left to right along the
   * challenge card's progress bar. Sampled off the profile mock the ring was
   * redrawn to; a pastel cousin of the story ring's orange-to-purple rather
   * than a copy of it, so the app reads as its own rather than Instagram's,
   * and sits with the post-it pastels instead of shouting over them. Reach
   * for it wherever something shows progress.
   */
  accent: ['#F7C3A0', '#EFA3B7', '#D8C6EE'],
  /**
   * The shade rising from the foot of a cover photo — Challenges' featured
   * card — clear through the top half so the picture keeps its colour, dark
   * enough at the bottom for white type to hold on any shot.
   */
  coverShade: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.68)'],
  /**
   * The faint fade under a post photo's task and time, at its foot — about
   * half the cover card's, since it only has to steady two small lines and
   * the photo is the post.
   */
  photoFoot: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.36)'],
} as const;

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

const QUICKSAND = {
  /**
   * Quicksand — body copy, buttons, labels, everything functional. A rounded
   * geometric sans, so it keeps the soft feel the reference gets from its
   * rounded bold cut, across every weight rather than just the heavy one.
   *
   * Quicksand runs optically lighter than the Helvetica it replaced, so each
   * role is mapped one step up the ramp to hold the weights in the reference
   * screenshots: plain copy sits on Medium, not Regular, and Regular is not
   * loaded at all.
   */
  body: 'Quicksand_500Medium',
  /** Same colour as `body`: the reference draws no medium/regular contrast. */
  bodyMedium: 'Quicksand_500Medium',
  /** Card titles and buttons — strong, but below the section-title bold. */
  bodySemi: 'Quicksand_600SemiBold',
  /** Section titles and the underlined tab rows. */
  bodyBold: 'Quicksand_700Bold',

  /**
   * Allura — the day written across the middle of a day's cover, the way
   * the reference cover signs it: a light hand-lettered script over the
   * photos. Nothing else.
   */
  coverDay: 'Allura_400Regular',
  /**
   * Inter Tight — the rest of a day's cover but its wordmark: the era's
   * name under the day and each photo's time — and the time and task on a
   * post's own photo slides, so they match it. A plain, closely set sans
   * that stays legible at the cover's very small sizes.
   */
  cover: 'InterTight_400Regular',
  /** Inter Tight Medium — the time and task on a post's photo slides. */
  coverMedium: 'InterTight_500Medium',
  /** Inter Tight SemiBold — the era's name under the day. */
  coverBold: 'InterTight_600SemiBold',
  /** Inclusive Sans Bold — only the "selfera" mark at a cover's foot and
   * a post's photos', so the brand keeps a face of its own; Bold holds it
   * over the photos while its opacity keeps it quiet. */
  brandMark: 'InclusiveSans_700Bold',
} as const;

export const fonts = QUICKSAND;

/** Each role's face as a style. */
const face = {
  body: { fontFamily: fonts.body },
  bodyMedium: { fontFamily: fonts.bodyMedium },
  bodySemi: { fontFamily: fonts.bodySemi },
  bodyBold: { fontFamily: fonts.bodyBold },
};

/**
 * Tracking for anything set in Quicksand. The face sets wider than the
 * reference's rounded cut, so every Quicksand string is pulled a point tighter,
 * headlines included. Components that build their own Quicksand style — text
 * inputs, the oversized Discover/Friends labels — pull this rather than
 * repeating the number.
 */
export const bodyTracking = -1;

/**
 * The type hierarchy, settled on My Profile and Settings: eight levels, each
 * one a clear step from the next in size or weight, so a screen reads top
 * down instead of as a scatter of near-identical sizes. Quicksand runs light,
 * so nothing sits below SemiBold. The `type` scale below exposes each level
 * by name, and the older variants that meant the same thing point here
 * rather than keeping their own numbers.
 */
export const hierarchy = {
  /** The screen's own title and the person it belongs to: "My Profile",
   * "Settings", the name under the avatar. */
  pageTitle: {
    ...face.bodyBold,
    fontSize: 23,
    lineHeight: 28,
    letterSpacing: bodyTracking,
  },
  /** A section inside the page: "Days", a month's name, a sheet's or a
   * dialog's title, a picker's values. */
  sectionHeading: {
    ...face.bodyBold,
    fontSize: 21,
    lineHeight: 27,
    letterSpacing: bodyTracking,
  },
  /** The name of one thing on the page: the challenge card's title. */
  itemTitle: {
    ...face.bodyBold,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: bodyTracking,
  },
  /** Reading text and list rows: a bio, a settings row's label, a switch's
   * labels, a dialog's message. */
  copy: {
    ...face.bodySemi,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: bodyTracking,
  },
  /** `copy` a weight up, for the word inside reading text that leads it: the
   * author's handle at the head of a post's caption. */
  copyBold: {
    ...face.bodyBold,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: bodyTracking,
  },
  /** Supporting detail next to something bigger: a handle, a settings row's
   * value, a group's title. */
  meta: {
    ...face.bodySemi,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: bodyTracking,
  },
  /** Supporting detail that carries a number people look for: "Day 5 / 75",
   * a calendar date. */
  metaBold: {
    ...face.bodyBold,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: bodyTracking,
  },
  /** The smallest thing on a page: a count on a pill or a tile, a weekday
   * letter, a mark in a calendar cell. */
  badge: {
    ...face.bodyBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: bodyTracking,
  },
} as const;

/**
 * Type scale. Headline sizes track the reference closely: the standard
 * question headline is ~34px on a 1170pt-wide render, section titles ~26px.
 * Headlines are set in Quicksand's heaviest cut like everything else — the app has no separate display face; size alone
 * is what sets a headline apart.
 */
export const type = {
  // The hierarchy's levels, by name — reach for these first.
  pageTitle: hierarchy.pageTitle,
  sectionHeading: hierarchy.sectionHeading,
  itemTitle: hierarchy.itemTitle,
  copy: hierarchy.copy,
  copyBold: hierarchy.copyBold,
  meta: hierarchy.meta,
  metaBold: hierarchy.metaBold,
  badge: hierarchy.badge,

  /** A short muted line that carries a screen's message rather than detail —
   * a fresh profile's "Join an era…", "Friends scan it to add you" under
   * the share card — between `meta` and `copy`: a step up from detail so it
   * reads as the message, a step short of the title over it. */
  note: {
    ...face.bodySemi,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: bodyTracking,
  },

  /** Small print under a group of settings — what its rows do — at the
   * footnote size the Settings app sets its own in, a step under `meta` so
   * it reads as a note on the card, not another row. */
  footnote: {
    ...face.bodySemi,
    fontSize: 13,
    lineHeight: 17,
    letterSpacing: bodyTracking,
  },

  headline: {
    ...face.bodyBold,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: bodyTracking,
  },
  headlineSm: {
    ...face.bodyBold,
    fontSize: 27,
    lineHeight: 33,
    letterSpacing: bodyTracking,
  },
  title: {
    ...face.bodyBold,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: bodyTracking,
  },

  sectionTitle: hierarchy.pageTitle,
  cardTitle: {
    ...face.bodySemi,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: bodyTracking,
  },
  /** `cardTitle`'s own size, stepped up to true Bold — a sheet heading that
   * wants more weight than the ambient Semi carries without reading as a
   * bigger title than it is. */
  cardTitleBold: hierarchy.itemTitle,
  body: {
    ...face.body,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: bodyTracking,
  },
  bodyStrong: {
    ...face.bodyMedium,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: bodyTracking,
  },
  bodyBold: hierarchy.copyBold,
  button: {
    ...face.bodySemi,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: bodyTracking,
  },
  label: {
    ...face.bodyMedium,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: bodyTracking,
  },
  /**
   * `label`, one step up the weight ramp — the mosaic tile's task name, which
   * has to hold its own printed over a photo rather than sitting on plain
   * background the way most `label` copy does.
   */
  labelBold: hierarchy.meta,
  micro: {
    ...face.bodyMedium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: bodyTracking,
  },
  /** A step up from `micro` — the interaction counts on the profile grid's
   * own post tiles, which need to hold their own printed straight onto a
   * photo rather than fade into it. The heaviest cut Quicksand has: anything
   * lighter washes out again against a busy photo at this size. */
  microBold: hierarchy.badge,
  /**
   * The ❤️ that pops over a post on a double tap. An emoji draws taller than
   * a line of text at the same size, so the line is opened well past the
   * size — at a text leading the heart's top was clipped off its own box.
   */
  burst: {
    ...face.bodyBold,
    fontSize: 44,
    lineHeight: 60,
  },
  /**
   * A day's cover, set at the cover's own card width and scaled with it.
   * The day in Allura across the middle — a script runs small for its
   * size, so it's set well over the size of the era's name.
   */
  coverDay: {
    fontFamily: fonts.coverDay,
    fontSize: 22,
    lineHeight: 28,
    // Drawn in, so the script runs as one stroke.
    letterSpacing: -0.75,
  },
  /** The era's name under the day — set exactly as a post's photo slides
   * set their time and task (`shotTitle`), so the cover and the slides
   * after it read as one hand. The cover is laid out 280 wide and scaled
   * to the phone, so each of `shotTitle`'s numbers is taken down by a
   * 390pt phone's scale to land at the same size on screen. */
  coverEra: {
    fontFamily: fonts.coverMedium,
    fontSize: (14 * 280) / 390,
    lineHeight: (19 * 280) / 390,
    letterSpacing: (-0.4 * 280) / 390,
  },
  /** Each photo's time, very small, in the middle of every shot. The task
   * isn't on the cover — at this size it can't be read, and which task a
   * photo is belongs to the photo's own slide. Not pulled in at
   * the body's tracking: this small, a tighter line runs together. */
  coverCaption: {
    fontFamily: fonts.cover,
    fontSize: 7.5,
    lineHeight: 10,
    letterSpacing: 0,
  },
  /** "selfera" at the cover's foot — a maker's mark a step over the era
   * name, held back by its opacity rather than by being smaller. On a
   * cover scaled to a 390pt phone's width it shows at about 15. */
  coverMark: {
    fontFamily: fonts.brandMark,
    fontSize: 11,
    lineHeight: 15,
    // Drawn in, so the word sets as one wordmark rather than spelled out.
    letterSpacing: -0.75,
  },
  /** The task a photo in Tasks' post proves and the time it was shot, at
   * its foot like a camera's date stamp — in Quicksand Bold, as the posted
   * day's own slides set theirs; the cover's face stays the cover's. Both
   * lines at one size: the task leads by coming first, not by being
   * bigger. */
  shotCaption: {
    ...face.bodyBold,
    fontSize: 13,
    lineHeight: 17,
    letterSpacing: bodyTracking,
  },
  /** The time over the task across a posted photo's middle — the cover's
   * Inter Tight in its Medium, so a post's slides and its cover read as
   * one set; small, both lines at one size, so it stays a caption over the
   * shot rather than a headline across it. */
  shotTitle: {
    fontFamily: fonts.coverMedium,
    fontSize: 14,
    lineHeight: 19,
    // Drawn in a touch, as a video's typed caption sets.
    letterSpacing: -0.4,
  },
  tab: {
    ...face.bodyMedium,
    fontSize: 12,
    lineHeight: 15,
    letterSpacing: bodyTracking,
  },
} as const;

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 56,
  '6xl': 72,
} as const;

/** Standard horizontal page gutter. */
/** The page's side margin: the iPhone's own layout margin there — the inset
 * its lists, bars and search fields keep from the edge — and the app's
 * roomier 20 elsewhere. */
export const screenPadding = Platform.OS === 'ios' ? 16 : 20;

/** Breathing room between the status bar and the first thing on a screen. */
export const screenTopGap = 20;

/**
 * Spacing by role, settled on My Profile and Settings. `spacing` is the ruler;
 * these say which mark to use for what, so the same kind of gap is the same
 * size wherever it turns up instead of whichever step looked right that day.
 * Reach for a role first; a bare `spacing` step is for an optical nudge.
 */
export const layout = {
  /** The page's side margin. */
  gutter: screenPadding,
  /** Under the page's title row, before its first content. */
  title: spacing.xl,
  /** Between the big blocks of a page: the challenge card, "Days", a
   * settings group, the month below the grid. */
  section: spacing['2xl'],
  /** Between elements inside one block: avatar to name, a sheet's title,
   * wheel and button, a month's name to its weekdays. */
  block: spacing.lg,
  /** From a heading to what it heads: "Days" to the grid, a group's title
   * to its card. */
  heading: spacing.md,
  /** Between things stacked inside a card: the challenge name row and its
   * bar, a weekday row and the dates under it. */
  stack: spacing.sm,
  /** Between two lines of text that belong together: a handle and the bio. */
  line: spacing.xs,
  /** Between things side by side on one row: a name and its day count, a
   * row's value and its chevron. */
  inline: spacing.md,
  /** Inside a card or a list row, every side. */
  // Inside a card or row: on the iPhone the 16 its list rows keep.
  card: Platform.OS === 'ios' ? spacing.lg : spacing.xl,
  /** Either side of a pill's label: a count badge, a tile's "3/5". */
  pill: spacing.sm,
  /** Between tiles in a grid: the day posts, the calendar's cells. */
  grid: spacing.xs,
} as const;

/** The smallest thing a finger should have to hit: Apple's 44pt. A glyph or
 * a word drawn smaller than this keeps its size and reaches it through
 * `tapSlop`. */
export const minTap = 44;

/** The `hitSlop` that grows something `size` across out to `minTap` on every
 * side — nothing for anything already that big. */
export const tapSlop = (size: number) => Math.max(0, (minTap - size) / 2);

export const radii = {
  sm: 10,
  md: 16,
  /** A grouped card's corner: on the iPhone the system list's own, so a card
   * drawn by the app matches the native lists beside it — the rounder one
   * liquid glass brought in iOS 26, 10 before that. */
  lg: Platform.OS === 'ios' ? (parseInt(String(Platform.Version), 10) >= 26 ? 26 : 10) : 20,
  /** The signature card radius. */
  card: 32,
  xl: 32,
  /** Anything fully rounded: buttons, chips, the tab bar. */
  pill: 999,
} as const;

/**
 * Height of the floating tab bar plus its bottom offset — scroll views add
 * this to their bottom inset so content clears the bar.
 */
export const tabBar = {
  height: 68,
  bottomOffset: 12,
  // Tighter than the page gutter on purpose: at 20 each of the four equal
  // cells was so narrow that "Community" ran almost into the active pill's
  // rounded end.
  horizontalInset: spacing.md,
} as const;

export const tabBarClearance =
  tabBar.height + tabBar.bottomOffset + spacing.lg;

/**
 * Distance from the bottom of the screen to the bottom edge of the floating tab
 * bar. The pill floats *over* the home-indicator area rather than above it —
 * clearing the whole inset lifted it well off the bottom edge — while a phone
 * with no indicator keeps the plain offset.
 */
export const tabBarBottom = (insetBottom: number) =>
  Math.max(insetBottom - spacing.xl, spacing.md) + tabBar.bottomOffset;

// ---------------------------------------------------------------------------
// Elevation
// ---------------------------------------------------------------------------

/**
 * Shadows in the reference are very soft and very low opacity — large blur,
 * small offset. Anything punchier reads wrong against the warm background.
 */
export const shadows = {
  /**
   * Close in and all but centred, so it shows on every edge instead of
   * pooling under one. Kept faint on purpose: the cards sit on a near-white
   * page, and anything heavier reads as a drawn outline rather than depth.
   */
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  /** The same cast, a step down: icon buttons, floating pills, photo tiles. */
  soft: {
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  floating: {
    shadowColor: '#000000',
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  /**
   * Liquid glass sits *on* the photo rather than on the warm background, so it
   * casts a tighter, cooler shadow than the card shadows above — enough to
   * lift the lens off the image without smudging it.
   */
  glass: {
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  /**
   * `soft` pulled in close, for the round buttons in a screen's fixed header
   * bar. The bar leaves only a stack's gap under them before the page
   * scrolls in, and `soft`'s blur reaches past that, so its lower edge was
   * sliced off flat. This one fades out inside the gap.
   */
  header: {
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  /**
   * A dropped cast rather than a centred one: the same soft, neutral blur as
   * `card`, weighted downward so the thing casting it reads as lifted off the
   * page. The avatar, the "Day N" badge, the task photos and the wall tiles
   * use it. Measured off the reference, where those photos carry about 7% at
   * their sides and half again as much underneath.
   */
  hard: {
    shadowColor: '#000000',
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
} as const;

// ---------------------------------------------------------------------------
// Liquid glass
// ---------------------------------------------------------------------------

/**
 * The iOS 26 "liquid glass" material — a live lens rather than a tinted card.
 * Three layers stack to make it read as a physical piece of glass:
 *
 *   1. a real backdrop blur, so whatever sits behind melts and shows through,
 *   2. a vertical body wash that is brightest at the lit top edge, thinnest
 *      through the middle, and lifts again at the bottom where light bounces
 *      back up off the surface underneath,
 *   3. a specular rim that catches light on the top-left and bottom-right
 *      corners and dims across the middle of each edge.
 *
 * Every value is alpha-only on white: the material has no colour of its own,
 * it borrows whatever it floats over. That is what keeps it looking like glass
 * over a dark photo *and* over a light one.
 */
export const glass = {
  /**
   * Backdrop blur strength. Enough that the photo behind smears into colour
   * fields, not so much that it flattens to a single tone — you should still
   * be able to tell a dark card edge from a bright tortilla through the lens.
   * On web this also sets the tint opacity (expo-blur couples the two), which
   * is why `sheen` below stays restrained.
   */
  blur: 46,
  /**
   * The thinnest of Apple's light materials — the one liquid glass is actually
   * built on. Plain `light` is UIBlurEffectStyleLight, which frosts over far
   * too much to see through. On web both map to the same wash, so this is a
   * free win on iOS. The unsuffixed material follows the phone's
   * appearance, going dark with the rest of the app.
   */
  tint: 'systemUltraThinMaterial',
  /** Thickness of the specular edge, in px. Below ~1.5 it stops reading. */
  rimWidth: 1.5,
  /** Body wash, top to bottom. */
  sheen: [
    'rgba(255,255,255,0.42)',
    'rgba(255,255,255,0.12)',
    'rgba(255,255,255,0.28)',
  ],
  /**
   * Specular edge, run corner-to-corner so the highlight travels around the
   * rim: hot at top-left, falling away through the middle, catching again at
   * bottom-right. A flat white border reads as a stroke; this reads as glass.
   */
  rim: [
    'rgba(255,255,255,0.95)',
    'rgba(255,255,255,0.30)',
    'rgba(255,255,255,0.85)',
  ],
  /**
   * Flat stand-in for the blur. Android below API 31 and any platform where
   * the backdrop cannot be sampled falls back to this, so the badge stays
   * legible rather than disappearing into the photo.
   */
  fallback: 'rgba(255,255,255,0.42)',
} as const;

/**
 * RN 0.86 no longer types `StyleSheet.absoluteFillObject`; this is the
 * spreadable equivalent.
 */
export const absoluteFill = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
} as const;
