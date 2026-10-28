// The reminders' plan, checked without a phone: `npx tsx lib/reminderPlan.test.ts`.
import { planReminders } from './reminderPlan';

let failures = 0;
const check = (ok: boolean, label: string) => {
  console.log(ok ? 'PASS' : 'FAIL', label);
  if (!ok) failures += 1;
};

const tasks = ['Eat clean', 'Drink water', 'Walk', 'Work out', 'Read'].map((label, i) => ({
  id: `h${i + 1}`,
  label,
  note: i === 0 ? 'Whole foods only.' : undefined,
}));
const defaults = { tasks: {}, lastCall: 22 * 60 };
const day = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min);
const none = new Set<string>();

// Day 5 of 75, seven in the morning, nothing done.
let plan = planReminders({ now: day(2026, 10, 5, 7), startDate: day(2026, 10, 1), totalDays: 75, tasks, reminders: defaults, doneToday: none });
check(plan.length === 42, `a week ahead, five tasks and a last call a day: ${plan.length} of 42`);
check(plan[0].at.getTime() === day(2026, 10, 5, 8).getTime() && plan[0].title === 'Eat clean', 'first: Eat clean at 8:00 today');
check(plan[0].body === 'Whole foods only.', "a task's own note is the message");
check(plan[1].body === 'Day 5 — photograph it to tick it off.', 'without a note, the day and what to do');
const lastToday = plan.find((r) => r.title === 'Last call' && r.at.getDate() === 5);
check(!!lastToday && lastToday.at.getHours() === 22 && lastToday.body === '5 tasks still open — Day 5 ends at midnight.', 'last call at 22:00 says how many are open');

// Nine o'clock: today's 8:00 nudges have passed.
plan = planReminders({ now: day(2026, 10, 5, 9), startDate: day(2026, 10, 1), totalDays: 75, tasks, reminders: defaults, doneToday: none });
check(plan.filter((r) => r.at.getDate() === 5).length === 1, 'past times today are dropped, the last call stays');

// Two done today.
plan = planReminders({ now: day(2026, 10, 5, 7), startDate: day(2026, 10, 1), totalDays: 75, tasks, reminders: defaults, doneToday: new Set(['h1', 'h2']) });
const today = plan.filter((r) => r.at.getDate() === 5);
check(today.length === 4 && !today.some((r) => r.title === 'Eat clean' || r.title === 'Drink water'), 'done tasks are not reminded of today');
check(today.some((r) => r.body === '3 tasks still open — Day 5 ends at midnight.'), 'the last call counts what is left');
check(plan.some((r) => r.at.getDate() === 6 && r.title === 'Eat clean'), 'tomorrow they come back');

// Everything done today: no last call.
plan = planReminders({ now: day(2026, 10, 5, 7), startDate: day(2026, 10, 1), totalDays: 75, tasks, reminders: defaults, doneToday: new Set(tasks.map((t) => t.id)) });
check(plan.filter((r) => r.at.getDate() === 5).length === 0, 'a finished day has no last call');

// Joined, Day 1 in three days.
plan = planReminders({ now: day(2026, 10, 5, 7), startDate: day(2026, 10, 8), totalDays: 75, tasks, reminders: defaults, doneToday: none });
check(plan.length === 24 && plan[0].at.getDate() === 8, 'before Day 1, nothing until Day 1 morning');
check(plan[1].body.includes('Day 1'), 'and a reminder without a note says Day 1');

// The last day of the round.
plan = planReminders({ now: day(2026, 10, 5, 7), startDate: day(2026, 9, 21), totalDays: 15, tasks, reminders: defaults, doneToday: none });
check(plan.length === 6 && plan.every((r) => r.at.getDate() === 5), 'on the last day, only that day');

// Never: one task off, the last call off.
plan = planReminders({ now: day(2026, 10, 5, 7), startDate: day(2026, 10, 1), totalDays: 75, tasks, reminders: { tasks: { h3: null, h4: 19 * 60 + 30 }, lastCall: null }, doneToday: none });
check(plan.length === 28 && !plan.some((r) => r.title === 'Walk' || r.title === 'Last call'), 'Never means never');
check(plan.some((r) => r.title === 'Work out' && r.at.getHours() === 19 && r.at.getMinutes() === 30), 'a picked time is kept to the minute');

// Twelve tasks: more than an iPhone holds.
const many = Array.from({ length: 12 }, (_, i) => ({ id: `t${i}`, label: `Task ${i}` }));
plan = planReminders({ now: day(2026, 10, 5, 7), startDate: day(2026, 10, 1), totalDays: 75, tasks: many, reminders: defaults, doneToday: none });
check(plan.length === 60 && plan[59].at >= plan[0].at, 'capped at 60, soonest first');

// A task three times a week: Monday, Wednesday, Friday. 5 Oct 2026 is a
// Monday, so the week ahead holds three of it — and a last call only on the
// days something is due.
const lift = [{ id: 'l1', label: 'Lift', weekdays: [1, 3, 5] }];
plan = planReminders({ now: day(2026, 10, 5, 7), startDate: day(2026, 10, 1), totalDays: 75, tasks: lift, reminders: defaults, doneToday: none });
check(plan.filter((r) => r.title === 'Lift').map((r) => r.at.getDay()).join(',') === '1,3,5', 'a weekly task is only reminded of on its days');
check(plan.filter((r) => r.title === 'Last call').length === 3, 'and a rest day has no last call');

console.log(failures ? `${failures} FAILED` : 'ALL PASSED');
process.exit(failures ? 1 : 0);
