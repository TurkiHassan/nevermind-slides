import { detectAnchor, moveClasses, resizeClasses, unsupportedReason, type Handle } from '../engine/class-algebra.ts';

export interface ManipulationRect { x: number; y: number; width: number; height: number }
export interface Guide { axis: 'x' | 'y'; at: number; from: number; to: number }
export interface Distance { axis: 'x' | 'y'; value: number; x: number; y: number }
export interface SnapResult {
  dx: number;
  dy: number;
  guides: Guide[];
  distances: Distance[];
  equalSpacing: boolean;
}

export type Gesture =
  | { kind: 'move'; dx: number; dy: number }
  | { kind: 'resize'; handle: Handle; dx: number; dy: number };

/** PointerEvent.detail is not a click-count contract; only the primary button decides gesture eligibility. */
export function acceptsManipulationPointer(event: Pick<PointerEvent, 'button' | 'detail'>): boolean {
  return event.button === 0;
}

export function manipulationClasses(classes: string[], position: string, rect: ManipulationRect, gesture: Gesture): string[] {
  const anchor = detectAnchor(classes, { position });
  return gesture.kind === 'move'
    ? moveClasses(classes, anchor, gesture.dx, gesture.dy, position !== 'absolute' && position !== 'fixed')
    : resizeClasses(classes, anchor, gesture.handle, gesture.dx, gesture.dy, { w: rect.width, h: rect.height });
}

export const manipulationRefusal = (classes: string[]): string | undefined => unsupportedReason(classes);

const points = (r: ManipulationRect, axis: 'x' | 'y'): number[] => axis === 'x'
  ? [r.x, r.x + r.width / 2, r.x + r.width]
  : [r.y, r.y + r.height / 2, r.y + r.height];

function shifted(r: ManipulationRect, dx: number, dy: number): ManipulationRect {
  return { ...r, x: r.x + dx, y: r.y + dy };
}

function axisSnap(moving: ManipulationRect, others: ManipulationRect[], axis: 'x' | 'y', threshold: number): { adjust: number; guide?: Guide } {
  const stage = axis === 'x' ? [0, 960, 1920] : [0, 540, 1080];
  const candidates = [
    ...stage.map((at) => ({ at, span: axis === 'x' ? [0, 1080] : [0, 1920] })),
    ...others.flatMap((r) => points(r, axis).map((at) => ({
      at,
      span: axis === 'x' ? [Math.min(moving.y, r.y), Math.max(moving.y + moving.height, r.y + r.height)]
        : [Math.min(moving.x, r.x), Math.max(moving.x + moving.width, r.x + r.width)],
    }))),
  ];
  let best: { delta: number; at: number; span: number[] } | null = null;
  for (const p of points(moving, axis)) {
    for (const candidate of candidates) {
      const delta = candidate.at - p;
      if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) best = { delta, at: candidate.at, span: candidate.span };
    }
  }
  return best ? { adjust: best.delta, guide: { axis, at: best.at, from: best.span[0], to: best.span[1] } } : { adjust: 0 };
}

function equalHorizontal(r: ManipulationRect, others: ManipulationRect[], threshold: number): number | null {
  const sorted = [...others].sort((a, b) => a.x - b.x);
  for (let i = 0; i < sorted.length - 1; i++) {
    const left = sorted[i];
    const right = sorted[i + 1];
    const targetX = (left.x + left.width + right.x - r.width) / 2;
    if (targetX >= left.x + left.width && targetX + r.width <= right.x && Math.abs(r.x - targetX) <= threshold) return targetX - r.x;
  }
  return null;
}

/** Smart alignment in stage pixels. The six-pixel threshold is constant on screen. */
export function snapMove(rect: ManipulationRect, dx: number, dy: number, siblings: ManipulationRect[], zoom: number): SnapResult {
  const threshold = 6 / Math.max(zoom, 0.01);
  let moving = shifted(rect, dx, dy);
  const equal = equalHorizontal(moving, siblings, threshold);
  let equalSpacing = false;
  if (equal !== null) { dx += equal; moving = shifted(rect, dx, dy); equalSpacing = true; }
  const sx = axisSnap(moving, siblings, 'x', threshold);
  dx += sx.adjust;
  moving = shifted(rect, dx, dy);
  const sy = axisSnap(moving, siblings, 'y', threshold);
  dy += sy.adjust;
  const guides = [sx.guide, sy.guide].filter((g): g is Guide => !!g);
  return {
    dx, dy, guides, equalSpacing,
    distances: [
      { axis: 'x', value: Math.round(Math.abs(dx)), x: rect.x + dx / 2, y: rect.y - 18 },
      { axis: 'y', value: Math.round(Math.abs(dy)), x: rect.x + rect.width + 18, y: rect.y + dy / 2 },
    ].filter((d) => d.value > 0) as Distance[],
  };
}

const POSITION = /^(?:static|relative|absolute|fixed|sticky|(?:-?translate-[xy])-.+|(?:left|right|top|bottom|inset(?:-[xy])?)-.+|w-.+|h-.+)$/;

export function freePositionClasses(classes: string[], rect: ManipulationRect, parent: ManipulationRect): string[] {
  const kept = classes.filter((token) => token.includes(':') || !POSITION.test(token));
  return [...kept, 'absolute', `left-[${Math.round(rect.x - parent.x)}px]`, `top-[${Math.round(rect.y - parent.y)}px]`,
    `w-[${Math.round(rect.width)}px]`, `h-[${Math.round(rect.height)}px]`];
}
