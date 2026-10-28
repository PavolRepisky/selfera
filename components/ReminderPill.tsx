import {
  DatePicker,
  HStack,
  Host,
  Spacer,
  Text as SystemText,
  Toggle,
  VStack,
} from '@expo/ui/swift-ui';
import { datePickerStyle, foregroundStyle, labelsHidden } from '@expo/ui/swift-ui/modifiers';
import { useRef, type ReactNode } from 'react';
import { StyleSheet, View, useColorScheme, type StyleProp, type ViewStyle } from 'react-native';

import { colors, colorsFor, layout } from '@/constants/theme';
import { clockTime } from '@/lib/format';
import { quicksand, tint } from '@/lib/swiftUI';
import { Pill } from './Pill';
import { NATIVE_HEADER } from './Screen';
import { Text } from './Text';
import { WheelPicker } from './WheelPicker';

/** Every quarter hour of the day: fine enough for a nudge, few enough that
 * the wheel still flicks from morning to night. */
const QUARTER_HOURS = Array.from({ length: 24 * 4 }, (_, i) => i * 15);

/** Never, as a stop on the wheel — ahead of the first time, so turning a
 * reminder off is the same flick as moving it. */
const NEVER = -1;
const REMINDER_STOPS = [NEVER, ...QUARTER_HOURS];

/** The ring round an open pill. Always drawn, in the pill's own fill until
 * its wheel opens, so opening one doesn't nudge its row by the ring's width. */
const OPEN_RING = 2;

export interface ReminderPillProps {
  /** Minutes after midnight, or null for Never. */
  value: number | null;
  onPress: () => void;
  /** Whether its wheel is out — the pill takes an ink ring and its caret
   * turns up. */
  open?: boolean;
  /** Set on a fill-grey card, where the pill's own grey would vanish: it
   * turns white instead. */
  onFill?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * A reminder's time, or Never in the muted grey with the bell struck
 * through. It only says what's set; the wheel that changes it is laid out
 * by the list it sits in — see `ReminderRow`.
 */
export function ReminderPill({ value, onPress, open, onFill, style }: ReminderPillProps) {
  return (
    <Pill
      label={value === null ? 'Never' : clockTime(value)}
      icon={value === null ? 'notifications-off-outline' : 'notifications-outline'}
      labelColor={value === null ? colors.inkMuted : undefined}
      trailingIcon={open ? 'chevron-up' : 'chevron-down'}
      tone="muted"
      size="sm"
      labelVariant="metaBold"
      onPress={onPress}
      style={[styles.pill, onFill && styles.pillOnFill, open && styles.pillOpen, style]}
    />
  );
}

export interface ReminderRowProps {
  label: string;
  /** A muted line under the label — a task's note, what the last call is. */
  hint?: string;
  /** The label in `copyBold`, for a list that is the page's whole point
   * rather than one Settings line among others. */
  strong?: boolean;
  value: number | null;
  onChange: (value: number | null) => void;
  /** Whether this row's wheel is out. The list holds which one is, so only
   * one is open at a time. */
  open: boolean;
  onToggle: () => void;
  /** Rules the row off from the one below it. */
  divider?: boolean;
  /** Drawn under the row, inside its rule — the join page's weekday chips
   * for a task that isn't daily. */
  children?: ReactNode;
}

/**
 * One reminder as a line of a list: what it's for, and its pill. Tapping the
 * pill opens the wheel under the line, in place — Never at its top, then
 * every quarter hour — and each stop it turns to is kept as it goes, so
 * there's no menu or sheet stacked over the page or window it sits in.
 */
export function ReminderRow(props: ReminderRowProps) {
  return NATIVE_HEADER ? <SystemReminderRow {...props} /> : <DrawnReminderRow {...props} />;
}

/** Where a reminder lands when it is switched on with no time of its own to
 * go back to: eight in the morning, the app's own default. */
const DEFAULT_ON = 8 * 60;

/**
 * On the iPhone, the row the Clock app's alarms use: the time as the system's
 * compact time button — tapped, it opens its own wheel — and a switch beside
 * it for whether there's a nudge at all. Off hides the time; on brings back
 * the last one it had.
 */
function SystemReminderRow({ label, hint, strong, value, onChange, divider, children }: ReminderRowProps) {
  // The time's editing highlight in the system blue; the switch keeps the
  // system's green.
  const scheme = colorsFor(useColorScheme());
  const lastOn = useRef(value ?? DEFAULT_ON);
  if (value !== null) lastOn.current = value;
  const at = new Date();
  at.setHours(Math.floor(lastOn.current / 60), lastOn.current % 60, 0, 0);

  return (
    <View style={divider && styles.rowDivider}>
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text variant={strong ? 'copyBold' : 'copy'} numberOfLines={1}>
            {label}
          </Text>
          {hint ? (
            <Text variant="meta" color={colors.inkMuted} numberOfLines={strong ? 1 : undefined}>
              {hint}
            </Text>
          ) : null}
        </View>
        <Host matchContents>
          <HStack spacing={layout.stack}>
            {value !== null ? (
              <DatePicker
                selection={at}
                displayedComponents={['hourAndMinute']}
                onDateChange={(next) => onChange(next.getHours() * 60 + next.getMinutes())}
                modifiers={[datePickerStyle('compact'), labelsHidden(), tint(scheme.systemAccent)]}
              />
            ) : null}
            <Toggle
              isOn={value !== null}
              onIsOnChange={(on) => onChange(on ? lastOn.current : null)}
              modifiers={[labelsHidden()]}
            />
          </HStack>
        </Host>
      </View>
      {children ? <View style={styles.rowExtra}>{children}</View> : null}
    </View>
  );
}

/**
 * A reminder as a row of the system's own list, for a page built from
 * `SettingsList` on the iPhone: what it's for (and the line under it), then
 * the compact time button and the switch — all SwiftUI, so the row sits in
 * the list's own groups like any Settings row.
 */
export function ReminderListRow({
  label,
  hint,
  value,
  onChange,
}: Pick<ReminderRowProps, 'label' | 'hint' | 'value' | 'onChange'>) {
  // The time's editing highlight in the system blue; the switch keeps the
  // system's green.
  const scheme = colorsFor(useColorScheme());
  const lastOn = useRef(value ?? DEFAULT_ON);
  if (value !== null) lastOn.current = value;
  const at = new Date();
  at.setHours(Math.floor(lastOn.current / 60), lastOn.current % 60, 0, 0);

  return (
    <HStack spacing={layout.stack}>
      <VStack alignment="leading" spacing={layout.line / 2}>
        <SystemText modifiers={[quicksand()]}>{label}</SystemText>
        {hint ? (
          <SystemText
            modifiers={[quicksand('footnote'), foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}
          >
            {hint}
          </SystemText>
        ) : null}
      </VStack>
      <Spacer />
      {value !== null ? (
        <DatePicker
          selection={at}
          displayedComponents={['hourAndMinute']}
          onDateChange={(next) => onChange(next.getHours() * 60 + next.getMinutes())}
          modifiers={[datePickerStyle('compact'), labelsHidden(), tint(scheme.systemAccent)]}
        />
      ) : null}
      <Toggle
        isOn={value !== null}
        onIsOnChange={(on) => onChange(on ? lastOn.current : null)}
        modifiers={[labelsHidden()]}
      />
    </HStack>
  );
}

function DrawnReminderRow({
  label,
  hint,
  strong,
  value,
  onChange,
  open,
  onToggle,
  divider,
  children,
}: ReminderRowProps) {
  return (
    <View style={divider && styles.rowDivider}>
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text variant={strong ? 'copyBold' : 'copy'} numberOfLines={1}>
            {label}
          </Text>
          {hint ? (
            <Text variant="meta" color={colors.inkMuted} numberOfLines={strong ? 1 : undefined}>
              {hint}
            </Text>
          ) : null}
        </View>
        <ReminderPill value={value} open={open} onPress={onToggle} />
      </View>
      {open ? (
        <WheelPicker
          values={REMINDER_STOPS}
          value={value ?? NEVER}
          onChange={(stop) => onChange(stop === NEVER ? null : stop)}
          format={(stop) => (stop === NEVER ? 'Never' : clockTime(stop))}
          style={styles.rowWheel}
        />
      ) : null}
      {children ? <View style={styles.rowExtra}>{children}</View> : null}
    </View>
  );
}

export default ReminderPill;

const styles = StyleSheet.create({
  pill: {
    backgroundColor: colors.surfaceSunken,
    borderWidth: OPEN_RING,
    borderColor: colors.surfaceSunken,
  },
  pillOnFill: {
    backgroundColor: colors.surface,
    borderColor: colors.surface,
  },
  pillOpen: {
    borderColor: colors.ink,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.inline,
    paddingVertical: layout.inline,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceSunken,
  },
  rowText: {
    flex: 1,
    gap: layout.line / 2,
  },
  rowWheel: {
    marginBottom: layout.inline,
  },
  rowExtra: {
    gap: layout.stack,
    paddingBottom: layout.inline,
  },
});
