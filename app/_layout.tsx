import { Allura_400Regular } from '@expo-google-fonts/allura';
import { InclusiveSans_700Bold } from '@expo-google-fonts/inclusive-sans';
import { InterTight_400Regular, InterTight_500Medium, InterTight_600SemiBold } from '@expo-google-fonts/inter-tight';
import {
  Quicksand_500Medium,
  Quicksand_600SemiBold,
  Quicksand_700Bold,
} from '@expo-google-fonts/quicksand';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useMemo, useState } from 'react';
import { Platform, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ReminderSync } from '@/components/ReminderSync';
import { stackScreenOptions } from '@/components/ScreenHeader';
import { colors, colorsFor } from '@/constants/theme';
import { restoreAppearance } from '@/lib/appearance';
import { AppProvider, useApp } from '@/hooks/useAppState';
import { SessionProvider, useSession } from '@/hooks/useSession';
import { SocialProvider } from '@/hooks/useSocial';

SplashScreen.preventAutoHideAsync().catch(() => {
  /* no-op: splash may already be hidden on fast refresh */
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Quicksand_500Medium,
    Quicksand_600SemiBold,
    Quicksand_700Bold,
    Allura_400Regular,
    InterTight_400Regular,
    InterTight_500Medium,
    InterTight_600SemiBold,
    InclusiveSans_700Bold,
  });

  // The light/dark choice from Settings, put back before anything is drawn so
  // the first screen doesn't flash in the phone's own appearance first.
  const [appearanceReady, setAppearanceReady] = useState(false);
  useEffect(() => {
    restoreAppearance().finally(() => setAppearanceReady(true));
  }, []);

  // Headlines are the whole design; showing them in a fallback face first
  // would flash badly, so hold the splash until every face is ready.
  if ((!fontsLoaded && !fontError) || !appearanceReady) {
    return <View style={{ flex: 1, backgroundColor: colors.backgroundPlain }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SessionProvider>
          <AppProvider>
            <SocialProvider>
              <StatusBar style="auto" />
              <NavigationTheme>
                <RootStack />
              </NavigationTheme>
            </SocialProvider>
          </AppProvider>
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * The navigation's own containers — behind the tab bar's glass, under a page
 * mid-slide, at the screen's rounded corners as one is swiped away — paint
 * themselves from this theme and the window's root colour, not from the
 * pages. Left on their light defaults they flashed white through the glass
 * and the corners in dark mode, so both follow the page's own colour.
 */
function NavigationTheme({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const theme = useMemo<Theme>(() => {
    const base = scheme === 'dark' && Platform.OS === 'ios' ? DarkTheme : DefaultTheme;
    const page = colorsFor(scheme).backgroundPlain;
    return { ...base, colors: { ...base.colors, background: page, card: page } };
  }, [scheme]);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.colors.background).catch(() => {});
  }, [theme]);

  return <ThemeProvider value={theme}>{children}</ThemeProvider>;
}

/**
 * Signed out, the sign-in page is the only one there is; signed in, it's
 * gone and the app is everything else. A session appearing or ending swaps
 * one set for the other, so neither signing in nor out has to navigate.
 */
function RootStack() {
  const { session, ready: sessionReady } = useSession();
  const { ready: accountReady } = useApp();
  const signedIn = !!session;
  // The splash waits on the stored session being read back, so a signed-in
  // launch never shows the sign-in page for a frame first — and, signed in,
  // on the account's own data, so the demo account behind it never shows.
  const ready = sessionReady && (!signedIn || accountReady);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: colors.backgroundPlain }} />;
  }

  return (
    <>
      {/* The phone's own reminders, kept in step while signed in. */}
      {signedIn && Platform.OS !== 'web' ? <ReminderSync /> : null}
      <Stack screenOptions={stackScreenOptions}>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" options={{ animation: 'fade' }} />
        </Stack.Protected>

        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          <Stack.Screen
            name="story"
            options={{ animation: 'fade', presentation: 'fullScreenModal' }}
          />
          <Stack.Screen name="add-friends" />
          {/* Someone else's profile and days are ordinary pages, pushed
              the way your own Profile's are. As a modal, everything opened
              from them — the challenge, their days — came up as a sheet
              over it instead of a page of its own. */}
          <Stack.Screen name="friend/[id]" />
          <Stack.Screen name="friend/post/[id]" />
          <Stack.Screen name="feed/[id]" />
          <Stack.Screen name="join/[id]" />
          <Stack.Screen name="challenges/search" />
          <Stack.Screen name="challenge/create" />
          <Stack.Screen name="account/settings" />
          <Stack.Screen name="account/edit" />
          <Stack.Screen name="account/theme" />
          <Stack.Screen name="account/reminders" />
          {/* The iPhone's own sheets, which every `BottomSheet` opens there:
              one sized to what it holds, and one for a page's worth —
              comments, the photo library — that opens halfway and pulls up
              to the whole screen. */}
          <Stack.Screen
            name="sheet"
            options={{
              presentation: 'formSheet',
              sheetAllowedDetents: 'fitToContents',
              sheetGrabberVisible: true,
              contentStyle: { backgroundColor: colors.surface },
            }}
          />
          <Stack.Screen
            name="sheet-large"
            options={{
              presentation: 'formSheet',
              sheetAllowedDetents: [0.6, 1],
              sheetGrabberVisible: true,
              contentStyle: { backgroundColor: colors.surface },
            }}
          />
        </Stack.Protected>
      </Stack>
    </>
  );
}
