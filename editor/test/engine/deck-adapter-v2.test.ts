// Runtime v2 vocabulary in the adapter (NM-23): what the editor knows about steps, diagrams and detail templates,
// and the integrity warnings an edit can cause.
import { describe, expect, it } from 'vitest';
import { dirname } from 'node:path';
import { inspectDeck, lintDeck } from '../../src/engine/deck-adapter.ts';
import { parseSource } from '../../src/engine/source.ts';
import { SHOWCASE, fixturePath, loadFixture } from '../helpers.ts';

const V2_CODES = ['duplicate-morph', 'orphan-detail-template', 'detail-without-content', 'dangling-link'];

describe('runtime v2 inventory', () => {
  const text = loadFixture(SHOWCASE)!;
  const doc = parseSource(text);
  const info = inspectDeck(doc);

  it('lists every data-step with its act', () => {
    expect(info.steps.length).toBe((text.match(/\sdata-step="\d+"/g) ?? []).length);
    expect(new Set(info.steps.map((s) => s.act))).toEqual(new Set(['reveal', 'zoom', 'highlight', 'focus', 'detail', 'lens', 'pins', 'slice', 'draw'].filter((a) => info.steps.some((s) => s.act === a))));
    expect(info.steps.some((s) => s.act === 'detail')).toBe(true);
  });
  it('lists every diagram with its DSL source', () => {
    expect(info.diagrams.length).toBe((text.match(/class="nm-diagram/g) ?? []).length);
    expect(info.diagrams.every((d) => d.sourceId !== null && doc.nodes[d.sourceId].tag === 'script')).toBe(true);
  });
  it('lists the detail templates', () => {
    expect(info.detailTemplates.length).toBe((text.match(/data-detail-for=/g) ?? []).length);
  });
  it('the showcase raises none of the integrity warnings', () => {
    const issues = lintDeck(doc, info, dirname(fixturePath(SHOWCASE)));
    expect(issues.filter((i) => V2_CODES.includes(i.code))).toEqual([]);
  });
});

describe('integrity warnings', () => {
  const src = `<main class="deck-stage"><section class="slide" data-links="a>b; a>ghost">
<div id="x" data-node="a" data-morph="m">1</div><div data-node="b" data-morph="m">2</div>
<div id="d1" data-step="1" data-act="detail">بلا قالب</div>
<div id="d2" data-step="2" data-act="detail" data-detail-text="نص">بنص</div>
<template data-detail-for="gone"><p>يتيم</p></template>
</section></main>`;
  const doc = parseSource(src);
  const info = inspectDeck(doc);
  const codes = lintDeck(doc, info, '/').map((i) => i.code);
  it('flags each broken reference once', () => {
    expect(codes.filter((c) => c === 'duplicate-morph')).toHaveLength(1);
    expect(codes.filter((c) => c === 'orphan-detail-template')).toHaveLength(1);
    expect(codes.filter((c) => c === 'detail-without-content')).toHaveLength(1); // d2 has data-detail-text
    expect(codes.filter((c) => c === 'dangling-link')).toHaveLength(1); // "ghost"
  });
});
