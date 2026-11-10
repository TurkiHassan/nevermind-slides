// Shared by the server tests: a server on a temp copy of a deck, raw HTTP (so spoofed Host/Origin really reach the
// wire), and a small SSE collector.
import { cpSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { request, type IncomingHttpHeaders } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { startEditorServer, type RunningServer, type ServerOptions } from '../../src/server/server.ts';
import { ATTENTION, MINIMAL, fixturePath } from '../helpers.ts';

export interface Raw { status: number; headers: IncomingHttpHeaders; body: string; json: () => any }

export interface RawOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Buffer;
  /** Defaults to 127.0.0.1:<port>. */
  host?: string;
}

export function raw(port: number, path: string, o: RawOptions = {}): Promise<Raw> {
  return new Promise((resolve, reject) => {
    const req = request({
      host: '127.0.0.1', port, path, method: o.method ?? 'GET',
      headers: { host: o.host ?? `127.0.0.1:${port}`, ...(o.headers ?? {}) },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode ?? 0, headers: res.headers, body, json: () => JSON.parse(body) });
      });
    });
    req.on('error', reject);
    if (o.body !== undefined) req.write(o.body);
    req.end();
  });
}

export interface TestServer extends RunningServer {
  dir: string;
  deckPath: string;
  origin: string;
  get(path: string, headers?: Record<string, string>): Promise<Raw>;
  post(path: string, body: unknown, headers?: Record<string, string>): Promise<Raw>;
  ops(ops: unknown[], extra?: Record<string, unknown>): Promise<Raw>;
  state(): Promise<any>;
}

export function tempDeck(rel = MINIMAL, dirName?: string): { dir: string; deckPath: string } {
  const base = mkdtempSync(join(tmpdir(), 'nm-studio-srv-'));
  const dir = dirName ? join(base, dirName) : base;
  mkdirSync(dir, { recursive: true });
  const src = fixturePath(rel);
  if (rel.startsWith('real/')) {
    cpSync(dirname(src), dir, { recursive: true });
    return { dir, deckPath: join(dir, 'deck.html') };
  }
  cpSync(src, join(dir, 'deck.html'));
  return { dir, deckPath: join(dir, 'deck.html') };
}

export async function startTest(rel = MINIMAL, dirName?: string, options: Omit<ServerOptions, 'deckPath' | 'port' | 'open'> = {}): Promise<TestServer> {
  const { dir, deckPath } = tempDeck(rel, dirName);
  return startAt(deckPath, dir, options);
}

export async function startAt(deckPath: string, dir = dirname(deckPath), options: Omit<ServerOptions, 'deckPath' | 'port' | 'open'> = {}): Promise<TestServer> {
  const s = await startEditorServer({ deckPath, port: 0, open: false, ...options });
  const origin = `http://127.0.0.1:${s.port}`;
  const t = encodeURIComponent(s.token);
  const jsonHeaders = { 'content-type': 'application/json', origin, 'x-nm-token': s.token };
  const withT = (path: string) => path + (path.includes('?') ? '&' : '?') + 't=' + t;
  return {
    ...s,
    dir, deckPath, origin,
    get: (path, headers) => raw(s.port, withT(path), { headers }),
    post: (path, body, headers) => raw(s.port, path, { method: 'POST', body: JSON.stringify(body), headers: { ...jsonHeaders, ...headers } }),
    async ops(ops, extra) {
      const version = (await raw(s.port, withT('/api/state'))).json().version;
      return raw(s.port, '/api/ops', { method: 'POST', body: JSON.stringify({ ops, baseVersion: version, ...(extra ?? {}) }), headers: jsonHeaders });
    },
    async state() {
      return (await raw(s.port, withT('/api/state'))).json();
    },
  } as TestServer;
}

export const readDeck = (s: { deckPath: string }) => readFileSync(s.deckPath, 'utf8');
export { ATTENTION, MINIMAL };

export interface SseEvent { event: string; data: any }

/** Collect SSE events from /api/events until close(). */
export function collectEvents(s: { port: number; token: string }): Promise<{ events: SseEvent[]; waitFor(pred: (e: SseEvent) => boolean, ms?: number): Promise<SseEvent>; close(): void }> {
  return new Promise((resolve, reject) => {
    const events: SseEvent[] = [];
    const waiters: { pred: (e: SseEvent) => boolean; ok: (e: SseEvent) => void }[] = [];
    const req = request({ host: '127.0.0.1', port: s.port, path: `/api/events?t=${encodeURIComponent(s.token)}`, headers: { host: `127.0.0.1:${s.port}` } }, (res) => {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => {
        buf += chunk;
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const frame = buf.slice(0, i);
          buf = buf.slice(i + 2);
          const ev = /^event: (.*)$/m.exec(frame);
          const data = /^data: (.*)$/m.exec(frame);
          if (!ev || !data) continue;
          const e = { event: ev[1], data: JSON.parse(data[1]) };
          events.push(e);
          for (const w of [...waiters]) if (w.pred(e)) { waiters.splice(waiters.indexOf(w), 1); w.ok(e); }
        }
      });
      const api = {
        events,
        waitFor(pred: (e: SseEvent) => boolean, ms = 5000) {
          const have = events.find(pred);
          if (have) return Promise.resolve(have);
          return new Promise<SseEvent>((ok, fail) => {
            const t = setTimeout(() => fail(new Error(`no matching SSE event within ${ms} ms; got ${JSON.stringify(events.map((x) => x.event))}`)), ms);
            waiters.push({ pred, ok: (e) => { clearTimeout(t); ok(e); } });
          });
        },
        close() { req.destroy(); },
      };
      // resolve once the hello frame has arrived
      const check = setInterval(() => { if (events.some((e) => e.event === 'hello')) { clearInterval(check); resolve(api); } }, 5);
    });
    req.on('error', (e) => { if ((e as NodeJS.ErrnoException).code !== 'ECONNRESET') reject(e); });
    req.end();
  });
}
