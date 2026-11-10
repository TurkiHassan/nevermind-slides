// The local editor server: node:http only, bound to 127.0.0.1. Serves the shell, the instrumented preview, the
// deck's own files, and a JSON API over the Session. Every request passes the guards in security.ts first.
import { randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { dirname, extname, resolve } from 'node:path';
import { OpError } from '../engine/index.ts';
import { EDIT_MODE_CSS, EDIT_MODE_JS, shellHtml } from './assets.ts';
import { UI_FONT_FILES, uiFontsDir } from './fonts.ts';
import { LayoutPresetError, listLayoutPresets, readLayoutPreset } from './layout-presets.ts';
import { NotesError, NotesStore, type AgentNoteTarget, type AreaNoteTarget } from './notes.ts';
import { openBrowser } from './open.ts';
import { buildPreview } from './preview.ts';
import { checkRequest, checkToken, cookieName, resolveUnder } from './security.ts';
import { HttpError, Session, type OpsRequest } from './session.ts';
import { watchDeck } from './watch.ts';
import { saveUploadedImage, UploadError } from './uploads.ts';
import { AgentProposalStore, type AgentProposal, type AgentRunners } from './agent-proposals.ts';
import { createLocalAgentRunners } from './local-agent-runner.ts';
import { createChromiumDriver, type CaptureDriver } from '../export/chromium.ts';
import { EXPORT_FORMATS, ExportService, type ExportFormat } from '../export/service.ts';
import { contentDisposition, ExportJobs } from './exports.ts';

export interface ServerOptions { deckPath: string; port?: number; open?: boolean; agentRunners?: AgentRunners; exportDriver?: CaptureDriver }
export interface RunningServer {
  /** The editor URL, including ?t=<token>. */
  url: string;
  port: number;
  token: string;
  close(): Promise<void>;
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.avif': 'image/avif', '.ico': 'image/x-icon', '.otf': 'font/otf', '.ttf': 'font/ttf',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.mp4': 'video/mp4',
  '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.map': 'application/json; charset=utf-8',
};

const MAX_BODY = 8 * 1024 * 1024;
const MAX_OPS = 500;

const BASE_HEADERS = {
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'cross-origin-resource-policy': 'same-origin',
};

function send(res: ServerResponse, status: number, body: string | Buffer, type: string, extra: Record<string, string> = {}): void {
  res.writeHead(status, { ...BASE_HEADERS, 'content-type': type, ...extra });
  res.end(body);
}

const jsonReplacer = (_k: string, v: unknown) => (v instanceof Set ? [...v] : v);
function sendJson(res: ServerResponse, status: number, value: unknown): void {
  send(res, status, JSON.stringify(value, jsonReplacer), 'application/json; charset=utf-8');
}
function publicProposal(proposal: AgentProposal): Omit<AgentProposal, 'ops'> {
  const { ops: _ops, ...publicFields } = proposal;
  return publicFields;
}
const sendError = (res: ServerResponse, status: number, error: string, message: string, extra: Record<string, unknown> = {}) =>
  sendJson(res, status, { error, message, ...extra });

async function readJson(req: IncomingMessage): Promise<unknown> {
  const type = String(req.headers['content-type'] ?? '');
  if (!/^application\/json\b/i.test(type)) throw new HttpError(415, 'bad-content-type', 'send application/json');
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > MAX_BODY) throw new HttpError(413, 'too-large', `request body over ${MAX_BODY} bytes`);
    chunks.push(c as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (e) {
    throw new HttpError(400, 'bad-json', `body is not valid JSON: ${(e as Error).message}`);
  }
}

function parseOpsRequest(body: unknown): OpsRequest {
  const b = body as Record<string, unknown>;
  if (typeof b !== 'object' || b === null || Array.isArray(b)) throw new HttpError(400, 'bad-request', 'body must be an object');
  if (!Array.isArray(b.ops) || b.ops.some((o) => typeof o !== 'object' || o === null || Array.isArray(o))) throw new HttpError(400, 'bad-request', "'ops' must be an array of op objects");
  if (b.ops.length > MAX_OPS) throw new HttpError(400, 'bad-request', `at most ${MAX_OPS} ops per request`);
  if (!Number.isInteger(b.baseVersion)) throw new HttpError(400, 'bad-request', "'baseVersion' (the version the client last saw) is required");
  for (const f of ['label', 'coalesceKey', 'clientId'] as const) {
    if (b[f] !== undefined && (typeof b[f] !== 'string' || (b[f] as string).length > 200)) throw new HttpError(400, 'bad-request', `'${f}' must be a string of at most 200 characters`);
  }
  return { ops: b.ops as OpsRequest['ops'], baseVersion: b.baseVersion as number, label: b.label as string | undefined, coalesceKey: b.coalesceKey as string | undefined, clientId: b.clientId as string | undefined };
}

async function serveFile(req: IncomingMessage, res: ServerResponse, file: string): Promise<void> {
  const st = await stat(file).catch(() => null);
  if (!st || !st.isFile()) return sendError(res, 404, 'not-found', 'no such file');
  const type = TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
  const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range ?? ''));
  let start = 0;
  let end = st.size - 1;
  let status = 200;
  const headers: Record<string, string> = { ...BASE_HEADERS, 'content-type': type, 'accept-ranges': 'bytes' };
  if (range && (range[1] || range[2])) {
    start = range[1] ? Number(range[1]) : Math.max(0, st.size - Number(range[2]));
    end = range[1] && range[2] ? Math.min(Number(range[2]), st.size - 1) : st.size - 1;
    if (start > end || start >= st.size) {
      res.writeHead(416, { ...headers, 'content-range': `bytes */${st.size}` });
      return void res.end();
    }
    status = 206;
    headers['content-range'] = `bytes ${start}-${end}/${st.size}`;
  }
  headers['content-length'] = String(end - start + 1);
  res.writeHead(status, headers);
  if (req.method === 'HEAD') return void res.end();
  createReadStream(file, { start, end }).on('error', () => res.destroy()).pipe(res);
}

export async function startEditorServer(opts: ServerOptions): Promise<RunningServer> {
  const deckPath = await realpath(resolve(opts.deckPath));
  const root = dirname(deckPath);
  const session = await Session.open(deckPath);
  const notes = await NotesStore.open(deckPath);
  const proposals = new AgentProposalStore(opts.agentRunners ?? createLocalAgentRunners());
  const exportJobs = new ExportJobs(new ExportService(opts.exportDriver ?? createChromiumDriver()));
  const token = randomBytes(24).toString('base64url');
  const guard = { port: 0, token };
  const sse = new Set<ServerResponse>();
  const broadcast = (event: string, data: unknown) => {
    const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const response of sse) response.write(frame);
  };

  session.subscribe((e) => {
    broadcast(e.event, e.data);
  });
  notes.subscribe((document, source) => { broadcast('notes', { notes: document, source }); });

  const authed = (req: IncomingMessage, res: ServerResponse, url: URL, allowCookie = false): boolean => {
    const v = checkToken(req, url, guard, allowCookie);
    if (!v.ok) sendError(res, v.status, v.error, v.message);
    return v.ok;
  };
  const setCookie = (res: ServerResponse) => res.setHeader('set-cookie', `${cookieName(guard.port)}=${token}; Path=/deck/; HttpOnly; SameSite=Strict`);

  async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
    let url: URL;
    try {
      url = new URL(req.url ?? '/', 'http://127.0.0.1');
    } catch {
      return sendError(res, 400, 'bad-url', 'malformed URL');
    }
    const path = url.pathname;
    const method = req.method ?? 'GET';
    if (method !== 'GET' && method !== 'HEAD' && method !== 'POST') return sendError(res, 405, 'method', `${method} not allowed`);

    if (path.startsWith('/deck/')) {
      if (method === 'POST') return sendError(res, 405, 'method', 'POST not allowed here');
      if (!authed(req, res, url, true)) return;
      const file = await resolveUnder(root, path.slice('/deck/'.length));
      if (!file) return sendError(res, 403, 'forbidden', 'path is outside the deck directory');
      return serveFile(req, res, file);
    }

    if (path.startsWith('/ui/fonts/')) {
      if (method === 'POST') return sendError(res, 405, 'method', 'POST not allowed here');
      if (!authed(req, res, url, true)) return;
      const name = path.slice('/ui/fonts/'.length);
      if (!UI_FONT_FILES.has(name)) return sendError(res, 404, 'not-found', 'no such font');
      const dir = uiFontsDir();
      if (!dir) return sendError(res, 404, 'not-found', 'the editor fonts are not installed');
      const file = await resolveUnder(dir, name);
      if (!file) return sendError(res, 403, 'forbidden', 'path is outside the font directory');
      return serveFile(req, res, file);
    }

    if (method === 'GET' && (path === '/' || path === '/index.html')) {
      if (!authed(req, res, url)) return;
      setCookie(res);
      return send(res, 200, await shellHtml(), TYPES['.html'], { 'content-security-policy': "frame-ancestors 'self'" });
    }
    if (method === 'GET' && (path === '/preview' || path === '/thumbnail')) {
      if (!authed(req, res, url)) return;
      setCookie(res);
      const snap = session.snapshot();
      const html = buildPreview(snap.doc, snap.refs, { css: EDIT_MODE_CSS, js: EDIT_MODE_JS }, snap.version);
      return send(res, 200, html, TYPES['.html'], { 'x-nm-version': String(snap.version), 'x-frame-options': 'SAMEORIGIN' });
    }

    if (!path.startsWith('/api/')) return sendError(res, 404, 'not-found', 'no such route');
    if (!authed(req, res, url)) return;

    if (method === 'GET' && path === '/api/state') return sendJson(res, 200, { ...session.state(), notes: notes.read() });
    if (method === 'GET' && path === '/api/notes') return sendJson(res, 200, notes.read());
    if (method === 'GET' && path === '/api/layout-presets') return sendJson(res, 200, { presets: listLayoutPresets() });
    if (method === 'GET' && path === '/api/layout-preset') {
      const id = url.searchParams.get('id');
      if (!id) throw new HttpError(400, 'bad-request', 'layout preset id is required');
      try { return sendJson(res, 200, readLayoutPreset(id)); }
      catch (error) {
        if (error instanceof LayoutPresetError) throw new HttpError(error.code === 'unknown-preset' ? 404 : error.code === 'missing-presets' ? 503 : 422, error.code, error.message);
        throw error;
      }
    }
    if (method === 'GET' && path === '/api/outline') {
      const num = (name: string, def: number) => {
        const v = url.searchParams.get(name);
        if (v === null) return def;
        const n = Number(v);
        if (!Number.isInteger(n) || n < 0) throw new HttpError(400, 'bad-request', `${name} must be a non-negative integer`);
        return n;
      };
      return sendJson(res, 200, session.outline(num('slide', 1), num('depth', 4)));
    }
    if (method === 'GET' && path === '/api/events') {
      res.writeHead(200, { ...BASE_HEADERS, 'content-type': 'text/event-stream; charset=utf-8', connection: 'keep-alive' });
      res.write(': connected\n\n');
      res.write(`event: hello\ndata: ${JSON.stringify({ version: session.currentVersion, dirty: session.isDirty })}\n\n`);
      sse.add(res);
      const beat = setInterval(() => res.write(': ping\n\n'), 15_000);
      beat.unref();
      req.on('close', () => { clearInterval(beat); sse.delete(res); });
      return;
    }
    if (method === 'POST' && path === '/api/exports') {
      const body = await readJson(req) as { format?: unknown; allowRemote?: unknown };
      if (!body || typeof body !== 'object' || typeof body.format !== 'string' || !(EXPORT_FORMATS as readonly string[]).includes(body.format)) {
        throw new HttpError(400, 'bad-format', `format must be one of ${EXPORT_FORMATS.join(', ')}`);
      }
      if (body.allowRemote !== undefined && typeof body.allowRemote !== 'boolean') throw new HttpError(400, 'bad-request', "'allowRemote' must be a boolean");
      const snapshot = session.exportSource();
      const job = exportJobs.start({ format: body.format as ExportFormat, source: snapshot.text, version: snapshot.version, deckPath, allowRemote: body.allowRemote === true });
      return sendJson(res, 202, job);
    }
    const exportRoute = /^\/api\/exports\/(ex-[A-Za-z0-9_-]+)(\/download)?$/.exec(path);
    if (exportRoute && method === 'GET') {
      const job = exportJobs.get(exportRoute[1]);
      if (!job) throw new HttpError(404, 'unknown-export', 'no such export');
      if (!exportRoute[2]) return sendJson(res, 200, job);
      const artifact = exportJobs.file(job.id);
      if (job.status !== 'ready' || !artifact) throw new HttpError(409, 'export-not-ready', 'the export is not ready');
      return send(res, 200, artifact.data, artifact.mime, { 'content-disposition': contentDisposition(artifact.filename), 'content-length': String(artifact.data.length) });
    }
    if (method === 'POST' && path === '/api/ops') return sendJson(res, 200, session.applyOps(parseOpsRequest(await readJson(req))));
    if (method === 'POST' && path === '/api/ai/requests') {
      const body = await readJson(req) as { prompt?: unknown; key?: unknown; kind?: unknown };
      if (!body || typeof body.prompt !== 'string' || typeof body.key !== 'string' || (body.kind !== 'text' && body.kind !== 'image')) {
        throw new HttpError(400, 'bad-request', 'AI request requires prompt, selection key, and kind "text" or "image"');
      }
      let proposal: AgentProposal;
      try {
        const selection = session.agentSelection(body.key);
        proposal = body.kind === 'image' ? proposals.createImage(body.prompt, selection) : proposals.createText(body.prompt, selection);
      }
      catch (error) { throw new HttpError(400, 'bad-ai-request', (error as Error).message); }
      return sendJson(res, 202, publicProposal(proposal));
    }
    const aiRoute = /^\/api\/ai\/requests\/(ai-[0-9]+)(?:\/(accept|reject))?$/.exec(path);
    if (aiRoute && method === 'GET' && !aiRoute[2]) {
      const proposal = proposals.get(aiRoute[1]);
      if (!proposal) throw new HttpError(404, 'unknown-proposal', 'no such AI proposal');
      return sendJson(res, 200, publicProposal(proposal));
    }
    if (aiRoute && method === 'POST' && aiRoute[2] === 'reject') {
      await readJson(req);
      try { return sendJson(res, 200, publicProposal(proposals.reject(aiRoute[1]))); }
      catch (error) { throw new HttpError(409, 'proposal-state', (error as Error).message); }
    }
    if (aiRoute && method === 'POST' && aiRoute[2] === 'accept') {
      await readJson(req);
      const proposal = proposals.get(aiRoute[1]);
      if (!proposal) throw new HttpError(404, 'unknown-proposal', 'no such AI proposal');
      if (proposal.status !== 'ready' || !proposal.ops) throw new HttpError(409, 'proposal-state', 'the AI proposal is not ready');
      let materialized: string | null = null;
      try {
        materialized = await proposals.materializeImage(proposal.id);
        const result = session.acceptAgentOps({ baseVersion: proposal.baseVersion, ops: proposal.ops, label: `AI: ${proposal.summary ?? 'selection change'}` });
        proposals.markAccepted(proposal.id);
        return sendJson(res, 200, { proposal: publicProposal(proposals.get(proposal.id)!), result });
      } catch (error) {
        await proposals.rollbackMaterializedImage(materialized);
        throw error;
      }
    }
    if (method === 'POST' && path === '/api/assets') {
      try { return sendJson(res, 201, await saveUploadedImage(deckPath, await readJson(req) as Parameters<typeof saveUploadedImage>[1])); }
      catch (error) {
        if (error instanceof UploadError) {
          const status = error.code === 'unsupported-image' ? 415 : error.code === 'image-too-large' ? 413 : 400;
          throw new HttpError(status, error.code, error.message);
        }
        throw error;
      }
    }
    if (method === 'POST' && path === '/api/notes') {
      const body = await readJson(req) as { text?: unknown; target?: Record<string, unknown> };
      if (!body || typeof body !== 'object' || typeof body.text !== 'string' || !body.target || typeof body.target !== 'object') {
        throw new HttpError(400, 'bad-request', 'note requires text and a target object');
      }
      let target: AgentNoteTarget;
      if (body.target.kind === 'element') {
        if (typeof body.target.key !== 'string') throw new HttpError(400, 'bad-request', 'element target requires key');
        target = session.noteTarget(body.target.key);
      } else if (body.target.kind === 'area') {
        const slide = body.target.slide;
        const rect = body.target.rect;
        if (!Number.isInteger(slide) || !rect || typeof rect !== 'object') throw new HttpError(400, 'bad-request', 'area target requires slide and rect');
        const title = session.state().info.slides[(slide as number) - 1]?.title;
        target = { kind: 'area', slide: slide as number, ...(title ? { slideTitle: title } : {}), rect: rect as AreaNoteTarget['rect'] };
      } else {
        throw new HttpError(400, 'bad-request', 'target kind must be element or area');
      }
      const note = await notes.create({ text: body.text, target });
      return sendJson(res, 201, { note, notes: notes.read() });
    }
    if (method === 'POST' && path === '/api/notes/done') {
      const body = await readJson(req) as { id?: unknown };
      if (!body || typeof body.id !== 'string') throw new HttpError(400, 'bad-request', 'notes done requires id');
      const note = await notes.done(body.id);
      return sendJson(res, 200, { note, notes: notes.read() });
    }
    if (method === 'POST' && path === '/api/current') {
      const body = await readJson(req) as { slide?: unknown; key?: unknown };
      if (!body || !Number.isInteger(body.slide) || (body.key !== undefined && typeof body.key !== 'string')) {
        throw new HttpError(400, 'bad-request', 'current context requires slide and optional key');
      }
      const state = session.state();
      const slide = body.slide as number;
      if (!state.info.slides[slide - 1]) throw new HttpError(400, 'bad-slide', `slide ${slide}: the deck has ${state.info.slides.length} slides`);
      const selection = typeof body.key === 'string' ? session.noteTarget(body.key) : null;
      if (selection && selection.slide !== slide) throw new HttpError(400, 'bad-note-target', 'selected element is not on the current slide');
      return sendJson(res, 200, await notes.writeCurrent({ fingerprint: state.fingerprint, slide, selection }));
    }
    if (method === 'POST' && path === '/api/undo') { await readJson(req); return sendJson(res, 200, session.undo()); }
    if (method === 'POST' && path === '/api/redo') { await readJson(req); return sendJson(res, 200, session.redo()); }
    if (method === 'POST' && path === '/api/save') { await readJson(req); return sendJson(res, 200, await session.save()); }
    if (method === 'POST' && path === '/api/resolve') {
      const b = (await readJson(req)) as { strategy?: unknown };
      if (b?.strategy !== 'reload' && b?.strategy !== 'reapply') throw new HttpError(400, 'bad-request', "'strategy' must be \"reload\" or \"reapply\"");
      return sendJson(res, 200, await session.resolve(b.strategy));
    }
    return sendError(res, 404, 'not-found', 'no such route');
  }

  const server = createServer((req, res) => {
    const v = checkRequest(req, guard);
    if (!v.ok) return sendError(res, v.status, v.error, v.message);
    route(req, res).catch((e: unknown) => {
      if (res.headersSent) return void res.destroy();
      if (e instanceof HttpError) return sendError(res, e.status, e.code, e.message, e.extra);
      if (e instanceof NotesError) return sendError(res, e.code === 'unknown-note' ? 404 : 400, e.code, e.message);
      if (e instanceof OpError) return sendError(res, 422, 'op-error', e.message, { opCode: e.code });
      process.stderr.write(`nm-studio: internal error: ${(e as Error).stack ?? e}\n`);
      sendError(res, 500, 'internal', 'internal error');
    });
  });

  await new Promise<void>((ok, fail) => {
    server.once('error', fail);
    server.listen(opts.port ?? 0, '127.0.0.1', () => ok());
  });
  const addr = server.address();
  guard.port = typeof addr === 'object' && addr ? addr.port : (opts.port ?? 0);

  const watcher = watchDeck(deckPath, () => { session.checkDisk().catch(() => {}); });
  const url = `http://127.0.0.1:${guard.port}/?t=${token}`;
  if (opts.open) openBrowser(url);

  return {
    url,
    port: guard.port,
    token,
    close: async () => {
      watcher.close();
      notes.close();
      await proposals.close();
      await exportJobs.close();
      session.close();
      for (const r of sse) r.end();
      sse.clear();
      server.closeAllConnections();
      await new Promise<void>((ok) => server.close(() => ok()));
    },
  };
}
