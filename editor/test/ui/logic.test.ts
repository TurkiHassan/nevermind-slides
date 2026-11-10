import { describe, expect, it } from 'vitest';
import { nextZoom } from '../../src/ui/actions.ts';
import { dialGeometry } from '../../src/ui/dial-geometry.ts';
import { computeFit, STAGE_W } from '../../src/ui/preview.tsx';
import { cssColourToHex, flattenColours, nearestWeight } from '../../src/ui/readouts.ts';
import { roleFor } from '../../src/ui/roles.ts';

describe('canvas and readout logic', () => {
  it('keeps the slide at least 760px wide in the 1280x800 compact layout well', () => {
    expect(computeFit(912, 654) * STAGE_W).toBeGreaterThanOrEqual(760);
  });

  it('steps through fixed zoom stops without overshooting the ends', () => {
    expect(nextZoom(0.5, 1)).toBe(0.67);
    expect(nextZoom(0.5, -1)).toBe(0.33);
    expect(nextZoom(3, 1)).toBe(3);
  });

  it('clamps dial geometry to the 270 degree track', () => {
    expect(dialGeometry(0, 12, 240, 168, 72).frac).toBe(0);
    const max = dialGeometry(300, 12, 240, 168, 72);
    expect(max.frac).toBe(1);
    expect(max.arc).toBeCloseTo(max.track);
  });

  it('reads CSS colours and flattens nested deck colour tokens', () => {
    expect(cssColourToHex('rgb(31 59 255 / 50%)')).toBe('#1f3bff');
    expect(cssColourToHex('rgba(1, 2, 3, 0)')).toBeNull();
    expect([...flattenColours({ ink: '#171614', tab: { DEFAULT: '#fff', mint: '#a8d98a' } })]).toEqual([
      ['ink', '#171614'],
      ['tab', '#fff'],
      ['tab-mint', '#a8d98a'],
    ]);
    expect(nearestWeight(650)).toBe(700);
  });
});

describe('plain-language element roles', () => {
  it('names the first h1 as the main title and a later h2 as a heading', () => {
    expect(roleFor({ tag: 'h1', isSlide: false, hasText: true, childTags: [], firstHeading: true })).toBe('mainTitle');
    expect(roleFor({ tag: 'h2', isSlide: false, hasText: true, childTags: [], firstHeading: false })).toBe('heading');
  });

  it('treats SVG drawings as one shape and text with inline runs as one text block', () => {
    expect(roleFor({ tag: 'svg', isSlide: false, hasText: false, childTags: ['path'], firstHeading: false })).toBe('shape');
    expect(roleFor({ tag: 'p', isSlide: false, hasText: true, childTags: ['span', 'strong'], firstHeading: false })).toBe('text');
  });
});
