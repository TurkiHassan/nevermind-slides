import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { startTest, type TestServer } from './helpers.ts';

const PNG_1X1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const servers: TestServer[] = [];
afterEach(async () => Promise.all(servers.splice(0).map((server) => server.close())));

describe('Phase 6 server API', () => {
  it('serves the stable layout catalog and a source-backed slide fragment', async () => {
    const server = await startTest();
    servers.push(server);
    const catalog = await server.get('/api/layout-presets');
    expect(catalog.status).toBe(200);
    expect(catalog.json().presets).toHaveLength(23);
    const preset = await server.get('/api/layout-preset?id=opening%2Foffset-marquee');
    expect(preset.status).toBe(200);
    expect(preset.json().html).toMatch(/^<section class="slide /);
    expect(preset.json().html).not.toMatch(/\bactive\b/);
    expect((await server.get('/api/layout-preset?id=..%2F..%2Fsecret')).status).toBe(404);
  });

  it('uploads an authenticated image to assets and rejects unsupported content', async () => {
    const server = await startTest();
    servers.push(server);
    const uploaded = await server.post('/api/assets', { name: 'hero.png', type: 'image/png', data: PNG_1X1 });
    expect(uploaded.status).toBe(201);
    expect(uploaded.json().path).toBe('assets/hero.png');
    expect(existsSync(join(server.dir, 'assets', 'hero.png'))).toBe(true);
    expect(readFileSync(join(server.dir, 'assets', 'hero.png')).subarray(1, 4).toString()).toBe('PNG');
    expect((await server.post('/api/assets', { name: 'bad.txt', type: 'text/plain', data: 'eA==' })).status).toBe(415);
  });
});
