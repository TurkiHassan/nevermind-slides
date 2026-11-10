import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { EditorDocument } from '../../src/engine/document.ts';
import { NotesStore } from '../../src/server/notes.ts';
import { collectEvents, readDeck, startTest, type TestServer } from './helpers.ts';

const servers: TestServer[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map((server) => server.close())); });

describe('notes HTTP API', () => {
  it('derives element context from the live session and exposes notes in state', async () => {
    const server = await startTest();
    servers.push(server);
    const doc = EditorDocument.fromText(readDeck(server));
    const heading = doc.doc.query({ tag: 'h1' })[0];
    const key = doc.refs.keyOf(heading.id);

    expect((await server.get('/api/notes')).json()).toEqual({ version: 1, notes: [] });
    const response = await server.post('/api/notes', {
      text: 'اجعل العنوان أكثر مباشرة',
      target: { kind: 'element', key, slide: 999, role: 'مزور' },
    });

    expect(response.status).toBe(201);
    const { note, notes } = response.json();
    expect(note.target).toMatchObject({ kind: 'element', key, slide: 1, tag: 'h1', role: 'العنوان الرئيس' });
    expect(note.target.role).not.toBe('مزور');
    expect(note.target.text).toBe('الانتباه هو كل ما تحتاجه');
    expect(note.target.classes).toContain('text-ink');
    expect(notes.notes).toEqual([note]);
    expect((await server.get('/api/notes')).json()).toEqual(notes);
    expect((await server.state()).notes).toEqual(notes);
  });

  it('creates area notes, persists server-owned current context, and completes notes', async () => {
    const server = await startTest();
    servers.push(server);
    const doc = EditorDocument.fromText(readDeck(server));
    const paragraph = doc.doc.query({ attr: 'id=lede' })[0];
    const key = doc.refs.keyOf(paragraph.id);

    const made = await server.post('/api/notes', {
      text: 'راجع هذه المنطقة',
      target: { kind: 'area', slide: 1, rect: { x: 200, y: 300, width: 400, height: 200 } },
    });
    expect(made.status).toBe(201);
    const note = made.json().note;
    expect(note.target).toMatchObject({ kind: 'area', slide: 1, slideTitle: 'الانتباه هو كل ما تحتاجه' });

    const currentResponse = await server.post('/api/current', { slide: 1, key, fingerprint: 'client-lie' });
    expect(currentResponse.status).toBe(200);
    const current = currentResponse.json();
    expect(current.fingerprint).toBe((await server.state()).fingerprint);
    expect(current.fingerprint).not.toBe('client-lie');
    expect(current.selection).toMatchObject({ kind: 'element', key, slide: 1, tag: 'p', role: 'نص' });
    expect(JSON.parse(readFileSync(join(server.dir, '.nevermind', 'current.json'), 'utf8'))).toEqual(current);

    const completed = await server.post('/api/notes/done', { id: note.id });
    expect(completed.status).toBe(200);
    expect(completed.json().note.status).toBe('done');
    expect(completed.json().notes.notes).toHaveLength(1);
  });

  it('broadcasts editor and external note changes without a deck version event', async () => {
    const server = await startTest();
    servers.push(server);
    const stream = await collectEvents(server);
    const beforeVersion = (await server.state()).version;

    const made = await server.post('/api/notes', {
      text: 'نفّذ هذا التعديل',
      target: { kind: 'area', slide: 1, rect: { x: 20, y: 20, width: 100, height: 80 } },
    });
    const id = made.json().note.id as string;
    const editorEvent = await stream.waitFor((event) => event.event === 'notes' && event.data.source === 'editor');
    expect(editorEvent.data.notes.notes[0].id).toBe(id);

    const external = await NotesStore.open(server.deckPath);
    await external.done(id);
    external.close();
    const externalEvent = await stream.waitFor((event) => event.event === 'notes' && event.data.source === 'external', 5000);
    expect(externalEvent.data.notes.notes[0].status).toBe('done');
    expect((await server.state()).version).toBe(beforeVersion);
    stream.close();
  });
});
