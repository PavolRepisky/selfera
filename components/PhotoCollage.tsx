import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { absoluteFill, colors, layout, radii } from '@/constants/theme';
import type { ImageSourcePropType } from '@/lib/imageSource';
import { Placeholder } from './Placeholder';
import { ShotStamp } from './ShotStamp';
import { Text } from './Text';

/** One piece of the mosaic — a task's proof photo, or the slot where it goes. */
export interface CollageCell {
  /** Stable across renders: the arrangement is derived from it. */
  key: string;
  photo?: ImageSourcePropType | null;
  seed?: string | null;
  /**
   * When the task behind this tile was completed, as the app prints a shot's
   * time — "07:19" (`shotClock`). Only stamped on a tile that actually
   * carries a photo — a shot still waiting to be taken has no moment to
   * report.
   */
  time?: string;
  /** The task's name: under its time on a filled tile, and written in the
   * middle of its open slot — each square is its own task's. */
  label?: string;
  /** How the task's photo should be taken, under its name in an open slot. */
  note?: string;
  onPress?: () => void;
}

export interface PhotoCollageProps {
  cells: readonly CollageCell[];
  /** The block's width over its height — the post's own 3:4 on Tasks, so
   * it fills in at the shape it goes up in. A square by default. */
  ratio?: number;
  /** Corner radius of the block. Defaults to the signature `lg` cut. */
  radius?: number;
  style?: StyleProp<ViewStyle>;
  /** Drawn over the block — the day's cover once the post is complete, and
   * the clock floating at its top. */
  children?: React.ReactNode;
}

/** The line between pieces where a caller doesn't set its own — the
 * calendar's day cells, small enough that two photos need parting. */
const MOSAIC_SEAM = 1;

/** Every piece of the mosaic takes an equal share of whatever row or column
 * it falls in, whatever shape that row or column ends up. */
const MOSAIC_PIECE = { flex: 1 } as const;

/** The ink disc with a plus in an open slot — big enough to read as the
 * thing to tap, small enough to leave the task's name the slot's words. */
const PLUS_DISC = 34;
/** The plus inside it. */
const PLUS_GLYPH = 20;

/** One piece of the mosaic: the photo, or the open slot asking for it. */
function MosaicTile({ cell }: { cell: CollageCell }) {
  const filled = !!(cell.photo || cell.seed);

  const content = filled ? (
    <>
      {cell.photo ? (
        <Image source={cell.photo} style={absoluteFill} contentFit="cover" />
      ) : (
        <Placeholder seed={cell.seed ?? cell.key} radius={0} style={absoluteFill} />
      )}
      {/* When it was shot over what it proves, across its middle — the
          same stamp the post's own photo slides wear on Community. */}
      <ShotStamp time={cell.time} label={cell.label} />
    </>
  ) : (
    // A plain grey cell, the way a profile's empty photo slot reads as "a
    // photo goes here" without a button of its own: the whole cell is the
    // button. Before Day 1, with nothing to press yet, it names its task
    // without the plus.
    <View style={[absoluteFill, styles.empty]}>
      <View style={styles.slot}>
        {cell.onPress ? (
          <View style={styles.plus}>
            <Ionicons name="add" size={PLUS_GLYPH} color={colors.inkInverse} />
          </View>
        ) : null}
        {cell.label ? (
          <Text variant="metaBold" center numberOfLines={2}>
            {cell.label}
          </Text>
        ) : null}
        {cell.note ? (
          <Text variant="meta" color={colors.inkMuted} center numberOfLines={3}>
            {cell.note}
          </Text>
        ) : null}
      </View>
    </View>
  );

  if (!cell.onPress) return <View style={MOSAIC_PIECE}>{content}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        filled
          ? `${cell.label ?? 'Photo'}${cell.time ? `, ${cell.time}` : ''}`
          : `Take the ${cell.label ?? ''} photo`
      }
      onPress={cell.onPress}
      style={({ pressed }) => [MOSAIC_PIECE, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

export interface MosaicArrangementProps<T extends { key: string }> {
  cells: readonly T[];
  /** Must set `key={cell.key}` on the element it returns. */
  renderCell: (cell: T) => React.ReactElement;
  /**
   * Overrides the seam width in px, for a caller that needs no gap at all —
   * a grid that draws its own border per cell, where a real gap would show a
   * sliver of whatever sits behind the grid rather than a seam.
   */
  seam?: number;
}

/**
 * Cuts a set of cells into one square, a fixed arrangement for each count
 * from one to nine:
 *
 *   1 the whole square      4 a corner each         7 tall · two · tall, over three
 *   2 two tall halves       5 two over three        8 one tall, then squares
 *   3 a tall half, two      6 three across, twice   9 three by three
 *     squares beside it
 *
 * Every piece is square or taller than wide, because the photos are shot
 * upright on a phone and a wide strip would cut the person out of them; and
 * none is narrower than a third, so the grid still reads at a calendar cell's
 * size. Seven to nine sit on a three-by-three lattice, a task taking two of
 * its cells where the count leaves some over. The first task always holds the
 * top-left piece. Past nine — the database allows a few more than the create
 * screen offers — the lattice simply keeps going in rows of three.
 *
 * Generic over what a cell renders as, and pulled out of `PhotoCollage` so
 * other grids — a post, a story, a profile tile, a calendar day — lay their
 * cells out identically without re-deriving the split.
 */
export function MosaicArrangement<T extends { key: string }>({
  cells,
  renderCell,
  seam,
}: MosaicArrangementProps<T>) {
  const gap = seam ?? MOSAIC_SEAM;
  const column = { flex: 1, flexDirection: 'column', gap } as const;
  const row = { flex: 1, flexDirection: 'row', gap } as const;
  const c = cells;

  // A piece two lattice cells long: twice the share of a single one, plus the
  // seam it swallows, so its edges land on the lattice's own lines.
  const tall = (cell: T) => (
    <View key={cell.key} style={{ flexGrow: 2, flexShrink: 1, flexBasis: gap }}>
      {renderCell(cell)}
    </View>
  );
  const line = (style: typeof row | typeof column, items: React.ReactNode[], key?: string) => (
    <View key={key} style={style}>
      {items}
    </View>
  );

  switch (c.length) {
    case 1:
      return renderCell(c[0]);
    case 2:
      return line(row, c.map(renderCell));
    case 3:
      return line(row, [renderCell(c[0]), line(column, [renderCell(c[1]), renderCell(c[2])], 'side')]);
    case 4:
    case 5:
    case 6: {
      const top = c.length === 6 ? 3 : 2;
      return line(column, [
        line(row, c.slice(0, top).map(renderCell), 'top'),
        line(row, c.slice(top).map(renderCell), 'bottom'),
      ]);
    }
    // Seven and eight are drawn column by column, so a tall piece and the
    // squares beside it share the lattice's vertical lines exactly.
    case 7:
      return line(row, [
        line(column, [tall(c[0]), renderCell(c[4])], 'left'),
        line(column, [renderCell(c[1]), renderCell(c[3]), renderCell(c[5])], 'middle'),
        line(column, [tall(c[2]), renderCell(c[6])], 'right'),
      ]);
    case 8:
      return line(row, [
        line(column, [tall(c[0]), renderCell(c[5])], 'left'),
        line(column, [renderCell(c[1]), renderCell(c[3]), renderCell(c[6])], 'middle'),
        line(column, [renderCell(c[2]), renderCell(c[4]), renderCell(c[7])], 'right'),
      ]);
    default: {
      const rows: T[][] = [];
      for (let i = 0; i < c.length; i += 3) rows.push(c.slice(i, i + 3));
      return line(
        column,
        rows.map((three, r) => line(row, three.map(renderCell), `row-${r}`)),
      );
    }
  }
}

/**
 * Today's post at the shape it goes up in, the Tasks tab's grid: the tasks
 * already shot show their photo with its time and task across the middle, the
 * rest wait as grey cells naming their task. Cut with no seam, so photos
 * meet with nothing between them, as the one post they become; only where
 * two open cells share an edge is a grey line drawn, so they still read as
 * two places a photo goes.
 */
/** Where a piece sits in the mosaic, as shares of its width and height. */
interface PieceRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Each piece's place in the unit square, cut exactly as `MosaicArrangement`
 * cuts it with no seam — so lines can be laid over just the edges that need
 * one, rather than a seam running under every piece.
 */
function mosaicRects(count: number): PieceRect[] {
  const third = 1 / 3;
  const rect = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });
  const across = (n: number, y: number, h: number) =>
    Array.from({ length: n }, (_, i) => rect(i / n, y, 1 / n, h));
  switch (count) {
    case 1:
      return [rect(0, 0, 1, 1)];
    case 2:
      return across(2, 0, 1);
    case 3:
      return [rect(0, 0, 0.5, 1), rect(0.5, 0, 0.5, 0.5), rect(0.5, 0.5, 0.5, 0.5)];
    case 4:
    case 5:
    case 6: {
      const top = count === 6 ? 3 : 2;
      return [...across(top, 0, 0.5), ...across(count - top, 0.5, 0.5)];
    }
    case 7:
      return [
        rect(0, 0, third, 2 * third),
        rect(third, 0, third, third),
        rect(2 * third, 0, third, 2 * third),
        rect(third, third, third, third),
        rect(0, 2 * third, third, third),
        rect(third, 2 * third, third, third),
        rect(2 * third, 2 * third, third, third),
      ];
    case 8:
      return [
        rect(0, 0, third, 2 * third),
        rect(third, 0, third, third),
        rect(2 * third, 0, third, third),
        rect(third, third, third, third),
        rect(2 * third, third, third, third),
        rect(0, 2 * third, third, third),
        rect(third, 2 * third, third, third),
        rect(2 * third, 2 * third, third, third),
      ];
    default: {
      const rows = Math.ceil(count / 3);
      return Array.from({ length: rows }, (_, r) =>
        across(Math.min(3, count - r * 3), r / rows, 1 / rows),
      ).flat();
    }
  }
}

/** Shares this close count as the same line — thirds don't add up exactly. */
const EDGE_EPSILON = 1e-6;

/** Every edge two open pieces share: where it runs, and which way. */
function openSeams(cells: readonly CollageCell[]) {
  const rects = mosaicRects(cells.length);
  const open = (i: number) => !(cells[i].photo || cells[i].seed);
  const seams: { key: string; vertical: boolean; at: number; from: number; length: number }[] = [];
  for (let i = 0; i < cells.length; i++) {
    for (let j = 0; j < cells.length; j++) {
      if (i === j || !open(i) || !open(j)) continue;
      const a = rects[i];
      const b = rects[j];
      // a's right edge on b's left edge, or a's foot on b's head.
      if (Math.abs(a.x + a.w - b.x) < EDGE_EPSILON) {
        const from = Math.max(a.y, b.y);
        const length = Math.min(a.y + a.h, b.y + b.h) - from;
        if (length > EDGE_EPSILON) {
          seams.push({ key: `${cells[i].key}|${cells[j].key}`, vertical: true, at: b.x, from, length });
        }
      }
      if (Math.abs(a.y + a.h - b.y) < EDGE_EPSILON) {
        const from = Math.max(a.x, b.x);
        const length = Math.min(a.x + a.w, b.x + b.w) - from;
        if (length > EDGE_EPSILON) {
          seams.push({ key: `${cells[i].key}-${cells[j].key}`, vertical: false, at: b.y, from, length });
        }
      }
    }
  }
  return seams;
}

export function PhotoCollage({
  cells,
  ratio = 1,
  radius = radii.lg,
  style,
  children,
}: PhotoCollageProps) {
  if (cells.length === 0) return null;

  return (
    <View style={[styles.block, { aspectRatio: ratio, borderRadius: radius }, style]}>
      <MosaicArrangement
        cells={cells}
        seam={0}
        renderCell={(cell) => <MosaicTile key={cell.key} cell={cell} />}
      />
      {openSeams(cells).map((seam) => (
        <View
          key={seam.key}
          pointerEvents="none"
          style={[
            styles.seam,
            seam.vertical
              ? { left: `${seam.at * 100}%`, top: `${seam.from * 100}%`, height: `${seam.length * 100}%`, width: MOSAIC_SEAM, marginLeft: -MOSAIC_SEAM / 2 }
              : { top: `${seam.at * 100}%`, left: `${seam.from * 100}%`, width: `${seam.length * 100}%`, height: MOSAIC_SEAM, marginTop: -MOSAIC_SEAM / 2 },
          ]}
        />
      ))}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    overflow: 'hidden',
    backgroundColor: colors.surfaceSunken,
  },
  empty: {
    backgroundColor: colors.surfaceSunken,
  },
  // The line between two open cells, a shade darker than their grey,
  // centred on the edge they share.
  seam: {
    position: 'absolute',
    backgroundColor: colors.inkGhost,
  },
  slot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: layout.stack,
    padding: layout.stack,
  },
  plus: {
    width: PLUS_DISC,
    height: PLUS_DISC,
    borderRadius: radii.pill,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
});

export default PhotoCollage;
