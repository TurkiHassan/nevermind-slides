import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { applySplices, invertSplices, type Splice } from '../../src/engine/splice.ts';
import { textUnits, normaliseVisible, escapeText, escapeAttr } from '../../src/engine/html-text.ts';

describe('applySplices', () => {
  it('applies in offset order regardless of input order', () => {
    expect(applySplices('abcdef', [{ start: 4, end: 5, text: 'E' }, { start: 0, end: 1, text: 'A' }])).toBe('AbcdEf');
  });
  it('allows several inserts at one offset, in input order', () => {
    expect(applySplices('ab', [{ start: 1, end: 1, text: 'X' }, { start: 1, end: 1, text: 'Y' }])).toBe('aXYb');
  });
  it('insert before a replacement at the same offset', () => {
    expect(applySplices('abc', [{ start: 1, end: 2, text: 'B' }, { start: 1, end: 1, text: '>' }])).toBe('a>Bc');
  });
  it('throws on overlap and out of range', () => {
    expect(() => applySplices('abcdef', [{ start: 0, end: 3, text: '' }, { start: 2, end: 4, text: '' }])).toThrow(/overlapping/);
    expect(() => applySplices('abc', [{ start: 2, end: 9, text: '' }])).toThrow(/invalid/);
    expect(() => applySplices('abc', [{ start: 2, end: 1, text: '' }])).toThrow(/invalid/);
  });
});

/** Random non-overlapping splice sets over a text. */
const spliceCase = fc
  .string({ unit: fc.constantFrom('a', 'b', ' ', '\n', 'ع', '\u{1D54F}', '&', '<'), maxLength: 60 })
  .chain((text) =>
    fc
      .array(
        fc.record({ a: fc.nat({ max: text.length }), b: fc.nat({ max: text.length }), t: fc.string({ maxLength: 6 }) }),
        { maxLength: 8 },
      )
      .map((raw) => {
        const cuts = raw.map((r) => ({ start: Math.min(r.a, r.b), end: Math.max(r.a, r.b), text: r.t })).sort((x, y) => x.start - y.start);
        const out: Splice[] = [];
        let pos = 0;
        for (const c of cuts) {
          if (c.start < pos) continue;
          out.push(c);
          pos = c.end;
        }
        // shuffle deterministically so input order is not sorted
        return { text, splices: out.reverse() };
      }),
  );

describe('invertSplices', () => {
  it('round trip on 200 random splice sets', () => {
    fc.assert(
      fc.property(spliceCase, ({ text, splices }) => {
        const after = applySplices(text, splices);
        const inverse = invertSplices(text, splices);
        expect(applySplices(after, inverse)).toBe(text);
        // and the inverse of the inverse re-does the edit
        expect(applySplices(text, invertSplices(after, inverse))).toBe(after);
      }),
      { numRuns: 200 },
    );
  });
});

describe('html-text', () => {
  it('textUnits keeps references and CRLF atomic', () => {
    const raw = 'أ &amp; ب&nbsp;ج&#x200F;د\r\nx';
    const units = textUnits(raw, 10, 'أ & ب ج‏د\nx');
    expect(units.find((u) => u.decoded === '&')).toEqual({ rawStart: 12, rawEnd: 17, decoded: '&' });
    expect(units.find((u) => u.decoded === '‏')!.rawEnd - units.find((u) => u.decoded === '‏')!.rawStart).toBe(8);
    expect(units.find((u) => u.decoded === '\n')!.rawEnd - units.find((u) => u.decoded === '\n')!.rawStart).toBe(2);
    expect(units.map((u) => u.decoded).join('')).toBe('أ & ب ج‏د\nx');
  });
  it('textUnits falls back to one unit when its model disagrees with the parser', () => {
    expect(textUnits('a&b', 0, 'something else')).toEqual([{ rawStart: 0, rawEnd: 3, decoded: 'something else' }]);
  });
  it('normaliseVisible', () => {
    expect(normaliseVisible('  a \t b  \n  c  ')).toBe('a b\nc ');
    expect(normaliseVisible('\n\nx')).toBe('\n\nx');
  });
  it('escape', () => {
    expect(escapeText('a<b>&c')).toBe('a&lt;b&gt;&amp;c');
    expect(escapeAttr('a "b" & c &x', '"')).toBe('a &quot;b&quot; & c &amp;x');
  });
});
