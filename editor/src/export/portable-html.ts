import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import { dirname, extname, relative, resolve, sep } from 'node:path';

export type PortableExportErrorCode = 'missing-asset' | 'outside-root' | 'remote-asset' | 'asset-too-large' | 'export-too-large' | 'unsupported-reference';

export class PortableExportError extends Error {
  readonly code: PortableExportErrorCode;
  constructor(code: PortableExportErrorCode, message: string) {
    super(message);
    this.name = 'PortableExportError';
    this.code = code;
  }
}

export interface PortableAsset { path: string; bytes: number; mime: string }
export interface FontLicenceAudit { path: string; licensed: boolean; licence: string | null }
export interface PortableManifest {
  assets: PortableAsset[];
  fonts: FontLicenceAudit[];
  /** Remote references left in place because the caller allowed them. The document needs a network for these. */
  remote: string[];
  warnings: string[];
  sourceBytes: number;
  outputBytes: number;
}
export interface PortableHtmlResult { html: string; manifest: PortableManifest }
export interface PortableHtmlOptions {
  deckPath: string;
  source: string;
  maxAssetBytes?: number;
  maxTotalBytes?: number;
  /** Leave remote stylesheets, scripts, images and fonts untouched (and report them) instead of refusing. */
  allowRemote?: boolean;
}

const MIME: Record<string, string> = {
  '.avif': 'image/avif', '.css': 'text/css', '.gif': 'image/gif', '.htm': 'text/html', '.html': 'text/html',
  '.ico': 'image/x-icon', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.otf': 'font/otf', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf', '.wav': 'audio/wav', '.webm': 'video/webm', '.webp': 'image/webp', '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};
const FONT_EXT = new Set(['.otf', '.ttf', '.woff', '.woff2']);
const REMOTE = /^(?:https?:)?\/\//i;
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const LICENCE_NAME = /^(?:ofl(?:-\d+(?:\.\d+)*)?|licen[cs]e(?:[-_.].*)?|copying(?:[-_.].*)?|notice(?:[-_.].*)?)\.?(?:txt|md|html)?$/i;
const MAX_NESTING = 3;

const cleanRef = (ref: string) => ref.trim().replace(/[?#].*$/, '');
const normalPath = (path: string) => path.split(sep).join('/');
const attrEscape = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const blank = (text: string) => text.replace(/[^\n]/g, ' ');

/**
 * Same-length copy of `html` with the parts that must not be scanned for asset references replaced by spaces:
 * comments always, plus the bodies of script elements and (optionally) style elements. A `<img src="${x}">` inside
 * a JavaScript template literal is JavaScript, not a reference.
 */
function masked(html: string, styles: boolean): string {
  let out = html.replace(/<!--[\s\S]*?-->/g, blank);
  out = out.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script\s*>)/gi, (_m, a: string, body: string, c: string) => a + blank(body) + c);
  if (styles) out = out.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)/gi, (_m, a: string, body: string, c: string) => a + blank(body) + c);
  return out;
}

interface Replacement { start: number; end: number; text: string }
function splice(text: string, replacements: Replacement[]): string {
  let out = text;
  for (const r of [...replacements].sort((a, b) => b.start - a.start)) out = out.slice(0, r.start) + r.text + out.slice(r.end);
  return out;
}

export async function createPortableHtml(options: PortableHtmlOptions): Promise<PortableHtmlResult> {
  const root = await realpath(dirname(resolve(options.deckPath)));
  const maxAsset = options.maxAssetBytes ?? 25 * 1024 * 1024;
  const maxTotal = options.maxTotalBytes ?? 150 * 1024 * 1024;
  const allowRemote = options.allowRemote ?? false;
  const assets = new Map<string, PortableAsset>();
  const fonts = new Map<string, FontLicenceAudit>();
  const remote = new Set<string>();
  let aggregate = Buffer.byteLength(options.source);

  const isRemote = (raw: string) => REMOTE.test(cleanRef(raw));

  const localFile = async (raw: string, base: string): Promise<{ path: string; rel: string; data: Buffer; mime: string }> => {
    const ref = cleanRef(raw);
    if (REMOTE.test(ref)) throw new PortableExportError('remote-asset', `remote asset cannot be made portable without downloading it: ${raw}`);
    if (SCHEME.test(ref)) throw new PortableExportError('unsupported-reference', `unsupported asset reference: ${raw}`);
    let decoded: string;
    try { decoded = decodeURIComponent(ref); } catch { decoded = ref; }
    const candidate = resolve(base, decoded);
    if (candidate !== root && !candidate.startsWith(root + sep)) throw new PortableExportError('outside-root', `asset is outside the deck directory: ${raw}`);
    let path: string;
    try { path = await realpath(candidate); }
    catch { throw new PortableExportError('missing-asset', `asset not found: ${raw}`); }
    if (path !== root && !path.startsWith(root + sep)) throw new PortableExportError('outside-root', `asset is outside the deck directory: ${raw}`);
    const info = await stat(path);
    if (!info.isFile()) throw new PortableExportError('missing-asset', `asset is not a file: ${raw}`);
    if (info.size > maxAsset) throw new PortableExportError('asset-too-large', `asset exceeds ${maxAsset} bytes: ${raw}`);
    const data = await readFile(path);
    const rel = normalPath(relative(root, path));
    const mime = MIME[extname(path).toLowerCase()] ?? 'application/octet-stream';
    if (!assets.has(rel)) {
      aggregate += data.length;
      if (aggregate > maxTotal) throw new PortableExportError('export-too-large', `portable export exceeds ${maxTotal} bytes`);
      assets.set(rel, { path: rel, bytes: data.length, mime });
    }
    return { path, rel, data, mime };
  };

  // Licence evidence is a licence file in the same directory as the font. A licence higher up (a project MIT LICENSE
  // for the code) says nothing about the typeface, so it is not evidence.
  const licenceFor = async (fontPath: string): Promise<string | null> => {
    const dir = dirname(fontPath);
    const names = await readdir(dir).catch(() => [] as string[]);
    const name = names.sort((a, b) => a.localeCompare(b)).find((entry) => LICENCE_NAME.test(entry));
    return name ? normalPath(relative(root, resolve(dir, name))) : null;
  };

  const dataUrl = async (raw: string, base: string): Promise<string> => {
    const value = raw.trim();
    if (/^(?:data:|#|\$\{|\{\{)/i.test(value) || value === '') return raw;
    if (allowRemote && isRemote(value)) { remote.add(value); return raw; }
    const file = await localFile(raw, base);
    if (FONT_EXT.has(extname(file.path).toLowerCase()) && !fonts.has(file.rel)) {
      const licence = await licenceFor(file.path);
      fonts.set(file.rel, { path: file.rel, licensed: licence !== null, licence });
    }
    return `data:${file.mime};base64,${file.data.toString('base64')}`;
  };

  const inlineCss = async (css: string, base: string): Promise<string> => {
    if (/@import\s/i.test(css)) throw new PortableExportError('unsupported-reference', 'CSS @import is not supported in portable exports');
    const replacements: Replacement[] = [];
    for (const match of css.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/gi)) {
      const raw = match[2];
      if (!raw || /^(?:data:|#)/i.test(raw.trim())) continue;
      const url = await dataUrl(raw, base);
      if (url === raw) continue;
      replacements.push({ start: match.index!, end: match.index! + match[0].length, text: `url("${url}")` });
    }
    return splice(css, replacements);
  };

  /** One HTML document (the deck, or a nested iframe document) made self-contained. `base` resolves its references. */
  const portable = async (source: string, base: string, depth: number): Promise<string> => {
    let html = source;

    // Linked stylesheets, and other <link> tags that name files.
    {
      const re = /<link\b[^>]*>/gi;
      const reps: Replacement[] = [];
      for (const match of masked(html, true).matchAll(re)) {
        const tag = html.slice(match.index!, match.index! + match[0].length);
        const rel = /\brel\s*=\s*(["'])(.*?)\1/i.exec(tag)?.[2].toLowerCase() ?? '';
        const href = /\bhref\s*=\s*(["'])([\s\S]*?)\1/i.exec(tag);
        if (!href) continue;
        const kinds = rel.split(/\s+/);
        if (kinds.includes('stylesheet')) {
          if (allowRemote && isRemote(href[2])) { remote.add(href[2]); continue; }
          const file = await localFile(href[2], base);
          const css = await inlineCss(file.data.toString('utf8'), dirname(file.path));
          reps.push({ start: match.index!, end: match.index! + tag.length, text: `<style data-nm-inline="${attrEscape(file.rel)}">${css}</style>` });
        } else if (kinds.some((k) => k === 'preload' || k === 'prefetch' || k === 'modulepreload')) {
          if (!isRemote(href[2]) && !/^(?:data:|#)/i.test(href[2].trim())) reps.push({ start: match.index!, end: match.index! + tag.length, text: '' });
        } else if (kinds.some((k) => k === 'icon' || k === 'apple-touch-icon' || k === 'shortcut')) {
          const url = await dataUrl(href[2], base);
          if (url !== href[2]) {
            const valueStart = match.index! + tag.indexOf(href[0]) + href[0].indexOf(href[2]);
            reps.push({ start: valueStart, end: valueStart + href[2].length, text: attrEscape(url) });
          }
        }
      }
      html = splice(html, reps);
    }

    // Linked scripts.
    {
      const reps: Replacement[] = [];
      for (const match of masked(html, false).matchAll(/<script\b([^>]*?)\bsrc\s*=\s*(["'])(.*?)\2([^>]*)>\s*<\/script\s*>/gi)) {
        if (allowRemote && isRemote(match[3])) { remote.add(match[3]); continue; }
        if (/^(?:data:)/i.test(match[3].trim())) continue;
        const file = await localFile(match[3], base);
        const code = file.data.toString('utf8').replace(/<\/script/gi, '<\\/script');
        const attrs = `${match[1]}${match[4]}`.replace(/\s+/g, ' ').trimEnd();
        reps.push({ start: match.index!, end: match.index! + match[0].length, text: `<script${attrs} data-nm-inline="${attrEscape(file.rel)}">${code}</script>` });
      }
      html = splice(html, reps);
    }

    // CSS inside style elements.
    {
      const reps: Replacement[] = [];
      for (const match of masked(html, false).matchAll(/<style\b([^>]*)>([\s\S]*?)<\/style\s*>/gi)) {
        const css = await inlineCss(html.slice(match.index! + match[0].indexOf('>') + 1, match.index! + match[0].lastIndexOf('</')), base);
        reps.push({ start: match.index!, end: match.index! + match[0].length, text: `<style${match[1]}>${css}</style>` });
      }
      html = splice(html, reps);
    }

    // Style attributes and Tailwind arbitrary url(...) values in class attributes.
    {
      const reps: Replacement[] = [];
      for (const match of masked(html, true).matchAll(/\b(style|class)\s*=\s*(["'])([\s\S]*?)\2/gi)) {
        if (!/url\(/i.test(match[3])) continue;
        const original = html.slice(match.index!, match.index! + match[0].length);
        const value = original.slice(original.indexOf(match[2]) + 1, original.length - 1);
        const css = match[1].toLowerCase() === 'style'
          ? await inlineCss(value, base)
          : await (async () => {
            const parts: Replacement[] = [];
            for (const u of value.matchAll(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi)) {
              const url = await dataUrl(u[2], base);
              if (url !== u[2]) parts.push({ start: u.index!, end: u.index! + u[0].length, text: `url(${url})` });
            }
            return splice(value, parts);
          })();
        if (css !== value) reps.push({ start: match.index!, end: match.index! + match[0].length, text: `${match[1]}=${match[2]}${css}${match[2]}` });
      }
      html = splice(html, reps);
    }

    // Nested documents: an iframe pointing at a local page becomes srcdoc, with that page's references inlined too.
    {
      const reps: Replacement[] = [];
      for (const match of masked(html, true).matchAll(/<iframe\b[^>]*?\bsrc\s*=\s*(["'])(.*?)\1/gi)) {
        const raw = match[2];
        if (/^(?:data:|#|about:)/i.test(raw.trim()) || raw.trim() === '') continue;
        if (allowRemote && isRemote(raw)) { remote.add(raw); continue; }
        const file = await localFile(raw, base);
        const ext = extname(file.path).toLowerCase();
        const srcAttr = match[0].slice(match[0].search(/\bsrc\s*=/i));
        if (ext !== '.html' && ext !== '.htm') {
          const url = await dataUrl(raw, base);
          reps.push({ start: match.index! + match[0].length - srcAttr.length, end: match.index! + match[0].length, text: `src="${attrEscape(url)}"` });
          continue;
        }
        if (depth >= MAX_NESTING) throw new PortableExportError('unsupported-reference', `iframe nesting is deeper than ${MAX_NESTING}: ${raw}`);
        const inner = await portable(file.data.toString('utf8'), dirname(file.path), depth + 1);
        reps.push({ start: match.index! + match[0].length - srcAttr.length, end: match.index! + match[0].length, text: `srcdoc="${attrEscape(inner)}"` });
      }
      html = splice(html, reps);
    }

    // Asset-bearing attributes. Anchors are intentionally excluded.
    {
      const reps: Replacement[] = [];
      for (const match of masked(html, true).matchAll(/<(?:img|source|video|audio|track|embed|input|image|use)\b[^>]*?\b(src|href|xlink:href|poster)\s*=\s*(["'])(.*?)\2/gi)) {
        const raw = match[3];
        if (/^(?:data:|#)/i.test(raw.trim())) continue;
        const url = await dataUrl(raw, base);
        if (url === raw) continue;
        const valueStart = match.index! + match[0].lastIndexOf(raw);
        reps.push({ start: valueStart, end: valueStart + raw.length, text: attrEscape(url) });
      }
      html = splice(html, reps);
    }
    {
      const reps: Replacement[] = [];
      for (const match of masked(html, true).matchAll(/\bsrcset\s*=\s*(["'])([\s\S]*?)\1/gi)) {
        const parts: string[] = [];
        for (const candidate of match[2].split(',')) {
          const parsed = /^\s*(\S+)(\s+.*)?$/.exec(candidate);
          if (!parsed) continue;
          parts.push(`${await dataUrl(parsed[1], base)}${parsed[2] ?? ''}`);
        }
        reps.push({ start: match.index!, end: match.index! + match[0].length, text: `srcset=${match[1]}${attrEscape(parts.join(', '))}${match[1]}` });
      }
      html = splice(html, reps);
    }
    return html;
  };

  let html = await portable(options.source, root, 0);

  const warnings = [...fonts.values()].filter((font) => !font.licensed).map((font) =>
    `No licence evidence was found for ${font.path}; embedding does not grant redistribution rights.`);
  const remoteList = [...remote].sort();
  for (const url of remoteList) warnings.push(`${url} is still a remote reference; this file needs a network connection for it.`);
  const sortedAssets = [...assets.values()].sort((a, b) => a.path.localeCompare(b.path));
  const sortedFonts = [...fonts.values()].sort((a, b) => a.path.localeCompare(b.path));
  const metadata = JSON.stringify({ fonts: sortedFonts, remote: remoteList, warnings }).replace(/</g, '\\u003c');
  if (sortedAssets.length) {
    const tag = `<script type="application/json" id="nm-portable-manifest">${metadata}</script>`;
    html = /<\/head\s*>/i.test(html) ? html.replace(/<\/head\s*>/i, () => `${tag}</head>`) : `${tag}${html}`;
  }
  const outputBytes = Buffer.byteLength(html);
  if (outputBytes > maxTotal * 2) throw new PortableExportError('export-too-large', `encoded portable export exceeds ${maxTotal * 2} bytes`);
  return { html, manifest: { assets: sortedAssets, fonts: sortedFonts, remote: remoteList, warnings, sourceBytes: Buffer.byteLength(options.source), outputBytes } };
}
