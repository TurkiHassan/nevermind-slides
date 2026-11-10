import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { startEditorServer, type RunningServer } from '../../src/server/server.ts';
import { MINIMAL, tempCopyDeck } from '../helpers.ts';
import { raw } from './helpers.ts';

const servers: RunningServer[] = [];
afterEach(async () => Promise.all(servers.splice(0).map((server) => server.close())));

describe('Phase 8 AI API', () => {
  it('previews a selected-element change and rejection leaves no trace in the deck', async () => {
    const copy = tempCopyDeck(MINIMAL);
    const before = readFileSync(copy.path, 'utf8');
    const server = await startEditorServer({
      deckPath: copy.path,
      port: 0,
      open: false,
      agentRunners: {
        text: async ({ selection }) => ({
          summary: 'اختصار العنوان',
          ops: [{ kind: 'setText', id: selection.id, text: 'الخلاصة الموجزة' }],
        }),
      },
    });
    servers.push(server);
    const origin = `http://127.0.0.1:${server.port}`;
    const headers = { origin, 'x-nm-token': server.token, 'content-type': 'application/json' };
    const token = encodeURIComponent(server.token);
    const outline = (await raw(server.port, `/api/outline?slide=3&depth=8&t=${token}`)).json().outline;
    const heading = outline.children.flatMap(function walk(node: any): any[] { return [node, ...node.children.flatMap(walk)]; })
      .find((node: any) => node.tag === 'h2');

    const created = await raw(server.port, '/api/ai/requests', {
      method: 'POST', headers, body: JSON.stringify({ prompt: 'اختصر العنوان', key: heading.key, kind: 'text' }),
    });
    expect(created.status).toBe(202);
    const id = created.json().id;
    let proposal: any;
    for (let attempt = 0; attempt < 20; attempt++) {
      proposal = (await raw(server.port, `/api/ai/requests/${id}?t=${token}`)).json();
      if (proposal.status !== 'running') break;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    expect(proposal).toMatchObject({ id, status: 'ready', summary: 'اختصار العنوان' });
    expect(proposal.diff).toContain('+          <h2 class="reveal d1 text-[64px] text-ink">الخلاصة الموجزة</h2>');

    const rejected = await raw(server.port, `/api/ai/requests/${id}/reject`, { method: 'POST', headers, body: '{}' });
    expect(rejected.status).toBe(200);
    expect(rejected.json().status).toBe('rejected');
    expect(readFileSync(copy.path, 'utf8')).toBe(before);
    const state = (await raw(server.port, `/api/state?t=${token}`)).json();
    expect(state).toMatchObject({ dirty: false, changedLines: 0, canUndo: false });
  });

  it('copies a regenerated image only on accept and Undo restores the source in one step', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'nm-phase8-image-api-'));
    const deckPath = join(dir, 'deck.html');
    const original = '<!doctype html><html><body><section class="slide"><img src="old.png" class="w-full"></section></body></html>\n';
    writeFileSync(deckPath, original);
    writeFileSync(join(dir, 'old.png'), Buffer.from('old'));
    const server = await startEditorServer({
      deckPath, port: 0, open: false,
      agentRunners: {
        text: async () => { throw new Error('not used'); },
        image: async ({ outputPath }) => { writeFileSync(outputPath, Buffer.from('89504e470d0a1a0a00000000', 'hex')); },
      },
    });
    servers.push(server);
    const origin = `http://127.0.0.1:${server.port}`;
    const headers = { origin, 'x-nm-token': server.token, 'content-type': 'application/json' };
    const token = encodeURIComponent(server.token);
    const outline = (await raw(server.port, `/api/outline?slide=1&depth=8&t=${token}`)).json().outline;
    const image = outline.children.flatMap(function walk(node: any): any[] { return [node, ...node.children.flatMap(walk)]; })
      .find((node: any) => node.tag === 'img');
    const created = await raw(server.port, '/api/ai/requests', {
      method: 'POST', headers, body: JSON.stringify({ prompt: 'أنشئ رسمًا تقنيًا', key: image.key, kind: 'image' }),
    });
    const id = created.json().id;
    let proposal: any;
    for (let attempt = 0; attempt < 20; attempt++) {
      proposal = (await raw(server.port, `/api/ai/requests/${id}?t=${token}`)).json();
      if (proposal.status !== 'running') break;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    expect(proposal.status).toBe('ready');
    expect(existsSync(join(dir, 'assets'))).toBe(false);

    const accepted = await raw(server.port, `/api/ai/requests/${id}/accept`, { method: 'POST', headers, body: '{}' });
    expect(accepted.status).toBe(200);
    expect(existsSync(join(dir, 'assets', `ai-${id}.png`))).toBe(true);
    await raw(server.port, '/api/save', { method: 'POST', headers, body: '{}' });
    expect(readFileSync(deckPath, 'utf8')).toContain(`src="assets/ai-${id}.png"`);

    await raw(server.port, '/api/undo', { method: 'POST', headers, body: '{}' });
    await raw(server.port, '/api/save', { method: 'POST', headers, body: '{}' });
    expect(readFileSync(deckPath, 'utf8')).toBe(original);
  });
});
