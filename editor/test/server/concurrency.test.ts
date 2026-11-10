import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { EditorDocument } from '../../src/engine/document.ts';
import type { Op } from '../../src/engine/ops.ts';
import { loadDeck, saveDeck } from '../../src/engine/file-store.ts';
import { watchDeck } from '../../src/server/watch.ts';
import { ATTENTION, ROOT } from '../helpers.ts';
import { MINIMAL, collectEvents, raw, readDeck, startTest, tempDeck, type TestServer } from './helpers.ts';

const CLI = join(ROOT, 'src', 'cli', 'nm-studio.ts');
const servers: TestServer[] = [];
const start = async (rel = ATTENTION) => {
  const s = await startTest(rel);
  servers.push(s);
  return s;
};
afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => s.close()));
});

/** The agent: an out-of-process `nm-studio apply` on the deck file. Builds id ops against the file as it is now. */
function agentApply(deckPath: string, build: (d: EditorDocument) => Op[]): void {
  const d = EditorDocument.fromText(readFileSync(deckPath, 'utf8'));
  const r = spawnSync(process.execPath, [CLI, 'apply', deckPath, '-'], { input: JSON.stringify(build(d)), encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`agent apply failed: ${r.stderr}`);
}

/** Poll the server state until `ok` holds (an external change is seen after the watcher's debounce). */
async function until(s: TestServer, ok: (st: any) => boolean, ms = 8000): Promise<void> {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (ok(await s.state())) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error('server state did not reach the expected condition');
}

const doc = (s: TestServer) => EditorDocument.fromText(readDeck(s));
const leafSpans = (d: EditorDocument) => d.doc.nodes.filter((n) => n.tag === 'span' && n.children.length === 0 && n.patchable && d.doc.text.slice(n.startTagEnd, n.endTagStart as number).trim().length > 2);
const keyed = (d: EditorDocument, id: number) => d.refs.keyOf(id);

describe('the watcher sees every replacement of the file (rename-replace)', () => {
  it('our own atomic save, then a CLI apply, then another save: three events', async () => {
    const { deckPath } = tempDeck(MINIMAL);
    let hits = 0;
    const w = watchDeck(deckPath, () => { hits++; }, 60);
    const settle = () => new Promise((r) => setTimeout(r, 300));
    const f1 = await loadDeck(deckPath);
    const f2 = await saveDeck(f1, f1.text.replace('<html', '<html data-a="1"'));
    await settle();
    expect(hits).toBe(1);
    agentApply(deckPath, (d) => [{ kind: 'setAttr', id: d.doc.query({ tag: 'section' })[0].id, name: 'data-b', value: '2' }]);
    await settle();
    expect(hits).toBe(2);
    await saveDeck(await loadDeck(deckPath), f2.text.replace('data-a="1"', 'data-a="3"'));
    await settle();
    expect(hits).toBe(3);
    w.close();
  });
});

describe('external change while clean (Review Focus 2, clean half)', () => {
  it('the editor reloads silently, tells the browser, and keys of untouched elements survive', async () => {
    const s = await start();
    const tab = await collectEvents(s);
    const d = doc(s);
    const spans = leafSpans(d);
    const [target, other] = [spans[0], spans[spans.length - 1]];
    const otherKey = keyed(d, other.id);
    const targetKey = keyed(d, target.id);
    const v0 = (await s.state()).version;
    agentApply(s.deckPath, (x) => [{ kind: 'setText', id: leafSpans(x)[0].id, text: 'تعديل من الوكيل' }]);
    const ev = await tab.waitFor((e) => e.event === 'disk-changed');
    expect(ev.data).toMatchObject({ reloaded: true, conflict: false });
    const ver = await tab.waitFor((e) => e.event === 'version' && e.data.source === 'reload');
    expect(ver.data.previewPatch).toBe('reload');
    const st = await s.state();
    expect(st.dirty).toBe(false);
    expect(st.version).toBeGreaterThan(v0);
    // keys resolve to the same elements; the agent's text is in the preview
    const html = (await raw(s.port, `/preview?t=${s.token}`)).body;
    expect(html).toContain('تعديل من الوكيل');
    expect(html).toContain(`data-nm-key="${otherKey}"`);
    expect(html).toMatch(new RegExp(`data-nm-key="${targetKey}"[^>]*>تعديل من الوكيل`));
    const r = await s.ops([{ kind: 'setAttr', id: otherKey, name: 'data-after-reload', value: '1' }]);
    expect(r.status).toBe(200);
    tab.close();
  });

  it('our own save is never reported as an external change', async () => {
    const s = await start();
    const tab = await collectEvents(s);
    const d = doc(s);
    await s.ops([{ kind: 'setText', id: keyed(d, leafSpans(d)[0].id), text: 'ours' }]);
    await s.post('/api/save', {});
    await new Promise((r) => setTimeout(r, 500));
    expect(tab.events.filter((e) => e.event === 'disk-changed')).toEqual([]);
    expect((await s.state()).conflict).toBeNull();
    // and a later external edit still is seen (the watch survived our rename-replace)
    agentApply(s.deckPath, (x) => [{ kind: 'setAttr', id: x.doc.query({ tag: 'section' })[0].id, name: 'data-agent', value: '1' }]);
    await tab.waitFor((e) => e.event === 'disk-changed');
    tab.close();
  });
});

describe('external change while dirty (Review Focus 2)', () => {
  it('the browser is told, save is refused, nothing is overwritten, pending ops are kept', async () => {
    const s = await start();
    const tab = await collectEvents(s);
    const d = doc(s);
    const spans = leafSpans(d);
    await s.ops([{ kind: 'setText', id: keyed(d, spans[1].id), text: 'USER-EDIT' }]);
    agentApply(s.deckPath, (x) => [{ kind: 'setText', id: leafSpans(x)[0].id, text: 'AGENT-EDIT' }]);
    const agentText = readDeck(s);
    const ev = await tab.waitFor((e) => e.event === 'disk-changed');
    expect(ev.data).toMatchObject({ reloaded: false, conflict: true });
    expect(ev.data.diskFingerprint).toMatch(/^[0-9a-f]{64}$/);
    const st = await s.state();
    expect(st.conflict?.diskFingerprint).toBe(ev.data.diskFingerprint);
    expect(st.dirty).toBe(true);
    const save = await s.post('/api/save', {});
    expect(save.status).toBe(409);
    expect(save.json()).toMatchObject({ error: 'conflict', diskFingerprint: ev.data.diskFingerprint });
    expect(readDeck(s)).toBe(agentText); // untouched
    expect(readDeck(s)).not.toContain('USER-EDIT');
    // the user may keep editing meanwhile
    expect((await s.ops([{ kind: 'setAttr', id: keyed(d, spans[2].id), name: 'data-more', value: '1' }])).status).toBe(200);
    tab.close();
  });

  it('reapply keeps both the agent change and the user ops when they touch different elements', async () => {
    const s = await start();
    const d = doc(s);
    const spans = leafSpans(d);
    // two user transactions, the second on an element the first one created (needs the minted key to replay)
    const first = (await s.ops([{ kind: 'duplicate', id: keyed(d, spans[1].id) }])).json();
    const copy = first.created[0];
    await s.ops([{ kind: 'setText', id: copy, text: 'USER-COPY-TEXT' }]);
    await s.ops([{ kind: 'setAttr', id: keyed(d, spans[2].id), name: 'data-user', value: 'u' }]);
    agentApply(s.deckPath, (x) => [{ kind: 'setText', id: leafSpans(x)[0].id, text: 'AGENT-EDIT' }]);
    await until(s, (st) => st.conflict !== null);
    expect((await s.state()).conflict).not.toBeNull();
    const res = await s.post('/api/resolve', { strategy: 'reapply' });
    expect(res.status).toBe(200);
    expect(res.json()).toMatchObject({ applied: 3, failed: [], dirty: true });
    const st = await s.state();
    expect(st.conflict).toBeNull();
    const save = await s.post('/api/save', {});
    expect(save.status).toBe(200);
    const final = readDeck(s);
    expect(final).toContain('AGENT-EDIT');
    expect(final).toContain('USER-COPY-TEXT');
    expect(final).toContain('data-user="u"');
    // and the editor can undo what it replayed, one transaction at a time
    expect((await s.post('/api/undo', {})).status).toBe(200);
  });

  it('reapply reports the ops that no longer resolve when the agent and the user collide', async () => {
    const s = await start();
    const d = doc(s);
    const spans = leafSpans(d);
    await s.ops([{ kind: 'setText', id: keyed(d, spans[1].id), text: 'USER-ON-REMOVED' }], { label: 'edit the doomed span' });
    await s.ops([{ kind: 'setAttr', id: keyed(d, spans[2].id), name: 'data-fine', value: '1' }]);
    agentApply(s.deckPath, (x) => [{ kind: 'remove', id: leafSpans(x)[1].id }]);
    await until(s, (st) => st.conflict !== null);
    const res = (await s.post('/api/resolve', { strategy: 'reapply' })).json();
    expect(res.applied).toBe(1);
    expect(res.failed).toHaveLength(1);
    expect(res.failed[0]).toMatchObject({ label: 'edit the doomed span', code: 'stale-ref' });
    expect(res.failed[0].ops[0]).toMatchObject({ kind: 'setText', text: 'USER-ON-REMOVED' });
    expect((await s.post('/api/save', {})).status).toBe(200);
    expect(readDeck(s)).not.toContain('USER-ON-REMOVED');
    expect(readDeck(s)).toContain('data-fine="1"');
  });

  it('the replay log mirrors the history: op A, op B, undo B, external edit, reapply replays A only', async () => {
    const s = await start();
    const d = doc(s);
    const spans = leafSpans(d);
    await s.ops([{ kind: 'setAttr', id: keyed(d, spans[1].id), name: 'data-a', value: '1' }]);
    await s.ops([{ kind: 'setAttr', id: keyed(d, spans[2].id), name: 'data-b', value: '1' }]);
    await s.post('/api/undo', {});
    agentApply(s.deckPath, (x) => [{ kind: 'setText', id: leafSpans(x)[0].id, text: 'AGENT' }]);
    await until(s, (st) => st.conflict !== null);
    const res = (await s.post('/api/resolve', { strategy: 'reapply' })).json();
    expect(res).toMatchObject({ applied: 1, failed: [] });
    await s.post('/api/save', {});
    expect(readDeck(s)).toContain('data-a="1"');
    expect(readDeck(s)).not.toContain('data-b="1"');
  });

  it('reload drops the user ops and takes the disk; the keys of untouched elements survive', async () => {
    const s = await start();
    const d = doc(s);
    const spans = leafSpans(d);
    const keepKey = keyed(d, spans[3].id);
    await s.ops([{ kind: 'setText', id: keyed(d, spans[1].id), text: 'USER' }]);
    agentApply(s.deckPath, (x) => [{ kind: 'setText', id: leafSpans(x)[0].id, text: 'AGENT' }]);
    await until(s, (st) => st.conflict !== null);
    const res = await s.post('/api/resolve', { strategy: 'reload' });
    expect(res.status).toBe(200);
    const st = await s.state();
    expect(st).toMatchObject({ dirty: false, conflict: null, canUndo: false });
    expect((await s.ops([{ kind: 'setAttr', id: keepKey, name: 'data-k', value: '1' }])).status).toBe(200);
    expect((await raw(s.port, `/preview?t=${s.token}`)).body).toContain('AGENT');
    expect((await raw(s.port, `/preview?t=${s.token}`)).body).not.toContain('USER');
  });

  it('after undo goes past the save point a reapply is refused (409 not-replayable), reload still works', async () => {
    const s = await start();
    const d = doc(s);
    const spans = leafSpans(d);
    await s.ops([{ kind: 'setAttr', id: keyed(d, spans[1].id), name: 'data-saved', value: '1' }]);
    await s.post('/api/save', {});
    await s.post('/api/undo', {}); // the editor now differs from disk by the inverse of a saved change
    agentApply(s.deckPath, (x) => [{ kind: 'setText', id: leafSpans(x)[0].id, text: 'AGENT' }]);
    await until(s, (st) => st.conflict !== null);
    const r = await s.post('/api/resolve', { strategy: 'reapply' });
    expect(r.status).toBe(409);
    expect(r.json().error).toBe('not-replayable');
    expect((await s.post('/api/resolve', { strategy: 'reload' })).status).toBe(200);
  });

  it('a disk that goes back to what we loaded clears the conflict', async () => {
    const s = await start();
    const d = doc(s);
    const original = readDeck(s);
    await s.ops([{ kind: 'setAttr', id: keyed(d, leafSpans(d)[1].id), name: 'data-u', value: '1' }]);
    const tab = await collectEvents(s);
    const bak = join(s.dir, 'bak.html');
    copyFileSync(s.deckPath, bak);
    agentApply(s.deckPath, (x) => [{ kind: 'setText', id: leafSpans(x)[0].id, text: 'AGENT' }]);
    await tab.waitFor((e) => e.event === 'disk-changed' && e.data.conflict === true);
    writeFileSync(s.deckPath, original);
    await tab.waitFor((e) => e.event === 'disk-changed' && e.data.conflict === false);
    expect((await s.state()).conflict).toBeNull();
    tab.close();
  });
});

describe('two tabs on one server (Review Focus 5)', () => {
  it('the second op resolves against the post-first document: an insert before X then a text edit of X by key', async () => {
    const s = await start();
    const d = doc(s);
    const spans = leafSpans(d);
    const x = spans[2];
    const xKey = keyed(d, x.id);
    const parentKey = keyed(d, x.parent as number);
    const v = (await s.state()).version;
    const a = await s.post('/api/ops', { ops: [{ kind: 'insertHtml', parent: parentKey, index: 0, html: '<i class="nm-ins">before</i>' }], baseVersion: v, clientId: 'A' });
    const b = await s.post('/api/ops', { ops: [{ kind: 'setText', id: xKey, text: 'TAB-B-TEXT' }], baseVersion: v, clientId: 'B' });
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(b.json().stale).toBe(true);
    await s.post('/api/save', {});
    const final = readDeck(s);
    expect(final).toContain('<i class="nm-ins">before</i>');
    const fd = EditorDocument.fromText(final);
    const hit = fd.doc.nodes.find((n) => final.slice(n.start, n.end).includes('TAB-B-TEXT') && n.tag === 'span');
    expect(hit).toBeDefined();
    expect(final.slice(hit!.start, hit!.startTagEnd)).toBe(d.doc.text.slice(x.start, x.startTagEnd)); // the same element, not a neighbour
  });

  it('an op on an element another tab removed is 409 stale-ref and changes nothing', async () => {
    const s = await start();
    const d = doc(s);
    const spans = leafSpans(d);
    const k = keyed(d, spans[1].id);
    expect((await s.ops([{ kind: 'remove', id: k }])).status).toBe(200);
    const before = readDeck(s);
    const v = (await s.state()).version;
    const r = await s.ops([{ kind: 'setText', id: k, text: 'late' }]);
    expect(r.status).toBe(409);
    expect((await s.state()).version).toBe(v);
    expect(readDeck(s)).toBe(before);
  });
});
