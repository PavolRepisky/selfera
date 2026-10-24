# Design system reference

The rules live in `CLAUDE.md`. This is the catalogue: what each piece is, what
it takes, and how the pieces compose into a screen. Tokens are defined in
`constants/theme.ts`, which carries the reasoning behind each value.

---

## 1. Tokens

### Colour

Semantic names only — nothing is called `pink` or `grey200`.

Underneath them sits `palette`, the five codes My Profile is built from:
`black` #141414 · `white` #FFFFFF · `greyDark` #9C9C9C · `greyLight`
#D7D6D3 · `greyFill` #F2F2F2 — and `red` #E63950 for destructive actions only. The tokens that share those codes point at
the palette rather than repeating them (`ink`, `surface`, `backgroundPlain`,
`inkInverse`, `inkMuted`, `disabledInk`, `inkGhost`, `surfaceSunken`,
`backgroundAlt`, `destructive`), so
one edit there moves every screen. `palette` is only read inside `theme.ts`;
everywhere else keeps to the semantic names.

| group | tokens |
| --- | --- |
| Backgrounds | `backgroundPlain` `backgroundAlt` |
| Surfaces | `surface` (white) · `surfaceMuted` (inset panels) · `surfaceSunken` (empty photo slots) |
| Ink | `ink` · `inkSoft` · `inkMuted` · `inkGhost` (not yet / not available) · `inkInverse` |
| Lines | `field` · `divider` |
| State | `destructive` · `disabled` · `disabledInk` |
| Scrims | `scrim` · `scrimLight` · `scrimPhoto` · `scrimLock` |
| Media | `mediaBackdrop` · `onMediaSoft` · `onMediaTrack` · `onMediaBorder` · `onMediaShadow` |

`gradients.accent` —
peach #F7C3A0 into rose #EFA3B7 into lavender #D8C6EE, in drawing order — is
the app's one accent beside the palette, the colour of progress: My
Profile's task ring (swept round it) and the challenge card's bar.

### Type scale

The hierarchy comes first — `hierarchy` in `theme.ts`, eight levels exposed
as `Text` variants: `pageTitle` 23 Bold · `sectionHeading` 21 Bold ·
`itemTitle` 18 Bold · `copy` 16 SemiBold · `copyBold` 16 Bold · `meta` 14
SemiBold · `metaBold` 14 Bold · `badge` 12 Bold. My Profile and Settings are built from these alone;
`sectionTitle`, `cardTitleBold`, `bodyBold`, `labelBold` and `microBold` now
point at the matching level.

Headline cuts — Quicksand Bold: `headline` 34 · `headlineSm` 27 · `title` 30. There is no separate display face; size sets a headline apart.

Functional cuts — Quicksand: `cardTitle` 17 · `body` 16 · `bodyStrong` 16 ·
`button` 17 · `label` 14 · `micro` 11 · `tab` 12. And the drawn ones:
the cover's (`coverDay`, `coverEra`, `coverCaption`, `coverMark`, in Allura
and Inter Tight) and `burst` (the heart a double tap pops).

Tracking is baked into the scale: `bodyTracking` (-1) on every Quicksand
string, headlines included. A component building its own
Quicksand style pulls `bodyTracking` rather than repeating the number.

### Space, radius, elevation

`spacing` runs `xs` 4 · `sm` 8 · `md` 12 · `lg` 16 · `xl` 20 · `2xl` 24 ·
`3xl` 32 · `4xl` 40 · `5xl` 56 · `6xl` 72. The page gutter is `screenPadding`
(20); the gap under the status bar is `screenTopGap` (20).

On top of that ruler sits `layout`, spacing by role: `gutter` 20 · `title` 20 ·
`section` 24 · `block` 16 · `heading` 12 · `stack` 8 · `line` 4 · `inline` 12
· `card` 20 · `pill` 8 · `grid` 4. My Profile and Settings take every gap,
margin and padding from it; a bare `spacing` step is left for optical nudges.

`radii`: `sm` 10 · `md` 16 · `lg` 20 · `card`/`xl` 32 · `pill` 999.

`shadows` are all low-opacity and large-blur — see the selection table in
`CLAUDE.md`. Anything punchier reads as a drawn outline on the white page.

### Tab bar geometry

`tabBar` is `{ height: 68, bottomOffset: 12, horizontalInset: 20 }`.
`tabBarClearance` is what a scroll view adds to its bottom inset.
`tabBarBottom(insetBottom)` places things relative to the floating bar — the bar floats *over* the home-indicator area rather than
above it.

### Liquid glass

`glass` describes the iOS 26 material as three stacked layers: a real backdrop
blur (`blur` 46, `tint` ultra-thin), a vertical body wash (`sheen`) brightest at
the lit top edge, and a specular `rim` that catches at top-left and
bottom-right. Every value is alpha-only on white — the material has no colour of
its own, which is what keeps it reading as glass over both dark and light
photos. `fallback` is the flat stand-in where the backdrop can't be sampled.
Use `GlassSurface` rather than assembling the layers by hand.

---

## 2. Components

### Layout

**`Screen` / `ScreenScroll`** — `tone` `'plain'|'alt'` · `padded` (default
true) · `tabBar` · `header` · `style`. `header` is a title row that stays put
above the page on the header line; the page then starts a title's gap under
it. `ScreenScroll` also takes `bottomExtra`, a `ref` to the scroller, and any
`ScrollViewProps`.

**`ScreenHeader`** — `plainTitle` · `showBack` (default true; a tab root
passes false) · `right`. The row a screen's fixed `header` holds: the back
button, the title at `pageTitle` on the gutter, then the actions grouped at
the end. Its buttons are `cornerButtonSize` / `cornerIconSize` (46 / 22,
exported from `IconButton`), the size every corner button in the app shares.

**`ProfileView`** — a whole profile page, yours and anyone else's: the face in
its task ring, the name and bio, the challenge card, and the days as a grid of
posts or a month (`CalendarMonth`).

**`Card`** — `flat` (drops the shadow) · `radius` · `onPress`. A white
surface; the content sets its own padding.

**`EmptyState`** — `icon` · `title` · `hint` · `disc` (the glyph on a grey
disc) · `action` (`{label, onPress}`).

### Type

**`Text`** — `variant` (any key of the type scale) · `color` · `center`. The
only way text reaches the screen.

### Controls

**`PrimaryButton`** — `label` · `onPress` · `disabled` · `icon` (Ionicon) ·
`fullWidth` (default true; false for side-by-side pairs). `buttonHeight` (58)
is exported for a screen that docks one over its scroll.

**`IconButton`** — `name` · `size` · `iconSize` · `color` · `background` (a
flat fill instead of the lens) · `shadow` · `disabled` · `accessibilityLabel`.

**`Pill`** — `label` · `tone` `'floating'|'solid'|'muted'` · `size`
`'sm'|'md'|'lg'` (heights 28/38/48, exported as `pillHeights`) · `icon` ·
`trailingIcon` · `bold` · `labelVariant` · `onPress`.

**`SegmentedTabs<T>`** — `options` (`{key, label}`) · `value` · `onChange` ·
`size` `'sm'|'md'`. The pill switch: a sunken track with the selected half
riding a white chip, labels at `metaBold`.

**`SearchBar`** — `value` · `onChangeText` · `placeholder` · `tone`
`'outline'|'sunken'` · `rightIcon` / `onRightIconPress` · `onSubmit`.

**`RulerSlider`** — `length` · `index` · `onChange` · `readout` · `caption`,
firing a selection haptic as ticks cross the centre line.
**`WheelPicker`** — `values` · `value` · `onChange` · `format`: the iOS
date-wheel drum.

### Overlays

**`BottomSheet`** — `visible` · `onDismiss` · `handle` (default true) ·
`padded` · `bottomGap`. Every sheet pulls down from anywhere on it. A
vertical scroller inside wraps itself in `SheetScrollable`: a list hands the
pull to the sheet once it's scrolled to the top; `owned` (a wheel) keeps
every vertical drag for itself.

**`AlertDialog`** — `title` · `message` · `actions` (`{label, onPress,
destructive?}`) · optional `input` · `onDismiss`. Two actions sit side by
side; three or more stack.

**`PopoverMenu`** — `items` (`{label, onPress, destructive?}`) · `top`. Drops
from the corner button on the gutter and unfolds out of its top-right corner.

**`PhotoLibrarySheet`** — `visible` · `onPick` · `onDismiss`.
**`ChallengeLengthSheet`** wraps `RulerSlider`. **`CommentsSheet`** — a post's
thread with its composer.

**`PhotoViewer`** — `photos` · `index` · `onDismiss` · `actions`: photos blown
up one at a time over a dark blurred backdrop, swiped through.

### Content

**`CheckCircle`** — `size`. A finished task's mark: an ink disc with a white
tick. Only ever a report of what is done, never pressed.

**`TaskRing`** — `avatar` · `done` · `total` · `watched` · `size` · `onPress`.
A face inside the split task ring, one segment per task in the accent, with its
"3/5" badge — My Profile's hero and the Community stories row.

**`CalendarMonth`** — `month` (any date inside it) · `days`, a map from day of
the month to `shots` (up to four `photo`/`seed` pairs) · `past` · `today` ·
`missed` · `inRun` · `label` · `onPress` · `header`. One month as a
seven-column grid, Monday first, with the day's photographs tiled behind its
numeral — one fills the cell, two split it across, three put one over a pair,
four take a corner each. Every day of the challenge gets a grey cell, shot or
not; dates either side of the run stay bare numbers. A bare numeral stays
quiet — `inkMuted` for a day already gone, `inkGhost` for one still to come —
and today wears a black border.

**`PhotoCollage`** — `cells` (`key` · `photo`/`seed` · `time` · `label` ·
`note` · `onPress`) · `ratio` · `radius` · `children`. Today's post at the
shape it goes up in (Tasks passes `POST_RATIO`, 3:4), cut by
`MosaicArrangement` with no seam, as the cover is. A shot piece carries its
task over its time in the bottom-left (`shotCaption` on the `photoFoot`
fade); an open one is a `surfaceSunken` piece with a dashed `slotEdge` slot
inset in it — a 34pt ink disc with a plus when it can be tapped, the task's
name and its note. `children` draw over the block (the `DayCover` once
complete, the clock badge at its top). `MosaicArrangement` is the same cut,
generic over what a cell renders.

**`CameraSheet`** — `visible` · `tasks` · `taskId` · `chips` · `onChangeTask`
· `onCapture` · `onClose`. The camera, opened only from a tap: the page dims
and a 44-corner card rises over its lower part with the live camera, a square
guide for what goes into the post, and the task's name on a pill — or, with
`chips`, every open task as a swipeable chip row. The shot is cropped back to
the guide square.

**`PhotoSlot`** — `photo` · `width` / `height` / `radius` · `emptyLabel` (a
dashed outline and a caption under the `+`) · `tilt` · `onPress`. A photo, or
the tile waiting for one — the new-challenge screen's cover prints.

**`PhotoStrip`** — `photos` · `height` · `onPressPhoto`. A challenge's photos
dropped as loose framed prints across the top of its page, each at its own
height and angle.

**`FriendCard`** — `friend` · `post` · `locked` · `accessory` · `onPress`: one
post on Community, flat on the page, its first slide the day's `DayCover`. **`LockedOverlay`** blurs what you can't see until you've posted.
**`ChallengeRow`** — `card` · `detail` · `note` · `showDate` · `onPress`: a
challenge in a list, photo first, its start date at the end while it can be
joined.

**`Avatar`** (`source` · `size`) · **`DateRange`** (`from` · `to` · `variant`) ·
**`GlassSurface`** (`radius` · `shadow`) · **`Placeholder`** /
`AvatarPlaceholder` / `AvatarSilhouette` — deterministic gradient stand-ins
seeded by a string, and the only place literal hex is allowed.

**`FloatingTabBar`** — the four tabs (Discover · Community · Tasks ·
Profile), outline icons until focused, a glass lens behind the bar and a light
pill behind the active tab. `hidden` takes it away for the live camera.

---

## 3. Composition recipes

**A tab screen.** `ScreenScroll tabBar` at the root, with a
`ScreenHeader showBack={false}` as its `header` and the screen's actions in
`right`.

**A detail screen.** `ScreenScroll` with a `ScreenHeader` as its `header`.
Pushed with `router.push({ pathname: '/thing/[id]', params: { id } })`.

**A sheet.** Hold `visible` in the host screen and close it with `onDismiss`.

**Lists.** Always give the empty case an `EmptyState`; every list in the app
has one.

---

## 4. State and data

`hooks/useAppState.tsx` exposes `useApp()`, wrapped by `AppProvider` in
`app/_layout.tsx`. Static content lives in `data/` (`challenges.ts`,
`content.ts`); formatting helpers in `lib/format.ts`. The backend is
Supabase — see `supabase/README.md`.

Fonts are loaded once in `app/_layout.tsx` and the splash is held until they
resolve — headlines are the whole design, so a fallback-face flash is not
acceptable. A new weight must be added to that `useFonts` call *and* to `fonts`
in `theme.ts`.
