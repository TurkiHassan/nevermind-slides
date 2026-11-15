// Tables and formulas in the editor (NM-23 for roadmap NM-10 and NM-11), on the science decks of the golden corpus
// (tests/corpus/golden/*-science.scaffold.html). A table is ordinary source: its cells edit like any text and the
// runtime builds its steps, so nothing it adds can leak into the file. A formula is not prose: it is edited through
// its source (the MathML inside <math>, or data-tex), never retyped as plain text.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { inspectDeck, lintDeck } from '../../src/engine/deck-adapter.ts';
import { EditorDocument } from '../../src/engine/document.ts';
import { OpError } from '../../src/engine/errors.ts';
import { runtimeOwned } from '../../src/engine/runtime-owned.ts';
import { findAttr, parseSource, type SourceDoc } from '../../src/engine/source.ts';
import { ROOT } from '../helpers.ts';

const golden = (name: string) => readFileSync(join(ROOT, '..', 'tests', 'corpus', 'golden', `${name}.scaffold.html`), 'utf8');
const AR = golden('ar-science');
const EN = golden('en-science');
const codeOf = (f: () => unknown) => { try { f(); } catch (e) { return e instanceof OpError ? e.code : 'other'; } return null; };
const changedLines = (a: string, b: string) => {
  const x = a.split('\n'), y = b.split('\n');
  expect(y.length).toBe(x.length);
  return x.map((l, i) => (l === y[i] ? -1 : i)).filter((i) => i >= 0);
};
const first = (d: SourceDoc, pred: (n: SourceDoc['nodes'][number]) => boolean) => d.nodes.find(pred)!;

describe('inventory', () => {
  const info = inspectDeck(parseSource(AR));
  it('lists the tables with their size and the steps the runtime builds', () => {
    expect(info.tables.map((t) => [t.dataId, t.rows, t.columns, t.steps, t.stepsAct, t.highlight])).toEqual([
      ['drops', 8, 5, 'row', null, 'r8'],
      ['air', 3, 4, 'col', 'highlight', null],
    ]);
  });
  it('lists every formula: native MathML roots and data-tex hosts, with their source and linked terms', () => {
    const kinds = info.equations.map((e) => e.kind);
    expect(kinds.filter((k) => k === 'mathml').length).toBe(4); // slide 2, and three derivation lines on slide 3
    expect(kinds.filter((k) => k === 'tex').length).toBe(3); // two inline, one display
    expect(new Set(info.equations.flatMap((e) => e.terms))).toEqual(new Set(['v', 'g', 't', 'd']));
    const mathml = info.equations.find((e) => e.kind === 'mathml')!;
    expect(mathml.source.startsWith('<mi data-term="v">v</mi>')).toBe(true);
    expect(mathml.display).toBe(true);
    expect(info.equations.filter((e) => e.kind === 'tex' && e.display).map((e) => e.source)).toEqual(['t = \\sqrt{\\frac{2\\data{term=d}{d}}{g}}']);
  });
  it('the science decks raise no table or formula warnings', () => {
    for (const text of [AR, EN]) {
      const doc = parseSource(text);
      const codes = lintDeck(doc, inspectDeck(doc), '/nonexistent').map((i) => i.code);
      expect(codes.filter((c) => /^(table|tex)-/.test(c))).toEqual([]);
    }
  });
});

describe('formulas are edited through their source', () => {
  it('classifies formula parts, data-tex hosts and the text around them', () => {
    const d = parseSource(AR);
    const mi = first(d, (n) => n.tag === 'mi');
    const math = first(d, (n) => n.tag === 'math');
    const host = first(d, (n) => findAttr(n, 'data-tex') !== undefined);
    const li = d.nodes[host.parent!];
    const td = first(d, (n) => n.tag === 'td');
    expect(runtimeOwned(d, mi.id)).toBe('math');
    expect(runtimeOwned(d, math.id)).toBe('math');
    expect(runtimeOwned(d, host.id)).toBe('math');
    expect(runtimeOwned(d, li.id)).toBe('contains-math');
    expect(runtimeOwned(d, td.id)).toBeNull();
  });

  it('refuses to retype a formula token or a sentence that holds a formula, and leaves the file as it was', () => {
    const d = EditorDocument.fromText(AR);
    const mi = first(d.doc, (n) => n.tag === 'mi').id;
    const li = d.doc.nodes[first(d.doc, (n) => findAttr(n, 'data-tex') !== undefined).parent!].id;
    expect(codeOf(() => d.apply([{ kind: 'setText', id: mi, text: 'x' }]))).toBe('unsupported');
    expect(codeOf(() => d.apply([{ kind: 'setText', id: li, text: 'جملة بلا معادلة' }]))).toBe('unsupported');
    expect(codeOf(() => d.apply([{ kind: 'insertHtml', parent: mi, index: 0, html: '<b>x</b>' }]))).toBe('unsupported');
    expect(d.text).toBe(AR);
  });

  it('a MathML edit changes one token in one line; the root tag stays as written', () => {
    const d = EditorDocument.fromText(AR);
    const math = first(d.doc, (n) => n.tag === 'math');
    const src = d.text.slice(math.startTagEnd, math.endTagStart!);
    const next = src.replace('<mi data-term="g">g</mi>', '<mi data-term="g">a</mi>');
    d.apply([{ kind: 'setText', id: math.id, text: next }]);
    const lines = changedLines(AR, d.text);
    expect(lines.length).toBe(1);
    expect(d.text.split('\n')[lines[0]]).toContain('<math display="block"><mi data-term="v">v</mi><mo>=</mo><mi data-term="g">a</mi>');
  });

  it('refuses MathML that is unbalanced, scripted or nests another <math>', () => {
    const d = EditorDocument.fromText(AR);
    const math = first(d.doc, (n) => n.tag === 'math').id;
    for (const bad of ['<mi>x', '<mi>x</mo>', '<mi onclick="x()">x</mi>', '<script>x</script>', '<math><mi>x</mi></math>', '<mi>a < b</mi>']) {
      expect(codeOf(() => d.apply([{ kind: 'setText', id: math, text: bad }])), bad).toBe('invalid');
    }
    expect(d.text).toBe(AR);
  });

  it('a TeX edit is one attribute in one line', () => {
    const d = EditorDocument.fromText(EN);
    const host = first(d.doc, (n) => findAttr(n, 'data-tex') !== undefined && findAttr(n, 'data-display')?.value === 'block');
    const tex = findAttr(host, 'data-tex')!.value;
    d.apply([{ kind: 'setAttr', id: host.id, name: 'data-tex', value: tex.replace('(1-\\alpha)', '(1-\\beta)') }]);
    const lines = changedLines(EN, d.text);
    expect(lines.length).toBe(1);
    expect(d.text.split('\n')[lines[0]]).toContain('(1-\\beta)');
  });
});

describe('tables are ordinary source', () => {
  it('a cell edit changes one line', () => {
    const d = EditorDocument.fromText(AR);
    const cell = d.doc.nodes.filter((n) => n.tag === 'td').find((n) => d.text.slice(n.startTagEnd, n.endTagStart!) === '4.80')!;
    d.apply([{ kind: 'setText', id: cell.id, text: '4.75' }]);
    const lines = changedLines(AR, d.text);
    expect(lines.length).toBe(1);
    expect(d.text.split('\n')[lines[0]]).toContain('<td>4.75</td>');
  });

  it('duplicating a row adds a row with no step attributes (the runtime numbers row steps itself)', () => {
    const d = EditorDocument.fromText(AR);
    const tr = d.doc.nodes.filter((n) => n.tag === 'tr')[3];
    d.apply([{ kind: 'duplicate', id: tr.id }]);
    const info = inspectDeck(d.doc);
    expect(info.tables[0].rows).toBe(9);
    const rows = d.doc.nodes.filter((n) => n.tag === 'tr');
    expect(rows.some((r) => findAttr(r, 'data-step') !== undefined)).toBe(false);
  });

  it('lint warns about rows with different numbers of cells, and about TeX without its converter', () => {
    const src = `<main class="deck-stage"><section class="slide"><figure class="nm-table"><table>
<thead><tr><th>a</th><th>b</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table></figure>
<p>x <span class="nm-math" data-tex="$x^2$"></span></p></section></main>`;
    const doc = parseSource(src);
    const codes = lintDeck(doc, inspectDeck(doc), '/nonexistent').map((i) => i.code);
    expect(codes).toContain('table-ragged');
    expect(codes).toContain('tex-without-converter');
    expect(codes).toContain('tex-delimiters');
  });
});
