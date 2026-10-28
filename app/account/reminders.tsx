import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ReminderListRow, ReminderRow } from '@/components/ReminderPill';
import { NATIVE_HEADER, ScreenScroll } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SettingsGroup, SettingsList } from '@/components/SettingsList';
import { Text } from '@/components/Text';
import { colors, layout, radii, spacing } from '@/constants/theme';
import { DEFAULT_TASK_REMINDER, useApp } from '@/hooks/useAppState';
import { EVERY_DAY, taskWeekdays, weekdaysLabel } from '@/lib/schedule';

/** What each group's reminder does, said under it, so a time is never a
 * guess at when it comes or whether it comes at all. */
const TASKS_NOTE = 'A nudge at this time on its days, if the task has no photo yet.';
const LAST_CALL_NOTE = 'Only comes while a task is still missing today.';

/**
 * When each of today's tasks nudges you, and the one nudge that isn't a
 * task's — the last call, which only comes while one is still missing — on a
 * page of their own, opened from Settings' Reminders row. Each change is kept
 * as it's made, so there's nothing to save: back is done.
 */
export default function RemindersScreen() {
  const { tasks, schedule, reminders, setReminders } = useApp();

  // A task done a few times a week names its days under it: it only nudges
  // on those.
  const daysOf = (task: (typeof tasks)[number]) =>
    (task.perWeek ?? EVERY_DAY) < EVERY_DAY ? weekdaysLabel(taskWeekdays(task, schedule)) : undefined;

  const reminderFor = (taskId: string) =>
    taskId in reminders.tasks ? reminders.tasks[taskId] : DEFAULT_TASK_REMINDER;
  const setReminderFor = (taskId: string, at: number | null) =>
    setReminders({ ...reminders, tasks: { ...reminders.tasks, [taskId]: at } });

  /** The one reminder whose wheel is open, where the rows draw their own —
   * a task's id, or `lastCall`. One at a time, so the list stays short. */
  const [editing, setEditing] = useState<string | null>(null);
  const toggle = (key: string) => setEditing((current) => (current === key ? null : key));

  // On the iPhone, the same system list Settings is, so its group titles,
  // cards and spacing are the Settings page's own rather than drawn alike.
  if (NATIVE_HEADER) {
    return (
      <SettingsList header={<ScreenHeader plainTitle="Reminders" />}>
        <SettingsGroup title="Each task" footer={TASKS_NOTE}>
          {tasks.map((task) => (
            <ReminderListRow
              key={task.id}
              label={task.label}
              hint={daysOf(task)}
              value={reminderFor(task.id)}
              onChange={(at) => setReminderFor(task.id, at)}
            />
          ))}
        </SettingsGroup>
        <SettingsGroup title="Last call" footer={LAST_CALL_NOTE}>
          <ReminderListRow
            label="Last call"
            value={reminders.lastCall}
            onChange={(at) => setReminders({ ...reminders, lastCall: at })}
          />
        </SettingsGroup>
      </SettingsList>
    );
  }

  return (
    <ScreenScroll tone="alt" header={<ScreenHeader plainTitle="Reminders" />}>
      <View style={styles.group}>
        <Text variant="metaBold" color={colors.inkMuted} style={styles.groupTitle}>
          Each task
        </Text>
        <View style={styles.card}>
          {tasks.map((task, i) => (
            <ReminderRow
              key={task.id}
              label={task.label}
              hint={daysOf(task)}
              value={reminderFor(task.id)}
              onChange={(at) => setReminderFor(task.id, at)}
              open={editing === task.id}
              onToggle={() => toggle(task.id)}
              divider={i < tasks.length - 1}
            />
          ))}
        </View>
        <Text variant="footnote" color={colors.inkMuted} style={styles.groupFooter}>
          {TASKS_NOTE}
        </Text>
      </View>

      <View style={styles.group}>
        <Text variant="metaBold" color={colors.inkMuted} style={styles.groupTitle}>
          Last call
        </Text>
        <View style={styles.card}>
          <ReminderRow
            label="Last call"
            value={reminders.lastCall}
            onChange={(at) => setReminders({ ...reminders, lastCall: at })}
            open={editing === 'lastCall'}
            onToggle={() => toggle('lastCall')}
          />
        </View>
        <Text variant="footnote" color={colors.inkMuted} style={styles.groupFooter}>
          {LAST_CALL_NOTE}
        </Text>
      </View>
    </ScreenScroll>
  );
}

// Elsewhere, drawn as the Settings list's own drawn groups — a white card on
// the grey page, its title over it in the same type — so the page reads as
// one more page of Settings.
const styles = StyleSheet.create({
  group: {
    marginBottom: layout.section,
  },
  groupTitle: {
    marginBottom: layout.stack,
    marginLeft: spacing.xs,
  },
  groupFooter: {
    marginTop: layout.stack,
    marginHorizontal: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
  },
});
