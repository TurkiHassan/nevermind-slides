// setText as a minimal diff over the existing text-node ranges, so inline runs (<span dir="ltr">), character
// references and the surrounding source indentation survive an edit.
import { OpError } from './errors.ts';
import { requirePatchable } from './attrs.ts';
import { escapeText, isCollapsible, normaliseVisible, textUnits } from './html-text.ts';
import { RAW_TEXT_TAGS, VOID_TAGS, type SourceDoc, type SourceNode } from './source.ts';
import type { Splice } from './splice.ts';

/** One visible UTF-16 code unit with the raw range it comes from. */
interface VisibleChar {
  ch: string;
  rawStart: number;
  rawEnd: number;
  nodeId: number; // element that holds the text (or the <br> itself)
  unit: number; // chars with the same unit id come from one indivisible raw piece
  br: boolean;
  /** Invisible whitespace that this char makes invisible (collapsed into a space, or dropped around a <br>). */
  extra: Range[];
}

interface Range { start: number; end: number }

const HIDDEN_TAGS = new Set([...RAW_TEXT_TAGS, 'template']);
/** Elements that carry content other than text; an element containing one is never removed by a text edit. */
const NON_TEXT = new Set(['img', 'svg', 'math', 'video', 'audio', 'canvas', 'iframe', 'object', 'embed', 'picture', 'input',
  'select', 'textarea', 'button', 'hr', 'meter', 'progress']);

function isHiddenWithin(doc: SourceDoc, id: number, root: number): boolean {
  for (let p: number | null = id; p !== null && p !== root; p = doc.nodes[p].parent) if (HIDDEN_TAGS.has(doc.nodes[p].tag)) return true;
  return false;
}

function requireTextTarget(doc: SourceDoc, id: number): SourceNode {
  const n = requirePatchable(doc, id);
  if (RAW_TEXT_TAGS.has(n.tag) || n.tag === 'template') throw new OpError('unsupported', `node ${id} <${n.tag}> is a raw-text element; its text is not editable as text`);
  if (VOID_TAGS.has(n.tag) || n.endTagStart === null) throw new OpError('invalid', `node ${id} <${n.tag}> has no content`);
  return n;
}

function visibleChars(doc: SourceDoc, root: SourceNode): VisibleChar[] {
  const segs = doc.textSegments(root.id).filter((s) => !isHiddenWithin(doc, s.nodeId, root.id));
  for (const s of segs) {
    if (!s.inPlace || !doc.nodes[s.nodeId].patchable) {
      throw new OpError('unpatchable', `text inside node ${s.nodeId} <${doc.nodes[s.nodeId].tag}> is not where the DOM puts it`);
    }
  }
  const brs: SourceNode[] = [];
  const last = root.id + countDescendants(doc, root);
  for (let i = root.id + 1; i <= last; i++) {
    if (doc.nodes[i].tag === 'br' && !isHiddenWithin(doc, i, root.id)) brs.push(doc.nodes[i]);
  }
  type Item = { at: number; seg?: (typeof segs)[number]; br?: SourceNode };
  const items: Item[] = [...segs.map((seg) => ({ at: seg.rawStart, seg })), ...brs.map((br) => ({ at: br.start, br }))];
  items.sort((x, y) => x.at - y.at);

  const out: VisibleChar[] = [];
  let unitId = 0;
  // A whitespace run waiting for the next visible char: its first raw run, plus runs from later segments that
  // collapse into it (invisible now, but visible if the space they join is deleted).
  let pending: { rawStart: number; rawEnd: number; nodeId: number; seg: number; extra: Range[] } | null = null;
  let lastBr: VisibleChar | null = null; // the <br> that started the current line, if any
  let lineStart = true;
  const pendingRanges = () => (pending ? [{ start: pending.rawStart, end: pending.rawEnd }, ...pending.extra] : []);
  items.forEach((item, segIndex) => {
    if (item.br) {
      const br: VisibleChar = { ch: '\n', rawStart: item.br.start, rawEnd: item.br.end, nodeId: item.br.id, unit: unitId++, br: true,
        extra: lineStart ? [] : pendingRanges() };
      if (lineStart && lastBr) lastBr.extra.push(...pendingRanges());
      pending = null;
      out.push(br);
      lastBr = br;
      lineStart = true;
      return;
    }
    const seg = item.seg!;
    for (const u of textUnits(doc.text.slice(seg.rawStart, seg.rawEnd), seg.rawStart, seg.decoded)) {
      if ([...u.decoded].every(isCollapsible)) {
        if (!pending) pending = { rawStart: u.rawStart, rawEnd: u.rawEnd, nodeId: seg.nodeId, seg: segIndex, extra: [] };
        else if (pending.seg === segIndex && pending.rawEnd === u.rawStart) pending.rawEnd = u.rawEnd;
        else {
          const last = pending.extra[pending.extra.length - 1];
          if (last && last.end === u.rawStart) last.end = u.rawEnd;
          else pending.extra.push({ start: u.rawStart, end: u.rawEnd });
        }
        continue;
      }
      if (pending && !lineStart) {
        out.push({ ch: ' ', rawStart: pending.rawStart, rawEnd: pending.rawEnd, nodeId: pending.nodeId, unit: unitId++, br: false, extra: pending.extra });
      } else if (pending && lastBr) {
        lastBr.extra.push(...pendingRanges());
      }
      pending = null;
      const id = unitId++;
      for (let i = 0; i < u.decoded.length; i++) {
        out.push({ ch: u.decoded[i], rawStart: u.rawStart, rawEnd: u.rawEnd, nodeId: seg.nodeId, unit: id, br: false, extra: [] });
      }
      lineStart = false;
      lastBr = null;
    }
  });
  return out;
}

function countDescendants(doc: SourceDoc, n: SourceNode): number {
  let count = 0;
  const stack = [...n.children];
  while (stack.length) {
    const c = stack.pop() as number;
    count++;
    stack.push(...doc.nodes[c].children);
  }
  return count;
}

/**
 * Text as rendered under `white-space: normal`: text segments joined, <br> as '\n', whitespace runs collapsed, each
 * line trimmed. Script, style and template content is excluded.
 */
export function visibleText(doc: SourceDoc, id: number): string {
  const n = requireTextTarget(doc, id);
  return visibleChars(doc, n).map((v) => v.ch).join('');
}

function escapeInserted(s: string): string {
  return escapeText(s).replace(/\n/g, '<br>');
}

/** Descendants of `root` (not root) in pre-order, with the visible-char index range each one covers. */
function elementCoverage(doc: SourceDoc, root: SourceNode, chars: VisibleChar[]): Map<number, { first: number; last: number }> {
  const cover = new Map<number, { first: number; last: number }>();
  chars.forEach((c, i) => {
    for (let p: number | null = c.nodeId; p !== null && p !== root.id; p = doc.nodes[p].parent) {
      const r = cover.get(p);
      if (r) r.last = i;
      else cover.set(p, { first: i, last: i });
    }
  });
  return cover;
}

function hasNonTextContent(doc: SourceDoc, n: SourceNode): boolean {
  const stack = [...n.children];
  while (stack.length) {
    const c = doc.nodes[stack.pop() as number];
    if (NON_TEXT.has(c.tag) || c.ns !== 'html' || (VOID_TAGS.has(c.tag) && c.tag !== 'br')) return true;
    stack.push(...c.children);
  }
  return false;
}

function within(doc: SourceDoc, id: number, ancestor: number): boolean {
  for (let p: number | null = id; p !== null; p = doc.nodes[p].parent) if (p === ancestor) return true;
  return false;
}

/** Minimal splices that make `visibleText(doc, id)` equal `normaliseVisible(next)`. */
export function setText(doc: SourceDoc, id: number, next: string): Splice[] {
  const root = requireTextTarget(doc, id);
  const chars = visibleChars(doc, root);
  const want = normaliseVisible(next);
  const have = chars.map((c) => c.ch).join('');
  if (have === want) return [];

  let a = 0;
  while (a < have.length && a < want.length && have[a] === want[a]) a++;
  let s = 0;
  while (s < have.length - a && s < want.length - a && have[have.length - 1 - s] === want[want.length - 1 - s]) s++;
  let b = have.length - s;
  // Never split an indivisible raw piece (a character reference, a surrogate pair, a CRLF).
  while (a > 0 && a < chars.length && chars[a - 1].unit === chars[a].unit) a--;
  while (b > 0 && b < chars.length && chars[b - 1].unit === chars[b].unit) b++;
  const inserted = want.slice(a, want.length - (have.length - b));

  if (a === b) {
    // Pure insertion: extend the run on the left (caret affinity), or the first run when inserting at the start.
    // After a collapsed space or a <br>, invisible whitespace may follow; insert right before the next visible char
    // so that whitespace stays invisible.
    let at: number;
    const left = a > 0 ? chars[a - 1] : null;
    const right = a < chars.length ? chars[a] : null;
    const hidden = left !== null && right !== null && left.extra.some((r) => r.start >= left.rawEnd && r.end <= right.rawStart);
    if (left && !hidden) at = left.rawEnd;
    else if (right) at = right.rawStart;
    else if (left) at = left.rawEnd;
    else at = root.startTagEnd;
    return [{ start: at, end: at, text: escapeInserted(inserted) }];
  }

  // Elements (inside root) whose whole visible text is deleted, have no other content, and do not receive the
  // inserted text are removed; take the outermost ones.
  const insertInto = inserted ? chars[a].nodeId : -1;
  const cover = elementCoverage(doc, root, chars);
  const removed: SourceNode[] = [];
  for (const [eid, r] of cover) {
    if (r.first < a || r.last >= b) continue;
    const e = doc.nodes[eid];
    if (!e.patchable || e.tag === 'br' || hasNonTextContent(doc, e)) continue;
    if (insertInto >= 0 && within(doc, insertInto, eid)) continue;
    removed.push(e);
  }
  const outer = removed.filter((e) => !removed.some((o) => o !== e && within(doc, e.id, o.id)));

  const ranges: { start: number; end: number }[] = outer.map((e) => ({ start: e.start, end: e.end }));
  for (let i = a; i < b; i++) {
    const c = chars[i];
    for (const r of [{ start: c.rawStart, end: c.rawEnd }, ...c.extra]) {
      if (outer.some((e) => r.start >= e.start && r.end <= e.end)) continue;
      ranges.push(r);
    }
  }
  ranges.sort((x, y) => x.start - y.start || y.end - x.end);
  const merged: { start: number; end: number }[] = [];
  for (const r of ranges) {
    const top = merged[merged.length - 1];
    if (top && r.start <= top.end) top.end = Math.max(top.end, r.end);
    else merged.push({ ...r });
  }
  const splices: Splice[] = merged.map((r) => ({ ...r, text: '' }));
  if (inserted) {
    // The deletion that covers chars[a] can start before chars[a].rawStart: a <br> also deletes the invisible
    // whitespace right before it. The inserted text goes into that deletion, never into a second splice inside it.
    const at = chars[a].rawStart;
    const host = splices.find((sp) => sp.start <= at && at < sp.end);
    if (host) host.text = escapeInserted(inserted);
    else splices.push({ start: at, end: at, text: escapeInserted(inserted) });
  }
  return splices;
}
