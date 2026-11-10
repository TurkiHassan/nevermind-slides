import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync, writeFileSync, utimesSync, existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConflictError, historyDir, listSnapshots, loadDeck, restoreLatestSnapshot, saveDeck, SNAPSHOT_LIMIT } from '../../src/engine/file-store.ts';
import { EditorDocument } from '../../src/engine/document.ts';
import { ATTENTION, MINIMAL, fixturePath, tempCopyDeck } from '../helpers.ts';

const haveAttention = existsSync(fixturePath(ATTENTION));

describe('file store', () => {
  it('no-op save leaves bytes and mtime untouched and returns the same fingerprint', async () => {
    const { path } = tempCopyDeck(MINIMAL);
    const old = new Date('2020-01-01T00:00:00Z');
    utimesSync(path, old, old);
    const before = readFileSync(path);
    const file = await loadDeck(path);
    const saved = await saveDeck(file, file.text);
    expect(saved).toBe(file);
    expect(readFileSync(path).equals(before)).toBe(true);
    expect(statSync(path).mtimeMs).toBe(old.getTime());
    expect(existsSync(historyDir(path))).toBe(false);
  });

  (haveAttention ? it : it.skip)('open and save with no operation is byte-identical (real deck, through EditorDocument)', async () => {
    const { path } = tempCopyDeck(ATTENTION);
    const before = readFileSync(path);
    const file = await loadDeck(path);
    const ed = EditorDocument.fromText(file.text);
    await saveDeck(file, ed.text);
    expect(readFileSync(path).equals(before)).toBe(true);
  });

  it('save then reload equals the saved text; fingerprint is sha256 of the bytes', async () => {
    const { path } = tempCopyDeck(MINIMAL);
    const file = await loadDeck(path);
    const next = file.text.replace('الخلاصة', 'الخلاصة الجديدة');
    const saved = await saveDeck(file, next);
    const reloaded = await loadDeck(path);
    expect(reloaded.text).toBe(next);
    expect(reloaded.fingerprint).toBe(saved.fingerprint);
    expect(saved.fingerprint).not.toBe(file.fingerprint);
    expect(readdirSync(join(path, '..')).filter((n) => n.includes('nm-tmp'))).toEqual([]);
  });

  it('Review Focus 4: a file changed on disk since load is never overwritten', async () => {
    const { path } = tempCopyDeck(MINIMAL);
    const file = await loadDeck(path);
    const agentText = file.text.replace('الخلاصة', 'تعديل وكيل');
    writeFileSync(path, agentText);
    let err: unknown;
    try {
      await saveDeck(file, file.text.replace('الخلاصة', 'تعديلي'));
    } catch (e) { err = e; }
    expect(err).toBeInstanceOf(ConflictError);
    expect((err as ConflictError).message).toMatch(/changed on disk/);
    expect((err as ConflictError).diskFingerprint).toBe((await loadDeck(path)).fingerprint);
    expect(readFileSync(path, 'utf8')).toBe(agentText);
    expect(await listSnapshots(path)).toEqual([]);
  });

  it('snapshot of the previous disk content is created on save and capped at 30', async () => {
    const { path } = tempCopyDeck(MINIMAL);
    let file = await loadDeck(path);
    const original = file.text;
    file = await saveDeck(file, original + '\n<!-- 0 -->');
    const snaps = await listSnapshots(path);
    expect(snaps).toHaveLength(1);
    expect(readFileSync(snaps[0].path, 'utf8')).toBe(original);
    for (let i = 1; i <= SNAPSHOT_LIMIT + 5; i++) file = await saveDeck(file, original + `\n<!-- ${i} -->`);
    const after = await listSnapshots(path);
    expect(after).toHaveLength(SNAPSHOT_LIMIT);
    // the newest snapshot holds the content before the last save
    expect(readFileSync(after[after.length - 1].path, 'utf8')).toBe(original + `\n<!-- ${SNAPSHOT_LIMIT + 4} -->`);
    const names = after.map((s) => s.name);
    expect([...names].sort()).toEqual(names);
  });

  it('snapshot: false writes no snapshot', async () => {
    const { path } = tempCopyDeck(MINIMAL);
    const file = await loadDeck(path);
    await saveDeck(file, file.text + ' ', { snapshot: false });
    expect(await listSnapshots(path)).toEqual([]);
  });

  it('BOM preserved exactly as loaded', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'nm-studio-bom-'));
    const withBom = join(dir, 'a.html');
    const noBom = join(dir, 'b.html');
    writeFileSync(withBom, '﻿<p>x</p>');
    writeFileSync(noBom, '<p>x</p>');
    const a = await loadDeck(withBom);
    expect(a.text.charCodeAt(0)).toBe(0xfeff);
    await saveDeck(a, '﻿<p>y</p>');
    expect([...readFileSync(withBom).subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const a2 = await loadDeck(withBom);
    await saveDeck(a2, '<p>z</p>'); // text without the BOM: the BOM is kept anyway
    expect(readFileSync(withBom, 'utf8')).toBe('﻿<p>z</p>');
    const b = await loadDeck(noBom);
    await saveDeck(b, '﻿<p>y</p>');
    expect(readFileSync(noBom, 'utf8')).toBe('<p>y</p>');
  });

  it('refuses to load invalid UTF-8', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'nm-studio-utf8-'));
    const p = join(dir, 'bad.html');
    writeFileSync(p, Buffer.from([0x3c, 0x70, 0x3e, 0xff, 0x3c]));
    await expect(loadDeck(p)).rejects.toThrow(/not valid UTF-8/);
  });

  it('restoreLatestSnapshot steps back one save at a time and snapshots first', async () => {
    const { path } = tempCopyDeck(MINIMAL);
    const v0 = readFileSync(path, 'utf8');
    let file = await loadDeck(path);
    file = await saveDeck(file, v0 + '<!-- 1 -->');
    file = await saveDeck(file, v0 + '<!-- 2 -->');
    expect((await restoreLatestSnapshot(path))!.file.text).toBe(v0 + '<!-- 1 -->');
    expect(readFileSync(path, 'utf8')).toBe(v0 + '<!-- 1 -->');
    expect((await listSnapshots(path)).filter((s) => s.preUndo)).toHaveLength(1);
    await restoreLatestSnapshot(path);
    expect(readFileSync(path, 'utf8')).toBe(v0);
    expect(await restoreLatestSnapshot(path)).toBeNull();
  });
});
