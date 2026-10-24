import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Text } from './Text';
import { absoluteFill, colors, layout, radii, shadows } from '@/constants/theme';

/** The track's height — a thumb's target, the size of the phone's own
 * slide to answer. */
const TRACK_HEIGHT = 60;
/** Room between the knob and the track's edge, all round. */
const KNOB_INSET = 4;
const KNOB = TRACK_HEIGHT - KNOB_INSET * 2;
/** The arrow on the knob. */
const KNOB_ICON = 22;
/** The chevrons after the label, pointing the way to slide. */
const HINT_ICON = 14;
/** How far along the knob has to be let go to count — most of the way, so
 * a nudge never posts by accident, short of the end so it doesn't take a
 * perfect throw. */
const CONFIRM_AT = 0.8;
/** How far the label has faded by the time the knob is halfway: gone
 * before the knob reaches it, so the two never overlap. */
const LABEL_FADE = 0.5;
/** The label breathing between these, once round every so often — the
 * phone's own slide to answer draws the eye along it the same way, without
 * anything moving across. */
const PULSE_LOW = 0.45;
const PULSE_MS = 1100;

export interface SlideToConfirmProps {
  /** What sliding does — "Slide to post". */
  label: string;
  /** Run once the knob has been carried to the end and let go. */
  onConfirm: () => void;
  /** Greyed and still: the knob doesn't move. */
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * A knob carried along a track to do something that shouldn't happen by a
 * stray tap — the phone's own slide to answer. The label breathes to say
 * it can be slid; as the knob goes, the track fills in ink behind it, so the
 * knob grows into a pill reaching back to the start. Let go short of the end, it springs back;
 * carried to the end, it stays there with a tick and `onConfirm` runs.
 * VoiceOver and TalkBack reach it as a button.
 */
export function SlideToConfirm({ label, onConfirm, disabled, style }: SlideToConfirmProps) {
  const [width, setWidth] = useState(0);
  const travel = Math.max(width - KNOB - KNOB_INSET * 2, 0);
  const x = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const done = useRef(false);
  const [confirmed, setConfirmed] = useState(false);

  // Read inside the responder, which is made once.
  const live = useRef({ travel, onConfirm, disabled });
  live.current = { travel, onConfirm, disabled };

  // Put back at the start whenever it's offered again.
  useEffect(() => {
    if (!disabled) {
      done.current = false;
      setConfirmed(false);
      x.setValue(0);
    }
  }, [disabled, x]);

  useEffect(() => {
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: PULSE_LOW,
          duration: PULSE_MS,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: PULSE_MS,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    breathe.start();
    return () => breathe.stop();
  }, [pulse]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !live.current.disabled && !done.current,
        // Sideways only, so the page still scrolls under a vertical drag.
        onMoveShouldSetPanResponder: (_, g) =>
          !live.current.disabled && !done.current && Math.abs(g.dx) > Math.abs(g.dy),
        // Once the knob is held, the scroll view doesn't get to take it.
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, g) => {
          x.setValue(Math.min(Math.max(g.dx, 0), live.current.travel));
        },
        onPanResponderRelease: (_, g) => {
          const { travel: end, onConfirm: confirm } = live.current;
          if (end > 0 && g.dx >= end * CONFIRM_AT) {
            done.current = true;
            setConfirmed(true);
            Animated.timing(x, { toValue: end, duration: 120, useNativeDriver: true }).start(() =>
              confirm(),
            );
          } else {
            Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(x, { toValue: 0, useNativeDriver: true }).start();
        },
      }),
    [x],
  );

  const labelOpacity = Animated.multiply(
    pulse,
    x.interpolate({
      inputRange: [0, Math.max(travel * LABEL_FADE, 1)],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    }),
  );
  // The trail: a track-wide strip of ink, slid in from the left so its
  // rounded end always sits under the knob's.
  const trailShift = x.interpolate({
    inputRange: [0, Math.max(travel, 1)],
    outputRange: [-travel, 0],
    extrapolate: 'clamp',
  });
  const trailOpacity = x.interpolate({
    inputRange: [0, KNOB / 2],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={() => {
        if (!disabled) onConfirm();
      }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[styles.track, disabled && styles.disabled, style]}
    >
      {width > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.trail,
            { width, opacity: trailOpacity, transform: [{ translateX: trailShift }] },
          ]}
        >
          <View style={styles.trailFill} />
        </Animated.View>
      ) : null}
      <Animated.View style={[styles.label, { opacity: labelOpacity }]} pointerEvents="none">
        <Text variant="copyBold" color={colors.inkMuted}>
          {label}
        </Text>
        <View style={styles.chevrons}>
          <Ionicons name="chevron-forward" size={HINT_ICON} color={colors.inkGhost} />
          <Ionicons name="chevron-forward" size={HINT_ICON} color={colors.inkMuted} />
        </View>
      </Animated.View>
      <Animated.View
        {...responder.panHandlers}
        style={[styles.knob, shadows.soft, { transform: [{ translateX: x }] }]}
      >
        <Ionicons
          name={confirmed ? 'checkmark' : 'arrow-forward'}
          size={KNOB_ICON}
          color={colors.inkInverse}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: TRACK_HEIGHT,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceSunken,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  trail: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  // The knob's own ink, so the two read as one shape.
  trailFill: {
    ...absoluteFill,
    backgroundColor: colors.ink,
  },
  // Centred on what's left of the track past the knob, the way the phone's
  // own sits — the knob slides over where it was.
  label: {
    ...absoluteFill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: layout.line,
    paddingLeft: KNOB,
  },
  // Two chevrons stepping up in strength — the way to go, read at a glance.
  chevrons: {
    flexDirection: 'row',
  },
  knob: {
    position: 'absolute',
    left: KNOB_INSET,
    width: KNOB,
    height: KNOB,
    borderRadius: radii.pill,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
});

export default SlideToConfirm;
