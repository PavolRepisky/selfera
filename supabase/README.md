# Backend

Supabase: Postgres with row-level security, Storage for photos, one Edge
Function, and a pg_cron job. The app talks to it through `lib/supabase.ts`
and `lib/backend/*`. There's no separate server.

## Layout

| path | what |
| --- | --- |
| `migrations/…01_init.sql` | everything, in order: accounts (made on sign-up, a time zone each); challenges, tasks, rounds (a shared Day 1) and memberships; task completions (today only), captions and the 90-second post countdown (`day_posts`); lives, missed days and standings; the Community lock, friends, comments, reactions, views, notifications and invites; the Community feed; storage buckets and who may read or upload which photo; the 15-minute settle job; the preset eras |
| `functions/delete-account` | Settings' Delete account — photos first, then the user |
| `tests/database/rules.test.sql` | the rules, checked as the people they apply to |
| `tests/api-smoke.mjs` | the same through the real API, storage included — makes its own two people and era, and removes them after |

## The rules it holds

- A task is done only by photographing it, only **today** in the member's own
  time zone, and only into today's folder.
- The day's last photo starts a 90-second countdown to the post going up.
  Until it runs out, photos can be retaken or removed (removing one stops
  it) and the caption written; `post_now` (slide to post) ends it early.
  After, the day and its caption are fixed.
- Joining closes once Day 1 has passed. One challenge at a time.
- Custom challenges: only their creator edits (before Day 1) or deletes them.
- Profiles, memberships, completions and past days are public to anyone
  signed in. **Someone's today** is only visible once you've photographed a
  task of your own today: the Community lock. Storage won't sign a link to a
  locked photo.
- Missed day = a day behind you without every task. More misses than the
  challenge's lives → lost.

## Working on it

Needs Docker Desktop running and Node ≥ 20.19 (`nvm use 25.2.1`).

```sh
npm run db:start     # first run downloads the images; prints the URL and keys
npm run db:reset     # rebuild from the migrations: no accounts, just the presets
npm run db:test      # database tests
npx supabase functions serve   # in another terminal, then:
npm run db:smoke     # end-to-end through the API
npm run db:types     # after a schema change → lib/database.types.ts
```

Studio (table browser) runs at http://127.0.0.1:54323. There are no demo
accounts: sign up in the app (or add a user in Studio) to have one.

A schema change is a **new** migration (`npx supabase migration new <name>`),
never an edit to one already pushed to a hosted project. The fourteen
migrations before 2026-10-25 were folded into `…01_init.sql` when the
database was wiped; they're in git history if anything needs tracing.

## Hosted project

```sh
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push                       # migrations, not the seed
npx supabase functions deploy delete-account
```

Then in the dashboard:

- **Authentication → Providers**: enable Apple and Google. If email sign-up
  stays on, keep **Confirm email** on, so nobody can take an address that
  isn't theirs, and set the minimum password length to **8**, which is what
  the sign-in screen promises.
- **Authentication → Attack Protection**: turn on CAPTCHA (Turnstile or
  hCaptcha) once the sign-in screen passes its token.
- **Authentication → URL Configuration**: add `selfera://**` to the redirect
  URLs. Add `exp://**` only while testing hosted sign-in in Expo Go, and
  take it out before release: it lets any Expo Go project be handed a
  sign-in code. PKCE keeps such a code from being used, but there's no
  reason to hand it out.
