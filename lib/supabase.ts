import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import type { Database } from '@/lib/database.types';
import { sessionStore } from '@/lib/sessionStore';

/**
 * The one connection to the backend. The URL and key come from
 * `.env.local` — the local stack's while developing, the hosted project's in
 * a release — and both are safe to ship inside the app: the key only ever
 * acts as whoever is signed in, and the database's own row rules decide what
 * that person may do.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY — copy .env.example to .env.local.',
  );
}

export const supabase = createClient<Database>(url, key, {
  auth: {
    // The session outlives the app being closed, kept encrypted on a phone;
    // on the web the browser's own storage already does that.
    storage: Platform.OS === 'web' ? undefined : sessionStore,
    persistSession: true,
    autoRefreshToken: true,
    // Sign-in comes back through the app's own link, handled in
    // `lib/backend/auth`, not a page URL.
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

// A token only refreshes while the app is in front; a phone suspends the
// timer in the background, so refreshing is paused and resumed with it.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export default supabase;
