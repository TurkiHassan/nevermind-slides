import { describe, expect, it } from 'vitest';
import { dirname } from 'node:path';
import { inspectDeck, lintDeck } from '../../src/engine/deck-adapter.ts';
import { parseSource } from '../../src/engine/source.ts';
import { ATTENTION, EDGE, MECHANISTIC, MINIMAL, fixturePath, loadFixture } from '../helpers.ts';

const attention = loadFixture(ATTENTION);
const mechanistic = loadFixture(MECHANISTIC);
const minimal = loadFixture(MINIMAL)!;

(attention === null ? describe.skip : describe)('attention deck', () => {
  const doc = parseSource(attention!);
  const info = inspectDeck(doc);
  const issues = lintDeck(doc, info, dirname(fixturePath(ATTENTION)));

  it('7 slides, local Tailwind, legacy editor, nevermind kind', () => {
    expect(info.slides).toHaveLength(7);
    expect(info.slides.map((s) => s.index)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(info.slides[0].title).toBe('الانتباه هو كل ما تحتاجه');
    expect(info.tailwind).toBe('local');
    expect(info.legacyEditor).toBe(true);
    expect(info.kind).toBe('nevermind');
    expect(info.tokens.colors.has('cream')).toBe(true);
  });
  it('fonts from @font-face with weights and sources', () => {
    const sans = info.fonts.find((f) => f.family === 'Thmanyah Sans')!;
    expect(sans.weights).toEqual([300, 400, 500, 700, 900]);
    expect(sans.src).toContain('assets/fonts/thmanyahsans-Bold.otf');
    expect(info.fonts.find((f) => f.family === 'KOMission')!.weights).toEqual([100, 200, 300, 400, 500, 600, 700, 800, 900]);
  });
  it('alpha-on-var-color reported for text-cream/70', () => {
    const hits = issues.filter((i) => i.code === 'alpha-on-var-color');
    expect(hits.some((i) => i.message.startsWith('text-cream/70'))).toBe(true);
    expect(hits.every((i) => i.severity === 'warn')).toBe(true);
  });
  it('no errors on the untouched deck (assets exist, no emoji)', () => {
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
  });
  it('letter-spacing-arabic and mixed-digits are found where the deck has them', () => {
    expect(issues.some((i) => i.code === 'letter-spacing-arabic' && attention!.slice(doc.byId(i.nodeId!).start).startsWith('<span class="font-kom text-[13px] tracking-[0.08em]'))).toBe(true);
    expect(issues.some((i) => i.code === 'mixed-digits' && i.nodeId === info.slides[0].id)).toBe(true);
  });
});

(mechanistic === null ? describe.skip : describe)('mechanistic deck', () => {
  const doc = parseSource(mechanistic!);
  const info = inspectDeck(doc);
  const issues = lintDeck(doc, info, dirname(fixturePath(MECHANISTIC)));

  it('8 slides, CDN Tailwind, morph pairs, 23 zoom steps', () => {
    expect(info.slides).toHaveLength(8);
    expect(info.tailwind).toBe('cdn');
    expect(info.legacyEditor).toBe(false);
    expect(info.kind).toBe('nevermind');
    expect(Object.keys(info.morph).sort()).toEqual(['equation-box', 'hero-visual-card', 'pillar-expression', 'pillar-monitoring', 'pillar-reliance']);
    expect(info.morph['equation-box']).toHaveLength(2);
    expect(info.zoomSteps).toHaveLength(23);
    expect(info.zoomSteps.every((z) => info.slides.some((s) => s.id === z.slideId))).toBe(true);
    expect(info.zoomSteps.map((z) => z.step).filter((s) => s === 4)).toHaveLength(5);
  });
  it('tailwind-cdn warning, no errors', () => {
    expect(issues.some((i) => i.code === 'tailwind-cdn' && i.severity === 'warn')).toBe(true);
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
  });
});

describe('synthetic decks', () => {
  it('inspects Phase 7 entrance, runtime, identity, and anatomy source contracts', () => {
    const source = `<!doctype html><html><head>
<meta name="nm-runtime" content="1">
<script>tailwind.config = { theme: { extend: { colors: { verm: '#ed3b2f' }, fontFamily: { body: 'Thmanyah Sans', display: ['Zain Rounded', 'sans-serif'] } } } }</script>
</head><body><main class="deck-stage">
<section class="slide"><h1 class="reveal d2" data-entrance="fade-up" data-entrance-order="3" data-entrance-delay="450">A</h1>
<svg data-anatomy="heart" style="--anatomy-artery: #d7263d; --other: blue"><path /></svg></section>
<section class="slide"><iframe class="anatomy-figure" src="assets/anatomy/lung.html" style="--anatomy-tissue:#e8a0a0"></iframe></section>
</main></body></html>`;
    const doc = parseSource(source);
    const inspected = inspectDeck(doc);
    const heading = doc.query({ tag: 'h1' })[0];
    const svg = doc.query({ tag: 'svg' })[0];
    const iframe = doc.query({ tag: 'iframe' })[0];

    expect(inspected.runtime).toEqual({ version: 1, native: true });
    expect(inspected.entrances).toEqual([{ slideId: inspected.slides[0].id, id: heading.id, kind: 'fade-up', order: 3, delay: 450, legacy: false }]);
    expect(inspected.identity).toEqual({ colours: { verm: '#ed3b2f' }, fonts: { body: 'Thmanyah Sans', display: ['Zain Rounded', 'sans-serif'] } });
    expect(inspected.anatomy).toEqual([
      { slideId: inspected.slides[0].id, id: svg.id, kind: 'svg', name: 'heart', variables: { '--anatomy-artery': '#d7263d' } },
      { slideId: inspected.slides[1].id, id: iframe.id, kind: 'iframe', name: 'lung.html', variables: { '--anatomy-tissue': '#e8a0a0' } },
    ]);
  });

  it('reads reveal/delay classes as legacy entrance fallback without requiring a runtime contract', () => {
    const doc = parseSource('<main class="deck-stage"><section class="slide"><p class="reveal d4">Legacy</p></section></main>');
    const inspected = inspectDeck(doc);
    expect(inspected.runtime).toEqual({ version: null, native: false });
    expect(inspected.entrances[0]).toMatchObject({ kind: 'reveal', order: 4, delay: 0, legacy: true });
  });

  it('minimal deck: inspected as nevermind with morph and zoom; clean', () => {
    const doc = parseSource(minimal);
    const info = inspectDeck(doc);
    expect(info.slides.map((s) => s.title)).toEqual(['الانتباه هو كل ما تحتاجه', 'الانتباه في سطر', 'الخلاصة']);
    expect(info.morph['hero-title']).toHaveLength(2);
    expect(info.zoomSteps.map((z) => [z.step, z.label])).toEqual([[1, 'الاستعلام'], [2, 'المفتاح']]);
    expect(info.tailwind).toBe('none');
    const errors = lintDeck(doc, info, dirname(fixturePath(MINIMAL))).filter((i) => i.severity === 'error');
    expect(errors).toEqual([]);
  });

  it('injected emoji, slide-relative, missing asset, no-stage, missing-font-weight are caught', () => {
    const bad = minimal
      .replace('<section class="slide" data-slide="2">', '<section class="slide relative" data-slide="2">')
      .replace('الخلاصة</h2>', 'الخلاصة \u{1F680}</h2>')
      .replace('<div class="absolute left-[80px] top-[640px]', '<img src="assets/missing.png"><div class="absolute left-[80px] top-[640px]');
    const doc = parseSource(bad);
    const issues = lintDeck(doc, inspectDeck(doc), dirname(fixturePath(MINIMAL)));
    const codes = issues.map((i) => `${i.code}:${i.severity}`);
    expect(codes).toContain('emoji:error');
    expect(codes).toContain('slide-relative:error');
    expect(codes).toContain('missing-asset:error');
    expect(issues.find((i) => i.code === 'slide-relative')!.nodeId).toBe(inspectDeck(doc).slides[1].id);

    const noStage = parseSource(minimal.replace('class="deck-stage"', 'class="stage"'));
    expect(lintDeck(noStage, inspectDeck(noStage), '.').map((i) => i.code)).toContain('no-stage');

    const fonts = `<html><head><style>@font-face { font-family: 'Fam'; src: url(f.otf); font-weight: 400; } :root { --f: 'Fam', serif; }</style>
<script>tailwind.config = { theme: { extend: { fontFamily: { fam: 'var(--f)' } } } }</script></head>
<body><div class="font-fam"><p id="p" class="font-bold">x</p><p class="font-normal">y</p></div></body></html>`;
    const fdoc = parseSource(fonts);
    const fi = lintDeck(fdoc, inspectDeck(fdoc), dirname(fixturePath(MINIMAL)));
    expect(fi.filter((i) => i.code === 'missing-font-weight').map((i) => i.nodeId)).toEqual([fdoc.query({ attr: 'id=p' })[0].id]);
  });

  it('edge-cases is a generic document', () => {
    const doc = parseSource(loadFixture(EDGE)!);
    const info = inspectDeck(doc);
    expect(info.kind).toBe('generic');
    expect(info.slides).toEqual([]);
  });
});
