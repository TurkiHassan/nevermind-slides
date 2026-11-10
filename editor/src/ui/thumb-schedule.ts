// Which fihris thumbnails to load next: only tiles on screen, the current slide first, then outward by distance
// (ties to the earlier slide), at most `slots` at a time. Pure, tested in test/ui/thumb-schedule.test.ts.

export type ThumbState = 'idle' | 'loading' | 'ready';

export function loadOrder(states: readonly ThumbState[], current: number, visible: ReadonlySet<number>): number[] {
  return states
    .map((s, i) => ({ s, i }))
    .filter(({ s, i }) => s === 'idle' && visible.has(i))
    .map(({ i }) => i)
    .sort((a, b) => Math.abs(a - current) - Math.abs(b - current) || a - b);
}

/** The tiles to start now, given how many are already loading. */
export function nextBatch(states: readonly ThumbState[], current: number, visible: ReadonlySet<number>, slots: number): number[] {
  const busy = states.filter((s) => s === 'loading').length;
  return loadOrder(states, current, visible).slice(0, Math.max(0, slots - busy));
}
