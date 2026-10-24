import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, layout, radii, spacing, tapSlop } from '@/constants/theme';
import { Avatar, type AvatarSource } from './Avatar';
import { clock24 } from '@/lib/format';
import { TaskRing, profileRingSize } from './TaskRing';
import { Text } from './Text';

/** The poster's face beside their name — the height of a reaction pill, so
 * the header and the action row under a post sit on one scale. */
const POST_AVATAR = 32;
/** The ring's band against My Profile's: true to scale it came out a
 * hairline round a face this small, so it's drawn half as heavy again. */
const POST_RING_STROKE = 1.5;
/** That face in My Profile's ring: the photo stays at `POST_AVATAR`, and the
 * band and its gap go around it in the profile's proportions. */
const POST_RING = profileRingSize(POST_AVATAR, POST_RING_STROKE);
/** The face with no ring round it — a touch over `POST_AVATAR`, since the
 * ring's band is what gave the ringed face its weight. */
const POST_AVATAR_BARE = 36;
/** The drawn dot between the day and the challenge. */
const SUBTITLE_DOT = 3;


export interface PostHeaderProps {
  avatar: AvatarSource;
  name: string;
  /** When the day was posted, or when the photo on show was taken. */
  time?: string;
  day: number;
  challengeName: string;
  /** The day's tasks, done and all — what the ring is drawn from. */
  done?: number;
  total?: number;
  /** Draws the day's ring round the face. Off, the face stands bare — a feed
   * of one person's own days, where every post's ring would repeat what the
   * profile already showed. */
  ring?: boolean;
  /** Set over a photo: white type, the softer white for the detail. */
  onMedia?: boolean;
  onPressProfile?: () => void;
  onPressChallenge?: () => void;
  /** Drawn at the far end of the row — Members' Add, a story's close. */
  accessory?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Who posted a day and which day it was: the face, the name and the time,
 * then "Day N · challenge" under them. The one header a post wears wherever
 * it's met — Community, My days, a story — so it only ever changes here.
 *
 * The face and the name lead to the profile; the challenge leads to its feed
 * — separate tap targets, so neither is nested inside the other.
 */
export function PostHeader({
  avatar,
  name,
  time,
  day,
  challengeName,
  done = 0,
  total = 0,
  ring = true,
  onMedia,
  onPressProfile,
  onPressChallenge,
  accessory,
  style,
}: PostHeaderProps) {
  const ink = onMedia ? colors.onMedia : colors.ink;
  const soft = onMedia ? colors.onMediaSoft : colors.inkMuted;

  const challengeLink = (
    <Text
      variant="metaBold"
      color={soft}
      numberOfLines={1}
      accessibilityRole={onPressChallenge ? 'button' : undefined}
      accessibilityLabel={onPressChallenge ? `Open ${challengeName}` : undefined}
      onPress={onPressChallenge}
      // Plain, not underlined: the day leads, and the challenge is the same
      // one on every post.
      style={styles.shrink}
    >
      {challengeName}
    </Text>
  );
  const dayLabel = (
    <Text variant="metaBold" color={soft}>
      Day {day}
    </Text>
  );

  return (
    <View style={[styles.row, style]}>
      <Pressable
        accessibilityRole={onPressProfile ? 'button' : undefined}
        accessibilityLabel={onPressProfile ? `${name}'s profile` : undefined}
        onPress={onPressProfile}
        hitSlop={tapSlop(ring ? POST_RING : POST_AVATAR_BARE)}
        style={({ pressed }) => pressed && onPressProfile && styles.pressed}
      >
        {/* The day's own ring, the one My Profile draws: a segment per
            task, the done ones in the accent — so each day says at a
            glance how full it was. */}
        {ring ? (
          <TaskRing
            avatar={avatar}
            done={done}
            total={total}
            size={POST_RING}
            badge={false}
            look="profile"
            strokeScale={POST_RING_STROKE}
          />
        ) : (
          <Avatar source={avatar} size={POST_AVATAR_BARE} />
        )}
      </Pressable>

      <View style={styles.text}>
        <View style={styles.line}>
          <Text
            variant="itemTitle"
            color={ink}
            numberOfLines={1}
            accessibilityRole={onPressProfile ? 'button' : undefined}
            accessibilityLabel={onPressProfile ? `${name}'s profile` : undefined}
            onPress={onPressProfile}
            style={styles.shrink}
          >
            {name}
          </Text>
          {time ? (
            <Text variant="metaBold" color={soft}>
              {clock24(time.trim())}
            </Text>
          ) : null}
        </View>
        {/* The day leads: it's what tells one post from the next. */}
        <View style={styles.line}>
          {dayLabel}
          <View style={[styles.dot, { backgroundColor: soft }]} />
          {challengeLink}
        </View>
      </View>

      {accessory}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // A stack's gap rather than the row's usual inline one: the ring already
  // stands off the photo, so the name sits close and reads as the face's.
  text: {
    flex: 1,
    marginLeft: layout.stack,
  },
  // A bare step rather than a `layout` role: the air either side of the
  // separator dot is an optical call — close enough that the day, the dot
  // and the challenge read as one line of detail.
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + spacing.xs / 2,
  },
  // Gives way before the time or the day does, so a long name or challenge
  // ellipsizes rather than pushing the rest off the row.
  shrink: {
    flexShrink: 1,
  },
  // A drawn dot rather than a "·" glyph, so its size and the gap either side
  // are its own to set, not whatever a character happens to render at.
  dot: {
    width: SUBTITLE_DOT,
    height: SUBTITLE_DOT,
    borderRadius: radii.pill,
  },
  pressed: {
    opacity: 0.85,
  },
});

export default PostHeader;
