const MONTHS_LONG = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Tue, Aug 18" — the form used under the ruler pickers. */
export function longDate(date: Date): string {
  return `${DAYS[date.getDay()]}, ${MONTHS_LONG[date.getMonth()]} ${date.getDate()}`;
}

/** "Jun 1" — one end of a range whose weekday doesn't matter, like a
 * finished round's dates. */
export function shortDate(date: Date): string {
  return `${MONTHS_LONG[date.getMonth()]} ${date.getDate()}`;
}

/** "Today", "Yesterday", or "Oct 6" — the day a post was made, said the way
 * a feed says it: relative while it's recent, the date once it isn't. */
export function relativeDay(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const ago = Math.round((today.getTime() - day.getTime()) / 86_400_000);
  if (ago === 0) return 'Today';
  if (ago === 1) return 'Yesterday';
  return shortDate(day);
}

/** "Sep 30, 2026" — a date that stands on its own, like the one under a
 * signature. */
export function fullDate(date: Date): string {
  return `${MONTHS_LONG[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/** "07:00" — a time of day stored as minutes after midnight, on the 24-hour
 * clock a phone's alarm list uses. */
export function clockTime(minutes: number): string {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return `${h}:${m}`;
}

/** "4th" — for the miss that ends a run. */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

/** "07:19" — the completion stamp on a task, on the 24-hour clock the
 * whole app reads time in. */
export function timeStamp(date: Date): string {
  return clockTime(date.getHours() * 60 + date.getMinutes());
}

/**
 * Every 12-hour time in `text` — "7:19am", "9:40 PM", "7:57 a.m." — on the
 * 24-hour clock, "07:19", "21:40", "07:57"; the rest of the text as it was.
 * Stamps saved before the app went 24-hour still hold the old form, so
 * every time shown passes through here rather than trusting how it was
 * stored.
 */
export function clock24(text: string): string {
  return text.replace(/(\d{1,2}):(\d{2})\s*([ap])\.?m\.?/gi, (_, h: string, m: string, half: string) => {
    const hour = (Number(h) % 12) + (half.toLowerCase() === 'p' ? 12 : 0);
    return clockTime(hour * 60 + Number(m));
  });
}

/** Local calendar day as ISO `YYYY-MM-DD` — the form a round's start date is
 * stored in. Built from the local fields, not `toISOString`, which is UTC and
 * east of Greenwich hands back the day before. */
export function isoDay(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** "now", "12m", "3h", "2d", "5w" — how long ago something was said, as a
 * comment thread stamps it: one unit, the biggest that fits, no "ago". */
export function ago(date: Date, now = new Date()): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60_000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d` : `${Math.floor(days / 7)}w`;
}

/** "7h 12m" — what's left of today until midnight, the day's deadline. Under
 * an hour it drops the hours, so the last stretch reads as minutes. */
export function timeLeftToday(now: Date): string {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const minutes = Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 60_000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** "06:12:40" — the same time left as a clock that ticks by the second,
 * for Tasks' badge over the post. */
export function clockLeftToday(now: Date): string {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const seconds = Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
}
