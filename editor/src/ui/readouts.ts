// Read-only facts about the selected element, measured in the live preview (computed style, layout boxes) and
// matched against the deck's own tokens. Everything the properties tab shows comes from here; nothing is invented.
import type { DeckInfo, NodeKey } from './types.ts';

export interface ColourReadout { prop: 'color' | 'background-color'; hex: string; token: string | null }
export interface DeckColour { token: string; hex: string }
export interface AxisReadout { side: 'left' | 'right' | 'top' | 'bottom'; px: number }

export interface Readout {
  key: NodeKey;
  /** Keys that carry the visible text's typography: the element itself, or its text-bearing children
   *  when the element only wraps them (a title made of two styled spans). Typography edits go to these. */
  typoKeys: NodeKey[];
  /** True when those children differ in family, size, weight or colour. */
  typoMixed: boolean;
  text: string;
  hasText: boolean;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  lineHeight: number | null; // ratio to font size; null for "normal"
  opacity: number;
  colour: ColourReadout | null;
  positioned: boolean;
  x: AxisReadout | null;
  y: AxisReadout | null;
  width: number;
  height: number;
  morph: { group: string; slides: number[] } | null;
}

const round = (n: number, d = 0) => { const f = 10 ** d; return Math.round(n * f) / f; };

/** 'rgb(1, 2, 3)' / 'rgba(1, 2, 3, 0.5)' / 'color(srgb ...)' to '#rrggbb' (alpha dropped); null if transparent or unparsable. */
export function cssColourToHex(css: string): string | null {
  const m = /rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/.exec(css);
  if (!m) return null;
  const alpha = m[4] === undefined ? 1 : m[4].endsWith('%') ? Number(m[4].slice(0, -1)) / 100 : Number(m[4]);
  if (alpha === 0) return null;
  return '#' + [m[1], m[2], m[3]].map((v) => Math.max(0, Math.min(255, Math.round(Number(v)))).toString(16).padStart(2, '0')).join('');
}

/** Flatten a Tailwind colours object: { tab: { mint: x } } -> tab-mint; DEFAULT keeps the parent name. */
export function flattenColours(obj: unknown, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  if (!obj || typeof obj !== 'object') return out;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const name = k === 'DEFAULT' ? prefix : prefix ? `${prefix}-${k}` : k;
    if (typeof v === 'string') out.set(name, v);
    else for (const [kk, vv] of flattenColours(v, name)) out.set(kk, vv);
  }
  return out;
}

let probe: HTMLElement | null = null;
/** Resolve any CSS colour (after var() substitution) to hex using a hidden probe in the editor document. */
function resolveColour(value: string): string | null {
  if (!probe) {
    probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden';
    probe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(probe);
  }
  probe.style.color = '';
  probe.style.color = value;
  if (!probe.style.color) return null;
  return cssColourToHex(getComputedStyle(probe).color);
}

function substituteVars(value: string, scope: CSSStyleDeclaration, depth = 0): string {
  if (depth > 5) return value;
  return value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)/g, (_m, name: string, fallback?: string) => {
    const v = scope.getPropertyValue(name).trim() || fallback?.trim() || '';
    return substituteVars(v, scope, depth + 1);
  });
}

/** The deck's colour tokens resolved in the scope of `el` (CSS variables can differ per slide). */
export function deckColours(win: Window, el: Element, info: DeckInfo): DeckColour[] {
  const tw = (win as Window & { tailwind?: { config?: { theme?: { colors?: unknown; extend?: { colors?: unknown } } } } }).tailwind;
  const values = new Map([...flattenColours(tw?.config?.theme?.colors), ...flattenColours(tw?.config?.theme?.extend?.colors)]);
  const scope = win.getComputedStyle(el);
  const out: DeckColour[] = [];
  for (const token of info.tokens.colors) {
    const raw = values.get(token);
    if (!raw) continue;
    const hex = resolveColour(substituteVars(raw, scope));
    if (hex) out.push({ token, hex });
  }
  return out;
}

const ANCHOR = /^-?(left|right|top|bottom|inset|inset-x|inset-y|start|end)-/;
function anchors(el: Element): Set<string> {
  const out = new Set<string>();
  for (const c of Array.from(el.classList)) {
    if (c.includes(':')) continue; // variants (hover:, md:) do not anchor the resting state
    const m = ANCHOR.exec(c);
    if (!m) continue;
    const a = m[1];
    if (a === 'inset') ['left', 'right', 'top', 'bottom'].forEach((s) => out.add(s));
    else if (a === 'inset-x') { out.add('left'); out.add('right'); }
    else if (a === 'inset-y') { out.add('top'); out.add('bottom'); }
    else out.add(a);
  }
  return out;
}

function slideIndexOf(el: Element): number {
  const slide = el.closest('.slide');
  return slide ? Array.from(el.ownerDocument.querySelectorAll('.slide')).indexOf(slide) : -1;
}

const hasOwnText = (el: Element) => Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? '').trim());

/** The elements whose own styling the user sees as "the text" of `el`: `el` when it holds text directly,
 *  otherwise the outermost keyed descendants that do (leaf text holders). */
export function typographyTargets(el: Element): Element[] {
  if (hasOwnText(el)) return [el];
  const out: Element[] = [];
  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      if (hasOwnText(child) && child.hasAttribute('data-nm-key')) out.push(child);
      else walk(child);
    }
  };
  walk(el);
  return out.length ? out : [el];
}

export function readElement(win: Window, el: Element, key: NodeKey, info: DeckInfo, tokens: DeckColour[], rtl: boolean): Readout {
  const targets = typographyTargets(el);
  const typoKeys = targets.map((t) => t.getAttribute('data-nm-key') ?? key);
  const sig = (t: Element) => { const c = win.getComputedStyle(t); return [c.fontFamily, c.fontSize, c.fontWeight, c.color].join('|'); };
  const typoMixed = new Set(targets.map(sig)).size > 1;
  const box0 = win.getComputedStyle(el);
  const cs = targets[0] === el ? box0 : win.getComputedStyle(targets[0]);
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  const hasText = text.length > 0 && !['img', 'svg', 'iframe', 'video', 'canvas', 'picture'].includes(el.localName);
  const fontSize = round(parseFloat(cs.fontSize) || 0, 1);
  const lh = parseFloat(cs.lineHeight);
  const fill = cssColourToHex(box0.backgroundColor);
  const colourProp: ColourReadout['prop'] | null = hasText ? 'color' : fill ? 'background-color' : null;
  const hex = colourProp === 'color' ? cssColourToHex(cs.color) : colourProp ? fill : null;
  const colour = colourProp && hex ? { prop: colourProp, hex, token: tokens.find((t) => t.hex === hex)?.token ?? null } : null;

  const positioned = box0.position === 'absolute' || box0.position === 'fixed';
  const a = anchors(el);
  const px = (v: string) => round(parseFloat(v) || 0);
  let x: AxisReadout | null = null;
  let y: AxisReadout | null = null;
  if (positioned) {
    const right = a.has('right') && !a.has('left') ? true : a.has('left') && !a.has('right') ? false : rtl;
    x = right ? { side: 'right', px: px(box0.right) } : { side: 'left', px: px(box0.left) };
    y = a.has('bottom') && !a.has('top') ? { side: 'bottom', px: px(box0.bottom) } : { side: 'top', px: px(box0.top) };
  }
  const box = el.getBoundingClientRect();
  const html = el as HTMLElement;
  const width = round(typeof html.offsetWidth === 'number' ? html.offsetWidth : box.width);
  const height = round(typeof html.offsetHeight === 'number' ? html.offsetHeight : box.height);

  let morph: Readout['morph'] = null;
  for (const [group, keys] of Object.entries(info.morph)) {
    if (!keys.includes(key)) continue;
    const doc = el.ownerDocument;
    const here = slideIndexOf(el);
    const slides = keys
      .filter((k) => k !== key)
      .map((k) => { const o = doc.querySelector(`[data-nm-key="${k}"]`); return o ? slideIndexOf(o) : -1; })
      .filter((i) => i >= 0 && i !== here)
      .map((i) => i + 1);
    morph = { group, slides: [...new Set(slides)].sort((p, q) => p - q) };
    break;
  }

  return {
    key, typoKeys, typoMixed, text, hasText, fontSize,
    fontFamily: cs.fontFamily.split(',')[0].trim().replace(/^['"]|['"]$/g, ''),
    fontWeight: Number(cs.fontWeight) || 400,
    lineHeight: Number.isFinite(lh) && fontSize > 0 ? round(lh / fontSize, 2) : null,
    opacity: round(Number(box0.opacity), 2),
    colour, positioned, x, y, width, height, morph,
  };
}

/** The weight tray's four stops; the computed weight presses the nearest one. */
export const WEIGHTS = [300, 400, 700, 900] as const;
export const nearestWeight = (w: number) => WEIGHTS.reduce((best, s) => (Math.abs(s - w) < Math.abs(best - w) ? s : best), WEIGHTS[0]);
