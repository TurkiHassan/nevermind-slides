import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CaptureDriver, TextBox } from '../../src/export/chromium.ts';
import { cssColorToHex, ExportError, ExportService } from '../../src/export/service.ts';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 9]);
const DECK = '<!doctype html><html><head><style>.slide{width:1920px}</style></head><body><section class="slide"><h1>عنوان</h1></section><section class="slide"><p>two</p></section><section class="slide"><p>three</p></section></body></html>';

function setup(box: Partial<TextBox> = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'nm-export-test-'));
  const deckPath = join(dir, 'مرحبا deck.html');
  writeFileSync(deckPath, DECK);
  const calls: { kind: string; hash?: string; page?: string }[] = [];
  const pages: string[] = [];
  const driver: CaptureDriver = {
    async pdf(page, out) { calls.push({ kind: 'pdf', page }); pages.push(readFileSync(page, 'utf8')); writeFileSync(out, '%PDF-1.4 fake'); },
    async png(page, hash, out) { calls.push({ kind: 'png', hash, page }); writeFileSync(out, PNG); },
    async geometry() {
      return [{ slide: 1, text: 'عنوان', x: 100, y: 120, width: 900, height: 160, fontSize: 64, color: 'rgb(10, 20, 30)', fontFamily: 'Thmanyah', bold: true, rtl: true, ...box },
        { slide: 2, text: 'ghost', x: 0, y: 0, width: 10, height: 10, fontSize: 12, color: 'rgba(0, 0, 0, 0)', fontFamily: 'X', bold: false, rtl: false }];
    },
    async close() { calls.push({ kind: 'close' }); },
  };
  const tmpRoot = mkdtempSync(join(tmpdir(), 'nm-export-svc-'));
  return { dir, deckPath, calls, pages, driver, tmpRoot, service: new ExportService(driver, { tmpRoot, concurrency: 2 }) };
}

describe('ExportService', () => {
  it('exports portable HTML without touching the browser or the deck', async () => {
    const s = setup();
    const before = readFileSync(s.deckPath, 'utf8');
    const out = await s.service.export({ format: 'html', source: DECK, deckPath: s.deckPath });
    expect(out.filename).toBe('مرحبا deck.html');
    expect(out.slides).toBe(3);
    expect(out.mime).toMatch(/text\/html/);
    expect(s.calls).toEqual([]);
    expect(readFileSync(s.deckPath, 'utf8')).toBe(before);
  });

  it('exports the supplied snapshot, not the file on disk', async () => {
    const s = setup();
    const out = await s.service.export({ format: 'html', source: DECK.replace('عنوان', 'نص غير محفوظ'), deckPath: s.deckPath });
    expect(out.data.toString()).toContain('نص غير محفوظ');
  });

  it('prints one PDF from a capture page that carries the runtime, and removes its temp directory', async () => {
    const s = setup();
    const out = await s.service.export({ format: 'pdf', source: DECK, deckPath: s.deckPath });
    expect(out.data.toString()).toContain('%PDF');
    expect(s.pages[0]).toContain('id="nm-export-css"');
    expect(s.pages[0]).toContain('عنوان');
    expect(readdirSync(s.tmpRoot)).toEqual([]);
  });

  it('exports exactly one PNG per slide, in a ZIP when there are several', async () => {
    const s = setup();
    const out = await s.service.export({ format: 'png', source: DECK, deckPath: s.deckPath });
    expect(s.calls.filter((c) => c.kind === 'png').map((c) => c.hash).sort()).toEqual(['nm-slide=1', 'nm-slide=2', 'nm-slide=3']);
    expect(out.mime).toBe('application/zip');
    expect(out.data.toString('latin1')).toContain('slide-03.png');
  });

  it('writes an image-mode PPTX with one slide per deck slide and no editable text', async () => {
    const s = setup();
    const out = await s.service.export({ format: 'pptx', source: DECK, deckPath: s.deckPath });
    expect(out.experimental).toBe(false);
    expect(out.data.toString('latin1')).toContain('ppt/slides/slide3.xml');
    expect(out.data.toString('utf8')).not.toContain('Editable text');
    expect(s.calls.some((c) => c.hash?.includes('nm-notext'))).toBe(false);
  });

  it('writes an experimental editable PPTX from text-free renders and measured text boxes', async () => {
    const s = setup();
    const out = await s.service.export({ format: 'pptx-editable', source: DECK, deckPath: s.deckPath });
    expect(out.experimental).toBe(true);
    expect(out.warnings.join(' ')).toMatch(/experimental/i);
    const text = out.data.toString('utf8');
    expect(text).toContain('عنوان');
    expect(text).toContain('0a141e');
    expect(text).not.toContain('ghost');
    expect(s.calls.filter((c) => c.kind === 'png').every((c) => c.hash?.endsWith('&nm-notext'))).toBe(true);
  });

  it('rejects unknown formats and decks without slides, and closes the driver', async () => {
    const s = setup();
    await expect(s.service.export({ format: 'docx' as any, source: DECK, deckPath: s.deckPath })).rejects.toBeInstanceOf(ExportError);
    await expect(s.service.export({ format: 'pdf', source: '<html><body>x</body></html>', deckPath: s.deckPath })).rejects.toMatchObject({ code: 'no-slides' });
    await s.service.close();
    expect(s.calls.at(-1)).toEqual({ kind: 'close' });
  });

  it('cleans the temp directory when a capture fails', async () => {
    const s = setup();
    s.driver.png = async () => { throw new Error('boom'); };
    await expect(s.service.export({ format: 'png', source: DECK, deckPath: s.deckPath })).rejects.toThrow('boom');
    expect(readdirSync(s.tmpRoot)).toEqual([]);
  });
});

describe('cssColorToHex', () => {
  it('converts rgb and rgba, and reports full transparency as null', () => {
    expect(cssColorToHex('rgb(255, 0, 16)')).toBe('ff0010');
    expect(cssColorToHex('rgba(1, 2, 3, 0.5)')).toBe('010203');
    expect(cssColorToHex('rgba(1, 2, 3, 0)')).toBeNull();
  });
});

describe('remote references', () => {
  const REMOTE_DECK = DECK.replace('<head>', '<head><script src="https://cdn.example.com/tailwind.js"></script>');
  it('refuses them for portable HTML unless allowed, but renders PDF, PNG and PPTX without refusing', async () => {
    const s = setup();
    await expect(s.service.export({ format: 'html', source: REMOTE_DECK, deckPath: s.deckPath })).rejects.toMatchObject({ code: 'remote-asset' });
    const html = await s.service.export({ format: 'html', source: REMOTE_DECK, deckPath: s.deckPath, allowRemote: true });
    expect(html.manifest.remote).toEqual(['https://cdn.example.com/tailwind.js']);
    for (const format of ['pdf', 'png', 'pptx'] as const) {
      const out = await s.service.export({ format, source: REMOTE_DECK, deckPath: s.deckPath });
      expect(out.manifest.remote).toEqual([]);
      expect(out.warnings.join(' ')).not.toMatch(/remote reference/);
    }
  });
});
