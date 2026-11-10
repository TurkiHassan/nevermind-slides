import { beforeAll, describe, expect, it } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MINIMAL, ROOT, tempCopyDeck } from './helpers.ts';
import { ATTENTION } from './helpers.ts';

const BUNDLE = join(ROOT, 'dist', 'nm-studio.mjs');
let lone: string; // the bundle copied alone into an empty temp directory: no node_modules anywhere above it

beforeAll(() => {
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', 'build.mjs')], { encoding: 'utf8' });
  expect(r.status, r.stderr).toBe(0);
  expect(r.stdout).toMatch(/nm-studio\.mjs [\d.]+ KB/);
  const dir = mkdtempSync(join(tmpdir(), 'nm-studio-bundle-'));
  lone = join(dir, 'nm-studio.mjs');
  copyFileSync(BUNDLE, lone);
}, 120_000);

describe('npm run build', () => {
  it('produces one file under 1.5 MB with no import of anything outside node:', () => {
    expect(statSync(BUNDLE).size).toBeLessThan(1.5 * 1024 * 1024);
    const text = readFileSync(BUNDLE, 'utf8');
    expect(text.startsWith('#!/usr/bin/env node')).toBe(true);
    const imports = [...text.matchAll(/^import .* from ["']([^"']+)["']/gm)].map((m) => m[1]);
    expect(imports.length).toBeGreaterThan(0);
    for (const i of imports) expect(i.startsWith('node:'), i).toBe(true);
    // the edit layer and the shell are inside the file
    expect(text).toContain('nm-edit-mode');
    expect(text).toContain('Nevermind Studio');
  });

  it('inspect runs under plain node from a lone copy, with no node_modules', () => {
    const { path } = tempCopyDeck(MINIMAL);
    const r = spawnSync(process.execPath, [lone, 'inspect', path, '--slide', '1'], { encoding: 'utf8', cwd: join(lone, '..') });
    expect(r.status, r.stderr).toBe(0);
    const info = JSON.parse(r.stdout);
    expect(info.slides.length).toBeGreaterThan(0);
    expect(info.outline.tag).toBe('section');
  });

  it('prints usage for an unknown command and rejects a bad --port', () => {
    const { path } = tempCopyDeck(MINIMAL);
    expect(spawnSync(process.execPath, [lone, 'frobnicate', path], { encoding: 'utf8' }).status).toBe(1);
    const r = spawnSync(process.execPath, [lone, 'edit', path, '--no-open', '--port', '99999'], { encoding: 'utf8' });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/--port/);
  });
});

function get(port: number, path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, headers: { host: `127.0.0.1:${port}` } }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

describe('nm-studio edit (from the lone bundle)', () => {
  it('starts, serves state and a preview with the inlined edit layer, and stops on SIGINT even with an event stream open', async () => {
    const { path } = tempCopyDeck(ATTENTION);
    const child = spawn(process.execPath, [lone, 'edit', path, '--no-open', '--port', '0'], { cwd: join(lone, '..'), stdio: ['ignore', 'pipe', 'pipe'] });
    const exited = new Promise<{ code: number | null; signal: string | null }>((ok) => child.on('exit', (code, signal) => ok({ code, signal })));
    let stdout = '';
    let stderr = '';
    child.stderr.on('data', (c) => (stderr += c));
    const first = await new Promise<string>((ok, fail) => {
      const t = setTimeout(() => fail(new Error(`no startup line; stderr: ${stderr}`)), 15_000);
      child.stdout.on('data', (c) => {
        stdout += c;
        const i = stdout.indexOf('\n{');
        const end = stdout.indexOf('\n}');
        if (end > 0 || (stdout.startsWith('{') && i < 0 && stdout.includes('}\n'))) { clearTimeout(t); ok(stdout); }
      });
    });
    const info = JSON.parse(first);
    expect(info.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/\?t=[\w-]+$/);
    const url = new URL(info.url);
    const port = Number(url.port);
    const t = url.searchParams.get('t')!;
    const st = await get(port, `/api/state?t=${t}`);
    expect(st.status).toBe(200);
    expect(JSON.parse(st.body).info.slides).toHaveLength(7);
    const pv = await get(port, `/preview?t=${t}`);
    expect(pv.status).toBe(200);
    expect(pv.body).toContain('id="nm-edit-mode-js"');
    expect(pv.body).toContain('window.__nm');
    expect(pv.body).toContain('data-nm-key=');
    expect((await get(port, `/?t=${t}`)).body).toContain('Nevermind Studio');
    expect((await get(port, '/api/state')).status).toBe(401);
    // hold an event stream open: shutdown must not wait for it
    const sse = request({ host: '127.0.0.1', port, path: `/api/events?t=${t}`, headers: { host: `127.0.0.1:${port}` } }, (res) => { res.resume(); });
    sse.on('error', () => {});
    sse.end();
    await new Promise((r) => setTimeout(r, 200));
    const t0 = Date.now();
    child.kill('SIGINT');
    const res = await exited;
    expect(res.code).toBe(0);
    expect(Date.now() - t0).toBeLessThan(3000);
    await expect(get(port, '/')).rejects.toThrow();
  }, 60_000);

  it('a missing deck is a clear error, not a hang', () => {
    const r = spawnSync(process.execPath, [lone, 'edit', join(tmpdir(), 'no-such-deck.html'), '--no-open'], { encoding: 'utf8', timeout: 10_000 });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/nm-studio:/);
  });

  const onUnix = process.platform === 'darwin' || process.platform === 'linux';
  const opener = process.platform === 'darwin' ? 'open' : 'xdg-open';

  async function runEdit(env: NodeJS.ProcessEnv): Promise<{ child: ReturnType<typeof spawn>; url: string }> {
    const { path } = tempCopyDeck(MINIMAL);
    const child = spawn(process.execPath, [lone, 'edit', path], { cwd: join(lone, '..'), env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    const url = await new Promise<string>((ok, fail) => {
      const t = setTimeout(() => fail(new Error('edit did not start')), 15_000);
      child.stdout!.on('data', (c) => { out += c; const m = /"url": "([^"]+)"/.exec(out); if (m) { clearTimeout(t); ok(m[1]); } });
      child.on('exit', (code) => fail(new Error(`edit exited early with ${code}`)));
    });
    return { child, url };
  }

  (onUnix ? it : it.skip)('without --no-open it hands the URL to the system opener (a fake one on PATH records it)', async () => {
    const bin = mkdtempSync(join(tmpdir(), 'nm-fake-open-'));
    const log = join(bin, 'opened.txt');
    writeFileSync(join(bin, opener), `#!/bin/sh\necho "$1" > "${log}"\n`);
    chmodSync(join(bin, opener), 0o755);
    const { child, url } = await runEdit({ ...process.env, PATH: bin });
    for (let i = 0; i < 100 && !existsSync(log); i++) await new Promise((r) => setTimeout(r, 50));
    expect(readFileSync(log, 'utf8').trim()).toBe(url);
    child.kill('SIGINT');
    await new Promise((r) => child.on('exit', r));
  }, 30_000);

  (onUnix ? it : it.skip)('with no opener on PATH the server still starts and serves (the launch failure is swallowed)', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'nm-empty-path-'));
    mkdirSync(join(empty, 'x'));
    const { child, url } = await runEdit({ ...process.env, PATH: join(empty, 'x') });
    const u = new URL(url);
    const r = await get(Number(u.port), `/api/state?t=${u.searchParams.get('t')}`);
    expect(r.status).toBe(200);
    await new Promise((r) => setTimeout(r, 300)); // give a late spawn 'error' event time to (not) kill the process
    expect(child.exitCode).toBeNull();
    child.kill('SIGINT');
    expect(await new Promise((r) => child.on('exit', r))).toBe(0);
  }, 30_000);

  it('exists', () => {
    expect(existsSync(lone)).toBe(true);
  });
});
