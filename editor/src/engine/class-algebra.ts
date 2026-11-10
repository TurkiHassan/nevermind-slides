// Tailwind class algebra: parse tokens into property groups, read and write the base utility of a group, and
// write a class list back as minimal splices. Variant (`md:`) and important (`!`) tokens are never touched.
import { OpError } from './errors.ts';
import { escapeAttr, UNQUOTED_SAFE } from './html-text.ts';
import { attrValueRange, rawEqualsDecoded, requirePatchable, setAttrSplices } from './attrs.ts';
import { findAttr, type SourceDoc } from './source.ts';
import type { Splice } from './splice.ts';

export type Group = 'top' | 'right' | 'bottom' | 'left' | 'translate-x' | 'translate-y' | 'rotate' | 'width' | 'height'
  | 'font-size' | 'text-color' | 'bg-color' | 'font-weight' | 'font-family' | 'leading' | 'tracking' | 'opacity' | 'z'
  | 'pt' | 'pr' | 'pb' | 'pl' | 'mt' | 'mr' | 'mb' | 'ml' | 'gap' | 'rounded' | 'text-align' | 'position';

export const GROUPS: readonly Group[] = ['top', 'right', 'bottom', 'left', 'translate-x', 'translate-y', 'rotate', 'width',
  'height', 'font-size', 'text-color', 'bg-color', 'font-weight', 'font-family', 'leading', 'tracking', 'opacity', 'z',
  'pt', 'pr', 'pb', 'pl', 'mt', 'mr', 'mb', 'ml', 'gap', 'rounded', 'text-align', 'position'];

export interface ParsedToken {
  raw: string;
  variants: string[];
  important: boolean;
  negative: boolean;
  utility: string;
  value: string | null;
  group: Group | null;
}

/** Theme names a deck defines (from tokens.ts). Tailwind's default names are known here and need not be listed. */
export interface TokenContext { colors: Set<string>; fontSizes: Set<string>; fontFamilies: Set<string> }

export const EMPTY_CONTEXT: TokenContext = { colors: new Set(), fontSizes: new Set(), fontFamilies: new Set() };

const DEFAULT_SIZES = new Set(['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl']);
const DEFAULT_FAMILIES = new Set(['sans', 'serif', 'mono']);
const WEIGHTS: Record<string, number> = { thin: 100, extralight: 200, light: 300, normal: 400, medium: 500, semibold: 600,
  bold: 700, extrabold: 800, black: 900 };
const WEIGHT_NAMES = Object.fromEntries(Object.entries(WEIGHTS).map(([k, v]) => [v, k])) as Record<number, string>;
const COLOR_KEYWORDS = new Set(['inherit', 'current', 'transparent', 'black', 'white']);
const PALETTE = /^(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50|100|200|300|400|500|600|700|800|900|950)$/;
const ALIGN = new Set(['left', 'right', 'center', 'justify', 'start', 'end']);
const POSITION = new Set(['static', 'fixed', 'absolute', 'relative', 'sticky']);
const ROUNDED_SIDES = /^(t|r|b|l|tl|tr|br|bl|s|e|ss|se|es|ee)(-|$)/;

const PREFIX: Record<Group, string> = {
  top: 'top', right: 'right', bottom: 'bottom', left: 'left', 'translate-x': 'translate-x', 'translate-y': 'translate-y',
  rotate: 'rotate', width: 'w', height: 'h', 'font-size': 'text', 'text-color': 'text', 'bg-color': 'bg',
  'font-weight': 'font', 'font-family': 'font', leading: 'leading', tracking: 'tracking', opacity: 'opacity', z: 'z',
  pt: 'pt', pr: 'pr', pb: 'pb', pl: 'pl', mt: 'mt', mr: 'mr', mb: 'mb', ml: 'ml', gap: 'gap', rounded: 'rounded',
  'text-align': 'text', position: '',
};

/** Split on ':' outside brackets and parentheses. */
function splitVariants(raw: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let last = 0;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === '[' || c === '(') depth++;
    else if ((c === ']' || c === ')') && depth > 0) depth--;
    else if (c === ':' && depth === 0) {
      parts.push(raw.slice(last, i));
      last = i + 1;
    }
  }
  parts.push(raw.slice(last));
  return parts;
}

function isKnownColor(name: string, ctx: TokenContext): boolean {
  const base = name.replace(/\/[^/]+$/, '');
  return ctx.colors.has(base) || COLOR_KEYWORDS.has(base) || PALETTE.test(base);
}

/** Classify an arbitrary value `[...]` as a length, a colour, or something else. */
function arbitraryKind(v: string): 'length' | 'color' | 'number' | 'other' {
  const inner = v.slice(1, -1);
  if (/^length:/.test(inner)) return 'length';
  if (/^color:/.test(inner)) return 'color';
  if (/^#[0-9a-fA-F]{3,8}$/.test(inner) || /^(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/.test(inner) || /^var\(/.test(inner)) return 'color';
  if (/^-?\d*\.?\d+$/.test(inner)) return 'number';
  if (/^-?\d*\.?\d+(px|rem|em|%|vw|vh|vmin|vmax|ch|ex|pt|cm|mm|in|pc|lh|svh|dvh|lvh)$/.test(inner) || /^(calc|clamp|min|max)\(/.test(inner)) return 'length';
  return 'other';
}

function classify(body: string, ctx: TokenContext): { utility: string; value: string | null; group: Group | null } {
  if (POSITION.has(body)) return { utility: body, value: null, group: 'position' };
  let m: RegExpExecArray | null;
  if ((m = /^(top|right|bottom|left)-(.+)$/.exec(body))) return { utility: m[1], value: m[2], group: m[1] as Group };
  if ((m = /^translate-([xy])-(.+)$/.exec(body))) return { utility: `translate-${m[1]}`, value: m[2], group: `translate-${m[1]}` as Group };
  if ((m = /^rotate-(.+)$/.exec(body))) return { utility: 'rotate', value: m[1], group: 'rotate' };
  if ((m = /^w-(.+)$/.exec(body))) return { utility: 'w', value: m[1], group: 'width' };
  if ((m = /^h-(.+)$/.exec(body))) return { utility: 'h', value: m[1], group: 'height' };
  if ((m = /^text-(.+)$/.exec(body))) {
    const v = m[1];
    if (ALIGN.has(v)) return { utility: 'text', value: v, group: 'text-align' };
    if (v.startsWith('[')) {
      const k = arbitraryKind(v);
      if (k === 'length') return { utility: 'text', value: v, group: 'font-size' };
      if (k === 'color') return { utility: 'text', value: v, group: 'text-color' };
      return { utility: 'text', value: v, group: null };
    }
    const size = v.replace(/\/.+$/, '');
    if (DEFAULT_SIZES.has(size) || ctx.fontSizes.has(size)) return { utility: 'text', value: v, group: 'font-size' };
    if (isKnownColor(v, ctx)) return { utility: 'text', value: v, group: 'text-color' };
    return { utility: 'text', value: v, group: null };
  }
  if ((m = /^bg-(.+)$/.exec(body))) {
    const v = m[1];
    if (v.startsWith('[')) return { utility: 'bg', value: v, group: arbitraryKind(v) === 'color' ? 'bg-color' : null };
    return { utility: 'bg', value: v, group: isKnownColor(v, ctx) ? 'bg-color' : null };
  }
  if ((m = /^font-(.+)$/.exec(body))) {
    const v = m[1];
    if (v in WEIGHTS) return { utility: 'font', value: v, group: 'font-weight' };
    if (DEFAULT_FAMILIES.has(v) || ctx.fontFamilies.has(v)) return { utility: 'font', value: v, group: 'font-family' };
    if (v.startsWith('[')) return { utility: 'font', value: v, group: arbitraryKind(v) === 'number' ? 'font-weight' : 'font-family' };
    return { utility: 'font', value: v, group: null };
  }
  if ((m = /^(leading|tracking|opacity|z|gap)-(.+)$/.exec(body))) {
    return { utility: m[1], value: m[2], group: m[1] as Group };
  }
  if ((m = /^([pm])([trbl])-(.+)$/.exec(body))) return { utility: m[1] + m[2], value: m[3], group: (m[1] + m[2]) as Group };
  if (body === 'rounded') return { utility: 'rounded', value: null, group: 'rounded' };
  if ((m = /^rounded-(.+)$/.exec(body))) {
    if (ROUNDED_SIDES.test(m[1])) return { utility: 'rounded', value: m[1], group: null };
    return { utility: 'rounded', value: m[1], group: 'rounded' };
  }
  const dash = body.indexOf('-');
  return dash > 0 ? { utility: body.slice(0, dash), value: body.slice(dash + 1), group: null } : { utility: body, value: null, group: null };
}

export function parseToken(raw: string, ctx: TokenContext): ParsedToken {
  const parts = splitVariants(raw);
  let body = parts.pop() as string;
  let important = false;
  if (body.startsWith('!')) { important = true; body = body.slice(1); }
  else if (body.endsWith('!') && body.length > 1) { important = true; body = body.slice(0, -1); }
  let negative = false;
  if (body.startsWith('-') && body.length > 1) { negative = true; body = body.slice(1); }
  const c = classify(body, ctx);
  return { raw, variants: parts, important, negative, ...c };
}

const isBase = (t: ParsedToken) => t.variants.length === 0 && !t.important;

/** The base (no variants, not important) token of a group, or null. */
export function getUtility(classes: string[], group: Group, ctx: TokenContext): ParsedToken | null {
  for (const c of classes) {
    const t = parseToken(c, ctx);
    if (t.group === group && isBase(t)) return t;
  }
  return null;
}

const LENGTH_GROUPS = new Set<Group>(['top', 'right', 'bottom', 'left', 'translate-x', 'translate-y', 'width', 'height',
  'font-size', 'pt', 'pr', 'pb', 'pl', 'mt', 'mr', 'mb', 'ml', 'gap', 'rounded']);
const NUMERIC = /^-?\d*\.?\d+$/;
const PX = /^(-?\d*\.?\d+)px$/;
const KEYWORD = /^[A-Za-z0-9][\w./-]*$/;

function arbitrary(v: string): string {
  return `[${v.trim().replace(/\s+/g, '_')}]`;
}

function hexColor(v: string): string | null {
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.exec(v.trim());
  if (!m) return null;
  let h = m[1].toLowerCase();
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
  return `#${h}`;
}

/** The class token that sets `group` to `value`. Throws OpError('invalid') for a value the group cannot take. */
export function formatUtility(group: Group, value: string, ctx: TokenContext): string {
  const v = value.trim();
  if (v === '') throw new OpError('invalid', `empty value for ${group}`);
  const prefix = PREFIX[group];
  const tok = (suffix: string) => `${prefix}-${suffix}`;
  if (group === 'position') {
    if (!POSITION.has(v)) throw new OpError('invalid', `position must be one of ${[...POSITION].join(', ')}, got ${JSON.stringify(v)}`);
    return v;
  }
  if (group === 'text-align') {
    if (!ALIGN.has(v)) throw new OpError('invalid', `text-align must be one of ${[...ALIGN].join(', ')}, got ${JSON.stringify(v)}`);
    return tok(v);
  }
  if (v.startsWith('[') && v.endsWith(']')) return tok(v);
  if (group === 'text-color' || group === 'bg-color') {
    if (isKnownColor(v, ctx)) return tok(v);
    const hex = hexColor(v);
    if (hex) return tok(`[${hex}]`);
    if (/^(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|var)\(/.test(v)) return tok(arbitrary(v));
    throw new OpError('invalid', `unknown colour ${JSON.stringify(v)} for ${group}`);
  }
  if (group === 'font-weight') {
    if (v in WEIGHTS) return tok(v);
    if (NUMERIC.test(v)) {
      const n = Number(v);
      return WEIGHT_NAMES[n] ? tok(WEIGHT_NAMES[n]) : tok(`[${Math.round(n)}]`);
    }
    throw new OpError('invalid', `invalid font weight ${JSON.stringify(v)}`);
  }
  if (group === 'font-family') {
    if (DEFAULT_FAMILIES.has(v) || ctx.fontFamilies.has(v)) return tok(v);
    return tok(`['${v.replace(/^['"]|['"]$/g, '').replace(/\s+/g, '_')}']`);
  }
  if (group === 'rotate') {
    const m = /^(-?\d*\.?\d+)(deg)?$/.exec(v);
    if (m) return tok(`[${Number(Number(m[1]).toFixed(2))}deg]`);
    if (KEYWORD.test(v)) return tok(v);
    return tok(arbitrary(v));
  }
  if (group === 'opacity') {
    if (NUMERIC.test(v)) {
      const n = Number(v);
      if (n <= 1 && v.includes('.')) return tok(`[${n}]`);
      if (Number.isInteger(n) && n % 5 === 0 && n >= 0 && n <= 100) return tok(String(n));
      return tok(`[${n}%]`);
    }
    if (/^\d+%$/.test(v)) return tok(`[${v}]`);
    throw new OpError('invalid', `invalid opacity ${JSON.stringify(v)}`);
  }
  if (group === 'z') {
    if (v === 'auto') return tok(v);
    if (/^-?\d+$/.test(v)) return ['0', '10', '20', '30', '40', '50'].includes(v) ? tok(v) : tok(`[${v}]`);
    throw new OpError('invalid', `invalid z-index ${JSON.stringify(v)}`);
  }
  if (group === 'leading') {
    if (NUMERIC.test(v)) return tok(`[${Number(v)}]`);
    const px = PX.exec(v);
    if (px) return tok(`[${Math.round(Number(px[1]))}px]`);
    if (KEYWORD.test(v)) return tok(v);
    return tok(arbitrary(v));
  }
  if (group === 'tracking') {
    const px = PX.exec(v) ?? (NUMERIC.test(v) ? [v, v] : null);
    if (px) return tok(`[${Math.round(Number(px[1]))}px]`);
    if (['tighter', 'tight', 'normal', 'wide', 'wider', 'widest'].includes(v)) return tok(v);
    return tok(arbitrary(v));
  }
  if (LENGTH_GROUPS.has(group)) {
    const px = PX.exec(v) ?? (NUMERIC.test(v) ? [v, v] : null);
    if (px) return tok(`[${Math.round(Number(px[1]))}px]`);
    if (group === 'font-size' && (DEFAULT_SIZES.has(v) || ctx.fontSizes.has(v))) return tok(v);
    if (group !== 'font-size' && KEYWORD.test(v)) return tok(v);
    return tok(arbitrary(v));
  }
  throw new OpError('unsupported', `cannot format a value for ${group}`);
}

/**
 * Set the base utility of a group: replace the first base token in place (removing further base duplicates), append
 * if absent, remove for null. Variant and important tokens are left alone.
 */
export function setUtility(classes: string[], group: Group, value: string | null, ctx: TokenContext): string[] {
  const next = value === null ? null : formatUtility(group, value, ctx);
  const out: string[] = [];
  let placed = false;
  for (const c of classes) {
    const t = parseToken(c, ctx);
    if (t.group === group && isBase(t)) {
      if (next !== null && !placed) out.push(next);
      placed = true;
      continue;
    }
    out.push(c);
  }
  if (next !== null && !placed) out.push(next);
  return out;
}

interface RawToken { tok: string; s: number; e: number }

/**
 * Splices that make an element's class list equal `classes`, keeping the original order, spacing and bytes of every
 * unchanged token. An empty list removes the attribute.
 */
export function setClassAttr(doc: SourceDoc, id: number, classes: string[]): Splice[] {
  const n = requirePatchable(doc, id);
  for (const c of classes) {
    if (!c || /[\s]/.test(c)) throw new OpError('invalid', `invalid class token ${JSON.stringify(c)}`);
  }
  const text = doc.text;
  const a = findAttr(n, 'class');
  if (!a) return classes.length ? setAttrSplices(doc, n, 'class', classes.join(' ')) : [];
  const oldTokens = a.value.split(/[ \t\n\r\f]+/).filter(Boolean);
  if (oldTokens.length === classes.length && oldTokens.every((t, i) => t === classes[i])) return [];
  if (classes.length === 0) return setAttrSplices(doc, n, 'class', null);
  const range = attrValueRange(text, a);
  const needsQuotes = a.quote === '' && (classes.length > 1 || !classes.every((c) => UNQUOTED_SAFE.test(c)));
  if (!range || !rawEqualsDecoded(text, a) || needsQuotes || oldTokens.length === 0) {
    return setAttrSplices(doc, n, 'class', classes.join(' '));
  }
  const q = a.quote === "'" ? "'" : '"';
  const esc = (t: string) => (a.quote ? escapeAttr(t, q) : t);
  const raw: RawToken[] = [];
  const re = /[^ \t\n\r\f]+/g;
  const value = text.slice(range.vStart, range.vEnd);
  for (let m = re.exec(value); m; m = re.exec(value)) raw.push({ tok: m[0], s: range.vStart + m.index, e: range.vStart + m.index + m[0].length });

  let p = 0;
  while (p < raw.length && p < classes.length && raw[p].tok === classes[p]) p++;
  let q2 = 0;
  while (q2 < raw.length - p && q2 < classes.length - p && raw[raw.length - 1 - q2].tok === classes[classes.length - 1 - q2]) q2++;
  const oldMid = raw.slice(p, raw.length - q2);
  const newMid = classes.slice(p, classes.length - q2);

  if (oldMid.length === newMid.length) {
    return oldMid.filter((t, i) => t.tok !== newMid[i]).map((t) => ({ start: t.s, end: t.e, text: esc(newMid[oldMid.indexOf(t)]) }));
  }
  if (oldMid.length === 0) {
    const ins = newMid.map(esc).join(' ');
    if (p > 0) return [{ start: raw[p - 1].e, end: raw[p - 1].e, text: ' ' + ins }];
    return [{ start: raw[0].s, end: raw[0].s, text: ins + ' ' }];
  }
  const s = oldMid[0].s;
  const e = oldMid[oldMid.length - 1].e;
  if (newMid.length === 0) {
    if (p > 0) return [{ start: raw[p - 1].e, end: e, text: '' }];
    const after = raw[p + oldMid.length];
    return [{ start: s, end: after ? after.s : range.vEnd, text: '' }];
  }
  return [{ start: s, end: e, text: newMid.map(esc).join(' ') }];
}

// ---------------------------------------------------------------------------------------------------------------
// Anchor-aware move and resize write-back (ported from spikes/s4-transform/writeback.ts).
// dx, dy are stage pixels; positive dx is rightwards, positive dy downwards.

export type Anchor = { x: 'left' | 'right' | 'none'; y: 'top' | 'bottom' | 'none' };
export type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const refused = new WeakMap<string[], string>();

/** Why a write-back refused to change the classes, or undefined when it did not refuse. */
export function unsupportedReason(result: string[]): string | undefined {
  return refused.get(result);
}
function refuse(classes: string[], reason: string): string[] {
  const r = [...classes];
  refused.set(r, reason);
  return r;
}

type Found = { index: number; token: string; px: number | null };

/** px value of a Tailwind length value, or null when it is not a plain px length we can rewrite. */
function valuePx(v: string): number | null {
  let m = /^\[(-?\d+(?:\.\d+)?)px\]$/.exec(v);
  if (m) return Number(m[1]);
  if (v === '0' || v === '[0]') return 0;
  if (v === 'px') return 1;
  m = /^(\d+(?:\.\d+)?)$/.exec(v); // spacing scale: n * 0.25rem = 4n px
  if (m) return Number(m[1]) * 4;
  return null;
}

/** First base token with the given utility prefix. Variant and important tokens are never matched. */
function find(classes: string[], prefix: string): Found | null {
  for (let i = 0; i < classes.length; i++) {
    const t = classes[i];
    if (t.includes(':') || t.startsWith('!') || t.endsWith('!')) continue;
    const neg = t.startsWith('-');
    const body = neg ? t.slice(1) : t;
    if (!body.startsWith(prefix + '-')) continue;
    const px = valuePx(body.slice(prefix.length + 1));
    return { index: i, token: t, px: px === null ? null : neg ? -px : px };
  }
  return null;
}

const fmt = (prefix: string, px: number) => `${prefix}-[${Math.round(px)}px]`;

export function detectAnchor(classes: string[], computed: { position: string }): Anchor {
  if (computed.position !== 'absolute' && computed.position !== 'fixed') return { x: 'none', y: 'none' };
  const has = (p: string, axis: string) => find(classes, p) !== null || find(classes, axis) !== null || find(classes, 'inset') !== null;
  const x = has('left', 'inset-x') ? 'left' : has('right', 'inset-x') ? 'right' : 'none';
  const y = has('top', 'inset-y') ? 'top' : has('bottom', 'inset-y') ? 'bottom' : 'none';
  return { x, y };
}

type Edit = { prefix: string; delta: number };

/** Apply additive edits to px utilities. A missing utility is appended (starting from `start` or 0). */
function applyEdits(classes: string[], edits: Edit[], start?: Record<string, number>): string[] {
  const out = [...classes];
  const remove: number[] = [];
  for (const e of edits) {
    if (Math.round(e.delta) === 0) continue;
    const p = find(out, e.prefix);
    if (p && p.px === null) return refuse(classes, `cannot rewrite ${p.token}`);
    const base = p ? (p.px as number) : start?.[e.prefix] ?? 0;
    const next = Math.round(base + e.delta);
    if (e.prefix.startsWith('translate-') && next === 0) {
      if (p) remove.push(p.index);
      continue;
    }
    if (p) out[p.index] = fmt(e.prefix, next);
    else out.push(fmt(e.prefix, next));
  }
  return out.filter((_, i) => !remove.includes(i));
}

export function moveClasses(classes: string[], anchor: Anchor, dx: number, dy: number, isFlowChild: boolean): string[] {
  for (const t of classes) {
    if (t.includes(':')) continue;
    const tr = /^-?(translate-[xy])-/.exec(t);
    if (tr && find([t], tr[1])?.px === null) return refuse(classes, `cannot rewrite ${t}`);
    if (/^-?inset(-[xy])?-/.test(t)) return refuse(classes, `inset utilities are not supported: ${t}`);
  }
  const edits: Edit[] = [];
  if (isFlowChild) {
    edits.push({ prefix: 'translate-x', delta: dx }, { prefix: 'translate-y', delta: dy });
  } else {
    if (anchor.x === 'left') edits.push({ prefix: 'left', delta: dx });
    else if (anchor.x === 'right') edits.push({ prefix: 'right', delta: -dx });
    else edits.push({ prefix: 'translate-x', delta: dx });
    if (anchor.y === 'top') edits.push({ prefix: 'top', delta: dy });
    else if (anchor.y === 'bottom') edits.push({ prefix: 'bottom', delta: -dy });
    else edits.push({ prefix: 'translate-y', delta: dy });
  }
  return applyEdits(classes, edits);
}

export function resizeClasses(classes: string[], anchor: Anchor, handle: Handle, dx: number, dy: number,
  rect: { w: number; h: number }): string[] {
  const edits: Edit[] = [];
  if (handle.includes('e')) {
    edits.push({ prefix: 'w', delta: dx });
    if (anchor.x === 'right') edits.push({ prefix: 'right', delta: -dx });
  } else if (handle.includes('w')) {
    edits.push({ prefix: 'w', delta: -dx });
    if (anchor.x === 'left') edits.push({ prefix: 'left', delta: dx });
  }
  if (handle.includes('s')) {
    edits.push({ prefix: 'h', delta: dy });
    if (anchor.y === 'bottom') edits.push({ prefix: 'bottom', delta: -dy });
  } else if (handle.includes('n')) {
    edits.push({ prefix: 'h', delta: -dy });
    if (anchor.y === 'top') edits.push({ prefix: 'top', delta: dy });
  }
  // A missing w/h class starts from the rendered size.
  return applyEdits(classes, edits, { w: rect.w, h: rect.h });
}
