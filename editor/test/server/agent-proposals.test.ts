import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { AgentProposalStore, type AgentSelectionSnapshot } from '../../src/server/agent-proposals.ts';
import { HttpError, Session } from '../../src/server/session.ts';
import { MINIMAL, tempCopyDeck } from '../helpers.ts';

const source = '<section class="slide"><h1 class="text-6xl">العنوان القديم</h1></section>\n';

function selection(): AgentSelectionSnapshot {
  return {
    baseVersion: 7,
    deckPath: '/tmp/deck.html',
    source,
    key: 'n5',
    id: 4,
    slide: 1,
    tag: 'h1',
    role: 'heading',
    text: 'العنوان القديم',
    classes: ['text-6xl'],
    html: '<h1 class="text-6xl">العنوان القديم</h1>',
  };
}

describe('AgentProposalStore', () => {
  it('builds a selected-element proposal in isolation and exposes its source diff', async () => {
    const seen: AgentSelectionSnapshot[] = [];
    const store = new AgentProposalStore({
      text: async (input) => {
        seen.push(input.selection);
        return { summary: 'اختصر العنوان', ops: [{ kind: 'setText', id: input.selection.id, text: 'عنوان موجز' }] };
      },
    });

    const created = store.createText('اختصر العنوان', selection());
    const proposal = await store.settled(created.id);

    expect(seen).toEqual([selection()]);
    expect(proposal).toMatchObject({
      id: created.id,
      kind: 'text',
      status: 'ready',
      baseVersion: 7,
      summary: 'اختصر العنوان',
      ops: [{ kind: 'setText', id: 'n5', text: 'عنوان موجز' }],
    });
    expect(proposal.diff).toContain('-<section class="slide"><h1 class="text-6xl">العنوان القديم</h1></section>');
    expect(proposal.diff).toContain('+<section class="slide"><h1 class="text-6xl">عنوان موجز</h1></section>');
    expect(selection().source).toBe(source);
    await store.close();
  });

  it('accepts all proposal operations as one undo step and refuses a stale proposal', async () => {
    const copy = tempCopyDeck(MINIMAL);
    const session = await Session.open(copy.path);
    const outline = session.outline(3, 8).outline;
    const heading = outline.children.flatMap(function walk(node): typeof outline.children {
      return [node, ...node.children.flatMap(walk)];
    }).find((node) => node.tag === 'h2')!;
    const snapshot = session.agentSelection(heading.key!);

    expect(snapshot).toMatchObject({ baseVersion: 1, key: heading.key, slide: 3, tag: 'h2', text: 'الخلاصة' });
    const accepted = session.acceptAgentOps({
      baseVersion: snapshot.baseVersion,
      ops: [
        { kind: 'setText', id: snapshot.key, text: 'خلاصة موجزة' },
        { kind: 'setAttr', id: snapshot.key, name: 'data-ai-edited', value: 'true' },
      ],
      label: 'AI: shorten heading',
    });
    expect(accepted.version).toBe(2);
    expect(session.text).toContain('<h2 class="reveal d1 text-[64px] text-ink" data-ai-edited="true">خلاصة موجزة</h2>');

    session.undo();
    expect(session.text).toBe(snapshot.source);
    expect(() => session.acceptAgentOps({ baseVersion: 1, ops: [{ kind: 'setText', id: snapshot.key, text: 'قديم' }], label: 'stale' }))
      .toThrowError(HttpError);
    session.close();
  });

  it('keeps a regenerated image temporary and rejection removes it without creating assets', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'nm-ai-image-test-'));
    const deckPath = join(dir, 'deck.html');
    const imageSource = '<section class="slide"><img src="old.png" class="w-full"></section>\n';
    writeFileSync(deckPath, imageSource);
    writeFileSync(join(dir, 'old.png'), Buffer.from('reference'));
    let generatedPath = '';
    const imageSelection: AgentSelectionSnapshot = {
      baseVersion: 2, deckPath, source: imageSource, key: 'n5', id: 4, slide: 1, tag: 'img', role: 'image',
      classes: ['w-full'], html: '<img src="old.png" class="w-full">', src: 'old.png',
    };
    const store = new AgentProposalStore({
      text: async () => { throw new Error('not used'); },
      image: async ({ outputPath, referencePath }) => {
        generatedPath = outputPath;
        expect(referencePath).toBe(join(dir, 'old.png'));
        writeFileSync(outputPath, Buffer.from('89504e470d0a1a0a00000000', 'hex'));
      },
    });

    const created = store.createImage('حوّلها إلى رسم تقني', imageSelection);
    const ready = await store.settled(created.id);

    expect(ready).toMatchObject({ kind: 'image', status: 'ready', ops: [{ kind: 'setAttr', id: 'n5', name: 'src' }] });
    expect(ready.diff).toContain('assets/ai-ai-1.png');
    expect(existsSync(generatedPath)).toBe(true);
    expect(existsSync(join(dir, 'assets'))).toBe(false);
    store.reject(created.id);
    expect(existsSync(generatedPath)).toBe(false);
    expect(existsSync(join(dir, 'assets'))).toBe(false);
    await store.close();
  });
});
