import { describe, expect, it } from 'vitest';
import { EditorDocument } from '../../src/engine/document.ts';
import { OpError } from '../../src/engine/errors.ts';
import { RefMap, StaleRefError, type KeyedOp } from '../../src/engine/refs.ts';
import { findAttr, parseSource, classList, type SourceDoc } from '../../src/engine/source.ts';
import { applySplices } from '../../src/engine/splice.ts';
import { randomOp } from '../random-ops.ts';
import { ATTENTION, MECHANISTIC, MINIMAL, loadFixture, makeRng } from '../helpers.ts';

const minimal = loadFixture(MINIMAL)!;

const ed = (text = minimal) => EditorDocument.fromText(text);
const byClass = (d: EditorDocument, cls: string) => d.doc.nodes.filter((n) => classList(n).includes(cls));
const keyOfFirst = (d: EditorDocument, q: { tag?: string; cls?: string }) => d.refs.keyOf(d.doc.query(q)[0].id);
const nodeOf = (d: EditorDocument, key: string) => {
  const id = d.refs.idOf(key);
  return id === null ? null : d.doc.byId(id);
};

const leafSpan = (d: EditorDocument) => d.doc.nodes.find((n) => n.tag === 'span' && n.children.length === 0 && n.patchable)!;
const parentWithKids = (d: EditorDocument) => d.doc.nodes.find((n) => n.tag === 'p' && n.children.length > 0 && n.patchable)!;
const subtreeOf = (d: EditorDocument, id: number) => {
  const out: number[] = [];
  const walk = (i: number) => { out.push(i); d.doc.byId(i).children.forEach(walk); };
  walk(id);
  return out;
};

describe('RefMap basics', () => {
  it('keyOf and idOf round-trip and keys are unique opaque strings', () => {
    const d = ed();
    const keys = d.doc.nodes.map((n) => d.refs.keyOf(n.id));
    expect(new Set(keys).size).toBe(keys.length);
    keys.forEach((k, i) => {
      expect(typeof k).toBe('string');
      expect(d.refs.idOf(k)).toBe(i);
    });
    expect(d.refs.idOf('nope')).toBeNull();
    expect(d.refs.idOf('nzzzzzzz')).toBeNull();
    expect(() => d.refs.keyOf(99999)).toThrow(RangeError);
  });
});

describe('keys survive edits (Review Focus 3)', () => {
  it('a key held across an insertHtml before the element still points at the same element', () => {
    const d = ed();
    const slide2 = d.doc.nodes.filter((n) => n.tag === 'section' && classList(n).includes('slide'))[1];
    const h = d.doc.nodes.find((n) => /^h[1-3]$/.test(n.tag) && n.start > slide2.start && n.end < slide2.end)!;
    const key = d.refs.keyOf(h.id);
    const idBefore = h.id;
    const first = d.doc.nodes.find((n) => n.tag === 'section' && classList(n).includes('slide'))!;
    d.applyKeyed([{ kind: 'insertHtml', parent: d.refs.keyOf(first.id), index: 0, html: '<p class="nm-new">new</p><p>another</p>' }]);
    const after = nodeOf(d, key)!;
    expect(after.id).toBeGreaterThan(idBefore); // ids moved ...
    expect(after.tag).toBe(h.tag);
    expect(d.doc.text.slice(after.start, after.end)).toBe(minimal.slice(h.start, h.end)); // ... the key did not
  });

  it('setText, setUtility and setAttr keep every key', () => {
    const d = ed();
    const all = d.refs.keys();
    const t = leafSpan(d);
    d.applyKeyed([{ kind: 'setText', id: d.refs.keyOf(t.id), text: 'عنوان جديد' }]);
    expect(d.refs.keys()).toEqual(all);
    d.applyKeyed([{ kind: 'setUtility', id: d.refs.keyOf(t.id), group: 'opacity', value: '50' }]);
    expect(d.refs.keys()).toEqual(all);
    d.applyKeyed([{ kind: 'setAttr', id: d.refs.keyOf(t.id), name: 'data-x', value: '1' }]);
    expect(d.refs.keys()).toEqual(all);
  });

  it('a two-op transaction resolves each key against the document the previous op produced', () => {
    const d = ed();
    const slide = byClass(d, 'slide')[0];
    const target = d.doc.nodes.find((n) => n.tag !== 'section' && n.start > slide.start && n.end < slide.end && n.patchable)!;
    const tk = d.refs.keyOf(target.id);
    const pk = d.refs.keyOf(slide.id);
    const text = d.doc.text.slice(target.start, target.end);
    d.applyKeyed([
      { kind: 'insertHtml', parent: pk, index: 0, html: '<div class="nm-first">x</div>' },
      { kind: 'setAttr', id: tk, name: 'data-two', value: 'ok' },
    ]);
    const n = nodeOf(d, tk)!;
    expect(findAttr(n, 'data-two')?.value).toBe('ok');
    expect(n.tag).toBe(target.tag);
    expect(d.doc.text.slice(n.start, n.end).replace(/ data-two="ok"/, '')).toBe(text);
  });

  it('move keeps the key of the element and of its descendants at the new place', () => {
    const d = ed();
    const slides = byClass(d, 'slide');
    const mover = parentWithKids(d);
    const subtree = subtreeOf(d, mover.id);
    const keys = subtree.map((id) => d.refs.keyOf(id));
    const tags = subtree.map((id) => d.doc.byId(id).tag);
    const destKey = d.refs.keyOf(slides[slides.length - 1].id);
    d.applyKeyed([{ kind: 'move', id: keys[0], parent: destKey, index: 0 }]);
    const moved = nodeOf(d, keys[0])!;
    expect(moved.parent).toBe(d.refs.idOf(destKey));
    keys.forEach((k, i) => expect(nodeOf(d, k)?.tag, `descendant ${i}`).toBe(tags[i]));
    const ids = keys.map((k) => d.refs.idOf(k) as number);
    expect(ids).toEqual(ids.map((_, i) => ids[0] + i)); // the moved subtree is contiguous at the destination
    expect(subtree.length).toBeGreaterThan(1);
  });

  it('duplicate: the original and its descendants keep their keys; the copy gets all-new keys', () => {
    const d = ed();
    const orig = parentWithKids(d);
    const subtree = subtreeOf(d, orig.id);
    const keys = subtree.map((id) => d.refs.keyOf(id));
    const before = new Set(d.refs.keys());
    const tx = d.applyKeyed([{ kind: 'duplicate', id: keys[0] }]);
    keys.forEach((k, i) => expect(d.refs.idOf(k), `orig ${i}`).toBe(subtree[i]));
    const fresh = d.refs.keys().filter((k) => !before.has(k));
    expect(fresh.length).toBe(subtree.length);
    expect(d.mintedBy(tx)).toEqual(fresh);
  });

  it('remove makes the key (and the subtree keys) unresolvable; undo brings them back; redo removes again', () => {
    const d = ed();
    const victim = parentWithKids(d);
    const sub = subtreeOf(d, victim.id).map((id) => d.refs.keyOf(id));
    const idsBefore = sub.map((k) => d.refs.idOf(k));
    d.applyKeyed([{ kind: 'remove', id: sub[0] }]);
    sub.forEach((k) => expect(d.refs.idOf(k)).toBeNull());
    expect(d.undo()).toBe(true);
    expect(sub.map((k) => d.refs.idOf(k))).toEqual(idsBefore);
    expect(d.redo()).toBe(true);
    sub.forEach((k) => expect(d.refs.idOf(k)).toBeNull());
  });

  it('keys are never reused: a new element after a removal gets a key no removed element ever had', () => {
    const d = ed();
    const victim = d.doc.nodes.find((n) => n.patchable && n.tag === 'p')!;
    const vk = d.refs.keyOf(victim.id);
    d.applyKeyed([{ kind: 'remove', id: vk }]);
    const everSeen = new Set<string>([...d.refs.keys(), vk]);
    const slide = byClass(d, 'slide')[0];
    d.applyKeyed([{ kind: 'insertHtml', parent: d.refs.keyOf(slide.id), index: 0, html: '<p>x</p>' }]);
    d.undo();
    d.undo(); // back before the removal, then forward again with a different edit
    d.applyKeyed([{ kind: 'insertHtml', parent: d.refs.keyOf(byClass(d, 'slide')[0].id), index: 0, html: '<p>y</p>' }]);
    const newest = d.refs.keys().filter((k) => !everSeen.has(k));
    expect(newest.length).toBeGreaterThan(0);
    expect(d.refs.idOf(vk)).not.toBeNull(); // the undo restored it ...
    expect(newest).not.toContain(vk); // ... and nothing fresh took its place
  });

  it('a coalesced transaction undoes to the keys before the first op', () => {
    let t = 1000;
    const d = EditorDocument.fromText(minimal, { now: () => t });
    const first = d.doc.query({ tag: 'p' })[0];
    const k = d.refs.keyOf(first.id);
    const slide = byClass(d, 'slide')[0];
    const before = d.refs.keys();
    d.applyKeyed([{ kind: 'insertHtml', parent: d.refs.keyOf(slide.id), index: 0, html: '<div class="nm-a"></div>' }], { coalesceKey: 'drag' });
    t += 100;
    d.applyKeyed([{ kind: 'insertHtml', parent: d.refs.keyOf(slide.id), index: 0, html: '<div class="nm-b"></div>' }], { coalesceKey: 'drag' });
    expect(d.refs.keys().length).toBe(before.length + 2);
    d.undo();
    expect(d.refs.keys()).toEqual(before);
    expect(d.refs.idOf(k)).toBe(first.id);
  });

  it('an unknown key throws StaleRefError and changes nothing; a malformed key field is an OpError', () => {
    const d = ed();
    const text = d.text;
    expect(() => d.applyKeyed([{ kind: 'remove', id: 'n99zzz' }])).toThrow(StaleRefError);
    expect(() => d.applyKeyed([{ kind: 'remove', id: 5 as unknown as string }])).toThrow(OpError);
    expect(() => d.applyKeyed([{ kind: 'wrap', ids: [1 as unknown as string], html: '<div></div>' }])).toThrow(OpError);
    expect(d.text).toBe(text);
    expect(d.canUndo()).toBe(false);
  });

  it('plain apply keeps the keys in step too', () => {
    const d = ed();
    const p = d.doc.query({ tag: 'p' })[0];
    const k = d.refs.keyOf(p.id);
    const slide = byClass(d, 'slide')[0];
    d.apply([{ kind: 'insertHtml', parent: slide.id, index: 0, html: '<div></div>' }]);
    expect(nodeOf(d, k)?.tag).toBe('p');
  });
});

describe('RefMap.reconcile and RefMap.diff', () => {
  it('reconcile carries keys across an external text edit and attribute change, mints for new elements', () => {
    const d = ed();
    const old = d.refs;
    const p = d.doc.query({ tag: 'p' })[0];
    const pk = old.keyOf(p.id);
    const last = d.doc.nodes.filter((n) => n.tag === 'p').pop()!;
    const lk = old.keyOf(last.id);
    // The "agent" rewrites the text of the first paragraph, adds a class to another element and inserts a section.
    let text = d.text;
    const first = d.doc.query({ tag: 'p' })[0];
    text = applySplices(text, [
      { start: first.startTagEnd, end: first.endTagStart as number, text: 'agent text' },
      { start: d.doc.query({ tag: 'body' })[0].startTagEnd, end: d.doc.query({ tag: 'body' })[0].startTagEnd, text: '<aside>new</aside>' },
    ]);
    const next = parseSource(text);
    const m = RefMap.reconcile(old, next);
    expect(next.byId(m.idOf(pk) as number).tag).toBe('p');
    expect(next.byId(m.idOf(lk) as number).tag).toBe('p');
    expect(next.text.slice(next.byId(m.idOf(lk) as number).start, next.byId(m.idOf(lk) as number).end)).toBe(minimal.slice(last.start, last.end));
    const aside = next.query({ tag: 'aside' })[0];
    expect(old.idOf(m.keyOf(aside.id))).toBeNull(); // a new key
  });

  it('diff classifies attribute-only, text, structural and no change', () => {
    const d = ed();
    const before = d.refs;
    const p = leafSpan(d);
    const k = before.keyOf(p.id);
    d.applyKeyed([{ kind: 'setAttr', id: k, name: 'data-q', value: '1' }]);
    let diff = RefMap.diff(before, d.refs);
    expect(diff).toMatchObject({ attrs: [k], content: [], created: [], removed: [], structural: false });
    const mid = d.refs;
    d.applyKeyed([{ kind: 'setText', id: k, text: 'تغيير' }]);
    diff = RefMap.diff(mid, d.refs);
    expect(diff).toMatchObject({ attrs: [], content: [k], structural: false });
    const mid2 = d.refs;
    d.applyKeyed([{ kind: 'duplicate', id: k }]);
    diff = RefMap.diff(mid2, d.refs);
    expect(diff.structural).toBe(true);
    expect(diff.created.length).toBe(1);
    expect(RefMap.diff(d.refs, d.refs)).toMatchObject({ attrs: [], content: [], created: [], removed: [], structural: false });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Property test. Every element of the deck is stamped with a unique data-nm-mark; the oracle is the bijection
// key <-> mark. A rebase that swaps two same-tag siblings, or drops a key it should keep, fails it.

function stamp(text: string): string {
  const doc = parseSource(text);
  const body = doc.nodes.find((n) => n.tag === 'body');
  const inBody = (id: number) => { for (let p: number | null = id; p !== null; p = doc.nodes[p].parent) if (p === body?.id) return true; return false; };
  const splices = doc.nodes
    .filter((n) => n.patchable && n.start >= 0 && inBody(n.id) && n.ns === doc.nodes[n.id].ns)
    .map((n) => ({ start: n.start + 1 + n.tag.length, end: n.start + 1 + n.tag.length, text: ` data-nm-mark="m${n.id}"` }));
  return applySplices(text, splices);
}

function markOf(doc: SourceDoc, id: number): string | null {
  return findAttr(doc.byId(id), 'data-nm-mark')?.value ?? null;
}

interface Snapshot { key: string; tag: string; mark: string }
function snapshot(d: EditorDocument): Snapshot[] {
  const out: Snapshot[] = [];
  for (const n of d.doc.nodes) {
    const mark = markOf(d.doc, n.id);
    if (mark) out.push({ key: d.refs.keyOf(n.id), tag: n.tag, mark });
  }
  return out;
}

const SEQUENCES = 200;
const decks = [
  { name: 'attention', rel: ATTENTION, seed: 1 },
  { name: 'mechanistic', rel: MECHANISTIC, seed: 2 },
];
for (const deck of decks) {
  const raw = loadFixture(deck.rel);
  (raw ? it : it.skip)(`property: ${SEQUENCES} random op sequences on ${deck.name}: every key keeps pointing at its element`, () => {
    const stamped = stamp(raw as string);
    let applied = 0;
    let survivedChecks = 0;
    const kinds: Record<string, number> = {};
    for (let s = 0; s < SEQUENCES; s++) {
      const rng = makeRng(deck.seed * 100_000 + s);
      const d = EditorDocument.fromText(stamped);
      const len = 1 + Math.floor(rng() * 10);
      for (let step = 0; step < len; step++) {
        let op = null;
        for (let tries = 0; tries < 8 && !op; tries++) op = randomOp(d.doc, d.tokens, rng, { scope: rng() < 0.5 ? 'slides' : 'all' });
        if (!op) continue;
        const before = snapshot(d);
        const target = 'id' in op ? (op.id as number) : -1;
        const targetKey = target >= 0 ? d.refs.keyOf(target) : '';
        let tx;
        try {
          tx = d.apply([op]);
        } catch (e) {
          if (e instanceof OpError) continue; // the engine refused the op; nothing changed
          throw e;
        }
        applied++;
        if (tx.forward.flat().length > 0) kinds[op.kind] = (kinds[op.kind] ?? 0) + 1;
        // 1. every key that still resolves points at an element with the same tag and mark
        const marksAfter = new Map<string, number[]>();
        for (const n of d.doc.nodes) {
          const m = markOf(d.doc, n.id);
          if (m) marksAfter.set(m, [...(marksAfter.get(m) ?? []), n.id]);
        }
        for (const b of before) {
          const id = d.refs.idOf(b.key);
          const where = `${deck.name} seq ${s} step ${step} ${op.kind}`;
          if (id !== null) {
            expect(d.doc.byId(id).tag, `${where}: tag of ${b.mark}`).toBe(b.tag);
            expect(markOf(d.doc, id), `${where}: key resolves to its own element`).toBe(b.mark);
            survivedChecks++;
          } else {
            // 2. no spurious loss: a key may only vanish when its element is gone
            expect(marksAfter.has(b.mark), `${where}: key of ${b.mark} lost while the element is still there`).toBe(false);
          }
        }
        // 3. a duplicate leaves the original in place (the copy goes right after it)
        if (op.kind === 'duplicate' && tx.forward.flat().length > 0) {
          expect(d.refs.idOf(targetKey), `duplicate ${s}/${step}: original keeps its place`).toBe(target);
        }
      }
      // undo everything: the keys of the original document are all back
      const rootKeys = new RefMap(parseSource(stamped)).keys().length;
      while (d.canUndo()) d.undo();
      expect(d.text).toBe(stamped);
      expect(d.refs.keys().length).toBe(rootKeys);
      snapshot(d).forEach((b) => expect(d.refs.idOf(b.key)).not.toBeNull());
    }
    expect(applied).toBeGreaterThan(SEQUENCES);
    expect(survivedChecks).toBeGreaterThan(10_000);
    // the structural paths (orphan matching after move, wrap, remove, insert, duplicate) must really have run
    console.log(`[refs property] ${deck.name}: ${JSON.stringify(kinds)}`);
    for (const k of ['move', 'wrap', 'remove', 'duplicate', 'insertHtml', 'setText', 'setAttr']) expect(kinds[k] ?? 0, `${k} ops that changed the document`).toBeGreaterThanOrEqual(10);
  }, 600_000);
}
