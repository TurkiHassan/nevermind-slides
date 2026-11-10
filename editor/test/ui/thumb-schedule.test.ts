import { describe, expect, it } from 'vitest';
import { loadOrder, nextBatch, type ThumbState } from '../../src/ui/thumb-schedule.ts';

describe('fihris thumbnail scheduling', () => {
  it('loads only visible idle tiles, current first then nearest outward', () => {
    const states: ThumbState[] = ['idle', 'ready', 'idle', 'idle', 'idle', 'idle'];
    const visible = new Set([0, 2, 3, 5]);

    expect(loadOrder(states, 3, visible)).toEqual([3, 2, 5, 0]);
  });

  it('never exceeds the available concurrent slots', () => {
    const states: ThumbState[] = ['loading', 'idle', 'idle', 'ready', 'idle'];

    expect(nextBatch(states, 2, new Set([0, 1, 2, 3, 4]), 2)).toEqual([2]);
  });

  it('starts no hidden thumbnails', () => {
    expect(nextBatch(['idle', 'idle', 'idle'], 1, new Set(), 2)).toEqual([]);
  });
});
