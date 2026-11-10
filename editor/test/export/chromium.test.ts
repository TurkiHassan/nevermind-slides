import { existsSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ChromiumError, chromeArgs, createChromiumDriver, findChrome, type RunProcess } from '../../src/export/chromium.ts';

function fixture(handler: (args: string[]) => { code?: number; stdout?: string; timedOut?: boolean; write?: string }) {
  const tmpRoot = mkdtempSync(join(tmpdir(), 'nm-export-chrome-'));
  const runs: { command: string; args: string[] }[] = [];
  const run: RunProcess = async (command, args) => {
    runs.push({ command, args });
    const r = handler(args);
    const target = args.find((a) => a.startsWith('--screenshot=') || a.startsWith('--print-to-pdf='));
    if (target && r.write !== undefined) writeFileSync(target.split('=').slice(1).join('='), r.write);
    return { code: r.code ?? 0, stdout: Buffer.from(r.stdout ?? ''), stderr: '', timedOut: r.timedOut ?? false };
  };
  return { tmpRoot, runs, driver: createChromiumDriver({ executable: '/fake/chrome', run, tmpRoot, timeoutMs: 1000 }) };
}

describe('chromium driver', () => {
  it('captures a slide with shell-free argv, a private profile, and the slide in the URL hash', async () => {
    const f = fixture(() => ({ write: 'png' }));
    const out = join(f.tmpRoot, 'a b.png');
    await f.driver.png('/tmp/dir with space/capture.html', 'nm-slide=2', out);
    const { command, args } = f.runs[0];
    expect(command).toBe('/fake/chrome');
    expect(args).toContain('--headless');
    expect(args).toContain('--window-size=1920,1080');
    expect(args).toContain('--force-device-scale-factor=1');
    expect(args).toContain(`--screenshot=${out}`);
    expect(args.at(-1)).toBe('file:///tmp/dir%20with%20space/capture.html#nm-slide=2');
    expect(args.find((a) => a.startsWith('--user-data-dir='))).toMatch(/nm-export-profile-/);
    expect(readdirSync(f.tmpRoot)).toEqual(['a b.png']); // profile removed
  });

  it('prints a PDF without header or footer', async () => {
    const f = fixture(() => ({ write: '%PDF' }));
    await f.driver.pdf('/tmp/x.html', join(f.tmpRoot, 'o.pdf'));
    expect(f.runs[0].args).toContain('--no-pdf-header-footer');
  });

  it('reads text geometry from the dumped DOM', async () => {
    const boxes = [{ slide: 1, text: 'a<b', x: 1 }];
    const f = fixture(() => ({ stdout: `<html><script type="application/json" id="nm-geometry">${JSON.stringify(boxes).replace(/</g, '\\u003c')}</script></html>` }));
    expect(await f.driver.geometry('/tmp/x.html')).toEqual(boxes);
  });

  it.each([
    ['exit code', { code: 3 }, 'launch-failed'],
    ['timeout', { timedOut: true }, 'timeout'],
    ['empty output', { write: '' }, 'no-output'],
  ])('reports %s as a typed error and still removes the profile', async (_n, result, code) => {
    const f = fixture(() => result as any);
    await expect(f.driver.png('/tmp/x.html', 'nm-slide=1', join(f.tmpRoot, 'o.png'))).rejects.toMatchObject({ code });
    expect(readdirSync(f.tmpRoot).filter((n) => n.startsWith('nm-export-profile-'))).toEqual([]);
  });

  it('explains a missing browser, and refuses work after close', async () => {
    const none = createChromiumDriver({ executable: null });
    await expect(none.pdf('/tmp/x.html', '/tmp/o.pdf')).rejects.toBeInstanceOf(ChromiumError);
    const f = fixture(() => ({ write: 'x' }));
    await f.driver.close();
    await expect(f.driver.png('/tmp/x.html', 'a', join(f.tmpRoot, 'o.png'))).rejects.toMatchObject({ code: 'launch-failed' });
  });
});

describe('findChrome', () => {
  it('prefers NM_CHROME, then installed Chrome, then the Playwright cache', () => {
    expect(findChrome({ NM_CHROME: '/x/chrome' }, (p) => p === '/x/chrome')).toBe('/x/chrome');
    expect(findChrome({ NM_CHROME: '/missing' }, () => false)).toBeNull();
    expect(findChrome({}, (p) => p.endsWith('Google Chrome'))).toContain('Google Chrome.app');
    const cache = '/c/ms-playwright/chromium-1/chrome-linux/chrome';
    expect(findChrome({ PLAYWRIGHT_BROWSERS_PATH: '/c/ms-playwright' }, (p) => p === cache, () => ['chromium-1', 'ffmpeg-1'])).toBe(cache);
  });

  it('builds argv with the profile and URL as separate entries', () => {
    const args = chromeArgs('/p', ['--x'], 'file:///a');
    expect(args.slice(-3)).toEqual(['--user-data-dir=/p', '--x', 'file:///a']);
    expect(existsSync('/p')).toBe(false);
  });
});
