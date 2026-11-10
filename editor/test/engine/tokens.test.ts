import { describe, expect, it } from 'vitest';
import { readTokens, setTokenSplices } from '../../src/engine/tokens.ts';
import { parseSource } from '../../src/engine/source.ts';
import { applySplices } from '../../src/engine/splice.ts';
import { ATTENTION, MECHANISTIC, MINIMAL, loadFixture } from '../helpers.ts';

const attention = loadFixture(ATTENTION);
const mechanistic = loadFixture(MECHANISTIC);

describe('readTokens', () => {
  (attention === null ? it.skip : it)('attention: colours and families, config range covers the object literal', () => {
    const doc = parseSource(attention!);
    const t = readTokens(doc);
    expect([...t.ctx.colors].sort()).toEqual(['blue', 'bone', 'cream', 'ink', 'line', 'muted', 'navy', 'verm']);
    expect([...t.ctx.fontFamilies].sort()).toEqual(['body', 'display', 'kom', 'mono']);
    expect(t.ctx.fontSizes.size).toBe(0);
    const r = t.configRange!;
    expect(attention!.slice(r.start, r.start + 1)).toBe('{');
    expect(attention!.slice(r.end - 1, r.end)).toBe('}');
    expect(attention!.slice(r.start - 'tailwind.config = '.length, r.start)).toBe('tailwind.config = ');
  });
  (mechanistic === null ? it.skip : it)('mechanistic: nested colours flatten with dashes', () => {
    const t = readTokens(parseSource(mechanistic!));
    for (const c of ['outer', 'tab-mint', 'lp-bg', 'lp-fg', 'lp-accent', 'accent']) expect(t.ctx.colors.has(c), c).toBe(true);
    expect(t.ctx.fontFamilies.has('komission')).toBe(true);
  });
  it('a deck without a config yields an empty context', () => {
    const t = readTokens(parseSource(loadFixture(MINIMAL)!));
    expect(t.configRange).toBeNull();
    expect(t.ctx.colors.size).toBe(0);
  });
  it('DEFAULT names the parent; quoted keys; theme and extend both count', () => {
    const src = `<script>tailwind.config = { theme: { colors: { brand: { DEFAULT: '#111', 'soft-2': "#222" } }, extend: { fontSize: { hero: ['10px', '1'] } } } }</script>`;
    const t = readTokens(parseSource(src));
    expect([...t.ctx.colors].sort()).toEqual(['brand', 'brand-soft-2']);
    expect(t.ctx.fontSizes.has('hero')).toBe(true);
  });
  it('setTokenSplices on a one-line config keeps the quote style', () => {
    const src = `<script>tailwind.config = { theme: { extend: { colors: { a: "#000" } } } }</script>`;
    const doc = parseSource(src);
    expect(applySplices(src, setTokenSplices(doc, ['colors', 'a'], '#fff'))).toBe(src.replace('"#000"', '"#fff"'));
    expect(applySplices(src, setTokenSplices(doc, ['colors', 'b'], '#fff'))).toBe(src.replace('a: "#000"', 'a: "#000", b: "#fff"'));
    expect(applySplices(src, setTokenSplices(doc, ['colors', 'a'], null))).toBe(src.replace('a: "#000"', ''));
    expect(setTokenSplices(doc, ['colors', 'a'], '#000')).toEqual([]);
  });
});
