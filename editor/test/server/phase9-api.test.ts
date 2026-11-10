import { afterEach, describe, expect, it } from 'vitest';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CaptureDriver } from '../../src/export/chromium.ts';
import { startEditorServer, type RunningServer } from '../../src/server/server.ts';
import { contentDisposition } from '../../src/server/exports.ts';
import { MINIMAL, fixturePath } from '../helpers.ts';
import { raw } from './helpers.ts';

const servers: RunningServer[] = [];
afterEach(async () => Promise.all(servers.splice(0).map((s) => s.close())));

const fakeDriver = (closed: { n: number } = { n: 0 }): CaptureDriver => ({
  async pdf(_p, out) { writeFileSync(out, '%PDF-fake'); },
  async png(_p, _h, out) { writeFileSync(out, Buffer.from([0x89, 0x50, 0x4e, 0x47])); },
  async geometry() { return []; },
  async close() { closed.n++; },
});

async function boot(name = 'deck.html', driver = fakeDriver()) {
  const dir = mkdtempSync(join(tmpdir(), 'nm-phase9-api-'));
  const deckPath = join(dir, name);
  cpSync(fixturePath(MINIMAL), deckPath);
  const server = await startEditorServer({ deckPath, port: 0, open: false, exportDriver: driver });
  servers.push(server);
  const origin = `http://127.0.0.1:${server.port}`;
  const headers = { origin, 'x-nm-token': server.token, 'content-type': 'application/json' };
  const t = encodeURIComponent(server.token);
  const poll = async (id: string) => {
    for (let i = 0; i < 100; i++) {
      const job = (await raw(server.port, `/api/exports/${id}?t=${t}`)).json();
      if (job.status !== 'running') return job;
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error('export did not finish');
  };
  return { server, deckPath, headers, t, poll, create: (body: unknown) => raw(server.port, '/api/exports', { method: 'POST', headers, body: JSON.stringify(body) }) };
}

describe('Phase 9 export API', () => {
  it('creates, polls and downloads a PDF without changing the deck or the session', async () => {
    const b = await boot();
    const before = readFileSync(b.deckPath, 'utf8');
    const created = await b.create({ format: 'pdf' });
    expect(created.status).toBe(202);
    const job = await b.poll(created.json().id);
    expect(job).toMatchObject({ status: 'ready', format: 'pdf', filename: 'deck.pdf', experimental: false });
    const file = await raw(b.server.port, `/api/exports/${job.id}/download?t=${b.t}`);
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toBe('application/pdf');
    expect(file.headers['content-disposition']).toContain('deck.pdf');
    expect(file.body).toBe('%PDF-fake');
    expect(readFileSync(b.deckPath, 'utf8')).toBe(before);
    expect(await raw(b.server.port, `/api/state?t=${b.t}`).then((r) => r.json())).toMatchObject({ dirty: false, canUndo: false });
  });

  it('exports unsaved editor text, and names an Arabic deck with an RFC 5987 filename', async () => {
    const b = await boot('عرض تجريبي.html');
    const state = (await raw(b.server.port, `/api/state?t=${b.t}`)).json();
    const slide = (await raw(b.server.port, `/api/outline?slide=1&depth=8&t=${b.t}`)).json().outline;
    const heading = (function find(n: any): any { return /^h[1-6]$/.test(n.tag) ? n : n.children.map(find).find(Boolean); })(slide);
    const ops = await raw(b.server.port, '/api/ops', { method: 'POST', headers: b.headers, body: JSON.stringify({ ops: [{ kind: 'setText', id: heading.key, text: 'نص غير محفوظ' }], baseVersion: state.version }) });
    expect(ops.status).toBe(200);
    const job = await b.poll((await b.create({ format: 'html' })).json().id);
    expect(job.filename).toBe('عرض تجريبي.html');
    const file = await raw(b.server.port, `/api/exports/${job.id}/download?t=${b.t}`);
    expect(file.body).toContain('نص غير محفوظ');
    expect(file.headers['content-disposition']).toContain("filename*=UTF-8''%D8%B9%D8%B1%D8%B6");
    expect(file.headers['content-disposition']).toMatch(/filename="[\x20-\x7e]+"/);
  });

  it('rejects bad formats and unauthenticated requests, and reports failures as a failed job', async () => {
    const b = await boot();
    expect((await b.create({ format: 'docx' })).status).toBe(400);
    expect((await raw(b.server.port, '/api/exports', { method: 'POST', headers: { origin: `http://127.0.0.1:${b.server.port}`, 'content-type': 'application/json' }, body: '{"format":"pdf"}' })).status).toBe(401);
    expect((await raw(b.server.port, `/api/exports/ex-nope?t=${b.t}`)).status).toBe(404);
    const dir = mkdtempSync(join(tmpdir(), 'nm-phase9-api-'));
    const deckPath = join(dir, 'deck.html');
    writeFileSync(deckPath, '<html><body><section class="slide"><img src="missing.png"></section></body></html>');
    const server = await startEditorServer({ deckPath, port: 0, open: false, exportDriver: fakeDriver() });
    servers.push(server);
    const headers = { origin: `http://127.0.0.1:${server.port}`, 'x-nm-token': server.token, 'content-type': 'application/json' };
    const id = (await raw(server.port, '/api/exports', { method: 'POST', headers, body: '{"format":"html"}' })).json().id;
    let job: any;
    for (let i = 0; i < 100 && (!job || job.status === 'running'); i++) { await new Promise((r) => setTimeout(r, 10)); job = (await raw(server.port, `/api/exports/${id}?t=${encodeURIComponent(server.token)}`)).json(); }
    expect(job).toMatchObject({ status: 'failed', errorCode: 'missing-asset' });
    expect((await raw(server.port, `/api/exports/${id}/download?t=${encodeURIComponent(server.token)}`)).status).toBe(409);
  });

  it('closes the capture driver with the server', async () => {
    const closed = { n: 0 };
    const b = await boot('deck.html', fakeDriver(closed));
    await b.server.close();
    servers.length = 0;
    expect(closed.n).toBe(1);
  });
});

describe('contentDisposition', () => {
  it('never emits non-latin1 characters or quotes in the plain filename', () => {
    const value = contentDisposition('عرض "x".pdf');
    expect(value).not.toMatch(/[^\x20-\x7e]/);
    expect(value).toContain("filename*=UTF-8''");
  });
});
