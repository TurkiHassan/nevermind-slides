// Plain-language roles for deck elements (عنوان رئيس، نص، صورة، مجسّم، مجموعة، شكل) and the selection walk:
// which element a click means, one level down, one level up, and the path from the slide.
import type { Strings } from './i18n.ts';
import type { OutlineNode } from './types.ts';

export type Role = 'mainTitle' | 'heading' | 'text' | 'image' | 'figure' | 'group' | 'shape' | 'slide';

const INLINE = new Set(['span', 'b', 'strong', 'i', 'em', 'small', 'sup', 'sub', 'a', 'mark', 'u', 'br', 'bdi', 'bdo', 'code', 'abbr', 'time', 's', 'q']);
const IMAGE = new Set(['img', 'picture', 'video', 'canvas']);
const FIGURE = new Set(['iframe', 'object', 'embed']);

export interface RoleInput {
  tag: string;
  isSlide: boolean;
  hasText: boolean;
  childTags: string[];
  /** The slide's first h1/h2. */
  firstHeading: boolean;
}

export function roleFor(n: RoleInput): Role {
  if (n.isSlide) return 'slide';
  if (n.tag === 'h1' || n.tag === 'h2') return n.firstHeading ? 'mainTitle' : 'heading';
  if (/^h[3-6]$/.test(n.tag)) return 'heading';
  if (IMAGE.has(n.tag)) return 'image';
  if (FIGURE.has(n.tag)) return 'figure';
  if (n.tag === 'svg') return n.childTags.includes('image') ? 'image' : 'shape';
  if (n.childTags.length > 0) return n.hasText && n.childTags.every((c) => INLINE.has(c)) ? 'text' : 'group';
  return n.hasText ? 'text' : 'shape';
}

export const roleLabel = (r: Role, s: Strings): string => ({
  mainTitle: s.roleMainTitle, heading: s.roleHeading, text: s.roleText, image: s.roleImage,
  figure: s.roleFigure, group: s.roleGroup, shape: s.roleShape, slide: s.roleSlide,
})[r];

const tagOf = (el: Element) => el.localName.toLowerCase();
const slideOf = (el: Element) => el.closest('.slide');

// --- live DOM -----------------------------------------------------------------------------------------------------

export function elementRole(el: Element): Role {
  const slide = slideOf(el);
  const first = slide?.querySelector('h1, h2') ?? null;
  return roleFor({
    tag: tagOf(el),
    isSlide: el.classList.contains('slide'),
    hasText: (el.textContent ?? '').trim().length > 0,
    childTags: Array.from(el.children).map(tagOf),
    firstHeading: first === el,
  });
}

/** The nearest keyed ancestor (not crossing out of the slide). */
export function keyedParent(el: Element): Element | null {
  if (el.classList.contains('slide')) return null;
  let p = el.parentElement;
  while (p && !p.hasAttribute('data-nm-key')) p = p.parentElement;
  return p && slideOf(p) ? p : null;
}

/**
 * What a plain click selects: the hit element, lifted out of inline runs (a <span> inside a title selects the
 * title) so a click lands on the block a reader sees as one thing.
 */
/**
 * A picture that fills an absolutely positioned frame is moved by moving the frame: the deck's own CSS often
 * transforms the img inside it, which would swallow a translate written onto the img itself.
 */
function pictureFrame(img: Element): Element | null {
  const frame = keyedParent(img);
  if (!frame || frame.classList.contains('slide')) return null;
  const view = frame.ownerDocument.defaultView;
  if (!view || view.getComputedStyle(frame).position !== 'absolute') return null;
  const a = img.getBoundingClientRect();
  const b = frame.getBoundingClientRect();
  const close = (x: number, y: number) => Math.abs(x - y) <= Math.max(2, 0.08 * Math.max(Math.abs(x), Math.abs(y))); // an img scaled up a few percent still fills its frame
  return close(a.width, b.width) && close(a.height, b.height) && Math.abs(a.left - b.left) <= 0.08 * b.width && Math.abs(a.top - b.top) <= 0.08 * b.height ? frame : null;
}

export function meaningfulBlock(hit: Element): Element {
  if (tagOf(hit) === 'img') { const frame = pictureFrame(hit); if (frame) return frame; }
  let el = hit;
  for (;;) {
    if (!INLINE.has(tagOf(el))) return el;
    const p = keyedParent(el);
    if (!p || p.classList.contains('slide')) return el;
    const kids = Array.from(p.children);
    if (!(p.textContent ?? '').trim() || !kids.every((k) => INLINE.has(tagOf(k)))) return el;
    el = p;
  }
}

/** One level down from `selected` toward `hit`: the keyed child of `selected` that contains the hit. */
export function descendToward(selected: Element, hit: Element): Element | null {
  if (selected === hit || !selected.contains(hit)) return null;
  let el: Element | null = hit;
  while (el && keyedParent(el) !== selected) el = keyedParent(el);
  return el;
}

/** Keyed ancestors from the slide down to `el` (inclusive). */
export function pathTo(el: Element): Element[] {
  const out: Element[] = [];
  for (let n: Element | null = el; n; n = keyedParent(n)) out.unshift(n);
  return out;
}

// --- outline (layers tab) -----------------------------------------------------------------------------------------

/** Roles for an outline tree; the first h1/h2 in document order is the main title. */
export function outlineRoles(root: OutlineNode): Map<OutlineNode, Role> {
  const roles = new Map<OutlineNode, Role>();
  let firstSeen = false;
  const walk = (n: OutlineNode, isRoot: boolean) => {
    const heading = n.tag === 'h1' || n.tag === 'h2';
    const first = heading && !firstSeen;
    if (heading) firstSeen = true;
    roles.set(n, roleFor({
      tag: n.tag,
      isSlide: isRoot && n.classes.includes('slide'),
      hasText: n.text.trim().length > 0,
      childTags: n.children.map((c) => c.tag),
      firstHeading: first,
    }));
    n.children.forEach((c) => walk(c, false));
  };
  walk(root, true);
  return roles;
}
