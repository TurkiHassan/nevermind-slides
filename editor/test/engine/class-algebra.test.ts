import { describe, expect, it } from 'vitest';
import {
  detectAnchor, getUtility, GROUPS, moveClasses, parseToken, resizeClasses, setClassAttr, setUtility, unsupportedReason,
  EMPTY_CONTEXT, type Group, type TokenContext,
} from '../../src/engine/class-algebra.ts';
import { readTokens } from '../../src/engine/tokens.ts';
import { classList, parseSource } from '../../src/engine/source.ts';
import { applySplices } from '../../src/engine/splice.ts';
import { ATTENTION, MECHANISTIC, loadFixture } from '../helpers.ts';

const attention = loadFixture(ATTENTION);
const mechanistic = loadFixture(MECHANISTIC);
const haveReal = attention !== null && mechanistic !== null;
const split = (s: string) => s.split(/\s+/).filter(Boolean);
const attCtx: TokenContext = attention ? readTokens(parseSource(attention)).ctx : EMPTY_CONTEXT;

describe('parseToken', () => {
  it('variants, important and negative', () => {
    expect(parseToken('md:hover:top-[10px]', EMPTY_CONTEXT)).toMatchObject({ variants: ['md', 'hover'], important: false, group: 'top', value: '[10px]' });
    expect(parseToken('!top-[10px]', EMPTY_CONTEXT)).toMatchObject({ variants: [], important: true, group: 'top' });
    expect(parseToken('md:!top-[10px]', EMPTY_CONTEXT)).toMatchObject({ variants: ['md'], important: true, group: 'top' });
    expect(parseToken('-translate-x-[12px]', EMPTY_CONTEXT)).toMatchObject({ negative: true, utility: 'translate-x', value: '[12px]', group: 'translate-x' });
    expect(parseToken('[&_p]:text-[10px]', EMPTY_CONTEXT)).toMatchObject({ variants: ['[&_p]'], group: 'font-size' });
    expect(parseToken('bg-[url(x.png)]', EMPTY_CONTEXT).group).toBeNull();
    expect(parseToken('rounded-l-[14px]', EMPTY_CONTEXT).group).toBeNull();
    expect(parseToken('min-w-[10px]', EMPTY_CONTEXT).group).toBeNull();
    expect(parseToken('absolute', EMPTY_CONTEXT)).toMatchObject({ group: 'position', utility: 'absolute', value: null });
  });

  (attention === null ? it.skip : it)('text-* disambiguation with the attention deck tokens', () => {
    expect(parseToken('text-blue', attCtx).group).toBe('text-color');
    expect(parseToken('text-cream/70', attCtx).group).toBe('text-color');
    expect(parseToken('text-[31px]', attCtx).group).toBe('font-size');
    expect(parseToken('text-right', attCtx).group).toBe('text-align');
    expect(parseToken('text-xl', attCtx).group).toBe('font-size');
    expect(parseToken('text-[#ff0000]', attCtx).group).toBe('text-color');
    expect(parseToken('text-blue', EMPTY_CONTEXT).group).toBeNull(); // not a default colour without a shade
    expect(parseToken('text-blue-500', EMPTY_CONTEXT).group).toBe('text-color');
    expect(parseToken('font-display', attCtx).group).toBe('font-family');
    expect(parseToken('font-black', attCtx).group).toBe('font-weight');
  });
});

// Every group must parse from at least two distinct real-deck tokens. The real decks contain fewer than two
// tokens for five groups (listed below), so those cases are expected to fail and are covered synthetically.
const SCARCE: Group[] = ['rotate', 'translate-x', 'translate-y', 'pr', 'mr'];
const realTokens = (): Map<Group, Set<string>> => {
  const out = new Map<Group, Set<string>>();
  for (const text of [attention, mechanistic]) {
    if (!text) continue;
    const doc = parseSource(text);
    const ctx = readTokens(doc).ctx;
    for (const n of doc.nodes) {
      for (const c of classList(n)) {
        const t = parseToken(c, ctx);
        if (t.group) (out.get(t.group) ?? out.set(t.group, new Set()).get(t.group)!).add(c);
      }
    }
  }
  return out;
};
describe('each group parses from real-deck tokens', () => {
  const found = haveReal ? realTokens() : new Map<Group, Set<string>>();
  for (const g of GROUPS) {
    const run = !haveReal ? it.skip : SCARCE.includes(g) ? it.fails : it;
    run(`${g}: at least two distinct tokens`, () => {
      expect(found.get(g)?.size ?? 0).toBeGreaterThanOrEqual(2);
    });
  }
  (haveReal ? it : it.skip)('the scarce groups still have one real token each', () => {
    for (const g of SCARCE) expect(found.get(g)?.size ?? 0).toBeGreaterThanOrEqual(1);
  });
  it('the scarce groups parse from synthetic tokens', () => {
    const cases: [string, Group][] = [['rotate-[12deg]', 'rotate'], ['-rotate-90', 'rotate'], ['translate-x-[4px]', 'translate-x'],
      ['-translate-x-1/2', 'translate-x'], ['translate-y-[4px]', 'translate-y'], ['-translate-y-1/2', 'translate-y'],
      ['pr-[26px]', 'pr'], ['pr-4', 'pr'], ['mr-0', 'mr'], ['mr-[8px]', 'mr']];
    for (const [tok, g] of cases) expect(parseToken(tok, EMPTY_CONTEXT).group, tok).toBe(g);
  });
});

describe('getUtility / setUtility', () => {
  it('replaces in place, appends when absent, removes for null', () => {
    const c = split('absolute right-[104px] top-[132px] w-[900px]');
    expect(setUtility(c, 'top', '148', EMPTY_CONTEXT)).toEqual(split('absolute right-[104px] top-[148px] w-[900px]'));
    expect(setUtility(c, 'top', '147.6px', EMPTY_CONTEXT)).toEqual(split('absolute right-[104px] top-[148px] w-[900px]'));
    expect(setUtility(c, 'height', '300', EMPTY_CONTEXT)).toEqual([...c, 'h-[300px]']);
    expect(setUtility(c, 'top', null, EMPTY_CONTEXT)).toEqual(split('absolute right-[104px] w-[900px]'));
    expect(getUtility(c, 'width', EMPTY_CONTEXT)?.raw).toBe('w-[900px]');
    expect(getUtility(c, 'height', EMPTY_CONTEXT)).toBeNull();
  });

  it('Review Focus 3: variant and important tokens are left alone, the base one is written', () => {
    const c = split('absolute md:top-[10px] top-[20px] !top-[30px] hover:!top-[5px]');
    expect(getUtility(c, 'top', EMPTY_CONTEXT)?.raw).toBe('top-[20px]');
    expect(setUtility(c, 'top', '148', EMPTY_CONTEXT)).toEqual(split('absolute md:top-[10px] top-[148px] !top-[30px] hover:!top-[5px]'));
    const onlyVariants = split('absolute md:top-[10px] !top-[10px]');
    expect(getUtility(onlyVariants, 'top', EMPTY_CONTEXT)).toBeNull();
    expect(setUtility(onlyVariants, 'top', '148', EMPTY_CONTEXT)).toEqual([...onlyVariants, 'top-[148px]']);
    expect(setUtility(onlyVariants, 'top', null, EMPTY_CONTEXT)).toEqual(onlyVariants);
  });

  it('negative values', () => {
    const c = split('p-[28px] -translate-x-[12px] bg-cream');
    expect(getUtility(c, 'translate-x', EMPTY_CONTEXT)).toMatchObject({ negative: true, value: '[12px]' });
    expect(setUtility(c, 'translate-x', '-20', EMPTY_CONTEXT)).toEqual(split('p-[28px] translate-x-[-20px] bg-cream'));
    expect(setUtility(split('absolute right-[10px]'), 'right', '-20', EMPTY_CONTEXT)).toEqual(split('absolute right-[-20px]'));
  });

  it('removes base duplicates of the same group', () => {
    expect(setUtility(split('text-[20px] a text-[24px]'), 'font-size', '30', EMPTY_CONTEXT)).toEqual(split('text-[30px] a'));
  });

  (attention === null ? it.skip : it)('colours: token name when known, else [#rrggbb]', () => {
    const c = split('font-body text-[29px] text-muted');
    expect(setUtility(c, 'text-color', 'verm', attCtx)).toEqual(split('font-body text-[29px] text-verm'));
    expect(setUtility(c, 'text-color', '#F0A', attCtx)).toEqual(split('font-body text-[29px] text-[#ff00aa]'));
    expect(setUtility(c, 'font-size', '31', attCtx)).toEqual(split('font-body text-[31px] text-muted'));
    expect(setUtility(c, 'bg-color', 'cream', attCtx)).toEqual([...c, 'bg-cream']);
    expect(() => setUtility(c, 'text-color', 'not-a-colour', attCtx)).toThrow(/unknown colour/);
  });

  it('other groups format sensibly', () => {
    const f = (g: Group, v: string) => setUtility([], g, v, EMPTY_CONTEXT)[0];
    expect(f('font-weight', '700')).toBe('font-bold');
    expect(f('font-weight', 'black')).toBe('font-black');
    expect(f('leading', '1.75')).toBe('leading-[1.75]');
    expect(f('tracking', '0.08em')).toBe('tracking-[0.08em]');
    expect(f('opacity', '0.7')).toBe('opacity-[0.7]');
    expect(f('opacity', '70')).toBe('opacity-70');
    expect(f('z', '999')).toBe('z-[999]');
    expect(f('rotate', '-12.5')).toBe('rotate-[-12.5deg]');
    expect(f('position', 'absolute')).toBe('absolute');
    expect(f('text-align', 'right')).toBe('text-right');
    expect(f('width', 'full')).toBe('w-full');
    expect(f('width', '50%')).toBe('w-[50%]');
    expect(f('font-family', 'Thmanyah Sans')).toBe("font-['Thmanyah_Sans']");
    expect(f('rounded', '8')).toBe('rounded-[8px]');
    expect(() => f('position', 'floating')).toThrow(/position must be/);
  });
});

describe('setClassAttr', () => {
  const html = `<div id="a" class="absolute  right-[104px] top-[132px]\n  w-[900px]">x</div><p id="b" class='x y'>t</p><i id="c" class=solo>t</i><b id="d">t</b>`;
  const doc = parseSource(html);
  const id = (v: string) => doc.query({ attr: `id=${v}` })[0].id;
  const run = (v: string, classes: string[]) => applySplices(html, setClassAttr(doc, id(v), classes));

  it('unchanged list returns []', () => {
    expect(setClassAttr(doc, id('a'), split('absolute right-[104px] top-[132px] w-[900px]'))).toEqual([]);
  });
  it('replacing a token keeps the original spacing', () => {
    expect(run('a', split('absolute right-[104px] top-[148px] w-[900px]'))).toBe(html.replace('top-[132px]', 'top-[148px]'));
  });
  it('appending and removing', () => {
    expect(run('a', split('absolute right-[104px] top-[132px] w-[900px] h-[10px]'))).toBe(html.replace('w-[900px]', 'w-[900px] h-[10px]'));
    expect(run('a', split('absolute top-[132px] w-[900px]'))).toBe(html.replace('  right-[104px]', ''));
    expect(run('a', split('right-[104px] top-[132px] w-[900px]'))).toBe(html.replace('absolute  ', ''));
    expect(run('b', [])).toBe(html.replace(" class='x y'", ''));
  });
  it('quote styles: single, unquoted, absent', () => {
    expect(run('b', ['x', 'z'])).toBe(html.replace("class='x y'", "class='x z'"));
    expect(run('c', ['solo', 'two'])).toBe(html.replace('class=solo', 'class="solo two"'));
    expect(run('c', ['other'])).toBe(html.replace('class=solo', 'class=other'));
    expect(run('d', ['k'])).toBe(html.replace('<b id="d">', '<b id="d" class="k">'));
  });

  (attention === null ? it.skip : it)('top-[132px] to 148 on the attention deck changes only those three characters', () => {
    const real = attention as string;
    const rdoc = parseSource(real);
    const n = rdoc.nodes.find((x) => x.patchable && classList(x).includes('top-[132px]'))!;
    const next = setUtility(classList(n), 'top', '148', attCtx);
    const splices = setClassAttr(rdoc, n.id, next);
    expect(splices).toHaveLength(1);
    const out = applySplices(real, splices);
    const at = real.indexOf('top-[132px]', n.start) + 'top-['.length;
    expect(out).toBe(real.slice(0, at) + '148' + real.slice(at + 3));
  });
});

// Ported from spikes/s4-transform/writeback.test.ts.
const abs = { position: 'absolute' };
const flow = { position: 'static' };

describe('detectAnchor', () => {
  it('right/top anchored absolute', () => {
    expect(detectAnchor(split('absolute right-[104px] top-[132px] w-[900px]'), abs)).toEqual({ x: 'right', y: 'top' });
  });
  it('left/bottom anchored absolute', () => {
    expect(detectAnchor(split('absolute left-[80px] bottom-[40px]'), abs)).toEqual({ x: 'left', y: 'bottom' });
  });
  it('flow child has no anchor', () => {
    expect(detectAnchor(split('p-[28px] bg-cream right-[10px]'), flow)).toEqual({ x: 'none', y: 'none' });
  });
  it('ignores variant-prefixed classes', () => {
    expect(detectAnchor(split('absolute md:left-[10px] right-[20px]'), abs)).toEqual({ x: 'right', y: 'none' });
  });
});

describe('moveClasses', () => {
  it('right-anchored: dx rightwards reduces right', () => {
    const c = split('absolute right-[104px] top-[132px] w-[900px]');
    expect(moveClasses(c, detectAnchor(c, abs), 40, 16, false)).toEqual(split('absolute right-[64px] top-[148px] w-[900px]'));
  });
  it('left-anchored: dx rightwards increases left', () => {
    const c = split('absolute left-[80px] top-[640px] w-[480px]');
    expect(moveClasses(c, detectAnchor(c, abs), 40, -16, false)).toEqual(split('absolute left-[120px] top-[624px] w-[480px]'));
  });
  it('bottom-anchored: dy downwards reduces bottom', () => {
    const c = split('absolute left-[0px] bottom-[90px]');
    expect(moveClasses(c, detectAnchor(c, abs), 0, 10, false)).toEqual(split('absolute left-[0px] bottom-[80px]'));
  });
  it('values round to whole px', () => {
    const c = split('absolute right-[104px] top-[132px]');
    expect(moveClasses(c, detectAnchor(c, abs), 39.6, 16.4, false)).toEqual(split('absolute right-[64px] top-[148px]'));
  });
  it('crossing zero writes a negative arbitrary value', () => {
    const c = split('absolute right-[10px] top-[0px]');
    expect(moveClasses(c, detectAnchor(c, abs), 30, 0, false)).toEqual(split('absolute right-[-20px] top-[0px]'));
  });
  it('flow child without translate gets translate classes', () => {
    const c = split('p-[28px] bg-cream');
    expect(moveClasses(c, detectAnchor(c, flow), 30, 12, true)).toEqual(split('p-[28px] bg-cream translate-x-[30px] translate-y-[12px]'));
  });
  it('flow child with an existing arbitrary translate sums', () => {
    const c = split('p-[28px] translate-x-[10px] -translate-y-[4px] bg-cream');
    expect(moveClasses(c, detectAnchor(c, flow), 30, 12, true)).toEqual(split('p-[28px] translate-x-[40px] translate-y-[8px] bg-cream'));
  });
  it('flow child translate summing to zero is removed', () => {
    const c = split('p-[28px] translate-x-[10px]');
    expect(moveClasses(c, detectAnchor(c, flow), -10, 0, true)).toEqual(split('p-[28px]'));
  });
  it('non-arbitrary translate is unsupported and returns classes unchanged', () => {
    const c = split('p-[28px] -translate-x-1/2 bg-cream');
    const r = moveClasses(c, detectAnchor(c, flow), 30, 12, true);
    expect(r).toEqual(c);
    expect(unsupportedReason(r)).toMatch(/-translate-x-1\/2/);
  });
  it('non-px anchor value is unsupported', () => {
    const c = split('absolute left-1/2 top-[10px]');
    const r = moveClasses(c, detectAnchor(c, abs), 30, 0, false);
    expect(r).toEqual(c);
    expect(unsupportedReason(r)).toMatch(/left-1\/2/);
  });
  it('zero move changes nothing', () => {
    const c = split('absolute right-[104px] top-[132px]');
    const r = moveClasses(c, detectAnchor(c, abs), 0.2, -0.3, false);
    expect(r).toEqual(c);
    expect(unsupportedReason(r)).toBeUndefined();
  });
  it('important and variant tokens are never rewritten', () => {
    const c = split('absolute !right-[10px] md:right-[5px] right-[20px] top-[0px]');
    expect(moveClasses(c, detectAnchor(c, abs), 5, 0, false)).toEqual(split('absolute !right-[10px] md:right-[5px] right-[15px] top-[0px]'));
  });
});

describe('resizeClasses', () => {
  const box = split('absolute right-[104px] top-[132px] w-[900px]');
  const rect = { w: 900, h: 420 };
  it('e on a right-anchored box grows width and reduces right (left edge stays)', () => {
    expect(resizeClasses(box, detectAnchor(box, abs), 'e', 60, 0, rect)).toEqual(split('absolute right-[44px] top-[132px] w-[960px]'));
  });
  it('se with dy 0 is the same as e and writes no height', () => {
    expect(resizeClasses(box, detectAnchor(box, abs), 'se', 60, 0, rect)).toEqual(split('absolute right-[44px] top-[132px] w-[960px]'));
  });
  it('w on a right-anchored box grows width only', () => {
    expect(resizeClasses(box, detectAnchor(box, abs), 'w', -50, 0, rect)).toEqual(split('absolute right-[104px] top-[132px] w-[950px]'));
  });
  it('w on a left-anchored box moves left and changes width', () => {
    const c = split('absolute left-[80px] top-[640px] w-[480px] h-[300px]');
    expect(resizeClasses(c, detectAnchor(c, abs), 'w', -20, 0, { w: 480, h: 300 })).toEqual(split('absolute left-[60px] top-[640px] w-[500px] h-[300px]'));
  });
  it('s without a height class adds one from the rendered rect', () => {
    expect(resizeClasses(box, detectAnchor(box, abs), 's', 0, 30, rect)).toEqual(split('absolute right-[104px] top-[132px] w-[900px] h-[450px]'));
  });
  it('n on a top-anchored box moves top and changes height', () => {
    const c = split('absolute left-[80px] top-[640px] w-[480px] h-[300px]');
    expect(resizeClasses(c, detectAnchor(c, abs), 'n', 0, -40, { w: 480, h: 300 })).toEqual(split('absolute left-[80px] top-[600px] w-[480px] h-[340px]'));
  });
  it('nw on a right/bottom anchored box', () => {
    const c = split('absolute right-[10px] bottom-[20px] w-[100px] h-[100px]');
    expect(resizeClasses(c, detectAnchor(c, abs), 'nw', -10, -10, { w: 100, h: 100 })).toEqual(split('absolute right-[10px] bottom-[20px] w-[110px] h-[110px]'));
  });
  it('non-arbitrary width is unsupported', () => {
    const c = split('absolute right-[10px] top-[0px] w-full');
    const r = resizeClasses(c, detectAnchor(c, abs), 'e', 10, 0, { w: 100, h: 100 });
    expect(r).toEqual(c);
    expect(unsupportedReason(r)).toMatch(/w-full/);
  });
});
