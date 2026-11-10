// Geometry of the rotary readout: a 270 degree arc that starts at the lower left (135 degrees, SVG angles run
// clockwise from +x) and ends at the lower right. Pure, so test/ui/dial.test.ts can check it without a DOM.

export const DIAL_START_DEG = 135;
export const DIAL_SWEEP_DEG = 270;

export interface DialGeometry {
  /** 0..1 position of the value on the arc (clamped). */
  frac: number;
  /** Length of the full track and of the value arc, for stroke-dasharray. */
  track: number;
  arc: number;
  circumference: number;
  /** End of the value arc: where the marker sits. */
  marker: { x: number; y: number };
}

export function dialGeometry(value: number, min: number, max: number, size: number, radius: number): DialGeometry {
  const span = max - min;
  const raw = span > 0 && Number.isFinite(value) ? (value - min) / span : 0;
  const frac = Math.min(1, Math.max(0, raw));
  const circumference = 2 * Math.PI * radius;
  const track = circumference * (DIAL_SWEEP_DEG / 360);
  const angle = ((DIAL_START_DEG + frac * DIAL_SWEEP_DEG) * Math.PI) / 180;
  const c = size / 2;
  return {
    frac,
    track,
    arc: track * frac,
    circumference,
    marker: { x: c + radius * Math.cos(angle), y: c + radius * Math.sin(angle) },
  };
}
