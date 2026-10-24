import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { useApp } from '@/hooks/useAppState';
import {
  askForNotifications,
  configureNotifications,
  planReminders,
  scheduleReminders,
} from '@/lib/reminders';

/** How long changes settle before the week is planned again — a burst of
 * them (a load, a photo and its save) is planned once, not once each. */
const SETTLE_MS = 800;

configureNotifications();

/**
 * Keeps the phone's reminders in step with the app, and opens Tasks when
 * one is tapped. Draws nothing; mounted only while signed in on a phone, and
 * clears every reminder when it goes — logging out shouldn't leave
 * someone's nudges behind.
 */
export function ReminderSync() {
  const router = useRouter();
  const { ready, inChallenge, startDate, totalDays, tasks, reminders, progress, currentDay } = useApp();

  // Today's done tasks as one key, so a photo of a task re-plans but an
  // unrelated change to the day's entries doesn't.
  const doneToday = useMemo(
    () => tasks.filter((task) => progress[currentDay]?.[task.id]?.done).map((task) => task.id),
    [tasks, progress, currentDay],
  );
  const doneKey = doneToday.join(',');

  // Coming back to the app is when "today" may have moved on — re-plan.
  const [wake, setWake] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setWake((n) => n + 1);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      const plan = inChallenge
        ? planReminders({
            now: new Date(),
            startDate,
            totalDays,
            tasks,
            reminders,
            doneToday: new Set(doneKey ? doneKey.split(',') : []),
          })
        : [];
      // In a challenge and never asked — someone who joined before reminders
      // were real — asks here once; joining asks for everyone after.
      (inChallenge ? askForNotifications() : Promise.resolve(false))
        .then(() => scheduleReminders(plan))
        .catch(() => {});
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [ready, inChallenge, startDate, totalDays, tasks, reminders, doneKey, wake]);

  useEffect(
    () => () => {
      Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
    },
    [],
  );

  // A tapped reminder — while open, or the one that opened the app — leads
  // to the day's tasks.
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (response?.notification.request.content.data?.open === 'tasks') router.navigate('/tasks');
  }, [response, router]);

  return null;
}

export default ReminderSync;
