// Structural ops on runtime v2 vocabulary (NM-23): duplicate gives the copy its own connector endpoint and keeps its
// detail template reference consistent; remove takes the element's detail template with it.
import { describe, expect, it } from 'vitest';
import { EditorDocument } from '../../src/engine/document.ts';
import { findAttr } from '../../src/engine/source.ts';

const SRC = `<main class="deck-stage">
  <section class="slide" data-links="a>b: يرسل">
    <div class="camera-rig">
      <div class="card" id="c1" data-node="a" data-step="1" data-act="detail" data-morph="card">بطاقة</div>
      <template data-detail-for="c1"><p>تفاصيل</p></template>
      <div class="card" id="c2" data-node="b">أخرى</div>
    </div>
  </section>
</main>`;
const byAttr = (d: EditorDocument, a: string) => d.doc.query({ attr: a })[0];

describe('duplicate on v2 markup', () => {
  it('the copy gets its own id, data-node and data-morph; the original is untouched', () => {
    const d = EditorDocument.fromText(SRC);
    d.apply([{ kind: 'duplicate', id: byAttr(d, 'id=c1').id }]);
    expect(d.doc.query({ attr: 'data-node=a' })).toHaveLength(1);
    expect(d.doc.query({ attr: 'data-node=a-2' })).toHaveLength(1);
    expect(d.doc.query({ attr: 'data-morph=card' })).toHaveLength(1);
    expect(d.doc.query({ attr: 'id=c1-2' })).toHaveLength(1);
    expect(findAttr(byAttr(d, 'id=c1-2'), 'data-step')?.value).toBe('1'); // same step: both appear together (contract)
    d.undo();
    expect(d.text).toBe(SRC);
  });
});

describe('remove on v2 markup', () => {
  it('removing an element removes its detail template, and undo restores both', () => {
    const d = EditorDocument.fromText(SRC);
    d.apply([{ kind: 'remove', id: byAttr(d, 'id=c1').id }]);
    expect(d.text).not.toContain('data-detail-for="c1"');
    expect(d.text).not.toContain('id="c1"');
    expect(d.text).toContain('id="c2"');
    expect(d.text.split('\n').some((l) => l.trim() === '')).toBe(false); // no blank lines left behind
    d.undo();
    expect(d.text).toBe(SRC);
  });
  it('removing an element without a template removes only that element', () => {
    const d = EditorDocument.fromText(SRC);
    d.apply([{ kind: 'remove', id: byAttr(d, 'id=c2').id }]);
    expect(d.text).toContain('data-detail-for="c1"');
    expect(d.text).toBe(SRC.replace('      <div class="card" id="c2" data-node="b">أخرى</div>\n', ''));
  });
});
