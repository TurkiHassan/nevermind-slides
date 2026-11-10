import { afterEach, describe, expect, it } from 'vitest';
import { cpSync, existsSync, readFileSync, readdirSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { EditorDocument } from '../../src/engine/document.ts';
import { parseSource } from '../../src/engine/source.ts';
import { RefMap } from '../../src/engine/refs.ts';
import { fixturePath } from '../helpers.ts';
import { ATTENTION, MINIMAL, collectEvents, raw, readDeck, startTest, tempDeck, type TestServer } from './helpers.ts';

const servers: TestServer[] = [];
const start = async (rel = MINIMAL, dirName?: string) => {
  const s = await startTest(rel, dirName);
  servers.push(s);
  return s;
};
afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => s.close()));
});

const keyOfTag = async (s: TestServer, tag: string, pick = (_n: any) => true) => {
  const d = EditorDocument.fromText(readDeck(s));
  const n = d.doc.nodes.filter((x) => x.tag === tag && x.patchable).find(pick)!;
  return { key: d.refs.keyOf(n.id), node: n, doc: d };
};

describe('guards (Review Focus 1)', () => {
  it('missing or wrong token: 401 on every kind of route', async () => {
    const s = await start();
    for (const path of ['/', '/preview', '/thumbnail', '/api/state', '/api/outline', '/api/events', '/deck/deck.html']) {
      const r = await raw(s.port, path);
      expect(r.status, path).toBe(401);
      const bad = await raw(s.port, `${path}${path.includes('?') ? '&' : '?'}t=wrong`);
      expect(bad.status, `${path} wrong token`).toBe(401);
    }
    const post = await raw(s.port, '/api/ops', { method: 'POST', body: '{}', headers: { origin: s.origin, 'content-type': 'application/json' } });
    expect(post.status).toBe(401);
  });

  it('a request from another origin to POST /api/ops gets 403 and changes nothing', async () => {
    const s = await start();
    const before = await s.state();
    const { key } = await keyOfTag(s, 'p');
    const body = JSON.stringify({ ops: [{ kind: 'setText', id: key, text: 'HACKED' }], baseVersion: before.version });
    const headers = { 'content-type': 'application/json', 'x-nm-token': s.token };
    for (const origin of ['https://evil.example', 'null', 'http://127.0.0.1:1', 'http://localhost', `http://evil.localhost:${s.port}`]) {
      const r = await raw(s.port, '/api/ops', { method: 'POST', body, headers: { ...headers, origin } });
      expect(r.status, `Origin ${origin}`).toBe(403);
    }
    // No Origin at all (a non-browser caller that did not say who it is) is refused as well.
    expect((await raw(s.port, '/api/ops', { method: 'POST', body, headers })).status).toBe(403);
    // Fetch metadata of a cross-site context, even with a correct Origin header
    expect((await raw(s.port, '/api/ops', { method: 'POST', body, headers: { ...headers, origin: s.origin, 'sec-fetch-site': 'cross-site' } })).status).toBe(403);
    expect((await raw(s.port, '/api/save', { method: 'POST', body: '{}', headers: { ...headers, origin: 'https://evil.example' } })).status).toBe(403);
    const after = await s.state();
    expect(after.version).toBe(before.version);
    expect(after.dirty).toBe(false);
    expect(readDeck(s)).toBe(readFileSync(fixturePath(MINIMAL), 'utf8'));
    // The same request with the right Origin does work (the guard, not the body, was what refused it).
    const ok = await raw(s.port, '/api/ops', { method: 'POST', body, headers: { ...headers, origin: s.origin } });
    expect(ok.status).toBe(200);
    const alt = await raw(s.port, '/api/state', { headers: { origin: `http://localhost:${s.port}`, host: `localhost:${s.port}`, 'x-nm-token': s.token } });
    expect(alt.status).toBe(200);
  });

  it('wrong Host with a valid token and a valid Origin: 403 (DNS rebinding)', async () => {
    const s = await start();
    for (const host of ['evil.example', `evil.example:${s.port}`, '127.0.0.1', `127.0.0.1:${s.port + 1}`, `127.0.0.1.evil.example:${s.port}`]) {
      const get = await raw(s.port, `/api/state?t=${s.token}`, { host });
      expect(get.status, `GET with Host ${host}`).toBe(403);
      const post = await raw(s.port, '/api/save', { method: 'POST', body: '{}', host, headers: { origin: s.origin, 'x-nm-token': s.token, 'content-type': 'application/json' } });
      expect(post.status, `POST with Host ${host}`).toBe(403);
    }
    expect((await raw(s.port, `/api/state?t=${s.token}`, { host: `LOCALHOST:${s.port}` })).status).toBe(200);
  });

  it('path traversal is refused in every spelling and nothing outside the deck directory is served', async () => {
    const s = await start(MINIMAL, 'deck'); // the deck in its own subfolder, so the outside file stays in a private temp dir
    writeFileSync(join(s.dir, '..', 'secret.txt'), 'TOP-SECRET');
    symlinkSync(join(s.dir, '..', 'secret.txt'), join(s.dir, 'link.txt'));
    writeFileSync(join(s.dir, '.env'), 'DOTFILE-SECRET');
    const attempts = [
      '/deck/../package.json', '/deck/..%2Fpackage.json', '/deck/%2e%2e/package.json', '/deck/%2e%2e%2fpackage.json',
      '/deck/..%2f..%2fetc/hosts', '/deck/%2e%2e/%2e%2e/secret.txt', '/deck/..%5csecret.txt', '/deck/a/..%2F..%2Fsecret.txt',
      '/deck/%00', '/deck/deck.html%00.png', '/deck//etc/hosts', '/deck/link.txt', '/deck/.env', '/deck/.nevermind/history', '/deck/%2e%2e%2f%2e%2e%2fsecret.txt',
      '/deck/%C0%AE%C0%AE/secret.txt', '/deck/%ZZ',
    ];
    for (const p of attempts) {
      const r = await raw(s.port, `${p}?t=${s.token}`);
      expect([400, 403, 404], p).toContain(r.status);
      expect(r.body, p).not.toContain('TOP-SECRET');
      expect(r.body, p).not.toContain('DOTFILE-SECRET');
      expect(r.body, p).not.toContain('nevermind-studio');
    }
    const ok = await raw(s.port, `/deck/deck.html?t=${s.token}`);
    expect(ok.status).toBe(200);
  });

  it('the cookie set by the shell opens /deck/ only (no query string, as the preview loads assets), nothing else', async () => {
    const s = await start();
    const shell = await raw(s.port, `/?t=${s.token}`);
    expect(shell.status).toBe(200);
    const cookie = String(shell.headers['set-cookie']);
    expect(cookie).toMatch(new RegExp(`nm_t_${s.port}=`));
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
    const pair = cookie.split(';')[0];
    expect((await raw(s.port, '/deck/deck.html', { headers: { cookie: pair } })).status).toBe(200);
    expect((await raw(s.port, '/api/state', { headers: { cookie: pair } })).status).toBe(401);
    expect((await raw(s.port, '/preview', { headers: { cookie: pair } })).status).toBe(401);
    expect((await raw(s.port, '/thumbnail', { headers: { cookie: pair } })).status).toBe(401);
  });

  it('binds 127.0.0.1 only and uses a random port by default', async () => {
    const a = await start();
    const b = await start();
    expect(a.port).not.toBe(b.port);
    expect(a.url.startsWith(`http://127.0.0.1:${a.port}/?t=`)).toBe(true);
  });

  it('bad bodies: 415 without JSON content type, 400 on invalid JSON, 400 without baseVersion, 413 over the limit', async () => {
    const s = await start();
    const h = { origin: s.origin, 'x-nm-token': s.token };
    expect((await raw(s.port, '/api/ops', { method: 'POST', body: '{}', headers: { ...h, 'content-type': 'text/plain' } })).status).toBe(415);
    expect((await raw(s.port, '/api/ops', { method: 'POST', body: '{nope', headers: { ...h, 'content-type': 'application/json' } })).status).toBe(400);
    expect((await raw(s.port, '/api/ops', { method: 'POST', body: '{"ops":[]}', headers: { ...h, 'content-type': 'application/json' } })).status).toBe(400);
    const big = JSON.stringify({ ops: [], baseVersion: 1, pad: 'x'.repeat(9 * 1024 * 1024) });
    expect((await raw(s.port, '/api/ops', { method: 'POST', body: big, headers: { ...h, 'content-type': 'application/json' } })).status).toBe(413);
  });
});

describe('preview', () => {
  it('serves thumbnails from a distinct frame URL with the same instrumented document', async () => {
    const s = await start();
    const preview = await raw(s.port, `/preview?t=${s.token}`);
    const thumbnail = await raw(s.port, `/thumbnail?t=${s.token}`);
    expect(thumbnail.status).toBe(200);
    expect(thumbnail.body).toBe(preview.body);
  });

  it('has data-nm-key on every patchable body element, the edit layer first in <head>, and is the deck byte for byte otherwise', async () => {
    const s = await start(ATTENTION);
    const r = await raw(s.port, `/preview?t=${s.token}`);
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toMatch(/text\/html/);
    const html = r.body;
    expect(/<head[^>]*><style id="nm-edit-mode-css">/.test(html)).toBe(true);
    expect(html).toContain('<base href="/deck/">');
    const original = readDeck(s);
    const doc = parseSource(original);
    const refs = new RefMap(doc);
    const body = doc.nodes.find((n) => n.tag === 'body')!;
    const inBody = (id: number) => { for (let p: number | null = id; p !== null; p = doc.nodes[p].parent) if (p === body.id) return true; return false; };
    const patchable = doc.nodes.filter((n) => n.patchable && inBody(n.id));
    expect(patchable.length).toBeGreaterThan(500);
    const keysInHtml = new Set([...html.matchAll(/ data-nm-key="([a-z0-9]+)"/g)].map((m) => m[1]));
    expect(keysInHtml.size).toBe(patchable.length);
    // The keys are the engine's keys for this session (the server's first map is the same deterministic one).
    for (const n of patchable) expect(keysInHtml.has(refs.keyOf(n.id)), `key of <${n.tag}>`).toBe(true);
    // Removing what we inserted gives the deck back byte for byte.
    const stripped = html
      .replace(/ data-nm-key="[a-z0-9]+"/g, '')
      .replace(/<style id="nm-edit-mode-css">[\s\S]*?<\/style><script id="nm-edit-mode-js">[\s\S]*?<\/script><meta name="nm-runtime" content="1" data-nm-injected><meta name="nm-version" content="\d+"><base href="\/deck\/">/, '');
    expect(stripped).toBe(original);
  });

  it('serves assets relative to the deck, including a name with Arabic letters and spaces', async () => {
    const s = await start(ATTENTION);
    writeFileSync(join(s.dir, 'assets', 'صورة تجريبية.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
    const png = readdirAsset(s.dir);
    const r = await raw(s.port, `/deck/assets/img/${encodeURIComponent(png)}?t=${s.token}`);
    expect(r.status).toBe(200);
    expect(String(r.headers['content-type'])).toMatch(/^image\//);
    const arabic = await raw(s.port, `/deck/assets/${encodeURIComponent('صورة تجريبية.svg')}?t=${s.token}`);
    expect(arabic.status).toBe(200);
    expect(arabic.headers['content-type']).toBe('image/svg+xml');
    const range = await raw(s.port, `/deck/assets/img/${encodeURIComponent(png)}?t=${s.token}`, { headers: { range: 'bytes=0-9' } });
    expect(range.status).toBe(206);
    expect(range.headers['content-range']).toMatch(/^bytes 0-9\//);
  });
});

function readdirAsset(dir: string): string {
  return readdirSync(join(dir, 'assets', 'img')).find((f) => /\.(png|jpe?g|webp|svg)$/i.test(f))!;
}

describe('a deck under a path with spaces and Arabic letters (Review Focus 4)', () => {
  it('serves, applies ops and saves', async () => {
    const src = fixturePath(ATTENTION);
    const base = tempDeck(MINIMAL, 'منهج الجامعة/عرض الانتباه — نسخة 1').dir;
    cpSync(join(src, '..', 'assets'), join(base, 'assets'), { recursive: true });
    cpSync(src, join(base, 'عرض تقديمي.html'));
    const { startAt } = await import('./helpers.ts');
    const s = await startAt(join(base, 'عرض تقديمي.html'));
    servers.push(s);
    expect(s.deckPath).toContain('منهج الجامعة');
    const preview = await raw(s.port, `/preview?t=${s.token}`);
    expect(preview.status).toBe(200);
    expect(preview.body).toContain('data-nm-key=');
    const asset = readdirAsset(base);
    expect((await raw(s.port, `/deck/assets/img/${encodeURIComponent(asset)}?t=${s.token}`)).status).toBe(200);
    expect((await raw(s.port, `/deck/${encodeURIComponent('عرض تقديمي.html')}?t=${s.token}`)).status).toBe(200);
    const { key } = await keyOfTag({ deckPath: s.deckPath } as TestServer, 'p');
    const r = await s.ops([{ kind: 'setText', id: key, text: 'نص جديد بالعربية' }]);
    expect(r.status).toBe(200);
    expect((await s.post('/api/save', {})).status).toBe(200);
    expect(readFileSync(s.deckPath, 'utf8')).toContain('نص جديد بالعربية');
    expect(existsSync(join(base, '.nevermind', 'history'))).toBe(true);
  });
});

describe('save', () => {
  it('opening and saving with no ops leaves the file byte-identical and its mtime unchanged', async () => {
    const s = await start(ATTENTION);
    const before = readFileSync(s.deckPath);
    const m0 = statSync(s.deckPath).mtimeMs;
    await new Promise((r) => setTimeout(r, 30));
    const r = await s.post('/api/save', {});
    expect(r.status).toBe(200);
    expect(r.json().dirty).toBe(false);
    expect(readFileSync(s.deckPath).equals(before)).toBe(true);
    expect(statSync(s.deckPath).mtimeMs).toBe(m0);
    expect(existsSync(join(s.dir, '.nevermind'))).toBe(false);
  });

  it('ops then save: the file equals the EditorDocument text, and only the touched lines differ', async () => {
    const s = await start(ATTENTION);
    const original = readDeck(s);
    const mirror = EditorDocument.fromText(original);
    const d = parseSource(original);
    const lead = d.nodes.find((n) => n.tag === 'p' && n.patchable)!;
    const slide = d.nodes.find((n) => n.tag === 'section' && n.patchable)!;
    const ops = [
      { kind: 'setText', id: mirror.refs.keyOf(lead.id), text: 'نص معدّل' },
      { kind: 'setAttr', id: mirror.refs.keyOf(slide.id), name: 'data-note', value: 'x' },
      { kind: 'duplicate', id: mirror.refs.keyOf(lead.id) },
    ] as const;
    const r1 = await s.ops([ops[0]]);
    expect(r1.status).toBe(200);
    expect((await s.ops([ops[1]])).status).toBe(200);
    expect((await s.ops([ops[2]])).status).toBe(200);
    mirror.applyKeyed([ops[0]]);
    mirror.applyKeyed([ops[1]]);
    mirror.applyKeyed([ops[2]]);
    expect((await s.state()).dirty).toBe(true);
    const saved = await s.post('/api/save', {});
    expect(saved.status).toBe(200);
    expect(saved.json().dirty).toBe(false);
    expect(readDeck(s)).toBe(mirror.text);
    expect(readDeck(s)).not.toBe(original);
    const st = await s.state();
    expect(st.dirty).toBe(false);
    expect(st.fingerprint).toBe(saved.json().fingerprint);
  });

  it('a second tab edit landing while the save is in flight keeps the document dirty against the new file', async () => {
    const s = await start(ATTENTION);
    const { key } = await keyOfTag(s, 'p');
    const { key: key2 } = await keyOfTag(s, 'span', (n) => n.children.length === 0);
    expect((await s.ops([{ kind: 'setText', id: key, text: 'ZZ-one-ZZ' }])).status).toBe(200);
    const save = s.post('/api/save', {});
    const second = s.ops([{ kind: 'setText', id: key2, text: 'ZZ-two-ZZ' }]);
    const [a, b] = await Promise.all([save, second]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    const st = await s.state();
    const onDisk = readDeck(s);
    expect(onDisk).toContain('ZZ-one-ZZ');
    // dirty iff the second edit is not in the file
    expect(st.dirty).toBe(!onDisk.includes('ZZ-two-ZZ'));
    if (st.dirty) {
      expect((await s.post('/api/save', {})).status).toBe(200);
      expect(readDeck(s)).toContain('ZZ-two-ZZ');
    }
  });
});

describe('POST /api/ops', () => {
  it('returns version, changed, removed, created and a previewPatch of the right kind', async () => {
    const s = await start();
    const leaf = await keyOfTag(s, 'span', (n) => n.children.length === 0);
    const st0 = await s.state();

    // attribute only: patch in place
    const a = (await s.ops([{ kind: 'setAttr', id: leaf.key, name: 'data-q', value: '1' }])).json();
    expect(a.version).toBe(st0.version + 1);
    expect(a.changed).toEqual([leaf.key]);
    expect(a.removed).toEqual([]);
    expect(a.previewPatch).toHaveLength(1);
    expect(a.previewPatch[0]).toMatchObject({ key: leaf.key, attrsOnly: true });
    expect(a.previewPatch[0].outerHTML).toContain(`data-nm-key="${leaf.key}"`);
    expect(a.previewPatch[0].outerHTML).toContain('data-q="1"');

    // text only: the element's outerHTML replaces it
    const t = (await s.ops([{ kind: 'setText', id: leaf.key, text: 'جديد' }])).json();
    expect(t.previewPatch).toHaveLength(1);
    expect(t.previewPatch[0]).toMatchObject({ key: leaf.key, attrsOnly: false });
    expect(t.previewPatch[0].outerHTML).toContain('جديد');

    // structural: reload, and the response names the new element
    const dup = (await s.ops([{ kind: 'duplicate', id: leaf.key }])).json();
    expect(dup.previewPatch).toBe('reload');
    expect(dup.created).toHaveLength(1);
    expect(dup.changed).toContain(dup.created[0]);
    const rm = (await s.ops([{ kind: 'remove', id: dup.created[0] }])).json();
    expect(rm.removed).toEqual([dup.created[0]]);
    expect(rm.previewPatch).toBe('reload');

    // a slide (class change on a section) and a text change under a slide stay in place only when the slide itself is not replaced
    const slide = await keyOfTag(s, 'section');
    const sc = (await s.ops([{ kind: 'setAttr', id: slide.key, name: 'data-s', value: '1' }])).json();
    expect(sc.previewPatch[0]).toMatchObject({ key: slide.key, attrsOnly: true });
  });

  it('patches a multiline setText in place even when it creates a br node', async () => {
    const s = await start();
    const leaf = await keyOfTag(s, 'span', (n) => n.children.length === 0);
    const multiline = (await s.ops([{ kind: 'setText', id: leaf.key, text: 'سطر أول\nسطر ثان' }])).json();

    expect(multiline.previewPatch).toHaveLength(1);
    expect(multiline.previewPatch[0]).toMatchObject({ key: leaf.key, attrsOnly: false });
    expect(multiline.previewPatch[0].outerHTML).toContain('سطر أول<br');
    expect(multiline.previewPatch[0].outerHTML).toContain('سطر ثان');
  });

  it('a stale baseVersion still applies, but the response says stale and forces a reload', async () => {
    const s = await start();
    const { key } = await keyOfTag(s, 'span', (n) => n.children.length === 0);
    const v = (await s.state()).version;
    expect((await s.post('/api/ops', { ops: [{ kind: 'setAttr', id: key, name: 'data-a', value: '1' }], baseVersion: v })).json().stale).toBe(false);
    const r = (await s.post('/api/ops', { ops: [{ kind: 'setAttr', id: key, name: 'data-b', value: '2' }], baseVersion: v })).json();
    expect(r.stale).toBe(true);
    expect(r.previewPatch).toBe('reload');
    expect(r.version).toBe(v + 2);
    const html = (await raw(s.port, `/preview?t=${s.token}`)).body;
    expect(html).toContain('data-a="1"');
    expect(html).toContain('data-b="2"');
  });

  it('errors: an unknown key is 409 stale-ref, an invalid op is 422, nothing changes', async () => {
    const s = await start();
    const v0 = await s.state();
    const a = await s.ops([{ kind: 'remove', id: 'nzzzzz' }]);
    expect(a.status).toBe(409);
    expect(a.json()).toMatchObject({ error: 'stale-ref', key: 'nzzzzz' });
    const { key } = await keyOfTag(s, 'span', (n) => n.children.length === 0);
    const b = await s.ops([{ kind: 'setAttr', id: key, name: '', value: 'x' }]);
    expect(b.status).toBe(422);
    expect(b.json().error).toBe('op-error');
    const c = await s.ops([{ kind: 'nonsense' }]);
    expect(c.status).toBe(422);
    const st = await s.state();
    expect(st.version).toBe(v0.version);
    expect(st.dirty).toBe(false);
  });

  it('undo and redo return the same shape; undo of a removal brings the key back', async () => {
    const s = await start();
    const { key } = await keyOfTag(s, 'p');
    const rm = (await s.ops([{ kind: 'remove', id: key }])).json();
    expect(rm.removed).toContain(key);
    expect((await s.state()).canUndo).toBe(true);
    const un = (await s.post('/api/undo', {})).json();
    expect(un.previewPatch).toBe('reload');
    expect(un.created).toContain(key);
    expect(un.version).toBe(rm.version + 1);
    expect(un.canRedo).toBe(true);
    const out = (await s.get('/api/outline?slide=1&depth=6')).json();
    const keys: string[] = [];
    const walk = (o: any) => { keys.push(o.key); o.children.forEach(walk); };
    walk(out.outline);
    expect(keys).toContain(key);
    const re = (await s.post('/api/redo', {})).json();
    expect(re.removed).toContain(key);
    // text-only undo patches in place
    const leaf = await keyOfTag(s, 'span', (n) => n.children.length === 0);
    await s.ops([{ kind: 'setText', id: leaf.key, text: 'zzz' }]);
    const u2 = (await s.post('/api/undo', {})).json();
    expect(u2.previewPatch).toEqual([expect.objectContaining({ key: leaf.key, attrsOnly: false })]);
    expect((await s.post('/api/undo', {})).json().version).toBeGreaterThan(u2.version);
    expect((await s.post('/api/undo', {})).json()).toMatchObject({ version: expect.any(Number), canUndo: false });
  });
});

describe('state and outline', () => {
  it('GET /api/state has fingerprint, dirty, undo flags, info with keys, and lint', async () => {
    const s = await start(ATTENTION);
    const st = await s.state();
    expect(st).toMatchObject({ dirty: false, canUndo: false, canRedo: false, conflict: null });
    expect(st.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(st.info.slides).toHaveLength(7);
    expect(st.info.slides[0].key).toMatch(/^n[0-9a-z]+$/);
    expect(Array.isArray(st.info.tokens.colors)).toBe(true);
    expect(Array.isArray(st.lint)).toBe(true);
    const o = (await s.get('/api/outline?slide=2&depth=2')).json();
    expect(o.slide).toBe(2);
    expect(o.outline.key).toBe(st.info.slides[1].key);
    expect((await s.get('/api/outline?slide=99')).status).toBe(400);
  });
});

describe('SSE (Review Focus 5, wire level)', () => {
  it('every tab hears each version with its previewPatch; ops from two tabs apply in order', async () => {
    const s = await start();
    const tabA = await collectEvents(s);
    const tabB = await collectEvents(s);
    const { key: k1 } = await keyOfTag(s, 'span', (n) => n.children.length === 0);
    const { key: k2 } = await keyOfTag(s, 'p');
    const v0 = (await s.state()).version;
    const [ra, rb] = await Promise.all([
      s.post('/api/ops', { ops: [{ kind: 'setAttr', id: k1, name: 'data-a', value: 'A' }], baseVersion: v0, clientId: 'A' }),
      s.post('/api/ops', { ops: [{ kind: 'setAttr', id: k2, name: 'data-b', value: 'B' }], baseVersion: v0, clientId: 'B' }),
    ]);
    expect([ra.status, rb.status]).toEqual([200, 200]);
    const versions = [ra.json().version, rb.json().version].sort();
    expect(versions).toEqual([v0 + 1, v0 + 2]);
    for (const tab of [tabA, tabB]) {
      const e1 = await tab.waitFor((e) => e.event === 'version' && e.data.version === v0 + 1);
      const e2 = await tab.waitFor((e) => e.event === 'version' && e.data.version === v0 + 2);
      expect(Array.isArray(e1.data.previewPatch)).toBe(true);
      expect(Array.isArray(e2.data.previewPatch)).toBe(true);
      expect(new Set([e1.data.origin, e2.data.origin])).toEqual(new Set(['A', 'B']));
    }
    const html = (await raw(s.port, `/preview?t=${s.token}`)).body;
    expect(html).toContain('data-a="A"');
    expect(html).toContain('data-b="B"');
    await s.post('/api/save', {});
    await tabA.waitFor((e) => e.event === 'saved');
    tabA.close();
    tabB.close();
  });

  it('lint events arrive after a change that alters the lint result', async () => {
    const s = await start();
    const tab = await collectEvents(s);
    const d = EditorDocument.fromText(readDeck(s));
    const slide = d.doc.nodes.find((n) => n.tag === 'section' && n.patchable)!;
    // an emoji is a lint error in a deck (no emojis)
    await s.ops([{ kind: 'insertHtml', parent: d.refs.keyOf(slide.id), index: 0, html: '<p>\u{1F600} emoji</p>' }]);
    const ev = await tab.waitFor((e) => e.event === 'lint', 5000);
    expect(ev.data.issues.length).toBeGreaterThan(0);
    tab.close();
  });
});

describe('server lifetime', () => {
  it('close() ends open SSE streams and the process can stop', async () => {
    const s = await start();
    const tab = await collectEvents(s);
    await s.close();
    servers.splice(servers.indexOf(s), 1);
    expect(tab.events.length).toBeGreaterThan(0);
  });
});
