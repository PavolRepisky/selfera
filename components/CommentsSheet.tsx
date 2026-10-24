import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  useColorScheme,
  useWindowDimensions,
  type TextInputInstance,
} from 'react-native';

import { colors, colorsFor, layout, radii, spacing, tapSlop, type } from '@/constants/theme';
import { ago } from '@/lib/format';
import { NATIVE_HEADER } from './Screen';
import { Avatar, type AvatarSource } from './Avatar';
import { BottomSheet, SheetScrollable, useKeyboardInset } from './BottomSheet';
import { SheetHeader } from './SheetHeader';
import { Text } from './Text';

export interface CommentEntry {
  id: string;
  author: string;
  avatar: AvatarSource;
  text: string;
  /** When it was said — stamped beside the name as "12m". None on a comment
   * kept from before threads carried one. */
  at?: Date;
  /** A reply can itself carry replies — the thread nests as deep as
   * whoever's replying takes it, not just the one level under a top-level
   * comment. */
  replies?: readonly CommentEntry[];
}

export interface CommentsSheetProps {
  visible: boolean;
  onDismiss: () => void;
  comments: readonly CommentEntry[];
  draft: string;
  onChangeDraft: (text: string) => void;
  /** `parentId` is the exact comment being replied to, at whatever depth it
   * sits, or `null` for a fresh top-level comment of the account's own. */
  onSubmit: (parentId: string | null) => void;
  /** Whoever is typing — the signed-in account's own circle on the composer. */
  composerAvatar: AvatarSource;
  /** Whose post it is, named in the field's hint ("Add a comment for
   * Mia…"). Left out on your own post. */
  recipient?: string;
}

/** Share of the screen the sheet stands at — tall enough for a real thread,
 * short of the `tall` sheets elsewhere so the post it belongs to still shows
 * through above it, the way Instagram's own comment sheet leaves the photo's
 * top edge in view. */
const HEIGHT_RATIO = 0.7;

/** Indent per level of nesting — `spacing.lg` stepped out for every reply a
 * thread goes, so depth reads at a glance instead of needing the eye to
 * count avatars back to the top-level comment. */
const INDENT = spacing.lg;

/** The cross that cancels a reply — a quiet glyph, its tap area grown to
 * the 44pt minimum around it. */
const CANCEL_GLYPH = 16;

/** A top-level comment's face, and a reply's a step smaller so the thread's
 * shape shows in the column of faces alone. */
const AVATAR = 36;
const REPLY_AVATAR = 28;

/** The composer's field and its send button stand at the 44pt tap height,
 * side by side at the same size, as the canvas draws them. */
const FIELD = 44;
const SEND_GLYPH = 18;

/** The send button's fill: the system blue on the iPhone, the way its own
 * Messages send button is, ink in the drawn look, which has no accent. The
 * paper plane on it stays light against either. */
const SEND_FILL = NATIVE_HEADER ? colors.systemAccent : colors.ink;
const SEND_INK = NATIVE_HEADER ? colors.onAccent : colors.inkInverse;

const threadSize = (comments: readonly CommentEntry[]): number =>
  comments.reduce((sum, c) => sum + 1 + threadSize(c.replies ?? []), 0);

interface ReplyTarget {
  id: string;
  author: string;
}

interface Row {
  key: string;
  comment: CommentEntry;
  /** How many replies deep this row sits — 0 for a top-level comment. */
  depth: number;
}

const rowsFor = (comments: readonly CommentEntry[], depth = 0): Row[] =>
  comments.flatMap((comment) => [
    { key: comment.id, comment, depth },
    ...rowsFor(comment.replies ?? [], depth + 1),
  ]);

/**
 * A post's comments, reached by tapping its comment icon rather than shown on
 * the post itself — the thread and the composer both live only here, the way
 * Instagram's own sheet works. Opens with the keyboard already up: replying
 * is the reason this sheet gets opened, so it asks for the reply straight
 * away rather than waiting for a second tap on the field.
 */
export function CommentsSheet({
  visible,
  onDismiss,
  comments,
  draft,
  onChangeDraft,
  onSubmit,
  composerAvatar,
  recipient,
}: CommentsSheetProps) {
  const { height } = useWindowDimensions();
  const scheme = colorsFor(useColorScheme());
  const keyboardUp = useKeyboardInset() > 0;
  const input = useRef<TextInputInstance>(null);
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);

  useEffect(() => {
    if (visible) {
      input.current?.focus();
    } else {
      // A sheet reopened later starts over, not mid-reply to whatever was
      // last tapped.
      setReplyTarget(null);
    }
  }, [visible]);

  const startReply = (target: ReplyTarget) => {
    setReplyTarget(target);
    input.current?.focus();
  };

  const count = threadSize(comments);
  const canSend = draft.trim().length > 0;

  const submit = () => {
    if (!canSend) return;
    onSubmit(replyTarget?.id ?? null);
    setReplyTarget(null);
  };

  return (
    <BottomSheet
      visible={visible}
      onDismiss={onDismiss}
      // Instagram's own composer sits flush against the edge it clears —
      // the safe area or the keyboard — rather than the sheet's usual
      // roomy distance short of it.
      bottomGap={0}
      size="large"
      handle
      style={{ height: Math.round(height * HEIGHT_RATIO) }}
    >
      {/* The same bar Share profile opens on: the title centred under the
          grabber. */}
      <SheetHeader
        title={count === 0 ? 'Comments' : count === 1 ? '1 comment' : `${count} comments`}
        style={styles.title}
      />

      <SheetScrollable>
        {(onScroll) => (
          <FlatList
            data={rowsFor(comments)}
            onScroll={onScroll}
            scrollEventThrottle={16}
            keyExtractor={(row) => row.key}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            // No overscroll at the top: a pull there moves the sheet, and a
            // bounce would drag the thread down inside it at the same time.
            bounces={false}
            overScrollMode="never"
            ListEmptyComponent={
              <Text variant="copy" color={colors.inkMuted} center style={styles.empty}>
                No comments yet — be the first to say something.
              </Text>
            }
            renderItem={({ item }) => (
              <View style={[styles.row, item.depth > 0 && { marginLeft: item.depth * INDENT }]}>
                <Avatar source={item.comment.avatar} size={item.depth > 0 ? REPLY_AVATAR : AVATAR} />
                <View style={styles.rowBody}>
                  {/* Who and when on a line of their own, the words under
                      them at reading size, Reply quietest of the three. */}
                  <Text variant="metaBold" color={colors.ink}>
                    {item.comment.author}
                    {item.comment.at ? (
                      <Text variant="badge" color={colors.inkMuted}>
                        {'  '}
                        {ago(item.comment.at)}
                      </Text>
                    ) : null}
                  </Text>
                  <Text variant="copy" color={colors.ink}>
                    {item.comment.text}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => startReply({ id: item.comment.id, author: item.comment.author })}
                    hitSlop={tapSlop(type.badge.lineHeight)}
                    style={styles.replyButton}
                  >
                    <Text variant="badge" color={colors.inkMuted}>
                      Reply
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          />
        )}
      </SheetScrollable>

      {replyTarget ? (
        <View style={styles.replyBanner}>
          <Text variant="meta" color={colors.inkMuted}>
            Replying to {replyTarget.author}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel reply"
            onPress={() => setReplyTarget(null)}
            hitSlop={tapSlop(CANCEL_GLYPH)}
          >
            <Ionicons name="close" size={CANCEL_GLYPH} color={colors.inkMuted} />
          </Pressable>
        </View>
      ) : null}

      {/* The rule's colour as a plain string: a dynamic colour on a border
          is resolved again when the row restyles for the keyboard, and
          iOS picked its dark value there, darkening the line on focus. */}
      <View
        style={[styles.composer, { borderTopColor: scheme.sheetRule }, keyboardUp && styles.composerOnKeys]}
      >
        <Avatar source={composerAvatar} size={AVATAR} />
        <View style={styles.field}>
          <TextInput
            ref={input}
            value={draft}
            onChangeText={onChangeDraft}
            placeholder={
              replyTarget
                ? `Reply to ${replyTarget.author}…`
                : recipient
                  ? `Add a comment for ${recipient}…`
                  : 'Add a comment…'
            }
            placeholderTextColor={colors.inkMuted}
            returnKeyType="send"
            onSubmitEditing={submit}
            style={styles.input}
          />
        </View>
        {/* Always there, so the row doesn't shift as typing starts; greyed
            until there's something to send. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send"
          accessibilityState={{ disabled: !canSend }}
          disabled={!canSend}
          onPress={submit}
          style={({ pressed }) => [styles.send, !canSend && styles.sendIdle, pressed && styles.sendPressed]}
        >
          <Ionicons name="paper-plane-outline" size={SEND_GLYPH} color={canSend ? SEND_INK : colors.inkMuted} />
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  // A block's gap under the bar, as on Share profile.
  title: {
    marginBottom: layout.block,
  },
  // Takes the height the title and composer leave, so the thread scrolls
  // inside the fixed sheet rather than pushing the composer off the bottom
  // of it.
  list: {
    flex: 1,
  },
  // A card's inset between comments, so each reads as its own row
  // without a rule drawn between them.
  listContent: {
    gap: layout.card,
  },
  empty: {
    marginTop: spacing['3xl'],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: layout.inline,
  },
  rowBody: {
    flex: 1,
  },
  replyButton: {
    alignSelf: 'flex-start',
  },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  // Air over the field, under the rule. None under it while the keyboard is
  // down: the sheet's own home-indicator clearance is already there, and
  // the row's padding on top of it left the field floating a step higher
  // than the sheet's other last lines sit.
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.inline,
    paddingTop: layout.heading,
    // The rule runs edge to edge, out through the sheet's side padding, so
    // it reads as the line the composer docks on rather than a seam inside
    // the thread; the row takes the padding back for its own contents.
    marginHorizontal: -layout.gutter,
    paddingHorizontal: layout.gutter,
    borderTopWidth: 1,
  },
  // With the keys up the sheet ends right on them, so the field keeps the
  // same air under it as over it rather than touching them.
  composerOnKeys: {
    paddingBottom: layout.heading,
  },
  // The pill field itself, `SearchBar`'s own cut — sunken on the sheet's
  // white the way Instagram's own comment field sits on its feed, rather
  // than a bare line with nothing marking where the tap target is.
  field: {
    flex: 1,
    height: FIELD,
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceSunken,
    paddingHorizontal: layout.block,
  },
  send: {
    width: FIELD,
    height: FIELD,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SEND_FILL,
  },
  // Nothing to send yet: the field's own grey, so the button sits back
  // until the draft gives it something to do.
  sendIdle: {
    backgroundColor: colors.surfaceSunken,
  },
  sendPressed: {
    opacity: 0.7,
  },
  // `copy`, the level a dialog's field is set in — face, size and tracking
  // only: a line height on a single-line field shifts the text off centre.
  input: {
    fontFamily: type.copy.fontFamily,
    fontSize: type.copy.fontSize,
    letterSpacing: type.copy.letterSpacing,
    color: colors.ink,
    padding: 0,
  },
});

export default CommentsSheet;
