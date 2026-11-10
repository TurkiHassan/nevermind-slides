import { describe, expect, it } from 'vitest';
import { areaRect, pinPoint } from '../../src/ui/notes.ts';

describe('note geometry', () => {
  it('normalises and clamps an area drag to the 1920x1080 stage', () => {
    expect(areaRect({ x: 500, y: 400 }, { x: 100, y: 200 })).toEqual({ x: 100, y: 200, width: 400, height: 200 });
    expect(areaRect({ x: -40, y: -20 }, { x: 2000, y: 1200 })).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
    expect(areaRect({ x: 10, y: 10 }, { x: 10, y: 40 })).toBeNull();
  });

  it('places a pin at the visible top edge and keeps it inside the stage', () => {
    expect(pinPoint({ x: 100, y: 200, width: 400, height: 180 })).toEqual({ x: 300, y: 200 });
    expect(pinPoint({ x: 1900, y: -20, width: 100, height: 50 })).toEqual({ x: 1920, y: 0 });
  });
});
