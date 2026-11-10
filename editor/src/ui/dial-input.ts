import { snapSize } from './property-ops.ts';

interface Box { left: number; top: number; width: number; height: number }

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export function dialValueFromPoint(x: number, y: number, box: Box, min: number, max: number): number {
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  let degrees = Math.atan2(y - cy, x - cx) * 180 / Math.PI;
  if (degrees < 0) degrees += 360;
  if (degrees < 135) degrees += 360;
  const t = clamp((degrees - 135) / 270, 0, 1);
  return Math.round((min + t * (max - min)) * 10) / 10;
}

export function keyDialValue(value: number, code: string, shift: boolean, min: number, max: number): number {
  if (code === 'Home') return min;
  if (code === 'End') return max;
  const direction = code === 'ArrowUp' || code === 'ArrowRight' ? 1 : code === 'ArrowDown' || code === 'ArrowLeft' ? -1 : 0;
  return clamp(value + direction * (shift ? 10 : 1), min, max);
}

export function settleDial(value: number, velocity: number, stops: number[], reducedMotion: boolean, min: number, max: number): number {
  const projected = clamp(value + (reducedMotion ? 0 : clamp(velocity * 160, -96, 96)), min, max);
  return snapSize(projected, stops);
}
