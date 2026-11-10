// Headless Chrome/Chromium behind a small driver interface. The production driver launches a discovered executable
// without a shell; every path is its own argv entry. Tests inject the process runner or the whole driver.
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export interface TextBox {
  slide: number;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  color: string;
  fontFamily: string;
  bold: boolean;
  rtl: boolean;
}

export interface CaptureDriver {
  /** Print the page (already prepared for print) to a PDF at `out`. */
  pdf(htmlFile: string, out: string): Promise<void>;
  /** Screenshot the page at 1920x1080, device scale 1, to a PNG at `out`. `hash` selects the slide. */
  png(htmlFile: string, hash: string, out: string): Promise<void>;
  /** The text boxes the in-page probe measured, read from the dumped DOM. */
  geometry(htmlFile: string): Promise<TextBox[]>;
  close(): Promise<void>;
}

export interface RunResult { code: number | null; stdout: Buffer; stderr: string; timedOut: boolean }
export type RunProcess = (command: string, args: string[], options: { timeoutMs: number }) => Promise<RunResult>;

export class ChromiumError extends Error {
  readonly code: 'no-browser' | 'launch-failed' | 'timeout' | 'no-output';
  constructor(code: ChromiumError['code'], message: string) {
    super(message);
    this.name = 'ChromiumError';
    this.code = code;
  }
}

/** Where a Chrome or Chromium might live. NM_CHROME wins; then well-known macOS/Linux paths; then the Playwright cache. */
export function findChrome(env: NodeJS.ProcessEnv = process.env, exists: (path: string) => boolean = existsSync, list: (dir: string) => string[] = (d) => { try { return readdirSync(d); } catch { return []; } }): string | null {
  if (env.NM_CHROME) return exists(env.NM_CHROME) ? env.NM_CHROME : null;
  const fixed = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ];
  for (const path of fixed) if (exists(path)) return path;
  const caches = [env.PLAYWRIGHT_BROWSERS_PATH, join(homedir(), 'Library/Caches/ms-playwright'), join(homedir(), '.cache/ms-playwright')].filter((x): x is string => !!x);
  for (const cache of caches) {
    const dirs = list(cache).filter((d) => /^chromium(?:_headless_shell)?-\d+$/.test(d)).sort().reverse();
    for (const dir of dirs) {
      const candidates = [
        join(cache, dir, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'),
        join(cache, dir, 'chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'),
        join(cache, dir, 'chrome-mac/Chromium.app/Contents/MacOS/Chromium'),
        join(cache, dir, 'chrome-linux/chrome'),
        join(cache, dir, 'chrome-headless-shell-mac-arm64/chrome-headless-shell'),
        join(cache, dir, 'chrome-headless-shell-mac-x64/chrome-headless-shell'),
        join(cache, dir, 'chrome-headless-shell-linux64/chrome-headless-shell'),
      ];
      for (const path of candidates) if (exists(path)) return path;
    }
  }
  return null;
}

/** The real process runner: shell-free spawn, a hard timeout, children tracked so close() can kill them. */
export function createRunner(children: Set<ChildProcess>): RunProcess {
  return (command, args, { timeoutMs }) => new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { shell: false, stdio: ['ignore', 'pipe', 'pipe'], detached: false });
    children.add(child);
    const out: Buffer[] = [];
    let err = '';
    let timedOut = false;
    let outBytes = 0;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMs);
    child.stdout.on('data', (chunk: Buffer) => { outBytes += chunk.length; if (outBytes <= 256 * 1024 * 1024) out.push(chunk); });
    child.stderr.on('data', (chunk: Buffer) => { if (err.length < 64 * 1024) err += chunk.toString('utf8'); });
    child.once('error', (error) => { clearTimeout(timer); children.delete(child); reject(error); });
    child.once('close', (code) => {
      clearTimeout(timer);
      children.delete(child);
      resolveRun({ code, stdout: Buffer.concat(out), stderr: err, timedOut });
    });
  });
}

export interface ChromiumOptions {
  executable?: string | null;
  run?: RunProcess;
  timeoutMs?: number;
  tmpRoot?: string;
}

export const GEOMETRY_MARKER = 'nm-geometry';

/** Shared browser flags. The profile directory is private to one launch and removed afterwards. */
export function chromeArgs(profile: string, extra: string[], url: string): string[] {
  return [
    '--headless', '--disable-gpu', '--hide-scrollbars', '--mute-audio', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-background-networking', '--disable-sync', '--disable-component-update',
    '--force-device-scale-factor=1', '--window-size=1920,1080', '--font-render-hinting=none',
    '--virtual-time-budget=6000', '--run-all-compositor-stages-before-draw',
    `--user-data-dir=${profile}`, ...extra, url,
  ];
}

export function createChromiumDriver(options: ChromiumOptions = {}): CaptureDriver {
  const children = new Set<ChildProcess>();
  const run = options.run ?? createRunner(children);
  const timeoutMs = options.timeoutMs ?? 90_000;
  const tmpRoot = options.tmpRoot ?? tmpdir();
  let closed = false;

  const executable = () => {
    const found = options.executable === undefined ? findChrome() : options.executable;
    if (!found) throw new ChromiumError('no-browser', 'No Chrome or Chromium was found. Install Google Chrome, or set NM_CHROME to the executable.');
    return found;
  };

  const launch = async (extra: string[], url: string): Promise<RunResult> => {
    if (closed) throw new ChromiumError('launch-failed', 'The export service is closed.');
    const exe = executable();
    const profile = await mkdtemp(join(tmpRoot, 'nm-export-profile-'));
    try {
      const result = await run(exe, chromeArgs(profile, extra, url), { timeoutMs });
      if (result.timedOut) throw new ChromiumError('timeout', `Chrome did not finish within ${Math.round(timeoutMs / 1000)} seconds.`);
      if (result.code !== 0) throw new ChromiumError('launch-failed', `Chrome exited with code ${result.code}: ${result.stderr.trim().split('\n').slice(-3).join(' ')}`);
      return result;
    } finally {
      await rm(profile, { recursive: true, force: true });
    }
  };

  const expectFile = async (out: string) => {
    const info = await stat(out).catch(() => null);
    if (!info || info.size === 0) throw new ChromiumError('no-output', `Chrome produced no output at ${out}.`);
  };

  return {
    async pdf(htmlFile, out) {
      await launch([`--print-to-pdf=${out}`, '--no-pdf-header-footer'], pathToFileURL(htmlFile).href);
      await expectFile(out);
    },
    async png(htmlFile, hash, out) {
      await launch([`--screenshot=${out}`], `${pathToFileURL(htmlFile).href}#${hash}`);
      await expectFile(out);
    },
    async geometry(htmlFile) {
      const result = await launch(['--dump-dom'], `${pathToFileURL(htmlFile).href}#nm-probe`);
      const dom = result.stdout.toString('utf8');
      const match = new RegExp(`<script type="application/json" id="${GEOMETRY_MARKER}">([\\s\\S]*?)</script>`).exec(dom);
      if (!match) throw new ChromiumError('no-output', 'The text probe returned nothing.');
      return JSON.parse(match[1].replace(/\\u003c/g, '<')) as TextBox[];
    },
    async close() {
      closed = true;
      for (const child of children) child.kill('SIGKILL');
      children.clear();
    },
  };
}
