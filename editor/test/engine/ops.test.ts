import { describe, expect, it } from 'vitest';
import { resolveOp, OpError, readTokens, type Op } from '../../src/engine/ops.ts';
import { EMPTY_CONTEXT, type TokenContext } from '../../src/engine/class-algebra.ts';
import { classList, parseSource, type SourceDoc, type SourceNode } from '../../src/engine/source.ts';
import { applySplices, invertSplices } from '../../src/engine/splice.ts';
import { setAttrSplices } from '../../src/engine/attrs.ts';
import { visibleText } from '../../src/engine/text-diff.ts';
import { ALL_FIXTURES, ATTENTION, EDGE, MINIMAL, loadFixture, sample } from '../helpers.ts';

const minimal = loadFixture(MINIMAL)!;
const edge = loadFixture(EDGE)!;
const attention = loadFixture(ATTENTION);
const realIt = attention === null ? it.skip : it;

/** Resolve, apply, check the inverse restores the original bytes, return the new text. */
function run(text: string, op: Op | ((doc: SourceDoc) => Op), ctx: TokenContext = EMPTY_CONTEXT): string {
  const doc = parseSource(text);
  const o = typeof op === 'function' ? op(doc) : op;
  const splices = resolveOp(doc, o, ctx);
  const out = applySplices(text, splices);
  expect(applySplices(out, invertSplices(text, splices))).toBe(text);
  return out;
}
const q = (doc: SourceDoc, attr: string): SourceNode => {
  const n = doc.query({ attr })[0];
  if (!n) throw new Error(`no node with ${attr}`);
  return n;
};
const tagIn = (doc: SourceDoc, tag: string, nth = 0) => doc.query({ tag })[nth];
const codeOf = (f: () => unknown) => {
  try { f(); } catch (e) { return e instanceof OpError ? e.code : `other: ${(e as Error).message}`; }
  return null;
};

const SVG = `<div id="wrap">
  <svg id="s" viewBox="0 0 10 10" class="absolute left-[4px]">
    <defs>
      <linearGradient id="lg"></linearGradient>
    </defs>
    <circle id="c" cx="5" cy="5" r="4" fill="url(#lg)"/>
    <rect id="r" x="1" y="1" width="2" height="2"/>
    <text id="t" x="1" y="9">نص <tspan dir="ltr">42</tspan></text>
  </svg>
</div>`;

describe('setText', () => {
  it('html element', () => {
    const out = run(minimal, (d) => ({ kind: 'setText', id: q(d, 'id=lede').id, text: 'نص جديد' }));
    expect(visibleText(parseSource(out), q(parseSource(out), 'id=lede').id)).toBe('نص جديد');
  });
  it('svg element keeps the tspan', () => {
    const out = run(SVG, (d) => ({ kind: 'setText', id: q(d, 'id=t').id, text: 'نص آخر 42' }));
    expect(out).toBe(SVG.replace('نص <tspan', 'نص آخر <tspan'));
  });
  realIt('element in a real deck', () => {
    const out = run(attention!, (d) => ({ kind: 'setText', id: q(d, 'data-edit=s2-title').id, text: 'طابور ينتهي' }));
    expect(out).toBe(attention!.replace('طابور لا ينتهي', 'طابور ينتهي'));
  });
});

describe('setAttr', () => {
  it('html element: change, add, remove', () => {
    expect(run(minimal, (d) => ({ kind: 'setAttr', id: q(d, 'id=lede').id, name: 'id', value: 'lede2' }))).toBe(minimal.replace('id="lede"', 'id="lede2"'));
    expect(run(minimal, (d) => ({ kind: 'setAttr', id: q(d, 'id=lede').id, name: 'data-x', value: 'a"b' }))).toBe(minimal.replace('id="lede">', 'id="lede" data-x="a&quot;b">'));
    expect(run(minimal, (d) => ({ kind: 'setAttr', id: q(d, 'id=lede').id, name: 'id', value: null }))).toBe(minimal.replace(' id="lede"', ''));
  });
  it('svg element: case-insensitive lookup keeps the source case, self-closing add', () => {
    expect(run(SVG, (d) => ({ kind: 'setAttr', id: q(d, 'id=s').id, name: 'viewBox', value: '0 0 20 20' }))).toBe(SVG.replace('viewBox="0 0 10 10"', 'viewBox="0 0 20 20"'));
    expect(run(SVG, (d) => ({ kind: 'setAttr', id: q(d, 'id=c').id, name: 'stroke', value: 'red' }))).toBe(SVG.replace('fill="url(#lg)"/>', 'fill="url(#lg)" stroke="red"/>'));
  });
  it('quote styles are kept', () => {
    expect(run(edge, (d) => ({ kind: 'setAttr', id: q(d, 'id=attr-styles').id, name: 'class', value: 'a b' }))).toBe(edge.replace("class='single-quoted'", "class='a b'"));
    expect(run(edge, (d) => ({ kind: 'setAttr', id: q(d, 'id=attr-styles').id, name: 'data-bare', value: 'two words' }))).toBe(edge.replace('data-bare=unquoted', 'data-bare="two words"'));
    expect(run(edge, (d) => ({ kind: 'setAttr', id: q(d, 'id=attr-styles').id, name: 'data-bare', value: 'one' }))).toBe(edge.replace('data-bare=unquoted', 'data-bare=one'));
  });
  realIt('element in a real deck', () => {
    const out = run(attention!, (d) => ({ kind: 'setAttr', id: q(d, 'data-edit=s1-lede').id, name: 'data-edit', value: 'lede' }));
    expect(out).toBe(attention!.replace('data-edit="s1-lede"', 'data-edit="lede"'));
  });
});

describe('setUtility and setClasses', () => {
  it('html element', () => {
    expect(run(minimal, (d) => ({ kind: 'setUtility', id: q(d, 'id=title-block').id, group: 'top', value: '148' }))).toBe(
      minimal.replace('right-[104px] top-[132px] w-[900px]" id="title-block"', 'right-[104px] top-[148px] w-[900px]" id="title-block"'));
    expect(run(minimal, (d) => ({ kind: 'setClasses', id: q(d, 'id=lede').id, classes: ['reveal', 'text-[30px]'] }))).toBe(
      minimal.replace('class="reveal d2 text-[30px] mt-[32px]" id="lede"', 'class="reveal text-[30px]" id="lede"'));
  });
  it('svg element', () => {
    expect(run(SVG, (d) => ({ kind: 'setUtility', id: q(d, 'id=s').id, group: 'left', value: '10' }))).toBe(SVG.replace('left-[4px]', 'left-[10px]'));
    expect(run(SVG, (d) => ({ kind: 'setClasses', id: q(d, 'id=c').id, classes: ['mg-spin'] }))).toBe(SVG.replace('fill="url(#lg)"/>', 'fill="url(#lg)" class="mg-spin"/>'));
  });
  realIt('element in a real deck, with its tokens', () => {
    const ctx = readTokens(parseSource(attention!)).ctx;
    const out = run(attention!, (d) => ({ kind: 'setUtility', id: q(d, 'data-edit=s1-lede').id, group: 'text-color', value: 'verm' }), ctx);
    expect(out).toBe(attention!.replace('leading-[1.75] text-muted w-[900px] mr-0 ml-auto mt-[34px]" data-edit="s1-lede"',
      'leading-[1.75] text-verm w-[900px] mr-0 ml-auto mt-[34px]" data-edit="s1-lede"'));
    const out2 = run(attention!, (d) => ({ kind: 'setClasses', id: q(d, 'data-edit=s1-lede').id, classes: [...classList(q(d, 'data-edit=s1-lede')), 'italic'] }));
    expect(out2).toBe(attention!.replace('mt-[34px]" data-edit="s1-lede"', 'mt-[34px] italic" data-edit="s1-lede"'));
  });
});

describe('setStyle', () => {
  const src = '<div id="a" style="color: red;  top: 4px ;--x: url(data:a;b)">x</div><div id="b">y</div><svg><rect id="r" style=\'fill:red\'/></svg>';
  it('html element: edit, add, remove one declaration; the others stay byte for byte', () => {
    expect(run(src, (d) => ({ kind: 'setStyle', id: q(d, 'id=a').id, prop: 'top', value: '8px' }))).toBe(src.replace('top: 4px', 'top: 8px'));
    expect(run(src, (d) => ({ kind: 'setStyle', id: q(d, 'id=a').id, prop: 'left', value: '1px' }))).toBe(src.replace('--x: url(data:a;b)"', '--x: url(data:a;b); left: 1px"'));
    expect(run(src, (d) => ({ kind: 'setStyle', id: q(d, 'id=a').id, prop: 'top', value: null }))).toBe(src.replace('  top: 4px ;', ''));
    expect(run(src, (d) => ({ kind: 'setStyle', id: q(d, 'id=a').id, prop: 'color', value: null }))).toBe(src.replace('color: red;  ', ''));
    expect(run(src, (d) => ({ kind: 'setStyle', id: q(d, 'id=a').id, prop: '--x', value: 'blue' }))).toBe(src.replace('url(data:a;b)', 'blue'));
    expect(run(src, (d) => ({ kind: 'setStyle', id: q(d, 'id=b').id, prop: 'color', value: 'red' }))).toBe(src.replace('id="b"', 'id="b" style="color: red"'));
  });
  it('svg element; removing the last declaration removes the attribute', () => {
    expect(run(src, (d) => ({ kind: 'setStyle', id: q(d, 'id=r').id, prop: 'stroke', value: 'blue' }))).toBe(src.replace("'fill:red'", "'fill:red; stroke: blue'"));
    expect(run(src, (d) => ({ kind: 'setStyle', id: q(d, 'id=r').id, prop: 'fill', value: null }))).toBe(src.replace(" style='fill:red'", ''));
  });
  realIt('element in a real deck', () => {
    const out = run(attention!, (d) => ({ kind: 'setStyle', id: q(d, 'data-edit=s1-lede').id, prop: 'opacity', value: '0.5' }));
    expect(out).toBe(attention!.replace('data-edit="s1-lede"', 'data-edit="s1-lede" style="opacity: 0.5"'));
  });
});

describe('insertHtml', () => {
  it('html element: before a sibling, at the end, into an empty element; indented to match', () => {
    const src = '<ul id="l">\n  <li>a</li>\n  <li>b</li>\n</ul>\n<div id="e">\n</div>';
    expect(run(src, (d) => ({ kind: 'insertHtml', parent: q(d, 'id=l').id, index: 1, html: '<li>x</li>' }))).toBe(src.replace('<li>b</li>', '<li>x</li>\n  <li>b</li>'));
    expect(run(src, (d) => ({ kind: 'insertHtml', parent: q(d, 'id=l').id, index: 2, html: '<li>\n  <b>x</b>\n</li>' }))).toBe(
      src.replace('<li>b</li>', '<li>b</li>\n  <li>\n    <b>x</b>\n  </li>'));
    expect(run(src, (d) => ({ kind: 'insertHtml', parent: q(d, 'id=e').id, index: 0, html: '<p>x</p>' }))).toBe(src.replace('<div id="e">\n</div>', '<div id="e">\n  <p>x</p>\n</div>'));
    expect(codeOf(() => run(src, (d) => ({ kind: 'insertHtml', parent: q(d, 'id=l').id, index: 3, html: '<li>x</li>' })))).toBe('invalid');
  });
  it('svg element', () => {
    const out = run(SVG, (d) => ({ kind: 'insertHtml', parent: q(d, 'id=lg').id, index: 0, html: '<stop offset="0" stop-color="#000"/>' }));
    expect(out).toContain('<linearGradient id="lg"><stop offset="0" stop-color="#000"/></linearGradient>');
    expect(parseSource(out).nodes.find((n) => n.tag === 'stop')!.ns).toBe('svg');
  });
  realIt('element in a real deck', () => {
    const out = run(attention!, (d) => ({ kind: 'insertHtml', parent: q(d, 'data-edit=s1-title').id, index: 1, html: '<span class="block">سطر</span>' }));
    expect(out).toContain('text-blue">الانتباه</span>\n          <span class="block">سطر</span>\n          <span class="block font-display');
  });
});

describe('remove', () => {
  it('html element: the whole line goes, no blank line is left', () => {
    const src = '<ul id="l">\n  <li id="a">a</li>\n  <li id="b">b</li>\n</ul><p>x <b id="i">y</b> z</p>';
    expect(run(src, (d) => ({ kind: 'remove', id: q(d, 'id=a').id }))).toBe(src.replace('  <li id="a">a</li>\n', ''));
    expect(run(src, (d) => ({ kind: 'remove', id: q(d, 'id=i').id }))).toBe(src.replace(' <b id="i">y</b>', ''));
  });
  it('svg element', () => {
    expect(run(SVG, (d) => ({ kind: 'remove', id: q(d, 'id=r').id }))).toBe(SVG.replace('    <rect id="r" x="1" y="1" width="2" height="2"/>\n', ''));
  });
  realIt('element in a real deck', () => {
    const out = run(attention!, (d) => ({ kind: 'remove', id: q(d, 'data-edit=s1-lede').id }));
    expect(out.length).toBeLessThan(attention!.length);
    expect(out).not.toContain('data-edit="s1-lede"');
    expect(out).toContain('</h1>\n\n        <div class="reveal d4 grid');
  });
  it('refuses html, head and body', () => {
    expect(codeOf(() => run(minimal, (d) => ({ kind: 'remove', id: tagIn(d, 'body').id })))).toBe('invalid');
  });
});

describe('move', () => {
  it('html element: reorder siblings and move into another parent, reindented', () => {
    const src = '<ul id="l">\n  <li id="a">a</li>\n  <li id="b">b</li>\n</ul>\n<div id="d">\n  <section id="s">\n    <p>x</p>\n  </section>\n</div>';
    expect(run(src, (d) => ({ kind: 'move', id: q(d, 'id=b').id, parent: q(d, 'id=l').id, index: 0 }))).toBe(
      src.replace('  <li id="a">a</li>\n  <li id="b">b</li>\n', '  <li id="b">b</li>\n  <li id="a">a</li>\n'));
    expect(run(src, (d) => ({ kind: 'move', id: q(d, 'id=a').id, parent: q(d, 'id=s').id, index: 1 }))).toBe(
      src.replace('  <li id="a">a</li>\n', '').replace('<p>x</p>\n', '<p>x</p>\n    <li id="a">a</li>\n'));
    const nested = '<div id="o">\n  <div id="m">\n    <p>a</p>\n  </div>\n</div>\n<main id="t">\n</main>';
    expect(run(nested, (d) => ({ kind: 'move', id: q(d, 'id=m').id, parent: q(d, 'id=t').id, index: 0 }))).toBe(
      '<div id="o">\n</div>\n<main id="t">\n  <div id="m">\n    <p>a</p>\n  </div>\n</main>');
  });
  it('moving to the current position is a no-op; into itself is invalid', () => {
    const src = '<ul id="l">\n  <li id="a">a</li>\n  <li id="b">b</li>\n</ul>';
    const doc = parseSource(src);
    expect(resolveOp(doc, { kind: 'move', id: q(doc, 'id=b').id, parent: q(doc, 'id=l').id, index: 1 }, EMPTY_CONTEXT)).toEqual([]);
    expect(codeOf(() => resolveOp(doc, { kind: 'move', id: q(doc, 'id=l').id, parent: q(doc, 'id=a').id, index: 0 }, EMPTY_CONTEXT))).toBe('invalid');
  });
  it('svg element', () => {
    const out = run(SVG, (d) => ({ kind: 'move', id: q(d, 'id=r').id, parent: q(d, 'id=s').id, index: 1 }));
    const doc = parseSource(out);
    expect(q(doc, 'id=s').children.map((c) => doc.nodes[c].tag)).toEqual(['defs', 'rect', 'circle', 'text']);
  });
  realIt('element in a real deck', () => {
    const out = run(attention!, (d) => ({ kind: 'move', id: q(d, 'data-edit=s1-lede').id, parent: q(d, 'data-edit=s1-title').id, index: 0 }));
    const doc = parseSource(out);
    expect(doc.nodes[q(doc, 'data-edit=s1-title').children[0]].attrs['data-edit'].value).toBe('s1-lede');
  });
});

describe('duplicate', () => {
  it('html element: the copy follows on its own line', () => {
    const src = '<ul>\n  <li id="a">a</li>\n</ul>';
    expect(run(src, (d) => ({ kind: 'duplicate', id: q(d, 'id=a').id }))).toBe('<ul>\n  <li id="a">a</li>\n  <li id="a-2">a</li>\n</ul>');
    expect(run('<p>x<b>y</b></p>', (d) => ({ kind: 'duplicate', id: tagIn(d, 'b').id }))).toBe('<p>x<b>y</b><b>y</b></p>');
  });
  it('svg element', () => {
    const out = run(SVG, (d) => ({ kind: 'duplicate', id: q(d, 'id=c').id }));
    expect(out).toContain('<circle id="c" cx="5" cy="5" r="4" fill="url(#lg)"/>\n    <circle id="c-2" cx="5" cy="5" r="4" fill="url(#lg)"/>');
  });
  realIt('element in a real deck', () => {
    const out = run(attention!, (d) => ({ kind: 'duplicate', id: q(d, 'data-edit=s1-lede').id }));
    expect(parseSource(out).query({ attr: 'data-edit=s1-lede' })).toHaveLength(2);
  });

  it('Review Focus 5: every reference inside the copy is renamed consistently, nothing outside changes', () => {
    const src = `<main>
  <div id="host" data-morph="card">
    <svg id="icon" aria-labelledby="icon-title icon-desc"><title id="icon-title">t</title><desc id="icon-desc">d</desc>
      <defs><linearGradient id="g1"></linearGradient><clipPath id="c1"><rect width="1" height="1"/></clipPath></defs>
      <style>.k { fill: url(#g1); }</style>
      <rect fill="url(#g1)" clip-path="url('#c1')" style="stroke: url(#g1)"/>
      <use href="#g1" xlink:href="#c1"/>
    </svg>
    <label for="inp">L</label><input id="inp" aria-describedby="icon-desc">
    <a href="#outside">o</a>
  </div>
  <p id="outside" style="fill:url(#g1)" data-morph="card-2">ref from outside</p>
  <i id="g1-2"></i>
</main>`;
    const out = run(src, (d) => ({ kind: 'duplicate', id: q(d, 'id=host').id }));
    const host = parseSource(src).query({ attr: 'id=host' })[0];
    const copyStart = host.end + '\n  '.length;
    expect(out.slice(0, host.end)).toBe(src.slice(0, host.end));
    const tail = src.slice(host.end);
    expect(out.endsWith(tail)).toBe(true);
    const copy = out.slice(copyStart, out.length - tail.length);
    const expected = src.slice(host.start, host.end)
      .replace('id="host" data-morph="card"', 'id="host-2" data-morph="card-3"')
      .replace('id="icon" aria-labelledby="icon-title icon-desc"', 'id="icon-2" aria-labelledby="icon-title-2 icon-desc-2"')
      .replace('id="icon-title"', 'id="icon-title-2"').replace('id="icon-desc"', 'id="icon-desc-2"')
      .replace('id="g1"', 'id="g1-3"').replace('id="c1"', 'id="c1-2"')
      .replace('.k { fill: url(#g1); }', '.k { fill: url(#g1-3); }')
      .replace(`fill="url(#g1)" clip-path="url('#c1')" style="stroke: url(#g1)"`, `fill="url(#g1-3)" clip-path="url('#c1-2')" style="stroke: url(#g1-3)"`)
      .replace('href="#g1" xlink:href="#c1"', 'href="#g1-3" xlink:href="#c1-2"')
      .replace('for="inp"', 'for="inp-2"').replace('id="inp" aria-describedby="icon-desc"', 'id="inp-2" aria-describedby="icon-desc-2"');
    expect(copy).toBe(expected);
    expect(copy).toContain('href="#outside"');
    const ids = parseSource(out).nodes.map((n) => n.attrs['id']?.value).filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('wrap', () => {
  it('html element: contiguous siblings get a parent; open and close tags on their own lines', () => {
    const src = '<ul id="l">\n  <li id="a">a</li>\n  <li id="b">b</li>\n  <li id="c">c</li>\n</ul>';
    const out = run(src, (d) => ({ kind: 'wrap', ids: [q(d, 'id=b').id, q(d, 'id=a').id], html: '<div class="g"></div>' }));
    expect(out).toBe('<ul id="l">\n  <div class="g">\n  <li id="a">a</li>\n  <li id="b">b</li>\n  </div>\n  <li id="c">c</li>\n</ul>');
    expect(codeOf(() => run(src, (d) => ({ kind: 'wrap', ids: [q(d, 'id=a').id, q(d, 'id=c').id], html: '<div></div>' })))).toBe('invalid');
    expect(codeOf(() => run(src, (d) => ({ kind: 'wrap', ids: [q(d, 'id=a').id], html: '<div>x</div>' })))).toBe('invalid');
  });
  it('inline siblings are wrapped in place', () => {
    expect(run('<p>x<b>y</b><i>z</i></p>', (d) => ({ kind: 'wrap', ids: [tagIn(d, 'b').id, tagIn(d, 'i').id], html: '<span class="k"></span>' }))).toBe(
      '<p>x<span class="k"><b>y</b><i>z</i></span></p>');
  });
  it('svg element', () => {
    const out = run(SVG, (d) => ({ kind: 'wrap', ids: [q(d, 'id=c').id, q(d, 'id=r').id], html: '<g class="grp"></g>' }));
    const doc = parseSource(out);
    const g = doc.query({ tag: 'g' })[0];
    expect(g.ns).toBe('svg');
    expect(g.children.map((c) => doc.nodes[c].attrs['id'].value)).toEqual(['c', 'r']);
  });
  realIt('element in a real deck', () => {
    const out = run(attention!, (d) => {
      const lede = q(d, 'data-edit=s1-lede');
      return { kind: 'wrap', ids: [lede.id], html: '<div class="w"></div>' };
    });
    const doc = parseSource(out);
    expect(doc.byId(q(doc, 'data-edit=s1-lede').parent!).attrs['class'].value).toBe('w');
  });
});

describe('setToken', () => {
  realIt('attention config: one property changes and readTokens sees it', () => {
    const out = run(attention!, { kind: 'setToken', path: ['colors', 'verm'], value: '#ff3300' });
    expect(out).toBe(attention!.replace("verm: 'var(--verm)'", "verm: '#ff3300'"));
    const t = readTokens(parseSource(out));
    expect((t.values as { theme: { extend: { colors: Record<string, string> } } }).theme.extend.colors.verm).toBe('#ff3300');
  });
  realIt('adding and removing a key', () => {
    const added = run(attention!, { kind: 'setToken', path: ['colors', 'tab-mint'], value: '#aaffcc' });
    expect(added).toBe(attention!.replace("line: 'var(--line)'\n", "line: 'var(--line)',\n        'tab-mint': '#aaffcc'\n"));
    expect(readTokens(parseSource(added)).ctx.colors.has('tab-mint')).toBe(true);
    const nested = run(attention!, { kind: 'setToken', path: ['fontSize', 'hero'], value: '192px' });
    expect(readTokens(parseSource(nested)).ctx.fontSizes.has('hero')).toBe(true);
    expect(nested).toContain("      },\n      fontSize: { hero: '192px' }\n    }");
    const removed = run(attention!, { kind: 'setToken', path: ['colors', 'line'], value: null });
    expect(removed).toBe(attention!.replace(",\n        line: 'var(--line)'", ''));
    const removedMid = run(attention!, { kind: 'setToken', path: ['colors', 'navy'], value: null });
    expect(removedMid).toBe(attention!.replace("        navy: 'var(--navy)',\n", ''));
  });
  it('no config is unsupported', () => {
    expect(codeOf(() => run(minimal, { kind: 'setToken', path: ['colors', 'x'], value: '#fff' }))).toBe('unsupported');
  });
});

describe('errors', () => {
  it('every op on an unpatchable node throws OpError(unpatchable)', () => {
    const doc = parseSource(edge);
    const unclosed = q(doc, 'id=unclosed').id;
    const tbody = tagIn(doc, 'tbody').id;
    const body = tagIn(doc, 'body').id;
    for (const id of [unclosed, tbody]) {
      const ops: Op[] = [
        { kind: 'setText', id, text: 'x' }, { kind: 'setAttr', id, name: 'a', value: 'b' },
        { kind: 'setUtility', id, group: 'top', value: '1' }, { kind: 'setClasses', id, classes: ['x'] },
        { kind: 'setStyle', id, prop: 'color', value: 'red' }, { kind: 'insertHtml', parent: id, index: 0, html: '<b>x</b>' },
        { kind: 'remove', id }, { kind: 'move', id, parent: body, index: 0 }, { kind: 'duplicate', id },
        { kind: 'wrap', ids: [id], html: '<div></div>' },
      ];
      for (const op of ops) expect(codeOf(() => resolveOp(doc, op, EMPTY_CONTEXT)), `${op.kind} on ${id}`).toBe('unpatchable');
    }
    expect(codeOf(() => resolveOp(doc, { kind: 'move', id: q(doc, 'id=entities').id, parent: tbody, index: 0 }, EMPTY_CONTEXT))).toBe('unpatchable');
  });
  it('unknown ids are not-found; malformed ops are invalid', () => {
    const doc = parseSource(minimal);
    expect(codeOf(() => resolveOp(doc, { kind: 'remove', id: 99999 }, EMPTY_CONTEXT))).toBe('not-found');
    expect(codeOf(() => resolveOp(doc, { kind: 'nope' } as unknown as Op, EMPTY_CONTEXT))).toBe('invalid');
    expect(codeOf(() => resolveOp(doc, { kind: 'setUtility', id: 1, group: 'margin', value: '1' } as unknown as Op, EMPTY_CONTEXT))).toBe('invalid');
  });
});

// Ported from spikes/s1-source/source.test.ts: attribute writes are local on every fixture.
for (const f of ALL_FIXTURES) {
  (f.text === null ? describe.skip : describe)(`S1 port: ${f.name}`, () => {
    const text = f.text as string;
    it('setAttr is local and keeps the quote style', () => {
      const doc = parseSource(text);
      for (const n of sample(doc.nodes.filter((x) => x.patchable && x.attrs['class']), 150)) {
        const a = n.attrs['class'];
        const out = applySplices(text, setAttrSplices(doc, n, 'class', 'nm-x nm-y'));
        const tail = text.length - a.end;
        expect(out.slice(0, a.start)).toBe(text.slice(0, a.start));
        expect(out.slice(out.length - tail)).toBe(text.slice(a.end));
        if (a.quote) expect(out.slice(a.start, out.length - tail)).toBe(`class=${a.quote}nm-x nm-y${a.quote}`);
      }
    });
    it('setAttr adds exactly name="value" before > or />', () => {
      const doc = parseSource(text);
      for (const n of sample(doc.nodes.filter((x) => x.patchable && !x.attrs['data-nm-test']), 150)) {
        const [s] = setAttrSplices(doc, n, 'data-nm-test', 'v');
        expect(s.start).toBe(s.end);
        expect(s.text).toBe(' data-nm-test="v"');
        expect(['>', '/>']).toContain(text.slice(s.start, n.startTagEnd));
      }
    });
    it('setAttr then setAttr back gives the original bytes', () => {
      const doc = parseSource(text);
      for (const n of sample(doc.nodes.filter((x) => x.patchable && x.attrs['class']), 100)) {
        const old = n.attrs['class'].value;
        const out1 = applySplices(text, setAttrSplices(doc, n, 'class', 'nm-tmp'));
        const doc1 = parseSource(out1);
        expect(doc1.byId(n.id).tag).toBe(n.tag);
        expect(applySplices(out1, setAttrSplices(doc1, doc1.byId(n.id), 'class', old))).toBe(text);
      }
    });
    it('svg untouched after a text edit elsewhere', () => {
      const doc = parseSource(text);
      const svgs = doc.nodes.filter((n) => n.tag === 'svg' && n.patchable);
      if (svgs.length === 0) return;
      const target = doc.nodes.find((n) => n.patchable && ['p', 'h1', 'h2'].includes(n.tag) && n.ns === 'html' &&
        !svgs.some((s) => s.start > n.start && s.end < n.end) && visibleText(doc, n.id).length > 0)!;
      const out = run(text, { kind: 'setText', id: target.id, text: 'نص بديل' });
      const svgs2 = parseSource(out).nodes.filter((n) => n.tag === 'svg' && n.patchable);
      expect(svgs2.length).toBe(svgs.length);
      svgs.forEach((s, i) => expect(out.slice(svgs2[i].start, svgs2[i].end)).toBe(text.slice(s.start, s.end)));
    });
  });
}
