/**
 * Which tasks a day asks for. An era's creator says how many times a week
 * each task is done; everyone joining picks the weekdays they'll do it on.
 * A task done every day needs no picks. The server holds the same rules
 * (`task_weekdays` and `due_tasks`), so what Tasks shows and what
 * `complete_task` takes never disagree.
 *
 * Weekdays are counted 0 Sunday to 6 Saturday, as `Date.getDay()` and
 * Postgres's `dow` both count them.
 */

/** Every day — what a task is unless its era says otherwise. */
export const EVERY_DAY = 7;

/** The weekdays picked for each task that isn't daily, by task id. */
export type Schedule = Readonly<Record<string, readonly number[]>>;

/** What a task needs to say when it's due: its id and how often. */
export interface Scheduled {
  id: string;
  /** Times a week, 1–7. Left out, every day. */
  perWeek?: number;
}

/** The week as the join page lays it out: Monday first, the way a week
 * reads in Europe and on the iPhone's own alarm. */
export const WEEK = [1, 2, 3, 4, 5, 6, 0] as const;

/** One letter a weekday, for the day chips. */
export const WEEKDAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

/** Three letters a weekday, for a row naming its days. */
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/**
 * Where a task's days fall when nobody picked them, spread over the week
 * from Monday: three is Monday, Wednesday, Friday. Also what the join page
 * starts its chips on. The server's `default_weekdays` spreads them the same.
 */
export function defaultWeekdays(perWeek: number): number[] {
  return Array.from({ length: perWeek }, (_, i) => (1 + Math.floor((i * 7) / perWeek)) % 7);
}

/** The weekdays one task falls on: every day for a daily task, the picked
 * days while they match how often it's done, the spread otherwise. */
export function taskWeekdays(task: Scheduled, schedule: Schedule): readonly number[] {
  const perWeek = task.perWeek ?? EVERY_DAY;
  if (perWeek >= EVERY_DAY) return WEEK;
  const picked = schedule[task.id];
  return picked && picked.length === perWeek ? picked : defaultWeekdays(perWeek);
}

/** The calendar date of a round's Day `day`, from its Day 1 at local
 * midnight. Built from the calendar rather than by adding milliseconds, so
 * a clock change in between doesn't land it on the wrong date. */
export function dateOfDay(start: Date, day: number): Date {
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + day - 1);
}

/** The tasks due on Day `day` of a round that started on `start`, in their
 * own order. Empty on a rest day. */
export function tasksOn<T extends Scheduled>(
  tasks: readonly T[],
  schedule: Schedule,
  start: Date,
  day: number,
): T[] {
  const weekday = dateOfDay(start, day).getDay();
  return tasks.filter((task) => taskWeekdays(task, schedule).includes(weekday));
}

/** The next day after `day` that `task` is due, counted on the round — for
 * a row saying when it's back. */
export function nextDayOf(task: Scheduled, schedule: Schedule, start: Date, day: number): Date {
  const days = taskWeekdays(task, schedule);
  for (let ahead = 1; ahead <= 7; ahead += 1) {
    const date = dateOfDay(start, day + ahead);
    if (days.includes(date.getDay())) return date;
  }
  return dateOfDay(start, day + 1);
}

/** How often a task is done, as the era's page and the create form say it. */
export function perWeekLabel(perWeek: number | undefined): string {
  const n = perWeek ?? EVERY_DAY;
  if (n >= EVERY_DAY) return 'Every day';
  if (n === 1) return 'Once a week';
  if (n === 2) return 'Twice a week';
  return `${n}× a week`;
}

/** A task's days as a short line, Monday first: "Mon · Wed · Fri", or
 * "Mon, Wed, Fri" in a sentence. */
export function weekdaysLabel(days: readonly number[], separator = ' · '): string {
  return WEEK.filter((d) => days.includes(d))
    .map((d) => WEEKDAY_SHORT[d])
    .join(separator);
}

/** Photos an era asks for in a week: each task's times a week, added up. */
export function photosPerWeek(tasks: readonly Scheduled[]): number {
  return tasks.reduce((sum, task) => sum + (task.perWeek ?? EVERY_DAY), 0);
}
