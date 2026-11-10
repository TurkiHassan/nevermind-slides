import { describe, expect, it } from 'vitest';
import { parse } from 'parse5';
import { parseSource, RAW_TEXT_TAGS, type SourceDoc, type SourceNode } from '../../src/engine/source.ts';
import { applySplices } from '../../src/engine/splice.ts';
import { ALL_FIXTURES, ATTENTION, loadFixture } from '../helpers.ts';

function ancestors(doc: SourceDoc, n: SourceNode): SourceNode[] {
  const out: SourceNode[] = [];
  for (let p = n.parent; p !== null; p = doc.byId(p).parent) out.push(doc.byId(p));
  return out;
}
const inSlide = (doc: SourceDoc, n: SourceNode) =>
  ancestors(doc, n).some((a) => a.tag === 'section' && /\bslide\b/.test(a.attrs['class']?.value ?? ''));

/** Independent check: parse5's own tree, text of every element in pre-order (template content included). */
function parse5Texts(text: string): { tag: string; text: string }[] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const out: { tag: string; text: string }[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kids = (n: any): any[] => [...(n.childNodes ?? []), ...(n.content?.childNodes ?? [])];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const textOf = (n: any): string => (n.nodeName === '#text' ? n.value : n.tagName || n.content ? kids(n).map(textOf).join('') : '');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const walk = (n: any) => {
    if (n.tagName) out.push({ tag: n.tagName.toLowerCase(), text: textOf(n) });
    for (const c of kids(n)) if (c.tagName) walk(c);
  };
  for (const c of parse(src).childNodes) walk(c);
  return out;
}

for (const f of ALL_FIXTURES) {
  const d = f.text === null ? describe.skip : describe;
  d(f.text === null ? `${f.name} (absent: run npm run fixtures)` : f.name, () => {
    const text = f.text as string;

    it('identity: no splices returns the same string', () => {
      expect(applySplices(text, [])).toBe(text);
    });

    it('slices are real: every patchable node starts with its own start tag', () => {
      const doc = parseSource(text);
      const bad = doc.nodes.filter((n) => n.patchable && text.slice(n.start, n.start + 1 + n.tag.length).toLowerCase() !== '<' + n.tag);
      expect(bad.map((n) => `${n.id}:${n.tag}@${n.start}`)).toEqual([]);
      for (const n of doc.nodes.filter((x) => x.patchable)) {
        expect(n.end).toBeGreaterThanOrEqual(n.startTagEnd);
        if (n.endTagStart !== null) expect(text.slice(n.endTagStart, n.endTagStart + 2)).toBe('</');
      }
    });

    it('attribute ranges and quotes are real', () => {
      const doc = parseSource(text);
      for (const n of doc.nodes.filter((x) => x.patchable)) {
        for (const [name, a] of Object.entries(n.attrs)) {
          const raw = text.slice(a.start, a.end);
          expect(raw.toLowerCase().startsWith(name.toLowerCase())).toBe(true);
          if (a.quote) expect(raw.endsWith(a.quote)).toBe(true);
        }
      }
    });

    it('bom flag and ns', () => {
      const doc = parseSource(text);
      expect(doc.bom).toBe(text.charCodeAt(0) === 0xfeff);
      const svg = doc.nodes.find((n) => n.tag === 'svg');
      if (svg) expect(svg.ns).toBe('svg');
      expect(doc.nodes.find((n) => n.tag === 'body')!.ns).toBe('html');
    });

    it('textSegments: decoded values equal parse5 text for every element', () => {
      const doc = parseSource(text);
      const expected = parse5Texts(text);
      expect(doc.nodes.length).toBe(expected.length);
      const mismatches: string[] = [];
      for (const n of doc.nodes) {
        const got = doc.textSegments(n.id).map((s) => s.decoded).join('');
        if (got !== expected[n.id].text || n.tag !== expected[n.id].tag) mismatches.push(`${n.id}:${n.tag}`);
      }
      expect(mismatches).toEqual([]);
    });

    it('textSegments: in-place raw ranges hold the text the segment decodes from', () => {
      const doc = parseSource(text);
      for (const s of doc.textSegments(0)) {
        if (!s.inPlace || RAW_TEXT_TAGS.has(doc.byId(s.nodeId).tag)) continue;
        const raw = text.slice(s.rawStart, s.rawEnd);
        expect(raw.includes('<')).toBe(false);
        if (!raw.includes('&') && !raw.includes('\r') && !raw.includes('\0')) expect(raw).toBe(s.decoded);
      }
    });

    if (f.name.startsWith('synthetic/edge-cases')) {
      it('unpatchable nodes are flagged', () => {
        const doc = parseSource(text);
        const tbody = doc.nodes.find((n) => n.tag === 'tbody');
        expect(tbody?.patchable).toBe(false);
        const byIdAttr = (v: string) => doc.nodes.find((n) => n.attrs['id']?.value === v);
        expect(byIdAttr('unclosed')?.patchable).toBe(false);
        expect(byIdAttr('after-body')?.patchable).toBe(false);
        expect(byIdAttr('after-unclosed')?.patchable).toBe(true);
        expect(byIdAttr('after-astral')?.patchable).toBe(true);
        expect(byIdAttr('attr-styles')!.attrs['class'].quote).toBe("'");
        expect(byIdAttr('attr-styles')!.attrs['data-bare'].quote).toBe('');
        expect(byIdAttr('attr-styles')!.attrs['id'].quote).toBe('"');
      });

      it('astral and CRLF: a content splice lands on the right node', () => {
        const doc = parseSource(text);
        const n = doc.query({ attr: 'id=after-astral' })[0];
        const out = applySplices(text, [{ start: n.startTagEnd, end: n.endTagStart!, text: 'نص جديد' }]);
        const doc2 = parseSource(out);
        const host = doc2.query({ attr: 'id=astral-host' })[0];
        const target = doc2.query({ attr: 'id=after-astral' })[0];
        expect(doc2.textSegments(target.id).map((s) => s.decoded).join('')).toBe('نص جديد');
        expect(doc2.textSegments(host.id).map((s) => s.decoded).join('')).toBe('حرف خارج المستوى الأساسي \u{1D54F} ثم \u{1D54F} قبل نص جديد');
      });

      it('query by tag, class and attribute', () => {
        const doc = parseSource(text);
        expect(doc.query({ tag: 'li' })).toHaveLength(2);
        expect(doc.query({ cls: 'target' }).map((n) => n.attrs['id'].value)).toEqual(['after-astral']);
        expect(doc.query({ tag: 'svg', attr: 'viewbox' })).toHaveLength(1);
      });
    }

    if (f.real) {
      it('zero unpatchable nodes inside section.slide', () => {
        const doc = parseSource(text);
        const bad = doc.nodes.filter((n) => !n.patchable && inSlide(doc, n));
        expect(bad.map((n) => `${n.id}:${n.tag}@${n.start}`)).toEqual([]);
      });
      it('every text segment inside a slide is in place', () => {
        const doc = parseSource(text);
        const slides = doc.nodes.filter((n) => n.tag === 'section' && /\bslide\b/.test(n.attrs['class']?.value ?? ''));
        expect(slides.length).toBeGreaterThan(0);
        for (const s of slides) expect(doc.textSegments(s.id).every((t) => t.inPlace)).toBe(true);
      });
    }
  });
}

const attention = loadFixture(ATTENTION);
(attention === null ? describe.skip : describe)('perf', () => {
  it('parseSource on the 548 KB deck: median of 5 runs < 800 ms', () => {
    const times: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      parseSource(attention as string);
      times.push(performance.now() - t0);
    }
    const median = [...times].sort((a, b) => a - b)[2];
    console.log(`[perf] parseSource attention: ${times.map((t) => t.toFixed(1)).join(', ')} ms, median ${median.toFixed(1)} ms`);
    expect(median).toBeLessThan(800);
  });
});
