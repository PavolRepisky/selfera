# Selfera

A social habit-challenge app for iOS and Android, built with Expo (SDK 58),
React Native 0.88, TypeScript and Expo Router, on a Supabase backend.

You join an **era** — a run of days (75 by default) with a few daily tasks.
A task is only done by **photographing** it, and only **today**; the day's
photos become one post, a mosaic with "Day N" stamped across it, which your
friends and everyone else in the era see on Community. Each era allows a few
missed days (**lives**, 3 by default); miss more and the run is over.

User-facing copy says "era"; code, routes and the database still say
"challenge". The slug and URL scheme are `selfera`.

## Running

Needs Node ≥ 20.19 (`nvm use 25.2.1`). The app runs in **Expo Go** — no
development build, so no packages that need one.

```bash
npm install
cp .env.example .env.local   # Supabase URL + anon key, see the file
npx expo start               # then press i / a, or scan with Expo Go
npx expo start --web         # renders in a browser, useful for layout checks
npm run typecheck            # tsc --noEmit
npm run check:design         # the design rules in CLAUDE.md
npm run test:reminders       # the reminder planner
```

The backend (local stack, tests, demo sign-ins, deploying) is described in
[`supabase/README.md`](supabase/README.md).

## Structure

```
app/                     routes (Expo Router, typedRoutes on)
  (tabs)/                Discover · Community · Tasks · Profile, a stack each
  feed/[id]              an era's page; Finished once its round is over
  join/[id]              reminders, then the signed pledge
  challenge/create       build your own era (and edit it before Day 1)
  challenges/search      every era, searched and filtered
  day/ friend/ story     your days, someone else's profile and days, stories
  add-friends            search, invite link + QR, suggestions
  account/               settings, theme, reminders
  sign-in                the only page while signed out
components/              shared UI — the inventory is in CLAUDE.md
constants/theme.ts       design tokens
constants/symbols.ts     Ionicon → SF Symbol names for iOS system controls
data/                    preset eras and their bundled photos, shared types
hooks/                   useSession · useAppState · useSocial · useChallengeCards
lib/backend/             the Supabase calls: api, auth, catalog, photos, social
lib/                     dates and rounds, reminders, appearance, SwiftUI helpers
supabase/                migrations, seed, Edge Function, database tests
reference/screens/       the screenshots the design was built from
```

**Tasks** is the app's home and the initial route. On the iPhone the app uses
the system's own parts — native stack headers, `NativeTabs` with SF Symbols,
segmented controls, pickers, alerts, action sheets, liquid glass over photos;
on Android and the web the drawn design (`FloatingTabBar`, drawn headers and
controls) stands in. `NATIVE_HEADER` in `components/Screen.tsx` is the switch.

## State

- `hooks/useSession.tsx` — the Supabase session. Signed out, the sign-in page
  is the only route; signed in, the app replaces it (`Stack.Protected` in
  `app/_layout.tsx`).
- `hooks/useAppState.tsx` — your own account, loaded from the server: profile,
  the era you're in, every day's progress and photos, captions, reminders,
  lives, the catalogue of eras and the Community lock. Its actions are the
  app's write surface for your own data; each shows at once and is rolled
  back if the server refuses.
- `hooks/useSocial.tsx` — everyone else: friends and members today, friend
  requests, reactions, comments, seen photos and people's pages, also from
  the server and also optimistic.
- `components/ReminderSync.tsx` — schedules each task's reminder and the
  evening last call on the phone, from `lib/reminderPlan.ts`.

Sign-in is email and password, plus Sign in with Apple on the iPhone once the
project has Apple enabled — the native Apple ID sheet in a real build, the
browser flow inside Expo Go. `lib/backend/auth.ts` can also do Google, but the
sign-in page doesn't offer it yet.

## Design system

The full rules are in [`CLAUDE.md`](CLAUDE.md), the deeper reference in
[`docs/design-system.md`](docs/design-system.md). Every colour, radius,
shadow, font and spacing step lives in
[`constants/theme.ts`](constants/theme.ts); screens never hardcode one. On
iOS each colour is a dynamic light/dark colour.

Type is **Quicksand** for everything, headlines included, with **Allura**
and **Inter Tight** only on a day's cover (`DayCover`). Quicksand runs
optically light, so every role sits one step up the weight ramp and plain
copy uses Medium; Regular isn't loaded.

> **Missing glyphs.** Quicksand has no `→` or `✓`. Where those are needed
> they are drawn as Ionicons instead — `components/DateRange.tsx` for
> `from → to` ranges, `Pill`'s `icon` prop for badges. **Do not put those
> characters into a string** — they render as tofu.

## Imagery

Preset eras ship bundled photos under `assets/`; everything people shoot or
pick is uploaded to Supabase Storage. Where there's no photo,
`components/Placeholder.tsx` draws warm neutral tiles keyed off a seed
string, so the same "photo" looks the same on every render.

## Known gaps

Open work is tracked as issues on the
[Selfera project board](https://github.com/users/PavolRepisky/projects/6).
