// Request guards: DNS-rebinding (Host), cross-site requests (Origin, Sec-Fetch-Site), the session token, and
// confinement of static file access to the deck directory.
import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { realpath } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';

export interface Guard { port: number; token: string }
export type Verdict = { ok: true } | { ok: false; status: number; error: string; message: string };

const deny = (status: number, error: string, message: string): Verdict => ({ ok: false, status, error, message });

export const allowedHosts = (port: number) => [`127.0.0.1:${port}`, `localhost:${port}`];
export const allowedOrigins = (port: number) => [`http://127.0.0.1:${port}`, `http://localhost:${port}`];

const header = (req: IncomingMessage, name: string): string | undefined => {
  const v = req.headers[name];
  return Array.isArray(v) ? v[0] : v;
};

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Host, Sec-Fetch-Site and Origin. Run on every request, before routing. */
export function checkRequest(req: IncomingMessage, g: Guard): Verdict {
  const host = header(req, 'host');
  if (!host || !allowedHosts(g.port).includes(host.toLowerCase())) {
    return deny(403, 'bad-host', 'Host must be 127.0.0.1 or localhost with the server port (DNS rebinding guard)');
  }
  const site = header(req, 'sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') {
    return deny(403, 'cross-site', `request comes from ${site} context`);
  }
  const origin = header(req, 'origin');
  const readOnly = req.method === 'GET' || req.method === 'HEAD';
  if (origin !== undefined) {
    if (!allowedOrigins(g.port).includes(origin)) return deny(403, 'bad-origin', 'Origin is not this server');
  } else if (!readOnly) {
    return deny(403, 'missing-origin', 'state-changing requests must carry an Origin header equal to the server origin');
  }
  return { ok: true };
}

export const cookieName = (port: number) => `nm_t_${port}`;

function cookieValue(req: IncomingMessage, name: string): string | null {
  const raw = header(req, 'cookie');
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

/**
 * The token check. `?t=` or the X-NM-Token header always count. The cookie (set when the shell or preview is opened
 * with a valid token) counts only where `allowCookie` is true: the static `/deck/` subresources, which the preview
 * loads without a query string.
 */
export function checkToken(req: IncomingMessage, url: URL, g: Guard, allowCookie: boolean): Verdict {
  const supplied = url.searchParams.get('t') ?? header(req, 'x-nm-token') ?? (allowCookie ? cookieValue(req, cookieName(g.port)) : null);
  if (!supplied) return deny(401, 'no-token', 'session token required (?t=… or X-NM-Token)');
  if (!safeEqual(supplied, g.token)) return deny(401, 'bad-token', 'session token is wrong');
  return { ok: true };
}

/**
 * Resolve a URL path under `root` (already a realpath). Null when it is malformed, contains a NUL, escapes the root
 * lexically, names a dot-file or dot-directory, or leaves the root through a symlink. A missing file resolves to its
 * lexical path so the caller answers 404.
 */
export async function resolveUnder(root: string, rawRel: string): Promise<string | null> {
  let rel: string;
  try {
    rel = decodeURIComponent(rawRel);
  } catch {
    return null;
  }
  if (rel.includes('\0') || rel.includes('\\')) return null;
  if (rel.split('/').some((seg) => seg.startsWith('.'))) return null;
  const p = resolve(join(root, rel));
  if (p !== root && !p.startsWith(root + sep)) return null;
  try {
    const real = await realpath(p);
    if (real !== root && !real.startsWith(root + sep)) return null;
    return real;
  } catch {
    return p;
  }
}
