import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NotesStore } from '../../src/server/notes.ts';
import { MINIMAL, tempCopyDeck } from '../helpers.ts';

describe('NotesStore', () => {
  it('starts empty and durably creates an element note without changing the deck', async () => {
    const { path } = tempCopyDeck(MINIMAL);
    const before = readFileSync(path);
    const store = await NotesStore.open(path);

    expect(store.read()).toEqual({ version: 1, notes: [] });
    const note = await store.create({
      text: '  غيّر صياغة العنوان  ',
      target: {
        kind: 'element',
        key: 'n1',
        slide: 1,
        slideTitle: 'البداية',
        tag: 'h1',
        role: 'العنوان الرئيس',
        text: 'عنوان قديم',
        classes: ['text-6xl', 'font-bold'],
      },
    });

    expect(note.text).toBe('غيّر صياغة العنوان');
    expect(note.status).toBe('open');
    expect(note.id).toMatch(/^note_[a-z0-9-]+$/);
    expect(store.read()).toEqual({ version: 1, notes: [note] });
    expect(JSON.parse(readFileSync(store.notesPath, 'utf8'))).toEqual(store.read());
    expect(readFileSync(path).equals(before)).toBe(true);
    store.close();
  });

  it('accepts only bounded plain text and in-stage area rectangles', async () => {
    const { path } = tempCopyDeck(MINIMAL);
    const store = await NotesStore.open(path);
    const note = await store.create({
      text: 'استبدل الرسم هنا',
      target: { kind: 'area', slide: 2, rect: { x: 40, y: 50, width: 320, height: 180 } },
    });
    expect(note.target).toEqual({ kind: 'area', slide: 2, rect: { x: 40, y: 50, width: 320, height: 180 } });

    await expect(store.create({
      text: 'خارج المسرح',
      target: { kind: 'area', slide: 1, rect: { x: 1900, y: 1000, width: 40, height: 90 } },
    })).rejects.toThrow(/1920.*1080/);
    await expect(store.create({ text: '   ', target: note.target })).rejects.toThrow(/1.*4000/);
    await expect(store.create({ text: 'x'.repeat(4001), target: note.target })).rejects.toThrow(/1.*4000/);
    expect(store.read().notes).toHaveLength(1);
    store.close();
  });

  it('retains completed notes, makes repeated done idempotent, and rejects unknown ids', async () => {
    const { path } = tempCopyDeck(MINIMAL);
    const store = await NotesStore.open(path);
    const created = await store.create({
      text: 'عدّل التباين',
      target: { kind: 'area', slide: 1, rect: { x: 0, y: 0, width: 100, height: 100 } },
    });
    const done = await store.done(created.id);
    expect(done.status).toBe('done');
    expect(done.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(await store.done(created.id)).toEqual(done);
    expect(store.read().notes).toEqual([done]);
    await expect(store.done('note_missing')).rejects.toThrow(/unknown note/i);
    store.close();
  });

  it('reports malformed existing metadata and never overwrites it', async () => {
    const { path } = tempCopyDeck(MINIMAL);
    const notesPath = `${dirname(path)}/.nevermind/notes.json`;
    mkdirSync(dirname(notesPath), { recursive: true });
    writeFileSync(notesPath, '{"version":1,"notes":[');
    const before = readFileSync(notesPath);

    await expect(NotesStore.open(path)).rejects.toThrow(/malformed notes/i);
    expect(readFileSync(notesPath).equals(before)).toBe(true);
  });

  it('writes current.json with server-owned deck context', async () => {
    const { path } = tempCopyDeck(MINIMAL);
    const store = await NotesStore.open(path);
    const selection = {
      kind: 'element' as const,
      key: 'n4',
      slide: 2,
      tag: 'p',
      role: 'نص',
      text: 'فقرة',
      classes: ['text-xl'],
    };
    const current = await store.writeCurrent({ fingerprint: 'abc123', slide: 2, selection });

    expect(current).toMatchObject({ version: 1, deck: path, fingerprint: 'abc123', slide: 2, selection });
    expect(current.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(JSON.parse(readFileSync(store.currentPath, 'utf8'))).toEqual(current);
    store.close();
  });
});
