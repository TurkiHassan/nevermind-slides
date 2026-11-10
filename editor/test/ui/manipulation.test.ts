import { describe, expect, it } from 'vitest';
import {
  acceptsManipulationPointer, freePositionClasses, manipulationClasses, snapMove, type ManipulationRect,
} from '../../src/ui/manipulation.ts';

const rect = (x: number, y: number, width: number, height: number): ManipulationRect => ({ x, y, width, height });

describe('acceptsManipulationPointer', () => {
  it('starts a primary pointer gesture without depending on click detail', () => {
    expect(acceptsManipulationPointer({ button: 0, detail: 0 })).toBe(true);
    expect(acceptsManipulationPointer({ button: 0, detail: 1 })).toBe(true);
    expect(acceptsManipulationPointer({ button: 1, detail: 0 })).toBe(false);
  });
});

describe('manipulationClasses', () => {
  it('keeps a right/top anchor when moving an absolute element', () => {
    expect(manipulationClasses(
      ['absolute', 'right-[104px]', 'top-[132px]', 'w-[900px]'],
      'absolute', rect(916, 132, 900, 420), { kind: 'move', dx: 40, dy: 16 },
    )).toEqual(['absolute', 'right-[64px]', 'top-[148px]', 'w-[900px]']);
  });

  it('moves a flow child with translate utilities', () => {
    expect(manipulationClasses(
      ['p-[28px]', 'bg-cream'], 'static', rect(80, 120, 400, 160), { kind: 'move', dx: 30, dy: 12 },
    )).toEqual(['p-[28px]', 'bg-cream', 'translate-x-[30px]', 'translate-y-[12px]']);
  });

  it('resizes from every axis represented by a north-west handle', () => {
    expect(manipulationClasses(
      ['absolute', 'left-[80px]', 'top-[640px]', 'w-[480px]', 'h-[300px]'],
      'absolute', rect(80, 640, 480, 300), { kind: 'resize', handle: 'nw', dx: -20, dy: -40 },
    )).toEqual(['absolute', 'left-[60px]', 'top-[600px]', 'w-[500px]', 'h-[340px]']);
  });
});

describe('snapMove', () => {
  it('snaps centres to the stage with a fixed screen-pixel threshold', () => {
    const snapped = snapMove(rect(900, 400, 100, 100), 8, 90, [], 0.5);
    expect(snapped).toMatchObject({ dx: 10, dy: 90 });
    expect(snapped.guides).toContainEqual({ axis: 'x', at: 960, from: 0, to: 1080 });
    expect(snapped.distances.length).toBeGreaterThan(0);
  });

  it('snaps to a sibling edge and reports the distance', () => {
    const snapped = snapMove(rect(100, 100, 200, 100), 298, 0, [rect(600, 100, 200, 100)], 1);
    expect(snapped.dx).toBe(300);
    expect(snapped.guides).toContainEqual({ axis: 'x', at: 600, from: 100, to: 200 });
    expect(snapped.distances).toContainEqual(expect.objectContaining({ axis: 'x', value: 300 }));
  });

  it('recognises equal spacing between two siblings', () => {
    const snapped = snapMove(rect(0, 100, 100, 100), 199, 0, [rect(50, 100, 100, 100), rect(350, 100, 100, 100)], 1);
    expect(snapped.dx).toBe(200);
    expect(snapped.equalSpacing).toBe(true);
  });
});

describe('freePositionClasses', () => {
  it('preserves the rendered box while converting a flow child to absolute positioning', () => {
    expect(freePositionClasses(
      ['relative', 'translate-x-[8px]', 'p-4'], rect(220, 160, 400, 180), rect(100, 80, 1000, 800),
    )).toEqual(['p-4', 'absolute', 'left-[120px]', 'top-[80px]', 'w-[400px]', 'h-[180px]']);
  });
});
