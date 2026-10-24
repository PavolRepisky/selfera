/**
 * A day's tasks in the order its grid shows them — the Tasks tab, the post it
 * goes up as, the profile tile and the week row all read this, so a photo
 * sits in the same cell everywhere. A done task stays in the cell it was shot
 * into; one with no cell of its own (seeded history) and the tasks still open
 * fill the free cells in checklist order, so an open cell always suggests
 * the next task on the list.
 *
 * Kept out of `useAppState` so the backend can order a day without importing
 * the hook — that import ran in a circle through `demoEra`.
 */
export function orderBySlot<T extends { id: string }>(
  tasks: readonly T[],
  day: Record<string, { done?: boolean; slot?: number }> | undefined,
): T[] {
  const cells: (T | null)[] = tasks.map(() => null);
  const loose: T[] = [];
  for (const task of tasks) {
    const entry = day?.[task.id];
    const slot = entry?.done ? entry.slot : undefined;
    if (slot !== undefined && slot >= 0 && slot < cells.length && !cells[slot]) cells[slot] = task;
    else loose.push(task);
  }
  return cells.map((cell) => cell ?? loose.shift()!);
}
