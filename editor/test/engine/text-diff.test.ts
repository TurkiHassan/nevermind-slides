import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { parseSource, type SourceDoc } from '../../src/engine/source.ts';
import { applySplices } from '../../src/engine/splice.ts';
import { setText, visibleText } from '../../src/engine/text-diff.ts';
import { normaliseVisible } from '../../src/engine/html-text.ts';
import { OpError } from '../../src/engine/errors.ts';
import { ATTENTION, EDGE, MECHANISTIC, MINIMAL, loadFixture } from '../helpers.ts';

const minimal = loadFixture(MINIMAL)!;
const edge = loadFixture(EDGE)!;
const attention = loadFixture(ATTENTION);
const mechanistic = loadFixture(MECHANISTIC);

const byAttr = (doc: SourceDoc, q: string) => doc.query({ attr: q })[0];
function edit(text: string, q: string, next: string): string {
  const doc = parseSource(text);
  return applySplices(text, setText(doc, byAttr(doc, q).id, next));
}
function vis(text: string, q: string): string {
  const doc = parseSource(text);
  return visibleText(doc, byAttr(doc, q).id);
}

describe('visibleText', () => {
  it('collapses source whitespace and keeps inline runs', () => {
    expect(vis(minimal, 'id=lede')).toBe('حقق النموذج 28.4 نقطة في اختبار الترجمة.');
    expect(vis(minimal, 'data-morph=hero-title')).toBe('الانتباه هو كل ما تحتاجه');
  });
  it('decodes references', () => {
    expect(vis(edge, 'id=entities')).toBe('أ & ب ج‏د');
  });
  it('<br> is a line break and spaces around it are dropped', () => {
    expect(vis('<p id="x">  a  <br>\n  b <br><br>c </p>', 'id=x')).toBe('a\nb\n\nc');
  });
  it('excludes script and style content', () => {
    expect(vis('<div id="x">a<script>var b = 1;</script> c<style>.d{}</style></div>', 'id=x')).toBe('a c');
  });
});

describe('setText', () => {
  it('unchanged text returns []', () => {
    const doc = parseSource(minimal);
    expect(setText(doc, byAttr(doc, 'id=lede').id, 'حقق النموذج 28.4 نقطة في اختبار الترجمة.')).toEqual([]);
    expect(setText(doc, byAttr(doc, 'id=lede').id, '  حقق   النموذج 28.4 نقطة في اختبار الترجمة.  ')).toEqual([]);
  });

  it('edits before, inside and after an inline span keep the span', () => {
    const src = '<p id="lede">حقق النموذج <span dir="ltr">28.4</span> نقطة</p>';
    expect(edit(src, 'id=lede', 'حقق النموذج الجديد 28.4 نقطة')).toBe('<p id="lede">حقق النموذج الجديد <span dir="ltr">28.4</span> نقطة</p>');
    expect(edit(src, 'id=lede', 'حقق النموذج 28.45 نقطة')).toBe('<p id="lede">حقق النموذج <span dir="ltr">28.45</span> نقطة</p>');
    expect(edit(src, 'id=lede', 'حقق النموذج 28.4 نقطة كاملة')).toBe('<p id="lede">حقق النموذج <span dir="ltr">28.4</span> نقطة كاملة</p>');
    expect(edit(src, 'id=lede', 'حقق النموذج 30.1 نقطة')).toBe('<p id="lede">حقق النموذج <span dir="ltr">30.1</span> نقطة</p>');
  });

  it('replacing 28.4 with 30.1 in the minimal deck keeps <span dir="ltr">', () => {
    const out = edit(minimal, 'id=lede', 'حقق النموذج 30.1 نقطة في اختبار الترجمة.');
    expect(out).toBe(minimal.replace('<span dir="ltr">28.4</span>', '<span dir="ltr">30.1</span>'));
  });

  it('deleting all text of an inline span removes the span', () => {
    const src = '<p id="lede">حقق النموذج <span dir="ltr">28.4</span> نقطة</p>';
    expect(edit(src, 'id=lede', 'حقق النموذج نقطة')).toBe('<p id="lede">حقق النموذج نقطة</p>');
    expect(vis(edit(src, 'id=lede', 'حقق النموذج نقطة'), 'id=lede')).toBe('حقق النموذج نقطة');
  });

  it('replacing a <br> that hides a trailing space puts the new text in the same splice (no overlap)', () => {
    // Minimised from the phase-gate counterexample (seed -1755623619, 13 ops, minimal deck). The space before the
    // <br> is invisible and is deleted with it, so the deletion starts one byte before the <br> itself.
    const src = '<p id="lede">حقق النموذج <br><span dir="ltr">28.4</span> نقطة</p>';
    const doc = parseSource(src);
    const splices = setText(doc, byAttr(doc, 'id=lede').id, 'حقق النموذجةة8.4 نقطة');
    const at = src.indexOf(' <br>');
    expect(splices).toEqual([
      { start: at, end: at + ' <br>'.length, text: 'ةة' },
      { start: src.indexOf('28.4'), end: src.indexOf('28.4') + 1, text: '' },
    ]);
    const out = applySplices(src, splices);
    expect(out).toBe('<p id="lede">حقق النموذجةة<span dir="ltr">8.4</span> نقطة</p>');
    expect(vis(out, 'id=lede')).toBe('حقق النموذجةة8.4 نقطة');
  });

  it('an element with non-text content is kept even when its text is deleted', () => {
    const src = '<p id="x">a <span>b<img src="i.png"></span> c</p>';
    const out = edit(src, 'id=x', 'a c');
    expect(out).toContain('<img src="i.png">');
    expect(vis(out, 'id=x')).toBe('a c');
  });

  it('Review Focus 1: references next to an edit are not corrupted', () => {
    const p = (inner: string) => `<p id="e">${inner}</p>`;
    const src = p('أ &amp; ب&nbsp;ج&#x200F;د');
    expect(edit(src, 'id=e', 'أ &X ب ج‏د')).toBe(p('أ &amp;X ب&nbsp;ج&#x200F;د'));
    expect(edit(src, 'id=e', 'أ & ت ج‏د')).toBe(p('أ &amp; ت&nbsp;ج&#x200F;د'));
    expect(edit(src, 'id=e', 'أ & ب ‏د')).toBe(p('أ &amp; ب&nbsp;&#x200F;د'));
    expect(edit(src, 'id=e', 'أ & ب جX‏د')).toBe(p('أ &amp; ب&nbsp;جX&#x200F;د'));
    expect(edit(src, 'id=e', 'أ & ب ج‏د')).toBe(p('أ &amp; ب ج&#x200F;د')); // replace the nbsp itself
    expect(edit(src, 'id=e', 'أ & ب ج‏د <&>')).toBe(p('أ &amp; ب&nbsp;ج&#x200F;د &lt;&amp;&gt;'));
    // on the edge-cases fixture, through the parser
    const out = edit(edge, 'id=entities', 'أ & ب ججج‏د');
    expect(out).toBe(edge.replace('ج&#x200F;', 'ججج&#x200F;'));
    expect(vis(out, 'id=entities')).toBe('أ & ب ججج‏د');
  });

  it('astral characters are never split', () => {
    const src = '<p id="x">a\u{1D54F}b &#x1D54F;c</p>';
    const out = edit(src, 'id=x', 'a\u{1D550}b \u{1D550}c');
    expect(vis(out, 'id=x')).toBe('a\u{1D550}b \u{1D550}c');
    expect(out).toBe('<p id="x">a\u{1D550}b \u{1D550}c</p>');
  });

  it('\\n round trip through <br>', () => {
    const src = '<div>\n  <p id="x">\n    سطر أول\n  </p>\n</div>';
    const out = edit(src, 'id=x', 'سطر أول\nسطر ثان');
    expect(out).toBe('<div>\n  <p id="x">\n    سطر أول<br>سطر ثان\n  </p>\n</div>');
    expect(vis(out, 'id=x')).toBe('سطر أول\nسطر ثان');
    expect(edit(out, 'id=x', 'سطر أول')).toBe(src);
  });

  it('throws for raw-text elements, void elements and unpatchable nodes', () => {
    const doc = parseSource(edge);
    const code = (f: () => unknown) => {
      try { f(); } catch (e) { return (e as OpError).code; }
      return null;
    };
    expect(code(() => setText(doc, doc.query({ tag: 'title' })[0].id, 'x'))).toBe('unsupported');
    expect(code(() => setText(doc, doc.query({ tag: 'img' })[0].id, 'x'))).toBe('invalid');
    expect(code(() => setText(doc, byAttr(doc, 'id=unclosed').id, 'x'))).toBe('unpatchable');
    expect(code(() => setText(doc, doc.query({ tag: 'tbody' })[0].id, 'x'))).toBe('unpatchable');
  });

  (attention === null ? it.skip : it)('appending Arabic to the attention lede changes only its line and keeps the indentation', () => {
    const text = attention as string;
    const doc = parseSource(text);
    const lede = byAttr(doc, 'data-edit=s1-lede');
    const before = visibleText(doc, lede.id);
    const out = applySplices(text, setText(doc, lede.id, before + ' وهذه جملة مضافة.'));
    const a = text.split('\n');
    const b = out.split('\n');
    expect(b.length).toBe(a.length);
    const changed = a.map((l, i) => (l === b[i] ? -1 : i)).filter((i) => i >= 0);
    expect(changed).toHaveLength(1);
    expect(b[changed[0]]).toBe(a[changed[0]] + ' وهذه جملة مضافة.');
    expect(b[changed[0]].startsWith('          تشريح')).toBe(true);
  });
});

// Property: random edits on 50 leaf blocks of the real decks.
const INLINE = new Set(['span', 'b', 'i', 'em', 'strong', 'br', 'a', 'sub', 'sup', 'small', 'code', 'mark', 'bdi', 'bdo', 'u', 's']);
export function leafBlocks(text: string): { text: string; id: number }[] {
  const doc = parseSource(text);
  const out: { text: string; id: number }[] = [];
  for (const n of doc.nodes) {
    if (!n.patchable || n.endTagStart === null || n.ns !== 'html') continue;
    if (!['p', 'h1', 'h2', 'h3', 'h4', 'li', 'div', 'span', 'td', 'figcaption', 'blockquote'].includes(n.tag)) continue;
    const desc: number[] = [...n.children];
    let ok = true;
    while (desc.length) {
      const c = doc.nodes[desc.pop() as number];
      if (!INLINE.has(c.tag)) { ok = false; break; }
      desc.push(...c.children);
    }
    if (!ok) continue;
    try {
      if (visibleText(doc, n.id).length > 0) out.push({ text, id: n.id });
    } catch { /* not editable */ }
  }
  return out;
}

const realTexts = [attention, mechanistic].filter((t): t is string => t !== null);
(realTexts.length === 0 ? describe.skip : describe)('setText property', () => {
  const pool = realTexts.flatMap((t) => leafBlocks(t));
  const step = pool.length / 50;
  const blocks = Array.from({ length: Math.min(50, pool.length) }, (_, i) => pool[Math.floor(i * step)]);

  it('found 50 leaf blocks', () => {
    expect(blocks.length).toBe(50);
  });

  it('visibleText(parse(apply(setText(x)))) === normalise(x) for random edits', () => {
    const alphabet = fc.constantFrom('ا', 'ب', 'ة', 'لا', ' ', '  ', '\n', 'a', 'Z', '7', '٧', '&', '<', '>', ' ', '‏', '.', '\u{1D54F}');
    fc.assert(
      fc.property(
        fc.nat({ max: blocks.length - 1 }), fc.nat(), fc.nat(), fc.array(alphabet, { maxLength: 8 }).map((x) => x.join('')),
        (bi, x, y, ins) => {
          const { text, id } = blocks[bi];
          const doc = parseSource(text);
          const before = visibleText(doc, id);
          const i = x % (before.length + 1);
          const j = i + (y % (before.length - i + 1));
          const next = before.slice(0, i) + ins + before.slice(j);
          const splices = setText(doc, id, next);
          const n = doc.byId(id);
          for (const s of splices) {
            expect(s.start).toBeGreaterThanOrEqual(n.startTagEnd);
            expect(s.end).toBeLessThanOrEqual(n.endTagStart as number);
          }
          const out = applySplices(text, splices);
          const doc2 = parseSource(out);
          expect(doc2.nodes.length).toBeLessThanOrEqual(doc.nodes.length + (next.match(/\n/g)?.length ?? 0));
          const n2 = doc2.nodes.find((m) => m.start === n.start)!;
          expect(visibleText(doc2, n2.id)).toBe(normaliseVisible(next));
        },
      ),
      { numRuns: 400 },
    );
  });
});
