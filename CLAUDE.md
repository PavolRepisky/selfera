# The app

**Selfera** is a social habit-challenge app for iOS and Android (also runs on
the web for layout checks). You join an **era**, a fixed run of days (75 by
default) with a short list of daily tasks. A task counts as done only once
you **photograph** it, and only **today**. Each day's photos make one post: a
mosaic with "Day N" stamped across it. Friends and others in the same era see
that post on Community. Each era has a set number of **lives** (allowed missed
days, 3 by default). Missing more than that ends your run.

- **Naming**: the app is Selfera, with one capital, and the slug, scheme and
  bundle id are `selfera` / `com.selfera.app`. Text users see says *era*;
  code, routes and DB tables still say *challenge*. Keep it that way. Never
  put "75" in an app name.
- **Stack**: Expo SDK 58, RN 0.88, React 19.3, TypeScript, expo-router with
  typed routes, Supabase. It must run in **Expo Go**, so don't add packages
  that need a dev build. Use Node 25.2.1 via nvm, because the default 20.17
  is too old.
- `README.md` describes setup and structure. Known gaps and open work are
  issues on the GitHub project board (github.com/users/PavolRepisky/projects/6).
  `supabase/README.md` covers the backend.

## Screens (`app/`)

Four tabs, each with its own stack folder under `app/(tabs)/`, in this order:
**Discover · Community · Tasks · Profile**. Tasks is the home screen and the
first route (`app/index.tsx` redirects to it). On iOS the tab bar is
`NativeTabs`; elsewhere it is `FloatingTabBar`.

| route | what it is |
| --- | --- |
| `(tabs)/tasks` | Today's post being filled in, edge to edge at the 3:4 it goes up in (`POST_RATIO`), a thin grey line (`inkGhost`) only between two open cells, photos flush against anything: a photo per done task (its time over its task across the middle, `ShotStamp`, as on Community), a plain grey cell naming each open one. The day's clock to midnight floats at the post's top, centred, as a `Pill` (`overMedia`). Under it, the era as one `ChallengeRow` (day, how many are in, lives left, chevron) that opens the era, then, until every photo is in, a "Today" list of the tasks ("Daily tasks" before Day 1; a camera square or the photo, name over its note, the reminder's time while open, a `CheckCircle`), each row doing what its piece does. Tapping a slot opens the camera on that slot's task — the iPhone's own Camera screen as a sheet, `CameraSheet` elsewhere — and the shot goes straight into it; there's no other shutter and no dragging. Tapping a filled piece opens `PhotoViewer` (retake or remove). Tasks have no order. The last photo starts a 90-second countdown (`POST_COUNTDOWN_MS` in `lib/round.ts`): the clock badge counts it, and under the era row come a caption card and a `SlideToConfirm` that posts at once; until it's up shots can be retaken or removed (removing stops it), after that the post and caption are fixed and the page says it's posted (a small tick), with Save (opens `ShareCoverSheet`) and View post (Community) side by side. Shows an empty state when you're in no era. |
| `(tabs)/community` | Two segments. **Friends**: a "Still going today" row of task rings (opens `story`) and the "Finished today" posts. **Members**: posts from everyone who finished in your era, each with Add friend. Both stay behind the **lock** until you have photographed one task today. Corner button opens `add-friends`. |
| `(tabs)/discover` | A carousel of featured eras you can still join (ranked by friends in them, then by members), then Trending rows. Search and See all open `challenges/search`. |
| `(tabs)/profile` | `ProfileView` for you: avatar inside the split task ring (no ring outside an era), name and bio (the handle is the bar's title, through `ProfileHeader`, on yours and anyone else's), the stats as one line under the bio ("30-day best run", "1 era finished", "6 friends" with a faint upright rule between each; best run = most full days back to back in one era), Edit profile and Share profile as two grey pills (on someone else's: Add friend / Friends and Share profile), the era's run card (`ChallengeRun`, `quiet`, opening the era) — between eras a "Ready for a new era?" card with Find an era instead, and with no era ever an empty state with Start new era — then My Eras: each era (current first, then every past one: Finished, Out of lives or Left) as a header row (name, badge, day count, chevron, opening its feed) over its three latest day covers. No calendar and no missed days on a profile. Settings is in the header; the Share profile button opens `ShareProfileSheet`. |
| `feed/[id]` | One era's page: photos, terms, daily tasks, lives, who's in it, with one docked action (Join, etc.). It reads differently for invited, joined and waiting, running, and watching. Once the round is over it becomes `Finished`: podium, standings, who ran out of lives. |
| `join/[id]` | Joining in 2 steps: reminder time per task plus a last call, then the pledge signed with `SignaturePad`. Signing is what joins. |
| `challenge/create` | Build your own era in 3 steps (what it is, daily tasks up to 9, rules: length, start date, lives 0–5), then a "live" page with invites. `?edit` reopens it for changes before Day 1. |
| `challenges/search` | Every era, with a search field and filter chips (yours, topic, length). Results are grouped as starting soon, under way, finished. |
| `day/[day]` | One of your eras as a scrolling feed (`DaysFeed` of `FriendCard`s), titled with the era's name and holding only its days, starting at the day you tapped (`?run=` names a past era). A tile or an era's header row on the profile opens it. |
| `friend/[id]`, `friend/post/[id]` | Someone else's `ProfileView`, and one of their eras as a days feed, as `day/[day]` is for yours. Their today follows the lock. |
| `story` | Full-screen story viewer over someone's photos for the day, with a queue across the Community row and a heart to like the day. |
| `add-friends` | Search, requests, and suggestions with mutual friends, each with Add. |
| `account/settings` · `edit` · `theme` · `reminders` | Settings: your card at the top (opens `edit`), App (Reminders while in an era, Theme: system, light or dark, End era while in one), About (Privacy and Terms, still doing nothing), Account (Log out, Delete account), the version at the foot. `edit` is Edit profile, as the canvas draws it: the photo big with a pencil badge (its own menu, saved at once), then Name, Username (up to 30) and Bio (multiline), each in a white box under its label with its count, kept on the bar's Save (leaving any way — ✕, swipe or back — asks first if any changed). `reminders` explains each group under it. |
| `sign-in` | The only route when signed out: email and password, plus Apple once the project turns it on (native sheet in a build, browser flow in Expo Go). Google is in `lib/backend/auth.ts` but has no button. |
| `sheet`, `sheet-large` | iOS system sheet routes, currently switched off (see `BottomSheet` below). |

## State and data

- `hooks/useSession` holds the Supabase session. `app/_layout.tsx` swaps the
  sign-in stack for the app stack with `Stack.Protected`, so signing in or
  out needs no navigation.
- `hooks/useAppState` (`useApp`) holds **your** account: profile, the era
  you're in (`inChallenge`, `challenge`, `tasks`, `startDate`, `currentDay`),
  `progress[day][taskId]`, captions, `postsAt` (when a finished day goes
  up), reminders, lives, the `catalog` of all eras, and `feedLocked`. Its
  actions are the whole write surface: `completeTaskWithPhoto` and
  `undoTask` (a tick and its photo always move together), `setCaption`
  (only in the countdown), `selectChallenge` (join), `leaveChallenge`, and
  `add`/`update`/`deleteChallenge`. Writes show in the UI first; if the save
  fails they roll back and set `syncError`.
- `hooks/useSocial` covers **everyone else**, from the backend: friends and
  members today, relations and requests, reactions, comments, seen photos,
  and people's pages. Like `useApp`, it updates the UI first and puts things
  back if the server refuses.
- `lib/backend/*` contains the Supabase calls (`api`, `auth`, `catalog`,
  `photos`, `social`). `lib/database.types.ts` is generated by
  `npm run db:types`.
- `data/challenges.ts` holds the preset eras and their bundled photos.
  `data/content.ts` now supplies only types (`Friend`), `LOVE` (the one
  reaction, a heart) and the
  photo strips. People are no longer demo data.
- `lib/round.ts`: every round has **one shared Day 1**. `roundState`
  returns upcoming, running or ended. Joining closes on Day 1, and you can be
  in one era at a time.
- Reminders: `lib/reminderPlan.ts` plans them (tested by
  `npm run test:reminders`). `components/ReminderSync` schedules them with
  expo-notifications on phones while signed in. They work now.
- **Dev switches to know about**: `FAKE_PAST_ERAS` in `useSocial` (`__DEV__`
  only, currently off) gives your own profile three made-up past eras (finished,
  out of lives, left) after any real ones. `DEMO_ERA` in `lib/demoEra.ts` (`__DEV__`
  only, currently **on**) puts you on Day 12 of a made-up "Get Fit for Summer"
  run with six friends and eight members, all held on the phone. `SYSTEM_CAMERA = true` in Tasks opens the
  iPhone's own Camera screen (tap to focus, drag to set the exposure, which
  expo-camera can't do) instead of the app's camera card; Android and the web
  keep the card.

## Backend (`supabase/`)

Postgres with row-level security, Storage for photos, the `delete-account`
Edge Function, and a pg_cron settle job every 15 minutes (runs out of lives
become lost; runs past their last day become finished). The rules live in the
database, not the app. Tasks can only be completed today in the member's own
time zone. Profiles and past days are public to anyone signed in. Someone's
**today** stays hidden, with no signed photo URL, until you've photographed
your own task today. Details, demo logins and commands are in
`supabase/README.md`. A schema change is always a **new** migration. Config
comes from `.env.local` (see `.env.example`).

## Commands

`npx expo start` (Expo Go) · `npm run typecheck` · `npm run check:design` ·
`npm run test:reminders` · `npm run db:start | db:reset | db:test | db:smoke |
db:types` (Docker needed).

# Design rules

## iPhone: native first

On iOS the app is built from the system's own parts, and that wins over any
rule below that says otherwise. `NATIVE_HEADER` (`components/Screen.tsx`) is
the switch; Android and the web keep the drawn design the rest of this file
describes. When adding UI, use the iOS system control if one exists (and runs
in Expo Go), and keep a drawn fallback for the other platforms.

- **Navigation**: native stack headers through `ScreenHeader` — the title is
  always the small one in the bar, never a large title on the page;
  `overPhoto` for photo heroes, `search` for the bar's search field; each tab is its own stack folder; the tab bar is `NativeTabs`
  with SF Symbols.
- **Controls**: `PrimaryButton` → SwiftUI prominent button; `SegmentedTabs` →
  native segmented control; `WheelPicker` → native picker; reminder times →
  compact time picker + switch; dates → graphical date picker; length →
  slider; `AlertDialog` → system alert/prompt (bigger dialogs → sheet);
  `PopoverMenu` → action sheet; `BottomSheet` stays drawn (iOS 26's form
  sheet floats inset from the screen's edges short of full height; the
  system path in `app/sheet*.tsx` + `lib/sheetPortal.ts` is switched off);
  Settings → SwiftUI `Form`;
  a `Pill` or `IconButton` marked `overMedia` (floating over a photo or the
  camera) → liquid glass (`LiquidGlass` in `GlassSurface.tsx`): interactive
  when tappable, materialising in and out through `visible`, neighbours in a
  `LiquidGlassGroup`. Glass is only for what floats over content — never on
  the page or a card, where a pill is the plain system capsule. `EmptyState` stays drawn (glyph on a
  grey disc, title, hint, a pill out — no card round it) — the system's empty view set
  its words in San Francisco.
- **Behaviour**: `ScreenScroll onRefresh` for pull to refresh,
  `LongPressMenu` for context menus, `SwipeRow` for row actions.
- **Icons**: SF Symbols in system controls, mapped from the Ionicon name in
  `constants/symbols.ts`; Ionicons stay for drawn UI.
- **Type**: Quicksand on iOS too, at the same `hierarchy` sizes as
  everywhere else, growing with Dynamic Type through `Text`'s
  `dynamicTypeRamp`. System controls follow it where they can: SwiftUI
  text and buttons through `quicksand()` from `lib/swiftUI.ts` (never a
  bare `font()`, which falls back to San Francisco), the bar title and tab
  labels through their style's `fontFamily`. Alerts, action sheets, pickers
  and the segmented control stay in the system's face.
- **Metrics**: on iOS the page margin is the system's 16 and `radii.lg`
  is the native list's card corner (26 on iOS 26, 10 before), so drawn
  cards sit level with native lists.
- **Accent**: system controls tint with `systemAccent` (Apple's system
  blue) — prominent buttons blue with white type, tinted ones blue type,
  bar items, Settings icons, the calendar's arrows, slider, time pickers,
  action sheets. Ink stays for text, the selected tab and a calendar's
  month (the start-date picker stays ink whole, since SwiftUI tints its
  month header too); switches keep the system green. Tint through `tint` from
  `lib/swiftUI.ts`, never the library's (Expo Go's native side reads an
  older field), and pass SwiftUI's semantic styles in their hierarchical
  form (`{ type: 'hierarchical', style: 'secondary' }`), not as strings.
- **Dark mode**: on iOS every `colors` token is a `DynamicColorIOS` (the
  `LIGHT`/`DARK` maps in `theme.ts`). Type on photos or the camera is
  `onMedia` (always white), never `inkInverse` (which flips with `ink`).
  Anything that needs a plain string — SVG, SwiftUI modifiers, gradients —
  uses `colorsFor(useColorScheme())`.

## Everywhere else

This app's visual language is **fixed** on Android and the web. Features,
screens, copy and data change; the look does not.

Deep reference: `docs/design-system.md`.
Visual source of truth: `reference/screens/**` — real screenshots. When a visual
question comes up, open the relevant screenshot rather than guessing.
Enforcement: `npm run check:design` (also run `npm run typecheck`).

---

## The laws

1. **No literal colours.** No hex, `rgb()` or `rgba()` anywhere in `app/` or
   `components/`. Import from `@/constants/theme`. Need a colour that isn't
   there? Add a *semantic* token to `theme.ts` with a comment saying what it is
   for — never inline it.
2. **No literal type.** No `fontFamily`, `fontSize`, `lineHeight` or
   `letterSpacing` in a StyleSheet. Type comes from the `type` scale only.
3. **All text goes through `@/components/Text`** with a `variant`. Never import
   `Text` from `react-native` — headlines too, on the `headline`,
   `headlineSm` and `title` variants.
4. **No magic numbers** for padding, margin, gap, radius or shadow. Use
   `layout` (spacing by role) first, then `spacing`, `radii`, `shadows`; a
   bare `spacing` step is for an optical nudge. Sizes tied to a specific
   drawing (a 46px check circle, a 120px avatar) are fine as named constants.
5. **Every screen wraps in `Screen` or `ScreenScroll`.** Never hand-roll a
   `SafeAreaView` + `ScrollView` + background colour. Screens under `(tabs)/`
   pass `tabBar` so content clears the floating bar.
6. **Check the inventory before writing a component.** The table below is the
   whole set. Extend an existing component with a prop before adding a new one.
7. **Icons are `Ionicons` from `@expo/vector-icons`.** No other icon set.
8. **Imports use the `@/` alias** — `@/components/Card`, not `../../components/Card`.

## Choosing tokens

**Colour** — five codes carry a page, plus one red for danger, defined once as `palette` in
`theme.ts` and reached through the semantic tokens that point at them:

| palette | code | token | for |
| --- | --- | --- | --- |
| `black` | `#141414` | `ink` | primary text, active icons, today |
| `white` | `#FFFFFF` | `surface` · `backgroundPlain` · `inkInverse` | page, cards, type on photos |
| `greyDark` | `#9C9C9C` | `inkMuted` | secondary text people still read: handles, captions, past dates |
| `greyLight` | `#D7D6D3` | `inkGhost` | not yet / not available: future dates, unfinished segments, disabled arrows |
| `greyFill` | `#F2F2F2` | `surfaceSunken` · `backgroundAlt` | fills: cards, calendar cells, tracks, a picker's band, the Settings page |
| `red` | `#E63950` | `destructive` · `liked` | the action that can't be taken back, and a heart you've left — nothing else |

Beside them sits one accent, `gradients.accent` — peach `#F7C3A0` into rose
`#EFA3B7` into lavender `#D8C6EE`, stored in the order it is drawn. It is the
colour of progress: the profile's task ring and challenge bar.

My Profile and Settings use these and nothing else; so do the shared
dialog, photo viewer and bottom sheets. Reach for them first on any page; the
older in-between greys (`inkSoft`, `field`, `divider`) remain for
screens that already use them. Never use `palette` outside `theme.ts` — code
names the role (`inkMuted`), not the shade (`greyDark`).

**Background** — `Screen tone`:

Every screen in the app sits on the same white, `Screen`/`ScreenScroll`'s
default `plain` tone (`backgroundPlain` `#FFFFFF`) — the tab roots, a
challenge's feed, a friend's day, all of it — with one exception: Settings
and its pages sit on `alt` (`backgroundAlt`, the palette's `#F2F2F2`), because their groups are white
cards and on a white page they'd dissolve. On the iPhone the system list
hides its own grouped grey for this one, so every Settings page, drawn or
native, is the same grey. Those are the only two tones.

**Shadow** — pick by what the thing sits on, not by how big it is:

| shadow | for |
| --- | --- |
| `card` | cards resting on the page |
| `soft` | icon buttons, floating pills, photo tiles |
| `hard` | things lifted *off* the page: avatar, "Day N" badge, task photos |
| `floating` | sheets and bars floating over content |
| `glass` | liquid-glass surfaces sitting on a photo |
| `header` | round buttons in a screen's fixed header bar (pulled in close) |

**Radius**: `pill` (999) for anything fully rounded — buttons, chips, tab bar ·
`card`/`xl` (32) is the signature card corner · `lg` 20 · `md` 16 · `sm` 10.

**Type hierarchy** — eight levels, defined once as `hierarchy` in `theme.ts`
and used as `Text` variants by name. My Profile and Settings use these and
nothing else; build other screens from them too:

| variant | size / weight | for |
| --- | --- | --- |
| `pageTitle` | 23 Bold | the screen's title, the profile's name |
| `sectionHeading` | 21 Bold | "Days", sheet and dialog titles, picker values |
| `itemTitle` | 18 Bold | one thing's name: the challenge card, the month on show |
| `copy` | 16 SemiBold | reading text and rows: a bio, a settings row (label and value) and its group title, a switch's labels, a dialog's message and field |
| `copyBold` | 16 Bold | the word leading reading text: a caption's author handle |
| `meta` | 14 SemiBold | detail beside something bigger |
| `metaBold` | 14 Bold | detail carrying a number: "Day 5 / 75", a calendar date |
| `badge` | 12 Bold | counts on pills and tiles, weekday letters, calendar marks |

A post's caption itself is running prose at `copy`'s size in Medium (`body`),
so the bold handle leading it stands clear.

The older names that meant one of these point at it (`sectionTitle` →
`pageTitle`, `cardTitleBold` → `itemTitle`, `bodyBold` → `copyBold`,
`labelBold` → `meta`,
`microBold` → `badge`). Prefer the level names in new code.

**Spacing** — by role, defined once as `layout` in `theme.ts` on top of the
`spacing` ruler. My Profile and Settings use these for every gap, margin and
padding:

| role | size | for |
| --- | --- | --- |
| `gutter` | 20 | the page's side margin |
| `title` | 20 | under the page's title row |
| `section` | 24 | between big blocks: a card, "Days", a settings group |
| `block` | 16 | between elements inside a block: avatar to name, a sheet's parts |
| `heading` | 12 | from a heading to what it heads |
| `stack` | 8 | between things stacked inside a card |
| `line` | 4 | between two lines of text that belong together |
| `inline` | 12 | between things side by side on a row |
| `card` | 20 | inside a card or list row, every side |
| `pill` | 8 | either side of a pill's label |
| `grid` | 4 | between tiles in a grid |

**Typeface** — Quicksand, plus a script/sans pair for a day's cover:
- **Quicksand** — everything, headlines included: body, buttons, labels, tabs,
  captions, and the `headline`/`headlineSm`/`title` scale (Bold). The app has
  no separate display face — Playfair was removed on purpose; don't add a
  serif back for headlines.
- **Allura** — the "Day N/75" written across the middle of a `DayCover`
  (`coverDay`). **Inter Tight** — the rest of that cover: the era name
  under the day (`coverEra`), the faint lower-case "selfera" wordmark at its foot (`coverMark`, in
  Inclusive Sans Bold, set close, drawn by `CoverMark`, which signs each of a
  post's photo slides the same way),
  and — only on the saved story, where its switches turn them on — each
  photo's time and task in its middle (`coverCaption`). Tasks' post and a
  posted day's own photo slides set the time over
  the task in Inter Tight Medium (`shotTitle`), centred, in white
  (`shotStamp`) on a faint drop. Times read
  "07:57", on the 24-hour clock, everywhere (`clock24` in `lib/format`,
  which also turns older "7:57am" stamps over). Neither face
  appears anywhere else.

Quicksand runs optically light, so each role is mapped one step up the weight
ramp; plain copy sits on Medium, and Regular isn't loaded at all. Don't
"correct" this.

## Component inventory

**Layout** · `Screen` / `ScreenScroll` page shell · `ProfileView` a whole
profile page — yours and anyone else's · `DaysFeed` a profile's days as
one scrolling feed — My days and anyone else's · `ScreenHeader` back + title +
actions · `Card` white surface · `EmptyState` glyph on a grey disc, title, hint, a pill out — no card.

**Type** · `Text` (variant).

**Controls** · `PrimaryButton` · `IconButton` circular · `Pill`
(`floating`|`solid`|`muted`|`outline` × `sm`|`md`|`lg`) · `SegmentedTabs` the pill
switch · `StepBar` a flow's segmented progress · `SignaturePad`
a finger-drawn signature · `SlideToConfirm` a knob slid along a track to act, the phone's slide to answer (Tasks' slide to post) · `ReminderPill` a reminder's time or Never, with its menu and wheel · `RulerSlider` tick picker · `WheelPicker` the iOS date-wheel drum ·
`SearchBar`.

**Overlays** · `BottomSheet` · `SheetHeader` a sheet's centred title under
the grabber, shared by Share profile and Comments · `AlertDialog` · `PopoverMenu` ·
`ChallengeLengthSheet` · `PhotoLibrarySheet` · `ShareProfileSheet` your
profile's QR code card (name, handle, today's day) with Copy link, Save and
Share · `ShareCoverSheet` a finished
day's cover as a 9:16 story in a bottom sheet (a switch each for the photos' times and tasks), with Save
(to Photos) and Share (the image through the phone's share sheet) side by side — opened from Tasks' Save button once the post is up.

**Content** · `ChallengeRun` the run you're on as one square a day, on ink or (`quiet`) a white card on a profile · `CheckCircle` a done task's tick · `TaskRing` a face in the split
task ring with its "3/5" badge, or round Tasks' shutter — every ring, the profile's
included; handed a day's `photos` (completion ids) it fades the ones you've
seen, and `mine` fades them all · `CalendarMonth` month grid · `PhotoCollage` today's post filling in, its open pieces grey cells · `DayCover`
a day's cover — its photos (each one's time and task in its middle only on the saved story, by its switches), "Day N/75" and the era name on a soft shadow across the centre, "Selfera" faint at the foot — on a post's first slide and as its tile in the profile's grid ·
`ShotStamp` a photo's time over its task across its middle, as Tasks' post, a post's photo slides and a story's frames set it ·
`CameraSheet` the camera card that rises when a task is tapped · `PhotoSlot` · `PhotoStrip`
a challenge's scattered prints · `PhotoViewer` · `CommentsSheet` ·
`FriendCard` · `PostHeader` who posted a day — face (in its task ring only on a
story), name, time, "Day N · challenge" · `LockedOverlay` · `ChallengeRow` a
challenge in a list, photo first, its start date at the end while it can be joined (`mosaic` for up to three photos with no seam; `ChallengeMosaic` draws the same on Discover's cover)
· `Avatar` · `DateRange` · `GlassSurface` ·
`Placeholder` / `AvatarPlaceholder` / `AvatarSilhouette` · `FloatingTabBar`.

**Behind the scenes** · `ReminderSync` keeps the phone's reminder notifications
in step with the day — draws nothing.

## Conventions

- **Comments explain *why*, in prose.** The existing files justify their values
  ("sampled off the reference", "anything heavier reads as a drawn outline").
  Match that. Don't add comments that restate the code.
- Components take a `style?: StyleProp<ViewStyle>` escape hatch, export a named
  function *and* a default, and keep their `StyleSheet.create` at the bottom.
- Pressed states dim via a `pressed` style, not an opacity wrapper.
- Haptics: `Haptics.selectionAsync().catch(() => {})` on tick-crossing
  pickers only. Don't spray haptics onto ordinary taps.
- New route files go under `app/`, expo-router file conventions, `typedRoutes`
  is on.
