// Random operation generator for the property tests and the phase gate. Ops are drawn from the whole Op union;
// targets are sampled from patchable nodes of the current document. A generated op may still be rejected by the
// engine (for example inserting a <div> into a <p>); callers retry.
import { GROUPS, type Group, type TokenContext } from '../src/engine/class-algebra.ts';
import { OP_KINDS, type Op } from '../src/engine/ops.ts';
import { classList, isWithin, RAW_TEXT_TAGS, VOID_TAGS, type SourceDoc, type SourceNode } from '../src/engine/source.ts';
import { visibleText } from '../src/engine/text-diff.ts';

export type Rng = () => number;
export interface RandomOpOptions {
  /** 'all': any patchable node below <body>. 'slides': strict descendants of section.slide (falls back to 'all'). */
  scope: 'all' | 'slides';
  /** Do not remove, move or wrap structural content (svg, img, section) — keeps the deck auditor's view stable. */
  protectStructure?: boolean;
}

const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];
const int = (rng: Rng, n: number) => Math.floor(rng() * n);

const ALPHABET = ['ا', 'ب', 'ت', 'لا', 'ة', ' ', ' ', '\n', 'a', 'Z', '7', '٧', '&', '<', '>', ' ', '.', '‏', '"'];
const randText = (rng: Rng, max = 8) => Array.from({ length: int(rng, max + 1) }, () => pick(rng, ALPHABET)).join('');

const HTML_SNIPPETS = ['<span class="nm-ins">نص مضاف</span>', '<div class="absolute top-[10px] right-[20px]">\n  <p>سطر جديد</p>\n</div>',
  '<b>غامق</b>', '<p class="text-[24px]">فقرة &amp; رمز</p>', '<br>', '<em>x</em> y'];
const SVG_SNIPPETS = ['<rect x="1" y="1" width="4" height="4" fill="#123456"/>', '<g class="nm-g"><circle r="2"/></g>'];

function valueFor(rng: Rng, group: Group, ctx: TokenContext): string | null {
  if (rng() < 0.15) return null;
  const colors = [...ctx.colors];
  switch (group) {
    case 'position': return pick(rng, ['absolute', 'relative', 'static']);
    case 'text-align': return pick(rng, ['left', 'right', 'center']);
    case 'text-color': case 'bg-color': return colors.length && rng() < 0.5 ? pick(rng, colors) : pick(rng, ['#1f3bff', '#abc', 'white', 'red-500']);
    case 'font-weight': return pick(rng, ['400', '700', 'black', 'medium']);
    case 'font-family': return pick(rng, ['mono', 'sans', ...ctx.fontFamilies]);
    case 'opacity': return pick(rng, ['0.5', '70', '33']);
    case 'z': return pick(rng, ['10', '999', 'auto']);
    case 'leading': return pick(rng, ['1.5', '24px', 'tight']);
    case 'tracking': return pick(rng, ['0.08em', 'wide', '2px']);
    case 'rotate': return String(int(rng, 90) - 45);
    default: return String(int(rng, 400) - (group.startsWith('translate') ? 200 : 0));
  }
}

function slidesOf(doc: SourceDoc): SourceNode[] {
  return doc.nodes.filter((n) => n.tag === 'section' && classList(n).includes('slide'));
}

function candidates(doc: SourceDoc, opts: RandomOpOptions): SourceNode[] {
  const body = doc.nodes.find((n) => n.tag === 'body');
  const slides = opts.scope === 'slides' ? slidesOf(doc) : [];
  const roots = slides.length ? slides : body ? [body] : [];
  return doc.nodes.filter((n) => n.patchable && n.start >= 0 && roots.some((r) => r.id !== n.id && isWithin(doc, n.id, r.id)));
}

const isContainer = (n: SourceNode) => n.endTagStart !== null && !VOID_TAGS.has(n.tag) && !RAW_TEXT_TAGS.has(n.tag) && n.tag !== 'template';
const structural = (doc: SourceDoc, n: SourceNode) => {
  const stack = [n.id];
  while (stack.length) {
    const c = doc.nodes[stack.pop() as number];
    if (['svg', 'img', 'section', 'script', 'style'].includes(c.tag)) return true;
    stack.push(...c.children);
  }
  return false;
};

/** One random op against `doc`, or null when the document offers no target for the chosen kind. */
export function randomOp(doc: SourceDoc, ctx: TokenContext, rng: Rng, opts: RandomOpOptions): Op | null {
  const nodes = candidates(doc, opts);
  if (nodes.length === 0) return null;
  const kind = pick(rng, OP_KINDS);
  const node = pick(rng, nodes);
  const movable = opts.protectStructure ? nodes.filter((n) => !structural(doc, n)) : nodes;
  switch (kind) {
    case 'setText': {
      const t = pick(rng, nodes.filter((n) => isContainer(n) && (n.ns === 'html' || n.tag === 'text')));
      if (!t) return null;
      let cur = '';
      try { cur = visibleText(doc, t.id); } catch { return null; }
      const i = int(rng, cur.length + 1);
      const j = i + int(rng, Math.min(6, cur.length - i) + 1);
      return { kind, id: t.id, text: cur.slice(0, i) + randText(rng) + cur.slice(j) };
    }
    case 'setAttr':
      return { kind, id: node.id, name: pick(rng, ['data-nm', 'title', 'aria-label', 'data-x']), value: rng() < 0.2 ? null : randText(rng, 5) };
    case 'setUtility': {
      const group = pick(rng, GROUPS);
      if (opts.protectStructure && group === 'position') return null;
      return { kind, id: node.id, group, value: valueFor(rng, group, ctx) };
    }
    case 'setClasses': {
      const cls = classList(node);
      const r = rng();
      if (r < 0.4 && cls.length) cls.splice(int(rng, cls.length), 1);
      else if (r < 0.8) cls.splice(int(rng, cls.length + 1), 0, pick(rng, ['nm-a', 'mt-[4px]', 'text-[20px]', 'hidden']));
      else cls.reverse();
      return { kind, id: node.id, classes: cls };
    }
    case 'setStyle':
      return { kind, id: node.id, prop: pick(rng, ['color', 'opacity', 'top', '--nm-x']), value: rng() < 0.25 ? null : pick(rng, ['red', '0.5', '12px', 'url(#x)']) };
    case 'insertHtml': {
      const p = pick(rng, nodes.filter(isContainer));
      if (!p) return null;
      return { kind, parent: p.id, index: int(rng, p.children.length + 1), html: pick(rng, p.ns === 'svg' ? SVG_SNIPPETS : HTML_SNIPPETS) };
    }
    case 'remove': {
      const t = pick(rng, movable);
      return t ? { kind, id: t.id } : null;
    }
    case 'duplicate':
      return { kind, id: node.id };
    case 'move': {
      const t = pick(rng, movable);
      if (!t) return null;
      const parents = nodes.filter((p) => isContainer(p) && !isWithin(doc, p.id, t.id) && p.ns === doc.nodes[t.parent ?? 0].ns);
      const p = pick(rng, parents);
      if (!p) return null;
      return { kind, id: t.id, parent: p.id, index: int(rng, p.children.length) };
    }
    case 'wrap': {
      const t = pick(rng, movable);
      if (!t || t.parent === null) return null;
      const sibs = doc.nodes[t.parent].children;
      const at = sibs.indexOf(t.id);
      const count = 1 + int(rng, Math.min(3, sibs.length - at));
      const ids = sibs.slice(at, at + count);
      if (opts.protectStructure && ids.some((id) => structural(doc, doc.nodes[id]))) return null;
      const html = t.ns === 'svg' ? '<g class="nm-wrap"></g>' : pick(rng, ['<div class="nm-wrap"></div>', '<span class="nm-wrap"></span>']);
      return { kind, ids, html };
    }
    case 'setToken':
      return { kind, path: ['colors', pick(rng, ['verm', 'nm-new', 'ink', 'accent'])], value: rng() < 0.2 ? null : pick(rng, ['#ff3300', 'var(--nm)', '#000']) };
  }
}
