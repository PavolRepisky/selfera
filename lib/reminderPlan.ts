/**
 * What should fire, and when — the reminders' plan, worked out apart from
 * the phone's notification calls (`lib/reminders`) so it can be checked on
 * its own.
 */

/** Eight in the morning: early enough to plan the day round. Kept here as
 * well as in the app state, so this file stands on its own. */
const DEFAULT_TASK_MINUTES = 8 * 60;

/** How far ahead nudges are set. A week of five tasks and a last call is
 * 42 — well under the 64 an iPhone holds. */
export const WINDOW_DAYS = 7;
const MAX_PENDING = 60;

const DAY_MS = 86_400_000;

export interface ReminderTimes {
  tasks: Record<string, number | null>;
  lastCall: number | null;
}

export interface ReminderPlanInput {
  now: Date;
  /** Day 1 of the round, local midnight. */
  startDate: Date;
  totalDays: number;
  /** Each task with the weekdays it's due on (0 Sunday … 6 Saturday) —
   * left out, every day. */
  tasks: readonly { id: string; label: string; note?: string; weekdays?: readonly number[] }[];
  reminders: ReminderTimes;
  /** Today's tasks already photographed. */
  doneToday: ReadonlySet<string>;
  windowDays?: number;
}

export interface PlannedReminder {
  at: Date;
  title: string;
  body: string;
}

const midnight = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const at = (day: Date, minutes: number) =>
  new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(minutes / 60), minutes % 60);

/**
 * What should fire, and when, from now to the end of the window — only on
 * days the round runs, for the tasks due that day, and only what's still
 * ahead. A day with nothing due has no last call either.
 */
export function planReminders({
  now,
  startDate,
  totalDays,
  tasks,
  reminders,
  doneToday,
  windowDays = WINDOW_DAYS,
}: ReminderPlanInput): PlannedReminder[] {
  const today = midnight(now);
  const plan: PlannedReminder[] = [];

  for (let offset = 0; offset < windowDays; offset += 1) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    const runDay = Math.round((day.getTime() - midnight(startDate).getTime()) / DAY_MS) + 1;
    if (runDay < 1 || runDay > totalDays) continue;
    const isToday = offset === 0;
    const due = tasks.filter((task) => !task.weekdays || task.weekdays.includes(day.getDay()));

    for (const task of due) {
      const minutes = task.id in reminders.tasks ? reminders.tasks[task.id] : DEFAULT_TASK_MINUTES;
      if (minutes === null) continue;
      if (isToday && doneToday.has(task.id)) continue;
      const when = at(day, minutes);
      if (when <= now) continue;
      plan.push({
        at: when,
        title: task.label,
        body: task.note ?? `Day ${runDay} — photograph it to tick it off.`,
      });
    }

    if (reminders.lastCall !== null) {
      const open = isToday ? due.filter((t) => !doneToday.has(t.id)).length : due.length;
      const when = at(day, reminders.lastCall);
      if (open > 0 && when > now) {
        plan.push({
          at: when,
          title: 'Last call',
          body: `${open === 1 ? '1 task' : `${open} tasks`} still open — Day ${runDay} ends at midnight.`,
        });
      }
    }
  }

  return plan.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, MAX_PENDING);
}
