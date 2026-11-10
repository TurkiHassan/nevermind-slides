import type { NodeKey } from './types.ts';

export type EditableProperty =
  | 'fontFamily' | 'fontSize' | 'fontWeight' | 'textColour' | 'fillColour'
  | 'lineHeight' | 'opacity' | 'left' | 'right' | 'top' | 'bottom';

type UtilityGroup = 'font-family' | 'font-size' | 'font-weight' | 'text-color' | 'bg-color'
  | 'leading' | 'opacity' | 'left' | 'right' | 'top' | 'bottom';

export interface PropertyOp { kind: 'setUtility'; id: NodeKey; group: UtilityGroup; value: string }

const GROUP: Record<EditableProperty, UtilityGroup> = {
  fontFamily: 'font-family', fontSize: 'font-size', fontWeight: 'font-weight',
  textColour: 'text-color', fillColour: 'bg-color', lineHeight: 'leading', opacity: 'opacity',
  left: 'left', right: 'right', top: 'top', bottom: 'bottom',
};

const rounded = (value: number): string => String(Math.round(value * 100) / 100);

export function propertyOp(key: NodeKey, property: EditableProperty, value: string | number): PropertyOp {
  if (typeof value === 'number' && !Number.isFinite(value)) throw new TypeError(`${property} must be finite`);
  let next = value;
  if (property === 'fontSize') next = Math.max(12, Math.min(240, Number(value)));
  else if (property === 'lineHeight') next = Math.max(0.6, Math.min(2.4, Number(value)));
  else if (property === 'opacity') {
    next = Math.max(0, Math.min(1, Number(value)));
    if (next === 1) next = 100;
  }
  return { kind: 'setUtility', id: key, group: GROUP[property], value: typeof next === 'number' ? rounded(next) : next };
}

export function sizeStops(values: number[]): number[] {
  return [...new Set(values.filter((n) => Number.isFinite(n) && n > 0).map((n) => Math.max(12, Math.min(240, Math.round(n * 10) / 10))))].sort((a, b) => a - b);
}

export function snapSize(value: number, stops: number[]): number {
  if (!stops.length) return Math.round(value * 10) / 10;
  return stops.reduce((best, stop) => Math.abs(stop - value) < Math.abs(best - value) ? stop : best, stops[0]);
}

export type FullProperty = 'padding' | 'margin' | 'radius' | 'shadow' | 'borderWidth' | 'borderColour';

const baseOnly = (value: string) => !value.includes(':') && !value.startsWith('!') && !value.endsWith('!');
const arbitraryLength = /^\[(?:-?\d*\.?\d+(?:px|rem|em|%)?|(?:calc|min|max|clamp)\(.+)\)]$/;

function replaceBase(classes: string[], matches: (value: string) => boolean, value: string): string[] {
  const at = classes.findIndex((candidate) => baseOnly(candidate) && matches(candidate));
  if (at < 0) return [...classes, value];
  const next = classes.slice();
  next[at] = value;
  return next.filter((candidate, index) => index === at || !baseOnly(candidate) || !matches(candidate));
}

const px = (value: string | number) => `[${Math.max(0, Number(value))}px]`;

/** Replace one un-varianted visual utility while leaving responsive/hover utilities byte-for-byte. */
export function propertyClasses(classes: string[], property: FullProperty, value: string | number): string[] {
  if (typeof value === 'number' && !Number.isFinite(value)) throw new TypeError(`${property} must be finite`);
  switch (property) {
    case 'padding': return replaceBase(classes, (c) => /^p-(?![trblesxy]-)/.test(c), `p-${px(value)}`);
    case 'margin': return replaceBase(classes, (c) => /^m-(?![trblesxy]-)/.test(c), `m-${px(value)}`);
    case 'radius': return replaceBase(classes, (c) => /^rounded(?:-|$)/.test(c), `rounded-${px(value)}`);
    case 'shadow': return replaceBase(classes, (c) => /^shadow(?:-|$)/.test(c), value === 'none' ? 'shadow-none' : `shadow-${value}`);
    case 'borderWidth': return replaceBase(classes, (c) => c === 'border' || /^border-(?:0|2|4|8)$/.test(c) || (c.startsWith('border-') && arbitraryLength.test(c.slice(7))), Number(value) === 1 ? 'border' : `border-${px(value)}`);
    case 'borderColour': return replaceBase(classes, (c) => /^border-(?![trblesxy](?:-|$))/.test(c) && !/^border-(?:0|2|4|8)$/.test(c) && !arbitraryLength.test(c.slice(7)), `border-${value}`);
  }
}

export interface ImageClassChange { fit?: 'cover' | 'contain'; focalX?: number; focalY?: number }

export function imageClasses(classes: string[], change: ImageClassChange): string[] {
  let next = classes;
  if (change.fit) next = replaceBase(next, (c) => c === 'object-cover' || c === 'object-contain', `object-${change.fit}`);
  if (change.focalX !== undefined || change.focalY !== undefined) {
    const current = next.find((c) => baseOnly(c) && /^object-\[\d+(?:\.\d+)?%_\d+(?:\.\d+)?%\]$/.test(c));
    const match = current && /^object-\[(\d+(?:\.\d+)?)%_(\d+(?:\.\d+)?)%\]$/.exec(current);
    const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
    const x = clamp(change.focalX ?? Number(match?.[1] ?? 50));
    const y = clamp(change.focalY ?? Number(match?.[2] ?? 50));
    next = replaceBase(next, (c) => /^object-\[\d+(?:\.\d+)?%_\d+(?:\.\d+)?%\]$/.test(c), `object-[${x}%_${y}%]`);
  }
  return next;
}
