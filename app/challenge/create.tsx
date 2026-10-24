import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import {
  Button,
  DatePicker,
  HStack,
  Host,
  Picker,
  RNHostView,
  Spacer,
  SwipeActions,
  Text as SystemText,
  TextField,
  VStack,
  useNativeState,
} from '@expo/ui/swift-ui';
import {
  buttonStyle,
  contentShape,
  datePickerStyle,
  foregroundStyle,
  frame,
  labelsHidden,
  lineLimit,
  listRowBackground,
  listRowInsets,
  pickerStyle,
  shapes,
  tag,
  textInputAutocapitalization,
} from '@expo/ui/swift-ui/modifiers';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
  useColorScheme,
  type ScrollViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { quicksand, tint } from '@/lib/swiftUI';
import { Avatar } from '@/components/Avatar';
import { BottomSheet } from '@/components/BottomSheet';
import { buttonHeight, PrimaryButton } from '@/components/Buttons';
import {
  ChallengeLengthSheet,
  MAX_DAYS,
  MIN_DAYS,
} from '@/components/ChallengeLengthSheet';
import { EmptyState } from '@/components/EmptyState';
import { IconButton } from '@/components/IconButton';
import { PhotoLibrarySheet } from '@/components/PhotoLibrarySheet';
import { PhotoSlot } from '@/components/PhotoSlot';
import { Pill, pillHeights } from '@/components/Pill';
import { NATIVE_HEADER, ScreenScroll } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SettingsGroup, SettingsList } from '@/components/SettingsList';
import { StepBar } from '@/components/StepBar';
import { Text } from '@/components/Text';
import { WheelPicker } from '@/components/WheelPicker';
import {
  colors,
  layout,
  radii,
  shadows,
  spacing,
  tabBarBottom,
  type as typeScale,
  colorsFor,
} from '@/constants/theme';
import { CHALLENGES, type Challenge, type ChallengeCategory } from '@/data/challenges';
import { LIVES_PER_CHALLENGE, useApp, type TaskPhoto } from '@/hooks/useAppState';
import { CATEGORIES } from '@/hooks/useChallengeCards';
import { useSocial } from '@/hooks/useSocial';
import { inviteToRound } from '@/lib/backend/catalog';
import { addDays, longDate } from '@/lib/format';
import { DAY_MS, localDay, roundState, startOfToday } from '@/lib/round';

/** The photos that stand for a challenge everywhere else — its strip on
 * Discover and on its preview are drawn from these. Three fill the cover
 * mosaic exactly: one large, two stacked beside it. */
const PHOTO_COUNT = 3;

/** The cover mosaic: two of the small tiles stacked, sampled off the design,
 * so the lead photo beside them reads as the one people see first. */
const COVER_TILE = 84;
const COVER_HEIGHT = COVER_TILE * 2 + layout.grid;

/** The number square leading each task, and the tap target for its X. */
const TASK_NUMBER = 32;
const TASK_DELETE = 32;

/** The ring round the task being typed into — the same weight as the dashed
 * "Add a task" edge, so the two read as one kind of mark. */
const FOCUS_RULE = 2;
const DASH_RULE = 2;

/** Enough for a full morning or a full day without the list turning into a
 * chore to photograph — and as many as the day's mosaic has a layout for. */
const MAX_TASKS = 9;

/** The name's cap: short enough to sit on one line under the day on a
 * cover, well inside the server's 60. The description's leaves room for a
 * few sentences without the era page turning into an essay; the server
 * takes 500. Both fields stop there and count, as Edit profile's do. */
const NAME_MAX = 40;
const DESCRIPTION_MAX = 300;

/** How many of the topic's popular tasks are offered under the list. */
const SUGGESTION_COUNT = 3;

/** Where a fresh draft sets the length — the length every preset defaults to. */
const DEFAULT_DAYS = 75;

/** How far ahead a start date can be picked. Long enough to plan a season,
 * short enough that the wheel stays a quick flick. */
const START_WINDOW_DAYS = 90;

/** How long the default start leaves a new challenge open to join before
 * Day 1. Only the default: today can be picked too, since joining stays open
 * through Day 1 itself. */
const JOIN_WINDOW_DAYS = 7;

const MONDAY = 1;

/** Lives on offer: none (no misses at all) up to a generous five. */
const LIFE_OPTIONS = [0, 1, 2, 3, 4, 5];

/** The miss that ends a run, spelled out: "A third miss ends their run." */
const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];

/** The finished page's pile: three prints, the middle one on top, each
 * framed in white like something printed and laid down by hand. */
const PRINT_WIDTH = 100;
const PRINT_HEIGHT = 124;
const PRINT_LEAD_WIDTH = 112;
const PRINT_LEAD_HEIGHT = 140;
const PRINT_FRAME = 4;
const PRINT_TILT = 8;
const PILE_WIDTH = 200;
const PILE_HEIGHT = 150;

/** The same size as a person's row on Find friends. */
const INVITE_AVATAR = 48;
/** Friends offered an invite on the finished page — a couple to start with,
 * the share link covers everyone else. */
const INVITE_COUNT = 2;

const STEPS = 3;

/** Each step's name in the iPhone's bar, where the drawn form has its step
 * bar and the question on the page. */
const STEP_TITLES = { 2: 'Daily Tasks', 3: 'Rules' } as const;

/** Every length the wheel offers, a week to four months. */
const LENGTH_OPTIONS = Array.from({ length: MAX_DAYS - MIN_DAYS + 1 }, (_, i) => MIN_DAYS + i);

/** The topic picker's "none" — a topic is optional. */
const NO_TOPIC = 'none';

type Step = 1 | 2 | 3 | 'live';

interface DraftTask {
  id: string;
  label: string;
  note: string;
}

/** The first Monday at least a week out: a week for friends to join, and
 * every challenge's Day 1 lands at the start of a week. */
function defaultStartOffset(today: Date): number {
  const weekOut = addDays(today, JOIN_WINDOW_DAYS).getDay();
  return JOIN_WINDOW_DAYS + ((MONDAY - weekOut + 7) % 7);
}

/** Days from today to a challenge's Day 1 — what the start wheel counts in. */
function offsetTo(today: Date, start: Date): number {
  return Math.round((start.getTime() - today.getTime()) / DAY_MS);
}

const livesLabel = (n: number) => `${n} ${n === 1 ? 'life' : 'lives'}`;

function livesHint(n: number): string {
  if (n === 0) return 'No misses at all — one missed day ends a run.';
  const days = n === 1 ? '1 day' : `${n} days`;
  return `People can miss up to ${days}. A ${ORDINALS[n]} miss ends their run.`;
}

/**
 * Build-your-own challenge in three short steps — what it is, what everyone
 * does each day, and the rules — then a page saying it's live with the way
 * to bring people along. Each step asks one question on one field style, so
 * the form never reads as three forms stacked. Every challenge has one Day 1
 * that everyone in it shares, so a created one gets a start date too —
 * friends join before it. Saving adds it to the picker's Custom tab rather
 * than making it the active challenge.
 *
 * Opened with `edit`, the same three steps carry a challenge you built,
 * filled in, and the last one saves the changes and goes back instead of
 * announcing it. That holds only until Day 1: once it has started, people
 * are in on its terms, so the form says so and changes nothing.
 */
export default function CreateChallengeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const { addChallenge, updateChallenge, customChallenges, catalog } = useApp();
  const { relations, refreshToday } = useSocial();
  const scroll = useRef<ScrollViewInstance>(null);

  // Read once: the form holds its own draft from here, so the saved
  // challenge changing underneath it doesn't reset what's being typed.
  const [editing] = useState<Challenge | undefined>(() =>
    edit ? customChallenges.find((c) => c.id === edit) : undefined,
  );
  const [step, setStep] = useState<Step>(1);
  const [today] = useState(startOfToday);
  const [name, setName] = useState(editing?.name ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [topic, setTopic] = useState<ChallengeCategory | null>(editing?.category ?? null);
  const [photos, setPhotos] = useState<TaskPhoto[]>(() => [...(editing?.photos ?? [])]);
  // The photo being replaced, or the next free one when adding.
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  // An edited challenge's tasks keep their ids, so the save can tell the
  // ones carried over from the ones added.
  const [tasks, setTasks] = useState<DraftTask[]>(() =>
    editing
      ? editing.tasks.map((t) => ({ id: t.id, label: t.label, note: t.note ?? '' }))
      : [{ id: 'draft-task-0', label: '', note: '' }],
  );
  const [focusedTask, setFocusedTask] = useState<string | null>(null);
  const [startOffset, setStartOffset] = useState(() =>
    editing?.startDate
      ? Math.max(0, offsetTo(today, localDay(editing.startDate)))
      : defaultStartOffset(today),
  );
  const [pendingOffset, setPendingOffset] = useState(startOffset);
  const [startOpen, setStartOpen] = useState(false);
  const [days, setDays] = useState(editing?.defaultDays ?? DEFAULT_DAYS);
  const [lengthOpen, setLengthOpen] = useState(false);
  /** Which of the iPhone form's wheel sheets is open, if either. */
  const [openWheel, setOpenWheel] = useState<'start' | 'length' | null>(null);
  const [pendingDays, setPendingDays] = useState(days);
  const [lives, setLives] = useState(editing?.lives ?? LIVES_PER_CHALLENGE);
  const [pendingLives, setPendingLives] = useState(lives);
  const [livesOpen, setLivesOpen] = useState(false);
  const [invited, setInvited] = useState<readonly string[]>([]);
  // Saving goes to the server — photos up, then the challenge — so the
  // button waits on it and says why if it can't.
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  /** The new challenge's key, once it's saved — what invites point at. */
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const createdRound = catalog.find((l) => l.key === createdKey)?.section.roundId;
  const inviteFriends = relations.friendList.slice(0, INVITE_COUNT);

  // The calendar takes plain colours, picked for the appearance on show.
  const scheme = colorsFor(useColorScheme());
  const startDate = addDays(today, startOffset);
  const endDate = addDays(startDate, days - 1);
  // Stretched to reach a start already picked further out than the window,
  // so opening the wheel on an edit never moves it.
  // From today: an era can start the day it's made, and its first members
  // still join on Day 1.
  const startOffsets = Array.from(
    { length: Math.max(START_WINDOW_DAYS, startOffset) + 1 },
    (_, i) => i,
  );
  const startLabel = (offset: number) =>
    offset === 0 ? 'Today' : longDate(addDays(today, offset));

  const goTo = (next: Step) => {
    setStep(next);
    // A fresh step starts at its question, not wherever the last one was
    // scrolled to.
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  const addTaskRow = (label = '') =>
    setTasks((list) =>
      list.length >= MAX_TASKS
        ? list
        : [...list, { id: `draft-task-${list.length}-${Date.now()}`, label, note: '' }],
    );

  const updateTask = (id: string, patch: Partial<DraftTask>) =>
    setTasks((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const deleteTaskRow = (id: string) =>
    setTasks((list) => list.filter((t) => t.id !== id));

  // A suggestion fills the first empty row before it adds one, so tapping
  // one on a fresh list doesn't leave a blank row stranded above it.
  const addSuggestion = (label: string) => {
    const blank = tasks.find((t) => !t.label.trim());
    if (blank) updateTask(blank.id, { label });
    else addTaskRow(label);
  };

  const filledTasks = tasks.filter((t) => t.label.trim().length > 0);
  const taken = new Set(filledTasks.map((t) => t.label.trim().toLowerCase()));
  const suggestions = topic
    ? CHALLENGES.filter((c) => c.category === topic)
        .flatMap((c) => c.tasks.map((t) => t.label))
        .filter((label, i, all) => all.indexOf(label) === i && !taken.has(label.toLowerCase()))
        .slice(0, SUGGESTION_COUNT)
    : [];

  const basicsDone = name.trim().length > 0 && photos.length === PHOTO_COUNT;
  const tasksDone = filledTasks.length > 0;

  const kept = new Set(editing?.tasks.map((t) => t.id));
  const input = () => ({
    name: name.trim(),
    description: description.trim(),
    category: topic ?? undefined,
    photos,
    tasks: filledTasks.map((t) => ({
      ...(kept.has(t.id) ? { id: t.id } : null),
      label: t.label.trim(),
      ...(t.note.trim() ? { note: t.note.trim() } : null),
    })),
    days,
    startDate,
    lives,
  });

  const create = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      if (editing) {
        await updateChallenge(editing.id, input());
        router.back();
        return;
      }
      setCreatedKey(await addChallenge(input()));
      // Your friends, fresh, for the invites on the page that follows.
      refreshToday();
      goTo('live');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'That didn’t save. Try again.';
      setSaveError(message);
      // The iPhone's form has no dock to say it under, so the system says it.
      if (NATIVE_HEADER) Alert.alert('Couldn’t save', message);
    } finally {
      setSaving(false);
    }
  };

  /** An invite lands in the friend's activity, naming the round. Marked sent
   * at once; unmarked if it doesn't go. */
  const invite = (friendId: string) => {
    if (!createdRound) return;
    setInvited((list) => [...list, friendId]);
    inviteToRound(friendId, createdRound).catch(() =>
      setInvited((list) => list.filter((id) => id !== friendId)),
    );
  };

  // Gone, or under way: either way there's nothing left here to change.
  const locked =
    edit !== undefined &&
    (!editing?.startDate ||
      roundState(localDay(editing.startDate), editing.defaultDays).kind !== 'upcoming');

  // The link opens the challenge's own page, where its Join button is.
  const shareInvite = () => {
    const link = createdKey ? ` ${Linking.createURL(`feed/${createdKey}`)}` : '';
    Share.share({
      message: `Join me on "${name.trim()}" — it starts ${longDate(startDate)} on Selfera.${link}`,
    }).catch(() => {});
  };

  // The dock's own gap: what the floating tab bar keeps off the bottom edge,
  // so the band reads as that bar filled in.
  const dockGap = tabBarBottom(insets.bottom);

  const contentWidth = width - layout.gutter * 2;

  const header =
    step === 'live' ? (
      NATIVE_HEADER ? (
        <ScreenHeader
          showBack={false}
          actions={[{ label: 'Done', prominent: true, onPress: () => router.back() }]}
        />
      ) : undefined
    ) : (
      <ScreenHeader
        backIcon={step === 1 ? 'close' : 'chevron-back'}
        onBack={step === 1 ? undefined : () => goTo((step - 1) as Step)}
        middle={<StepBar step={step} total={STEPS} />}
        right={
          <Text variant="metaBold" color={colors.inkMuted}>
            {step} of {STEPS}
          </Text>
        }
      />
    );

  const dock =
    step === 1 ? (
      <PrimaryButton label="Next: daily tasks" disabled={!basicsDone} onPress={() => goTo(2)} />
    ) : step === 2 ? (
      <PrimaryButton label="Next: rules" disabled={!tasksDone} onPress={() => goTo(3)} />
    ) : step === 3 ? (
      <View style={styles.saveActions}>
        {saveError ? (
          <Text variant="meta" center>
            {saveError}
          </Text>
        ) : null}
        <PrimaryButton
          label={saving ? 'Saving…' : editing ? 'Save changes' : 'Create era'}
          disabled={saving}
          onPress={create}
        />
      </View>
    ) : null;

  if (locked) {
    return (
      <ScreenScroll tone="plain" header={<ScreenHeader backIcon="close" />}>
        <EmptyState
          icon="lock-closed"
          title={editing ? `${editing.name} has started` : 'Era not found'}
          hint="An era can be changed until its Day 1. After that, everyone in it keeps the rules they joined on."
        />
      </ScreenScroll>
    );
  }

  // On the iPhone the three steps are the system's own grouped form — the
  // one Calendar's New Event is — with the step's name in the bar and its
  // way on as the bar's Next, so the system sets every row, gap and margin.
  if (NATIVE_HEADER && step !== 'live') {
    const next =
      step === 1
        ? { label: 'Next', disabled: !basicsDone, onPress: () => goTo(2) }
        : step === 2
          ? { label: 'Next', disabled: !tasksDone, onPress: () => goTo(3) }
          : {
              label: saving ? 'Saving…' : editing ? 'Save' : 'Create',
              disabled: saving,
              onPress: create,
            };
    return (
      <View style={styles.screenRoot}>
        <SettingsList
          // A fresh step starts at its top, not where the last was scrolled.
          key={step}
          header={
            <ScreenHeader
              plainTitle={step === 1 ? (editing ? 'Edit Era' : 'New Era') : STEP_TITLES[step]}
              backIcon={step === 1 ? 'close' : 'chevron-back'}
              onBack={step === 1 ? undefined : () => goTo((step - 1) as Step)}
              actions={[{ ...next, prominent: true }]}
            />
          }
        >
          {step === 1 ? (
            <NativeBasics
              hint={
                editing
                  ? `Change anything until it starts on ${longDate(startDate)}.`
                  : `Add ${PHOTO_COUNT} photos — they’re what people see first.`
              }
              photos={photos}
              onPick={setActiveSlot}
              name={name}
              onName={setName}
              description={description}
              onDescription={setDescription}
              topic={topic}
              onTopic={setTopic}
            />
          ) : null}

          {step === 2 ? (
            <>
              <SettingsGroup
                title="Tasks"
                footer={`Each task is proven with one photo. Add a line so everyone does it the same way. Swipe left to remove one. Up to ${MAX_TASKS}.`}
              >
                {tasks.map((task, i) => (
                  <NativeTaskRow
                    key={task.id}
                    task={task}
                    index={i}
                    onChange={(patch) => updateTask(task.id, patch)}
                    onDelete={() => deleteTaskRow(task.id)}
                  />
                ))}
                {tasks.length < MAX_TASKS ? (
                  <Button
                    label="Add Task"
                    systemImage="plus.circle.fill"
                    onPress={() => addTaskRow()}
                    modifiers={[tint(scheme.systemAccent)]}
                  />
                ) : null}
              </SettingsGroup>
              {suggestions.length > 0 && tasks.length < MAX_TASKS ? (
                <SettingsGroup title={`Popular in ${topic}`}>
                  {suggestions.map((label) => (
                    <Button
                      key={label}
                      label={label}
                      systemImage="plus.circle"
                      onPress={() => addSuggestion(label)}
                      modifiers={[tint(scheme.systemAccent)]}
                    />
                  ))}
                </SettingsGroup>
              ) : null}
            </>
          ) : null}

          {step === 3 ? (
            <>
              {/* Starts and Length as rows with their value at the end, each
                  opening the system's wheel on a sheet from the bottom. */}
              <SettingsGroup
                footer={`Everyone starts together, and joining closes when that day ends. It ends ${longDate(endDate)}.`}
              >
                <NativeExpandRow
                  label="Starts"
                  value={startLabel(startOffset)}
                  open={openWheel === 'start'}
                  onPress={() => {
                    setPendingOffset(startOffset);
                    setOpenWheel('start');
                  }}
                />
                <NativeExpandRow
                  label="Length"
                  value={`${days} days`}
                  open={openWheel === 'length'}
                  onPress={() => {
                    setPendingDays(days);
                    setOpenWheel('length');
                  }}
                />
              </SettingsGroup>
              <SettingsGroup footer={livesHint(lives)}>
                <Picker
                  label="Lives"
                  selection={lives}
                  onSelectionChange={(n: number) => setLives(n)}
                  modifiers={[pickerStyle('menu'), tint(scheme.systemAccent)]}
                >
                  {LIFE_OPTIONS.map((n) => (
                    <SystemText key={n} modifiers={[tag(n)]}>
                      {livesLabel(n)}
                    </SystemText>
                  ))}
                </Picker>
              </SettingsGroup>
            </>
          ) : null}
        </SettingsList>

        <PhotoLibrarySheet
          visible={activeSlot !== null}
          onPick={(photo) => {
            if (activeSlot === null) return;
            const slot = activeSlot;
            setPhotos((list) =>
              slot < list.length ? list.map((p, i) => (i === slot ? photo : p)) : [...list, photo],
            );
            setActiveSlot(null);
          }}
          onDismiss={() => setActiveSlot(null)}
        />

        {/* The wheels on a sheet from the bottom, the way the app's other
            pickers open: a draft until Done, kept as it was if the sheet is
            pulled away. */}
        <BottomSheet visible={openWheel === 'start'} onDismiss={() => setOpenWheel(null)}>
          <Text variant="sectionHeading" center>
            Starts
          </Text>
          <Host matchContents={{ vertical: true }} style={styles.wheel}>
            <DatePicker
              selection={addDays(today, pendingOffset)}
              range={{
                start: addDays(today, startOffsets[0]),
                end: addDays(today, startOffsets[startOffsets.length - 1]),
              }}
              displayedComponents={['date']}
              onDateChange={(picked) => {
                const day = new Date(picked.getFullYear(), picked.getMonth(), picked.getDate());
                setPendingOffset(offsetTo(today, day));
              }}
              modifiers={[
                datePickerStyle('wheel'),
                labelsHidden(),
                frame({ maxWidth: Number.MAX_SAFE_INTEGER }),
              ]}
            />
          </Host>
          <PrimaryButton
            label="Done"
            onPress={() => {
              setStartOffset(pendingOffset);
              setOpenWheel(null);
            }}
          />
        </BottomSheet>

        <BottomSheet visible={openWheel === 'length'} onDismiss={() => setOpenWheel(null)}>
          <Text variant="sectionHeading" center>
            Length
          </Text>
          <Host matchContents={{ vertical: true }} style={styles.wheel}>
            <Picker
              selection={pendingDays}
              onSelectionChange={(n: number) => setPendingDays(n)}
              modifiers={[
                pickerStyle('wheel'),
                labelsHidden(),
                frame({ maxWidth: Number.MAX_SAFE_INTEGER }),
              ]}
            >
              {LENGTH_OPTIONS.map((n) => (
                <SystemText key={n} modifiers={[tag(n)]}>
                  {n} days
                </SystemText>
              ))}
            </Picker>
          </Host>
          <PrimaryButton
            label="Done"
            onPress={() => {
              setDays(pendingDays);
              setOpenWheel(null);
            }}
          />
        </BottomSheet>
      </View>
    );
  }

  return (
    // Absolute overlays need a positioned parent, otherwise their offsets
    // resolve against the scroll content instead of the screen.
    <View style={styles.screenRoot}>
      {/* The finished page has nowhere to go back to, so the bar the steps
          turned on goes away with them. */}
      {step === 'live' && !NATIVE_HEADER ? <Stack.Screen options={{ headerShown: false }} /> : null}
      <ScreenScroll
        ref={scroll}
        tone="plain"
        // Room for the dock, so the last row clears it. The scroll already
        // pads for the safe area, which the dock's own gap covers. The
        // finished page has no dock: its button sits on the page.
        bottomExtra={dock ? layout.block + buttonHeight + dockGap - insets.bottom : undefined}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        header={header}
      >
        {step === 1 ? (
          <>
            <Question
              title={editing ? 'Edit your era' : 'Start a new era'}
              hint={
                editing
                  ? `Change anything until it starts on ${longDate(startDate)}.`
                  : 'A name and a few photos people will see first.'
              }
            />

            <Cover
              photos={photos}
              width={contentWidth}
              onPick={setActiveSlot}
            />

            <View style={styles.fields}>
              <Field label="Name" count={`${name.length}/${NAME_MAX}`}>
                <TextInput
                  value={name}
                  onChangeText={(text) => setName(text.slice(0, NAME_MAX))}
                  accessibilityLabel="Name"
                  placeholder="Name your era"
                  placeholderTextColor={colors.inkMuted}
                  maxLength={NAME_MAX}
                  autoCapitalize="words"
                  style={styles.input}
                />
              </Field>
              <Field label="Description" count={`${description.length}/${DESCRIPTION_MAX}`}>
                <TextInput
                  value={description}
                  onChangeText={(text) => setDescription(text.slice(0, DESCRIPTION_MAX))}
                  accessibilityLabel="Description"
                  placeholder="What's it about, and who's it for?"
                  placeholderTextColor={colors.inkMuted}
                  maxLength={DESCRIPTION_MAX}
                  multiline
                  textAlignVertical="top"
                  style={[styles.input, styles.multiline]}
                />
              </Field>
            </View>

            <Text variant="itemTitle" style={styles.heading}>
              Topic
            </Text>
            <View style={styles.chips}>
              {CATEGORIES.map((category) => {
                const on = topic === category;
                return (
                  <Pill
                    key={category}
                    label={category}
                    icon={on ? 'checkmark' : undefined}
                    tone={on ? 'solid' : 'muted'}
                    labelVariant="metaBold"
                    // Tapping the picked one again clears it: a topic is
                    // optional, and there's no other way back to none.
                    onPress={() => setTopic(on ? null : category)}
                    style={!on && styles.flatPill}
                  />
                );
              })}
            </View>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Question
              title="What will everyone do each day?"
              hint="Each task is proven with one photo. Add a line so everyone does it the same way."
            />

            <View style={styles.taskList}>
              {tasks.map((task, i) => {
                const focused = focusedTask === task.id;
                return (
                  <View key={task.id} style={[styles.taskRow, focused && styles.taskRowFocused]}>
                    <View style={[styles.taskNumber, focused && styles.taskNumberFocused]}>
                      <Text variant="metaBold">{i + 1}</Text>
                    </View>
                    <View style={styles.taskFields}>
                      <TextInput
                        value={task.label}
                        onChangeText={(label) => updateTask(task.id, { label })}
                        onFocus={() => setFocusedTask(task.id)}
                        onBlur={() => setFocusedTask(null)}
                        placeholder={`Task ${i + 1}`}
                        placeholderTextColor={colors.inkMuted}
                        style={styles.taskInput}
                      />
                      <TextInput
                        value={task.note}
                        onChangeText={(note) => updateTask(task.id, { note })}
                        onFocus={() => setFocusedTask(task.id)}
                        onBlur={() => setFocusedTask(null)}
                        placeholder="How should people do it? (optional)"
                        placeholderTextColor={colors.inkMuted}
                        multiline
                        style={styles.noteInput}
                      />
                    </View>
                    <IconButton
                      name="close"
                      size={TASK_DELETE}
                      iconSize={16}
                      color={colors.inkMuted}
                      background={focused ? colors.surface : colors.surfaceSunken}
                      shadow={false}
                      onPress={() => deleteTaskRow(task.id)}
                      accessibilityLabel={`Remove task ${i + 1}`}
                    />
                  </View>
                );
              })}

              {tasks.length < MAX_TASKS ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => addTaskRow()}
                  style={({ pressed }) => [styles.addTask, pressed && styles.pressed]}
                >
                  <Ionicons name="add" size={18} color={colors.ink} />
                  <Text variant="copyBold">Add a task</Text>
                  <Text variant="copyBold" color={colors.inkMuted}>
                    · {tasks.length} of {MAX_TASKS}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {suggestions.length > 0 && tasks.length < MAX_TASKS ? (
              <>
                <Text variant="metaBold" color={colors.inkMuted} style={styles.heading}>
                  Popular in {topic}
                </Text>
                <View style={styles.chips}>
                  {suggestions.map((label) => (
                    <Pill
                      key={label}
                      label={label}
                      icon="add"
                      tone="muted"
                      labelVariant="metaBold"
                      onPress={() => addSuggestion(label)}
                      style={styles.flatPill}
                    />
                  ))}
                </View>
              </>
            ) : null}
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Question title="Set the rules" />

            <View style={styles.rules}>
              <Rule
                label="Starts"
                hint="Everyone starts together. Joining closes when that day ends."
              >
                <Pill
                  label={startLabel(startOffset)}
                  icon="calendar-outline"
                  tone="muted"
                  labelVariant="metaBold"
                  onPress={() => {
                    setPendingOffset(startOffset);
                    setStartOpen(true);
                  }}
                  style={styles.flatPill}
                />
              </Rule>
              <Rule label="Length" hint={`Ends ${longDate(endDate)}.`}>
                <Pill
                  label={`${days} days`}
                  trailingIcon="chevron-down"
                  tone="muted"
                  labelVariant="metaBold"
                  onPress={() => setLengthOpen(true)}
                  style={styles.flatPill}
                />
              </Rule>
              <Rule label="Lives" hint={livesHint(lives)}>
                <Pill
                  label={livesLabel(lives)}
                  icon="heart"
                  trailingIcon="chevron-down"
                  tone="muted"
                  labelVariant="metaBold"
                  onPress={() => {
                    setPendingLives(lives);
                    setLivesOpen(true);
                  }}
                  style={styles.flatPill}
                />
              </Rule>
            </View>
          </>
        ) : null}

        {step === 'live' ? (
          <View style={styles.live}>
            <View style={styles.pile}>
              {photos[1] ? (
                <Print photo={photos[1]} tilt={-PRINT_TILT} style={styles.printLeft} />
              ) : null}
              {photos[2] ? (
                <Print photo={photos[2]} tilt={PRINT_TILT} style={styles.printRight} />
              ) : null}
              <Print photo={photos[0]} lead style={styles.printLead} />
            </View>

            <View style={styles.liveText}>
              <Text variant="pageTitle" center>
                {name.trim()} is live
              </Text>
              <Text variant="copy" color={colors.inkMuted} center>
                {startOffset === 0
                  ? 'It starts today. Bring people along before midnight, when joining closes.'
                  : `It starts ${longDate(startDate)}. Bring people along before joining closes.`}
              </Text>
            </View>

            {/* Straight under the words that ask for it, on the page itself
                rather than docked on a band over it. */}
            <View style={styles.liveActions}>
              <PrimaryButton label="Share invite link" icon="share-outline" onPress={shareInvite} />
              {/* On the iPhone, Done is the bar's, where iOS puts it. */}
              {NATIVE_HEADER ? null : (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.back()}
                  hitSlop={spacing.sm}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <Text variant="copyBold">Done</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.invites}>
              {inviteFriends.map((friend) => {
                const sent = invited.includes(friend.id);
                return (
                  <View key={friend.id} style={styles.inviteRow}>
                    <Avatar source={friend.avatar} size={INVITE_AVATAR} />
                    <Text variant="copyBold" style={styles.inviteName}>
                      {friend.name}
                    </Text>
                    {/* The Add a post carries, so asking someone in reads
                        the same everywhere: solid with the person icon, then
                        the muted grey with just the words once sent. */}
                    <Pill
                      label={sent ? 'Invited' : 'Invite'}
                      icon={sent ? undefined : 'person-add'}
                      tone={sent ? 'muted' : 'solid'}
                      size="sm"
                      bold
                      onPress={sent ? undefined : () => invite(friend.id)}
                      // Once sent it has no press and so no button round it,
                      // and a bare pill sets itself to the row's top edge —
                      // held on the row's centre line, it stays put.
                      style={styles.invitePill}
                    />
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}
      </ScreenScroll>

      {/* Docked on a white band like Join on a challenge's preview, so the
          form scrolls away under it rather than showing through. */}
      {dock ? <View style={[styles.dock, { paddingBottom: dockGap }]}>{dock}</View> : null}

      <PhotoLibrarySheet
        visible={activeSlot !== null}
        onPick={(photo) => {
          if (activeSlot === null) return;
          const slot = activeSlot;
          setPhotos((list) =>
            slot < list.length
              ? list.map((p, i) => (i === slot ? photo : p))
              : [...list, photo],
          );
          setActiveSlot(null);
        }}
        onDismiss={() => setActiveSlot(null)}
      />

      {/* The start day on the iPhone's own date-wheel drum, the way My
          Profile picks a year. Done sets it; tapping away leaves it. */}
      <BottomSheet visible={startOpen} onDismiss={() => setStartOpen(false)}>
        <Text variant="sectionHeading" center>
          Starts
        </Text>
        <WheelPicker
          // Remounted on every open, so the drum starts on the day already
          // picked rather than wherever it was last left.
          key={startOpen ? 'open' : 'closed'}
          values={startOffsets}
          value={pendingOffset}
          onChange={setPendingOffset}
          format={startLabel}
          style={styles.wheel}
        />
        <PrimaryButton
          label="Done"
          onPress={() => {
            setStartOffset(pendingOffset);
            setStartOpen(false);
          }}
        />
      </BottomSheet>

      <BottomSheet visible={livesOpen} onDismiss={() => setLivesOpen(false)}>
        <Text variant="sectionHeading" center>
          Lives
        </Text>
        <WheelPicker
          key={livesOpen ? 'open' : 'closed'}
          values={LIFE_OPTIONS}
          value={pendingLives}
          onChange={setPendingLives}
          format={livesLabel}
          style={styles.wheel}
        />
        <PrimaryButton
          label="Done"
          onPress={() => {
            setLives(pendingLives);
            setLivesOpen(false);
          }}
        />
      </BottomSheet>

      <ChallengeLengthSheet
        visible={lengthOpen}
        onDismiss={() => setLengthOpen(false)}
        days={days}
        startDate={startDate}
        onConfirm={setDays}
      />
    </View>
  );
}

/**
 * The first step on the iPhone, as the system form's groups: the cover
 * mosaic as a row of its own, edge to edge in the group with no card behind
 * it; the name and description as the form's own fields; the topic as its
 * pull-down picker.
 */
function NativeBasics({
  hint,
  photos,
  onPick,
  name,
  onName,
  description,
  onDescription,
  topic,
  onTopic,
}: {
  hint: string;
  photos: readonly TaskPhoto[];
  onPick: (slot: number) => void;
  name: string;
  onName: (name: string) => void;
  description: string;
  onDescription: (description: string) => void;
  topic: ChallengeCategory | null;
  onTopic: (topic: ChallengeCategory | null) => void;
}) {
  const scheme = colorsFor(useColorScheme());
  // Seeded once from the draft; from then on the fields hold the text and
  // report every change back.
  const nameText = useNativeState(name);
  const descriptionText = useNativeState(description);
  // The group's width is the system's to set, so the mosaic measures it.
  const [coverWidth, setCoverWidth] = useState(0);

  return (
    <>
      <SettingsGroup footer={hint}>
        <HStack
          modifiers={[
            // SDK 58's `frame` takes a fixed or a flexible size, not both, so the
            // height and the full width are two frames, as SwiftUI chains them.
            frame({ height: COVER_HEIGHT }),
            frame({ maxWidth: Number.MAX_SAFE_INTEGER }),
            listRowInsets({ top: 0, leading: 0, bottom: 0, trailing: 0 }),
            listRowBackground('clear'),
          ]}
        >
          <RNHostView>
            <View
              style={styles.nativeCover}
              onLayout={(e) => setCoverWidth(e.nativeEvent.layout.width)}
            >
              {coverWidth > 0 ? (
                <Cover photos={photos} width={coverWidth} onPick={onPick} style={styles.coverFlush} />
              ) : null}
            </View>
          </RNHostView>
        </HStack>
      </SettingsGroup>

      {/* Each field its own group, its name over it and the count under it —
          Edit profile's label, box and count, in the system list's form. */}
      <SettingsGroup titleInk title="Name" footer={`${name.length}/${NAME_MAX}`}>
        <TextField
          text={nameText}
          placeholder="Name your era"
          maxLength={NAME_MAX}
          onTextChange={(text) => onName(text.slice(0, NAME_MAX))}
          modifiers={[textInputAutocapitalization('words')]}
        />
      </SettingsGroup>
      <SettingsGroup titleInk title="Description" footer={`${description.length}/${DESCRIPTION_MAX}`}>
        {/* Three lines tall before anything is typed, as the bio is, so it
            reads as the field to say more in. */}
        <TextField
          text={descriptionText}
          placeholder="What's it about, and who's it for?"
          axis="vertical"
          maxLength={DESCRIPTION_MAX}
          onTextChange={(text) => onDescription(text.slice(0, DESCRIPTION_MAX))}
          modifiers={[lineLimit({ min: 3, max: 6 })]}
        />
      </SettingsGroup>

      <SettingsGroup footer="Optional. It picks the popular tasks offered on the next step.">
        <Picker
          label="Topic"
          selection={topic ?? NO_TOPIC}
          onSelectionChange={(picked: string) =>
            onTopic(picked === NO_TOPIC ? null : (picked as ChallengeCategory))
          }
          modifiers={[pickerStyle('menu'), tint(scheme.systemAccent)]}
        >
          <SystemText modifiers={[tag(NO_TOPIC)]}>None</SystemText>
          {CATEGORIES.map((category) => (
            <SystemText key={category} modifiers={[tag(category)]}>
              {category}
            </SystemText>
          ))}
        </Picker>
      </SettingsGroup>
    </>
  );
}

/**
 * A task on the iPhone: its name and the line on how to do it as two of the
 * form's own fields in one row, and the system's swipe to delete it — the
 * way Reminders edits a list.
 */
function NativeTaskRow({
  task,
  index,
  onChange,
  onDelete,
}: {
  task: DraftTask;
  index: number;
  onChange: (patch: Partial<DraftTask>) => void;
  onDelete: () => void;
}) {
  const label = useNativeState(task.label);
  const note = useNativeState(task.note);
  // A suggestion can fill a blank row from outside the field; what was typed
  // in it comes back as the same text and is left alone.
  const typed = useRef(task.label);
  useEffect(() => {
    if (task.label === typed.current) return;
    typed.current = task.label;
    label.value = task.label;
  }, [task.label, label]);

  return (
    <SwipeActions>
      <VStack alignment="leading" spacing={layout.line}>
        <TextField
          text={label}
          placeholder={`Task ${index + 1}`}
          onTextChange={(text) => {
            typed.current = text;
            onChange({ label: text });
          }}
          modifiers={[quicksand('body', 'bold')]}
        />
        <TextField
          text={note}
          placeholder="How should people do it? (optional)"
          axis="vertical"
          onTextChange={(text) => onChange({ note: text })}
          modifiers={[
            quicksand('subheadline'),
            foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
          ]}
        />
      </VStack>
      <SwipeActions.Actions edge="trailing">
        <Button role="destructive" label="Delete" systemImage="trash" onPress={onDelete} />
      </SwipeActions.Actions>
    </SwipeActions>
  );
}

/**
 * A row of the system form that opens a wheel: its name, and its value at
 * the end — in the accent while its wheel is open, as Calendar marks the
 * time being set.
 */
function NativeExpandRow({
  label,
  value,
  open,
  onPress,
}: {
  label: string;
  value: string;
  open: boolean;
  onPress: () => void;
}) {
  const scheme = colorsFor(useColorScheme());
  return (
    <Button onPress={onPress} modifiers={[buttonStyle('plain')]}>
      {/* Stretched and given a solid shape, so a tap anywhere along the row
          counts, not only on its words. */}
      <HStack
        spacing={layout.inline}
        modifiers={[
          frame({ maxWidth: Number.MAX_SAFE_INTEGER, alignment: 'leading' }),
          contentShape(shapes.rectangle()),
        ]}
      >
        <SystemText>{label}</SystemText>
        <Spacer />
        <SystemText
          modifiers={[
            foregroundStyle(
              open ? scheme.systemAccent : { type: 'hierarchical', style: 'secondary' },
            ),
          ]}
        >
          {value}
        </SystemText>
      </HStack>
    </Button>
  );
}

/** Each step's one question, with the line under it saying what it's for. */
function Question({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.question}>
      <Text variant="pageTitle">{title}</Text>
      {hint ? (
        <Text variant="copy" color={colors.inkMuted}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * The cover as the mosaic it will be: the first photo large, the rest beside
 * it. Whatever's still missing is one tile saying how many more, in the space
 * those photos will take, so the gap always reads as a single ask.
 */
function Cover({
  photos,
  width,
  onPick,
  style,
}: {
  photos: readonly TaskPhoto[];
  width: number;
  onPick: (slot: number) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const missing = PHOTO_COUNT - photos.length;
  const leadWidth = Math.round(((width - layout.grid) * 2) / 3);
  const sideWidth = width - layout.grid - leadWidth;

  const add = (w: number, h: number, label: string) => (
    <PhotoSlot
      photo={null}
      width={w}
      height={h}
      radius={radii.md}
      emptyLabel={label}
      onPress={() => onPick(photos.length)}
      accessibilityLabel="Add photos"
    />
  );
  const photo = (i: number, w: number, h: number) => (
    <PhotoSlot
      photo={photos[i]}
      width={w}
      height={h}
      radius={radii.md}
      onPress={() => onPick(i)}
      accessibilityLabel={`Change photo ${i + 1}`}
    />
  );

  if (photos.length === 0) {
    return (
      <View style={[styles.cover, style]}>
        {add(width, COVER_HEIGHT, `Add ${PHOTO_COUNT} photos`)}
      </View>
    );
  }

  const more = `${missing} more`;
  return (
    <View style={[styles.cover, styles.coverRow, style]}>
      {photo(0, leadWidth, COVER_HEIGHT)}
      {photos.length === 1 ? (
        add(sideWidth, COVER_HEIGHT, more)
      ) : (
        <View style={styles.coverSide}>
          {photo(1, sideWidth, COVER_TILE)}
          {photos.length === 2 ? add(sideWidth, COVER_TILE, more) : photo(2, sideWidth, COVER_TILE)}
        </View>
      )}
    </View>
  );
}

/** A field as Edit profile draws it: its name over the box — in ink rather
 * than Edit profile's grey, so it reads as the page's question — how much of
 * its cap is used at the other end of that line, counted as you type, never
 * told off after, and the box under them. */
function Field({
  label,
  count,
  children,
  style,
}: {
  label: string;
  count?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={style}>
      <View style={styles.fieldHead}>
        <Text variant="meta" color={colors.ink}>
          {label}
        </Text>
        {count ? (
          <Text variant="badge" color={colors.inkMuted}>
            {count}
          </Text>
        ) : null}
      </View>
      <View style={styles.fieldBox}>{children}</View>
    </View>
  );
}

/** A rule: its name and its pill on one line, what it means for people
 * under them — the consequence spelled out, not just the setting. */
function Rule({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.rule}>
      <View style={styles.ruleRow}>
        <Text variant="itemTitle">{label}</Text>
        {children}
      </View>
      <Text variant="meta" color={colors.inkMuted}>
        {hint}
      </Text>
    </View>
  );
}

/** A photo in the finished page's pile, framed in white like a print. */
function Print({
  photo,
  lead,
  tilt,
  style,
}: {
  photo: TaskPhoto | undefined;
  lead?: boolean;
  tilt?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const w = lead ? PRINT_LEAD_WIDTH : PRINT_WIDTH;
  const h = lead ? PRINT_LEAD_HEIGHT : PRINT_HEIGHT;
  return (
    <View
      style={[
        styles.print,
        tilt ? { transform: [{ rotate: `${tilt}deg` }] } : null,
        style,
      ]}
    >
      <PhotoSlot
        photo={photo ?? null}
        width={w - PRINT_FRAME * 2}
        height={h - PRINT_FRAME * 2}
        radius={radii.md - PRINT_FRAME}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
  },
  question: {
    gap: layout.line,
    marginBottom: layout.section,
  },
  cover: {
    marginBottom: layout.section,
  },
  coverRow: {
    flexDirection: 'row',
    gap: layout.grid,
  },
  coverSide: {
    gap: layout.grid,
  },
  // In the iPhone's form the group's own gaps space it.
  coverFlush: {
    marginBottom: 0,
  },
  nativeCover: {
    flex: 1,
  },
  fields: {
    gap: layout.block,
  },
  // Nudged in off the box's corner, as on Edit profile.
  fieldHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: layout.stack,
    marginHorizontal: spacing.xs,
  },
  // Edit profile's box, in the page's grey fill rather than its white: this
  // page is white, and a white box on it would vanish.
  fieldBox: {
    paddingHorizontal: spacing.lg,
    paddingVertical: layout.inline,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceSunken,
  },
  // `copy` — face, size and tracking only: a line height on a single-line
  // field shifts the text off centre.
  input: {
    fontFamily: typeScale.copy.fontFamily,
    fontSize: typeScale.copy.fontSize,
    letterSpacing: typeScale.copy.letterSpacing,
    color: colors.ink,
    padding: 0,
  },
  // The description wraps, so it takes the line height back and opens three
  // lines tall, as the bio does.
  multiline: {
    lineHeight: typeScale.copy.lineHeight,
    minHeight: typeScale.copy.lineHeight * 3,
  },
  heading: {
    marginTop: layout.section,
    marginBottom: layout.heading,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: layout.stack,
  },
  // Flat, in the palette's fill grey rather than `muted`'s warmer one — the
  // same as the task rows and the fields' fills.
  flatPill: {
    backgroundColor: colors.surfaceSunken,
  },
  taskList: {
    gap: layout.stack,
  },
  // The ring is always drawn, in the row's own fill until the row is being
  // typed in, so focusing one doesn't nudge the list by its width.
  taskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: layout.inline,
    borderRadius: radii.lg,
    borderWidth: FOCUS_RULE,
    borderColor: colors.surfaceSunken,
    backgroundColor: colors.surfaceSunken,
    paddingVertical: layout.inline,
    paddingLeft: layout.inline,
    paddingRight: layout.stack,
  },
  taskRowFocused: {
    borderColor: colors.ink,
    backgroundColor: colors.surface,
  },
  taskNumber: {
    width: TASK_NUMBER,
    height: TASK_NUMBER,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskNumberFocused: {
    backgroundColor: colors.surfaceSunken,
  },
  taskFields: {
    flex: 1,
    gap: layout.line,
    // Sits the task's name on the number square's centre line.
    paddingTop: layout.line,
  },
  taskInput: {
    ...typeScale.copyBold,
    color: colors.ink,
    padding: 0,
  },
  noteInput: {
    ...typeScale.meta,
    color: colors.inkMuted,
    padding: 0,
  },
  // An outline rather than a fill: it's where the next row will go, not a
  // row yet.
  addTask: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: layout.line,
    height: pillHeights.lg,
    borderRadius: radii.lg,
    borderWidth: DASH_RULE,
    borderStyle: 'dashed',
    borderColor: colors.inkGhost,
  },
  rules: {
    gap: layout.section,
  },
  rule: {
    gap: layout.stack,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  live: {
    alignItems: 'center',
    paddingTop: spacing['4xl'],
  },
  pile: {
    width: PILE_WIDTH,
    height: PILE_HEIGHT,
    marginBottom: layout.section,
  },
  print: {
    position: 'absolute',
    padding: PRINT_FRAME,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    ...shadows.hard,
  },
  // The two behind sit a little lower than the lead, so its top edge is the
  // pile's highest point.
  printLeft: {
    left: 0,
    top: spacing.lg,
  },
  printRight: {
    right: 0,
    top: spacing.lg,
  },
  printLead: {
    left: (PILE_WIDTH - PRINT_LEAD_WIDTH) / 2,
    top: 0,
  },
  liveText: {
    gap: layout.stack,
    marginBottom: layout.section,
  },
  invites: {
    alignSelf: 'stretch',
    gap: layout.block,
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.inline,
  },
  inviteName: {
    flex: 1,
  },
  invitePill: {
    alignSelf: 'center',
  },
  // Why a save didn't go through sits just above the button that tried.
  saveActions: {
    gap: layout.stack,
  },
  liveActions: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: layout.block,
    marginBottom: layout.section,
  },
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: layout.block,
    paddingHorizontal: layout.gutter,
    backgroundColor: colors.surface,
    ...shadows.floating,
  },
  wheel: {
    marginVertical: layout.block,
  },
  pressed: {
    opacity: 0.7,
  },
});
