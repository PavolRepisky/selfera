import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, layout, radii } from '@/constants/theme';
import { WEEK, WEEKDAY_LETTER, WEEKDAY_SHORT } from '@/lib/schedule';
import { Text } from './Text';

/** One day's chip: a fingertip wide, and seven of them still fit a phone's
 * narrowest row beside nothing else. */
const CHIP = 36;

export interface WeekdayPickerProps {
  /** The weekdays picked, 0 Sunday to 6 Saturday, in the order they were
   * picked. */
  value: readonly number[];
  onChange: (days: number[]) => void;
  /** How many make a full pick — a task's times a week. */
  count: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * The week as seven round chips, Monday first, for picking which days a
 * task is done on. Picked days fill with ink. It holds exactly `count`: once
 * that many are picked, tapping another day hands it the pick made first,
 * so the day you want is always one tap away and never a dead chip.
 */
export function WeekdayPicker({ value, onChange, count, style }: WeekdayPickerProps) {
  const press = (day: number) => {
    if (value.includes(day)) onChange(value.filter((d) => d !== day));
    else onChange([...value, day].slice(-count));
  };

  return (
    <View style={[styles.row, style]}>
      {WEEK.map((day) => {
        const picked = value.includes(day);
        return (
          <Pressable
            key={day}
            onPress={() => press(day)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: picked }}
            accessibilityLabel={WEEKDAY_SHORT[day]}
            hitSlop={layout.line}
            style={({ pressed }) => [styles.chip, picked && styles.chipPicked, pressed && styles.pressed]}
          >
            <Text variant="metaBold" color={picked ? colors.inkInverse : colors.ink}>
              {WEEKDAY_LETTER[day]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default WeekdayPicker;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chip: {
    width: CHIP,
    height: CHIP,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSunken,
  },
  chipPicked: {
    backgroundColor: colors.ink,
  },
  pressed: {
    opacity: 0.85,
  },
});
