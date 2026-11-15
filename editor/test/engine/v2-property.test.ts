// NM-23 acceptance: random edits on a runtime v2 deck (the showcase) never corrupt what the runtime depends on.
// After every op: no new lint errors, no Morph id twice on a slide, no orphaned detail template, every diagram's
// DSL source unchanged; after the sequence, undo restores the exact bytes.
import { describe, expect, it } from 'vitest';
import { dirname } from 'node:path';
import { EditorDocument } from '../../src/engine/document.ts';
import { inspectDeck, lintDeck } from '../../src/engine/deck-adapter.ts';
import { OpError } from '../../src/engine/errors.ts';
import { findAttr } from '../../src/engine/source.ts';
import { SHOWCASE, fixturePath, loadFixture, makeRng } from '../helpers.ts';
import { randomOp } from '../random-ops.ts';

const text = loadFixture(SHOWCASE)!;
const dir = dirname(fixturePath(SHOWCASE));
const SEQUENCES = 200;

function audit(d: EditorDocument) {
  const info = inspectDeck(d.doc);
  const issues = lintDeck(d.doc, info, dir);
  const dsl = new Map(info.diagrams.filter((x) => x.sourceId !== null)
    .map((x) => { const s = d.doc.nodes[x.sourceId!]; return [findAttr(d.doc.nodes[x.id], 'data-id')?.value ?? String(x.id), d.text.slice(s.startTagEnd, s.endTagStart!)]; }));
  return { errors: new Set(issues.filter((i) => i.severity === 'error').map((i) => i.code)), codes: issues.map((i) => i.code), dsl };
}

describe('random edits on a runtime v2 deck', () => {
  it(`${SEQUENCES} sequences keep the deck intact`, () => {
    const base = audit(EditorDocument.fromText(text));
    let applied = 0;
    for (let s = 0; s < SEQUENCES; s++) {
      const rng = makeRng(7_000 + s);
      const d = EditorDocument.fromText(text);
      const len = 1 + Math.floor(rng() * 8);
      for (let step = 0; step < len; step++) {
        let op = null;
        for (let tries = 0; tries < 8 && !op; tries++) op = randomOp(d.doc, d.tokens, rng, { scope: 'slides', protectStructure: true });
        if (!op) continue;
        try { d.apply([op]); } catch (e) { if (e instanceof OpError) continue; throw e; }
        applied++;
        const now = audit(d);
        const where = `seq ${s} step ${step} ${op.kind}`;
        for (const code of now.errors) expect(base.errors.has(code), `${where}: new lint error ${code}`).toBe(true);
        expect(now.codes.filter((c) => c === 'duplicate-morph'), `${where}: Morph id twice on a slide`).toEqual([]);
        expect(now.codes.filter((c) => c === 'orphan-detail-template'), `${where}: orphaned detail template`).toEqual([]);
        for (const [id, src] of now.dsl) if (base.dsl.has(id)) expect(src, `${where}: DSL of diagram ${id} changed`).toBe(base.dsl.get(id));
      }
      while (d.canUndo()) d.undo();
      expect(d.text).toBe(text);
    }
    expect(applied).toBeGreaterThan(SEQUENCES);
  });
});
