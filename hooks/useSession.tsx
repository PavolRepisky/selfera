import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { clearSnapshots } from '@/lib/snapshot';
import { supabase } from '@/lib/supabase';

/**
 * Who is signed in. `ready` is false only for the moment it takes to read a
 * stored session back off the phone at launch — the splash stays up for it,
 * so a signed-in person never sees the sign-in screen flash past.
 */
interface SessionState {
  session: Session | null;
  ready: boolean;
}

const SessionContext = createContext<SessionState>({ session: null, ready: false });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ session: null, ready: false });

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setState({ session: data.session, ready: true }))
      // A stored session that can't be read is the same as none: sign in again.
      .catch(() => setState({ session: null, ready: true }));

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // However the session ends — Log out, Delete account, a refresh the
      // server refuses — what this account last showed leaves the phone too.
      if (event === 'SIGNED_OUT') clearSnapshots();
      setState({ session, ready: true });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  return useContext(SessionContext);
}
