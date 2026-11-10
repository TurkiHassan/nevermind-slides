import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { EditorDocument } from '../../src/engine/document.ts';
import { OpError, resolveOp, type Op } from '../../src/engine/ops.ts';
import { parseSource } from '../../src/engine/source.ts';
import { applySplices } from '../../src/engine/splice.ts';
import { visibleText } from '../../src/engine/text-diff.ts';
import { DECKS, MINIMAL, loadFixture, makeRng } from '../helpers.ts';
import { randomOp } from '../random-ops.ts';

const minimal = loadFixture(MINIMAL)!;
const idOf = (ed: EditorDocument, attr: string) => ed.doc.query({ attr })[0].id;

describe('EditorDocument', () => {
  it('fromText: clean, no history, slides', () => {
    const ed = EditorDocument.fromText(minimal);
    expect(ed.text).toBe(minimal);
    expect(ed.dirty).toBe(false);
    expect(ed.canUndo()).toBe(false);
    expect(ed.undo()).toBe(false);
    expect(ed.slides().map((id) => ed.doc.byId(id).attrs['data-slide'].value)).toEqual(['1', '2', '3']);
  });

  it('Review Focus 2: the second op resolves against the document the first produced (created node)', () => {
    const ed = EditorDocument.fromText(minimal);
    const row = idOf(ed, 'id=flex-row');
    // The inserted <div> becomes the first child of #flex-row, so in the post-insert document its id is row + 1.
    ed.apply([
      { kind: 'insertHtml', parent: row, index: 0, html: '<div class="p-[28px]" id="new">جديد</div>' },
      { kind: 'setText', id: row + 1, text: 'محدث' },
      { kind: 'setUtility', id: row + 1, group: 'top', value: '12' },
    ]);
    const n = ed.doc.query({ attr: 'id=new' })[0];
    expect(n.id).toBe(row + 1);
    expect(visibleText(ed.doc, n.id)).toBe('محدث');
    expect(ed.text).toContain('<div class="p-[28px] top-[12px]" id="new">محدث</div>');
    expect(ed.doc.byId(row + 2).attrs['class'].value).toBe('p-[28px] bg-cream border-2 border-ink'); // old first child untouched
    expect(ed.undo()).toBe(true);
    expect(ed.text).toBe(minimal);
  });

  it('Review Focus 2: the second op resolves against the document the first produced (moved node)', () => {
    const ed = EditorDocument.fromText(minimal);
    const lede = idOf(ed, 'id=lede');
    const block = idOf(ed, 'id=title-block');
    // Move the lede to the front of #title-block; in the new document it is the block's first child.
    ed.apply([
      { kind: 'move', id: lede, parent: block, index: 0 },
      { kind: 'setAttr', id: block + 1, name: 'data-moved', value: 'yes' },
    ]);
    const moved = ed.doc.query({ attr: 'data-moved=yes' })[0];
    expect(moved.attrs['id'].value).toBe('lede');
    expect(ed.doc.byId(block).children[0]).toBe(moved.id);
    ed.undo();
    expect(ed.text).toBe(minimal);
  });

  it('all-or-nothing: a failing third op leaves the text and history unchanged', () => {
    const ed = EditorDocument.fromText(minimal);
    const lede = idOf(ed, 'id=lede');
    const ops: Op[] = [
      { kind: 'setText', id: lede, text: 'أ' },
      { kind: 'setAttr', id: lede, name: 'data-a', value: 'b' },
      { kind: 'remove', id: 99999 },
    ];
    expect(() => ed.apply(ops)).toThrow(OpError);
    expect(ed.text).toBe(minimal);
    expect(ed.canUndo()).toBe(false);
    expect(ed.dirty).toBe(false);
  });

  it('malformed inserted HTML is refused', () => {
    const ed = EditorDocument.fromText(minimal);
    let err: unknown;
    try { ed.apply([{ kind: 'insertHtml', parent: idOf(ed, 'id=lede'), index: 0, html: '<div>block in a paragraph</div>' }]); } catch (e) { err = e; }
    expect((err as OpError).code).toBe('invalid');
    // an unclosed inline element would leave a node without an end tag: refused too
    expect(() => ed.apply([{ kind: 'insertHtml', parent: idOf(ed, 'id=flex-row'), index: 0, html: '<div><span>unclosed</div>' }])).toThrow(/relocates/);
    expect(() => ed.apply([{ kind: 'insertHtml', parent: idOf(ed, 'id=flex-row'), index: 0, html: '</div>' }])).toThrow(/relocates/);
  });

  it('coalescing: 5 nudges with the same key within 1000 ms are one undo step', () => {
    let now = 1_000;
    const ed = EditorDocument.fromText(minimal, { now: () => now });
    const block = idOf(ed, 'id=title-block');
    for (let i = 1; i <= 5; i++) {
      ed.apply([{ kind: 'setUtility', id: block, group: 'top', value: String(132 + i) }], { coalesceKey: `nudge:${block}` });
      now += 300;
    }
    expect(ed.text).toContain('top-[137px] w-[900px]" id="title-block"');
    expect(ed.undo()).toBe(true);
    expect(ed.text).toBe(minimal);
    expect(ed.canUndo()).toBe(false);
    expect(ed.redo()).toBe(true);
    expect(ed.text).toContain('top-[137px] w-[900px]" id="title-block"');
  });

  it('coalescing stops after a gap, a different key, or no key', () => {
    let now = 0;
    const ed = EditorDocument.fromText(minimal, { now: () => now });
    const block = idOf(ed, 'id=title-block');
    const nudge = (v: number, key?: string) => ed.apply([{ kind: 'setUtility', id: block, group: 'top', value: String(v) }], key ? { coalesceKey: key } : {});
    nudge(140, 'k'); now += 500;
    nudge(141, 'k'); now += 1500;
    nudge(142, 'k'); now += 100;
    nudge(143, 'other'); now += 100;
    nudge(144); now += 100;
    nudge(145);
    let steps = 0;
    while (ed.undo()) steps++;
    expect(steps).toBe(5);
    expect(ed.text).toBe(minimal);
  });

  it('a new apply clears redo; no-op transactions are not recorded', () => {
    const ed = EditorDocument.fromText(minimal);
    const lede = idOf(ed, 'id=lede');
    ed.apply([{ kind: 'setAttr', id: lede, name: 'data-a', value: '1' }]);
    ed.undo();
    expect(ed.canRedo()).toBe(true);
    ed.apply([{ kind: 'setAttr', id: lede, name: 'data-b', value: '2' }]);
    expect(ed.canRedo()).toBe(false);
    const tx = ed.apply([{ kind: 'setAttr', id: lede, name: 'data-b', value: '2' }]);
    expect(tx.forward).toEqual([[]]);
    expect(ed.undo()).toBe(true);
    expect(ed.canUndo()).toBe(false);
  });

  it('setToken in a transaction updates the token context for the following ops', () => {
    const src = `<html><head><script>tailwind.config = { theme: { extend: { colors: {} } } }</script></head><body><p id="p" class="x">t</p></body></html>`;
    const ed = EditorDocument.fromText(src);
    ed.apply([
      { kind: 'setToken', path: ['colors', 'brand'], value: '#123456' },
      { kind: 'setUtility', id: idOf(ed, 'id=p'), group: 'text-color', value: 'brand' },
    ]);
    expect(ed.text).toContain('class="x text-brand"');
    expect(ed.tokens.colors.has('brand')).toBe(true);
  });
});

// Phase-gate property: random op sequences, undo to the start, redo to the end.
const RUNS = 300;
for (const deck of DECKS) {
  (deck.text === null ? describe.skip : describe)(`phase-gate property: ${deck.rel}`, () => {
    it(`${RUNS} runs of 1-20 random valid ops: undo restores the loaded bytes, redo restores the edited bytes`, () => {
      const text = deck.text as string;
      const stats = { runs: 0, ops: 0, transactions: 0, rejected: 0, byKind: {} as Record<string, number> };
      const t0 = performance.now();
      fc.assert(
        fc.property(fc.integer(), fc.integer({ min: 1, max: 20 }), (seed, count) => {
          const rng = makeRng(seed);
          const ed = EditorDocument.fromText(text);
          let done = 0;
          let attempts = 0;
          let recorded = 0;
          while (done < count && attempts < count * 15) {
            attempts++;
            // Build a transaction of 1-3 ops; each op is generated against the document the previous one produced.
            const size = Math.min(count - done, 1 + Math.floor(rng() * 3));
            const ops: Op[] = [];
            let doc = ed.doc;
            let curText = ed.text;
            for (let k = 0; k < size; k++) {
              const op = randomOp(doc, ed.tokens, rng, { scope: 'all' });
              if (!op) break;
              ops.push(op);
              if (k < size - 1) {
                try {
                  curText = applySplices(curText, resolveOp(doc, op, ed.tokens));
                  doc = parseSource(curText);
                } catch { break; }
              }
            }
            if (ops.length === 0) continue;
            const before = ed.text;
            const undoable = ed.canUndo();
            try {
              ed.apply(ops, rng() < 0.2 ? { coalesceKey: 'k' } : {});
            } catch (e) {
              if (!(e instanceof OpError)) throw e;
              stats.rejected++;
              expect(ed.text).toBe(before);
              expect(ed.canUndo()).toBe(undoable);
              continue;
            }
            for (const o of ops) stats.byKind[o.kind] = (stats.byKind[o.kind] ?? 0) + 1;
            if (ed.text !== before) recorded++;
            done += ops.length;
            stats.ops += ops.length;
            stats.transactions++;
          }
          const edited = ed.text;
          let undos = 0;
          while (ed.undo()) undos++;
          expect(undos).toBeLessThanOrEqual(recorded);
          expect(ed.text === text).toBe(true);
          expect(ed.dirty).toBe(false);
          while (ed.redo()) { /* redo all */ }
          expect(ed.text === edited).toBe(true);
          stats.runs++;
        }),
        { numRuns: RUNS },
      );
      const ms = performance.now() - t0;
      console.log(`[gate-property] ${deck.rel}: runs=${stats.runs} ops=${stats.ops} transactions=${stats.transactions} ` +
        `rejected=${stats.rejected} time=${(ms / 1000).toFixed(1)}s byKind=${JSON.stringify(stats.byKind)}`);
      expect(stats.runs).toBe(RUNS);
      for (const k of ['setText', 'setAttr', 'setUtility', 'setClasses', 'setStyle', 'insertHtml', 'remove', 'move', 'duplicate', 'wrap']) {
        expect(stats.byKind[k] ?? 0, k).toBeGreaterThan(0);
      }
    }, 900_000);
  });
}
