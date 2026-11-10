import { describe, expect, it } from 'vitest';
import { dialValueFromPoint, keyDialValue, settleDial } from '../../src/ui/dial-input.ts';

describe('interactive font-size dial', () => {
  it('maps the 270 degree dial sweep and clamps the dead zone', () => {
    const box = { left: 0, top: 0, width: 200, height: 200 };
    expect(dialValueFromPoint(29.3, 170.7, box, 12, 240)).toBeCloseTo(12, 0);
    expect(dialValueFromPoint(170.7, 170.7, box, 12, 240)).toBeCloseTo(240, 0);
    expect(dialValueFromPoint(100, 0, box, 12, 240)).toBeCloseTo(126, 0);
  });

  it('supports deterministic keyboard steps', () => {
    expect(keyDialValue(42, 'ArrowUp', false, 12, 240)).toBe(43);
    expect(keyDialValue(42, 'ArrowRight', true, 12, 240)).toBe(52);
    expect(keyDialValue(42, 'ArrowDown', true, 12, 240)).toBe(32);
    expect(keyDialValue(42, 'Home', false, 12, 240)).toBe(12);
    expect(keyDialValue(42, 'End', false, 12, 240)).toBe(240);
  });

  it('bounds inertia and snaps to a deck-used size; reduced motion removes inertia', () => {
    const stops = [16, 24, 36, 48, 64];
    expect(settleDial(35, 0.08, stops, false, 12, 240)).toBe(48);
    expect(settleDial(35, 5, stops, false, 12, 240)).toBe(64);
    expect(settleDial(35, 0.08, stops, true, 12, 240)).toBe(36);
  });
});
