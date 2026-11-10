// Stable node references. A SourceDoc numbers its nodes in document order, so an id is only good for one document
// version. A RefMap gives every element an opaque key that survives edits: after each op the map is rebased through
// that op's splices, so the key of an untouched element keeps pointing at the same element.
//
// A RefMap is immutable and compact (typed arrays only, no SourceDoc), so the undo history can keep one per step.
// Keys come from a counter shared by every map derived from the same root and never reused, so a key a client
// still holds for a removed element can never start meaning a different element.
import { OpError } from './errors.ts';
import type { Op } from './ops.ts';
import type { SourceDoc, SourceNode } from './source.ts';
import { checkSplices, type Splice } from './splice.ts';

export type NodeKey = string; // opaque, stable across edits for the life of an EditorDocument

/** An element key that no longer resolves (the element was removed, or the key was never issued). */
export class StaleRefError extends Error {
  key: string;
  constructor(key: string) {
    super(`node reference ${JSON.stringify(key)} does not resolve to an element in the current document`);
    this.name = 'StaleRefError';
    this.key = key;
  }
}

class KeyCounter { next = 1 }

const KEY_RE = /^n([0-9a-z]{1,10})$/;
const keyString = (n: number): NodeKey => 'n' + n.toString(36);
function keyNumber(k: unknown): number | null {
  if (typeof k !== 'string') return null;
  const m = KEY_RE.exec(k);
  if (!m) return null;
  const n = parseInt(m[1], 36);
  return n > 0 && n <= 0xffffffff ? n : null;
}

// --- hashing (FNV-1a, 32 bit) -----------------------------------------------------------------------------------
const FNV = 0x811c9dc5;
const mix = (h: number, c: number) => Math.imul(h ^ c, 0x01000193) >>> 0;
function hashStr(h: number, s: string): number {
  for (let i = 0; i < s.length; i++) h = mix(h, s.charCodeAt(i));
  return h;
}
function hashRange(h: number, text: string, a: number, b: number): number {
  for (let i = a; i < b; i++) h = mix(h, text.charCodeAt(i));
  return h;
}

/** Tag plus attributes with whitespace in values collapsed; independent of position, text and children. */
function signature(n: SourceNode): number {
  let h = hashStr(FNV, n.tag);
  for (const name of Object.keys(n.attrs).sort()) {
    h = mix(h, 0x1f);
    h = hashStr(h, name);
    h = mix(h, 0x3d);
    h = hashStr(h, n.attrs[name].value.replace(/\s+/g, ' ').trim());
  }
  return h;
}

/** Hash of the text that belongs to the element itself (between its tags, outside child elements). */
function ownTextHash(doc: SourceDoc, n: SourceNode): number {
  if (n.start < 0 || n.startTagEnd < 0) return 0;
  const contentEnd = n.endTagStart ?? n.end;
  let h = FNV;
  let pos = n.startTagEnd;
  for (const c of n.children) {
    const k = doc.nodes[c];
    if (k.start < pos || k.end > contentEnd) continue;
    h = hashRange(h, doc.text, pos, k.start);
    h = mix(h, 0x1e);
    pos = k.end;
  }
  return hashRange(h, doc.text, pos, Math.max(pos, contentEnd));
}

interface Seed { gen: KeyCounter; keys: Uint32Array | null }

export interface RefDiff {
  created: NodeKey[];
  removed: NodeKey[];
  /** Surviving elements whose tag attributes changed (own text unchanged). */
  attrs: NodeKey[];
  /** Surviving elements whose own text changed. */
  content: NodeKey[];
  /** Elements were created or removed, or an element's list of children changed. */
  structural: boolean;
}

export class RefMap {
  readonly size: number;
  /** Keys this map minted fresh (not carried from an earlier map), in document order. */
  readonly minted: NodeKey[] = [];
  private readonly gen: KeyCounter;
  private readonly nums: Uint32Array;
  private readonly starts: Int32Array;
  private readonly tags: string[];
  private readonly sigs: Uint32Array;
  private readonly texts: Uint32Array;
  private readonly kids: Uint32Array;
  private index: Map<number, number> | null = null;

  constructor(doc: SourceDoc, seed?: Seed) {
    const n = doc.nodes.length;
    this.size = n;
    this.gen = seed?.gen ?? new KeyCounter();
    this.nums = new Uint32Array(n);
    this.starts = new Int32Array(n);
    this.tags = new Array<string>(n);
    this.sigs = new Uint32Array(n);
    this.texts = new Uint32Array(n);
    this.kids = new Uint32Array(n);
    const given = seed?.keys ?? null;
    for (let i = 0; i < n; i++) {
      const node = doc.nodes[i];
      let num = given ? given[i] : 0;
      if (!num) {
        num = this.gen.next++;
        this.minted.push(keyString(num));
      }
      this.nums[i] = num;
      this.starts[i] = node.start;
      this.tags[i] = node.tag;
      this.sigs[i] = signature(node);
      this.texts[i] = ownTextHash(doc, node);
    }
    for (let i = 0; i < n; i++) {
      let h = FNV;
      for (const c of doc.nodes[i].children) h = mix(h, this.nums[c]);
      this.kids[i] = h;
    }
  }

  private lookup(): Map<number, number> {
    if (!this.index) {
      this.index = new Map();
      for (let i = 0; i < this.size; i++) this.index.set(this.nums[i], i);
    }
    return this.index;
  }

  keyOf(id: number): NodeKey {
    if (!Number.isInteger(id) || id < 0 || id >= this.size) throw new RangeError(`no node with id ${id} (document has ${this.size} nodes)`);
    return keyString(this.nums[id]);
  }

  /** The node id the key points at in the current document, or null when the element was removed. */
  idOf(key: NodeKey): number | null {
    const num = keyNumber(key);
    if (num === null) return null;
    return this.lookup().get(num) ?? null;
  }

  keys(): NodeKey[] {
    return Array.from(this.nums, keyString);
  }

  /**
   * Carry the keys across one edit. `next` is the document the splices produced from this map's document.
   * An element keeps its key when its start offset maps through the splices to a node with the same tag. Elements
   * that sat inside a replaced range are matched to the nodes the replacement created (same tag and attributes,
   * in order); the rest are removed. New elements get fresh keys (`mint` may supply them, for replay).
   */
  rebase(next: SourceDoc, splices: Splice[], mint?: () => NodeKey | undefined): RefMap {
    const ordered = checkSplices(Number.MAX_SAFE_INTEGER, splices);
    const mapStart = (p: number): number => {
      let delta = 0;
      for (const s of ordered) {
        if (s.start === s.end) {
          if (p >= s.start) delta += s.text.length;
          else break;
        } else {
          if (p < s.start) break;
          if (p < s.end) return -1;
          delta += s.text.length - (s.end - s.start);
        }
      }
      return p + delta;
    };

    const nn = next.nodes.length;
    const keys = new Uint32Array(nn);
    const claimed = new Uint8Array(nn);
    const byStart = new Map<number, number[]>();
    const unlocated = new Map<string, number[]>();
    for (const x of next.nodes) {
      if (x.start >= 0) {
        const list = byStart.get(x.start);
        if (list) list.push(x.id);
        else byStart.set(x.start, [x.id]);
      } else {
        const list = unlocated.get(x.tag);
        if (list) list.push(x.id);
        else unlocated.set(x.tag, [x.id]);
      }
    }
    const seen = new Map<string, number>();
    const orphans: number[] = [];
    for (let i = 0; i < this.size; i++) {
      const tag = this.tags[i];
      const s = this.starts[i];
      const ord = seen.get(`${s}|${tag}`) ?? 0;
      seen.set(`${s}|${tag}`, ord + 1);
      let target = -1;
      if (s < 0) {
        target = unlocated.get(tag)?.[ord] ?? -1;
      } else {
        const p = mapStart(s);
        if (p >= 0) target = (byStart.get(p) ?? []).filter((id) => next.nodes[id].tag === tag)[ord] ?? -1;
      }
      if (target >= 0 && !claimed[target]) {
        keys[target] = this.nums[i];
        claimed[target] = 1;
      } else orphans.push(i);
    }

    // Orphans: nodes that sat inside a replaced range (a move re-inserts them elsewhere).
    if (orphans.length) {
      const cands: number[] = [];
      for (let id = 0; id < nn; id++) if (!claimed[id]) cands.push(id);
      const candSig = cands.map((id) => signature(next.nodes[id]));
      const used = new Uint8Array(cands.length);
      const left: number[] = [];
      let ptr = 0;
      for (const o of orphans) {
        let hit = -1;
        for (let j = ptr; j < cands.length; j++) {
          if (!used[j] && next.nodes[cands[j]].tag === this.tags[o] && candSig[j] === this.sigs[o]) { hit = j; break; }
        }
        if (hit < 0) { left.push(o); continue; }
        used[hit] = 1;
        ptr = hit + 1;
        keys[cands[hit]] = this.nums[o];
        claimed[cands[hit]] = 1;
      }
      for (const o of left) {
        const hit = cands.findIndex((id, j) => !used[j] && next.nodes[id].tag === this.tags[o]);
        if (hit < 0) continue;
        used[hit] = 1;
        keys[cands[hit]] = this.nums[o];
        claimed[cands[hit]] = 1;
      }
    }

    const taken = new Set<number>();
    for (let i = 0; i < nn; i++) if (keys[i]) taken.add(keys[i]);
    if (mint) {
      for (let i = 0; i < nn; i++) {
        if (keys[i]) continue;
        const num = keyNumber(mint());
        if (num !== null && !taken.has(num)) {
          keys[i] = num;
          taken.add(num);
        }
      }
    }
    return new RefMap(next, { gen: this.gen, keys });
  }

  /**
   * Keys for a document that changed outside the editor (no splices known): nodes are matched by tag and attribute
   * signature, in document order (longest common subsequence). Text edits keep their keys; new elements get fresh ones.
   */
  static reconcile(from: RefMap, next: SourceDoc): RefMap {
    const nn = next.nodes.length;
    const nextSigs = new Uint32Array(nn);
    for (let i = 0; i < nn; i++) nextSigs[i] = signature(next.nodes[i]);
    const match = lcs(from.sigs, nextSigs, (i, j) => from.tags[i] === next.nodes[j].tag);
    const keys = new Uint32Array(nn);
    for (let i = 0; i < from.size; i++) if (match[i] >= 0) keys[match[i]] = from.nums[i];
    return new RefMap(next, { gen: from.gen, keys });
  }

  /** What changed between two maps of consecutive documents (undo snapshots and transaction ends). */
  static diff(before: RefMap, after: RefMap): RefDiff {
    const out: RefDiff = { created: [], removed: [], attrs: [], content: [], structural: false };
    const was = before.lookup();
    const now = after.lookup();
    for (let j = 0; j < after.size; j++) {
      const i = was.get(after.nums[j]);
      if (i === undefined) { out.created.push(keyString(after.nums[j])); continue; }
      if (before.kids[i] !== after.kids[j]) out.structural = true;
      if (before.texts[i] !== after.texts[j]) out.content.push(keyString(after.nums[j]));
      else if (before.sigs[i] !== after.sigs[j]) out.attrs.push(keyString(after.nums[j]));
    }
    for (let i = 0; i < before.size; i++) if (!now.has(before.nums[i])) out.removed.push(keyString(before.nums[i]));
    if (out.created.length || out.removed.length) out.structural = true;
    return out;
  }
}

/** Longest common subsequence of two hash sequences; returns, per element of `a`, its partner index in `b` or -1. */
function lcs(a: Uint32Array, b: Uint32Array, same: (i: number, j: number) => boolean): Int32Array {
  const out = new Int32Array(a.length).fill(-1);
  const eq = (i: number, j: number) => a[i] === b[j] && same(i, j);
  let lo = 0;
  while (lo < a.length && lo < b.length && eq(lo, lo)) { out[lo] = lo; lo++; }
  let ea = a.length;
  let eb = b.length;
  while (ea > lo && eb > lo && eq(ea - 1, eb - 1)) { ea--; eb--; out[ea] = eb; }
  const n = ea - lo;
  const m = eb - lo;
  if (n === 0 || m === 0) return out;
  if (n * m > 40_000_000) return out; // too different to align: the middle gets fresh keys
  const w = m + 1;
  const dp = new Uint32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * w + j] = eq(lo + i, lo + j) ? dp[(i + 1) * w + j + 1] + 1 : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
    }
  }
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (eq(lo + i, lo + j) && dp[i * w + j] === dp[(i + 1) * w + j + 1] + 1) { out[lo + i] = lo + j; i++; j++; }
    else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) i++;
    else j++;
  }
  return out;
}

// --- keyed operations -------------------------------------------------------------------------------------------

/** An Op with every node id field replaced by a NodeKey. */
export type KeyedOp =
  | { kind: 'setText'; id: NodeKey; text: string }
  | { kind: 'setAttr'; id: NodeKey; name: string; value: string | null }
  | { kind: 'setUtility'; id: NodeKey; group: Extract<Op, { kind: 'setUtility' }>['group']; value: string | null }
  | { kind: 'setClasses'; id: NodeKey; classes: string[] }
  | { kind: 'setStyle'; id: NodeKey; prop: string; value: string | null }
  | { kind: 'insertHtml'; parent: NodeKey; index: number; html: string }
  | { kind: 'remove'; id: NodeKey }
  | { kind: 'move'; id: NodeKey; parent: NodeKey; index: number }
  | { kind: 'duplicate'; id: NodeKey }
  | { kind: 'wrap'; ids: NodeKey[]; html: string }
  | { kind: 'setToken'; path: string[]; value: string | null };

/**
 * Turn a keyed op into an id op against the document `refs` describes. Throws OpError('invalid') for a malformed
 * key field and StaleRefError when a key does not resolve.
 */
export function resolveKeyed(op: KeyedOp, refs: RefMap): Op {
  const o = op as unknown as Record<string, unknown>;
  if (typeof o !== 'object' || o === null) throw new OpError('invalid', 'op must be an object');
  const one = (field: string): number => {
    const k = o[field];
    if (typeof k !== 'string') throw new OpError('invalid', `op ${JSON.stringify(o.kind)}: field '${field}' must be a node key (string)`);
    const id = refs.idOf(k);
    if (id === null) throw new StaleRefError(k);
    return id;
  };
  switch (o.kind) {
    case 'setText': case 'setAttr': case 'setUtility': case 'setClasses': case 'setStyle': case 'remove': case 'duplicate':
      return { ...o, id: one('id') } as unknown as Op;
    case 'insertHtml':
      return { ...o, parent: one('parent') } as unknown as Op;
    case 'move':
      return { ...o, id: one('id'), parent: one('parent') } as unknown as Op;
    case 'wrap': {
      if (!Array.isArray(o.ids)) throw new OpError('invalid', "op \"wrap\": field 'ids' must be an array of node keys");
      const ids = o.ids.map((k) => {
        if (typeof k !== 'string') throw new OpError('invalid', "op \"wrap\": field 'ids' must be an array of node keys");
        const id = refs.idOf(k);
        if (id === null) throw new StaleRefError(k);
        return id;
      });
      return { ...o, ids } as unknown as Op;
    }
    case 'setToken':
      return o as unknown as Op;
    default:
      throw new OpError('invalid', `unknown op kind ${JSON.stringify(o.kind)}`);
  }
}
