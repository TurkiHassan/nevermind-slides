// The editor must never write runtime-generated content into a deck's source (runtime contract: "Generated
// markup"). Before this guard a text edit on a diagram wrote plain text into <figure class="nm-diagram">.
import { describe, expect, it } from 'vitest';
import { EditorDocument } from '../../src/engine/document.ts';
import { OpError } from '../../src/engine/errors.ts';
import { runtimeOwned } from '../../src/engine/runtime-owned.ts';
import { classList, findAttr, parseSource, type SourceDoc } from '../../src/engine/source.ts';
import { SHOWCASE, loadFixture } from '../helpers.ts';

const showcase = loadFixture(SHOWCASE)!;
const figure = (d: SourceDoc) => d.nodes.find((n) => n.tag === 'figure' && classList(n).includes('nm-diagram'))!;
const dsl = (d: SourceDoc) => d.nodes.find((n) => n.tag === 'script' && findAttr(n, 'type')?.value === 'text/nm-diagram')!;
const codeOf = (f: () => unknown) => { try { f(); } catch (e) { return e instanceof OpError ? e.code : 'other'; } return null; };
const changedLines = (a: string, b: string) => {
  const x = a.split('\n'), y = b.split('\n');
  expect(y.length).toBe(x.length);
  return x.map((l, i) => (l === y[i] ? -1 : i)).filter((i) => i >= 0);
};

describe('runtime-owned content (runtime v2 decks)', () => {
  it('classifies the diagram figure, generated markup and its containers', () => {
    const src = `<main><section class="slide"><div id="card"><figure class="nm-diagram"><script type="text/nm-diagram">a -> b</script>
<figcaption id="cap">نص</figcaption></figure></div>
<div id="saved"><div class="nm-dg-canvas"><span id="lbl">x</span></div></div>
<div id="links" data-links="a>b"><div class="nm-links nm-dg" data-nm-generated="links"><b id="g">x</b></div><p id="p">نص</p></div></section></main>`;
    const d = parseSource(src);
    const byId = (v: string) => d.query({ attr: `id=${v}` })[0].id;
    expect(runtimeOwned(d, figure(d).id)).toBe('diagram');
    expect(runtimeOwned(d, byId('card'))).toBe('contains-generated');
    expect(runtimeOwned(d, byId('lbl'))).toBe('generated');
    expect(runtimeOwned(d, byId('g'))).toBe('generated');
    expect(runtimeOwned(d, byId('links'))).toBe('contains-generated');
    expect(runtimeOwned(d, byId('cap'))).toBeNull(); // a figcaption is the author's text
    expect(runtimeOwned(d, byId('p'))).toBeNull();
  });

  it('refuses a text edit on a diagram figure and leaves the source untouched', () => {
    const d = EditorDocument.fromText(showcase);
    expect(codeOf(() => d.apply([{ kind: 'setText', id: figure(d.doc).id, text: 'نص مكتوب فوق المخطط' }]))).toBe('unsupported');
    expect(d.text).toBe(showcase);
  });

  it('refuses inserting or moving HTML into a diagram figure', () => {
    const d = EditorDocument.fromText(showcase);
    const fig = figure(d.doc).id;
    expect(codeOf(() => d.apply([{ kind: 'insertHtml', parent: fig, index: 0, html: '<p>x</p>' }]))).toBe('unsupported');
    const h2 = d.doc.query({ tag: 'h2' })[0].id;
    expect(codeOf(() => d.apply([{ kind: 'move', id: h2, parent: fig, index: 0 }]))).toBe('unsupported');
    expect(d.text).toBe(showcase);
  });

  it('edits the diagram through its DSL source and changes only that line', () => {
    const d = EditorDocument.fromText(showcase);
    const s = dsl(d.doc);
    const before = d.text.slice(s.startTagEnd, s.endTagStart!);
    const line = before.split('\n').find((l) => /\[[^\]]+\]/.test(l))!;
    const label = /\[([^\]|]+)/.exec(line)![1];
    const after = before.replace(line, line.replace(label, label + ' المعدّلة'));
    d.apply([{ kind: 'setText', id: s.id, text: after }]);
    const changed = changedLines(showcase, d.text);
    expect(changed).toHaveLength(1);
    expect(d.text.split('\n')[changed[0]]).toContain(label + ' المعدّلة');
    d.undo();
    expect(d.text).toBe(showcase);
  });

  it('refuses a DSL that would close the script early', () => {
    const d = EditorDocument.fromText(showcase);
    expect(codeOf(() => d.apply([{ kind: 'setText', id: dsl(d.doc).id, text: 'a </script><b>x</b>' }]))).toBe('invalid');
  });

  it('opening and saving a v2 deck without edits is byte-identical', () => {
    const d = EditorDocument.fromText(showcase);
    expect(d.text).toBe(showcase);
  });

  it('a supported edit on a v2 deck changes only the intended line', () => {
    const d = EditorDocument.fromText(showcase);
    const h = d.doc.query({ tag: 'h2' })[0];
    d.apply([{ kind: 'setText', id: h.id, text: 'عنوان جديد' }]);
    const changed = changedLines(showcase, d.text);
    expect(changed).toHaveLength(1);
    expect(d.text.split('\n')[changed[0]]).toContain('عنوان جديد');
  });
});
