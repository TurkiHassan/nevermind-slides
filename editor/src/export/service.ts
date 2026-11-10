// Format-neutral export orchestration. One immutable source snapshot in, one downloadable artifact out. Nothing here
// writes to the deck directory: the capture document and Chrome profiles live in a private temp directory.
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, extname, join } from 'node:path';
import { inspectDeck, parseSource } from '../engine/index.ts';
import type { CaptureDriver, TextBox } from './chromium.ts';
import { withCaptureRuntime } from './page-runtime.ts';
import { createPortableHtml, type PortableManifest } from './portable-html.ts';
import { createPptx, type PptxText } from './pptx.ts';
import { createZip } from './zip.ts';

export const EXPORT_FORMATS = ['html', 'pdf', 'png', 'pptx', 'pptx-editable'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export interface ExportRequest {
  format: ExportFormat;
  /** The source text to export: the editor's current text, captured by the caller. */
  source: string;
  deckPath: string;
  allowRemote?: boolean;
}

export interface ExportArtifact {
  format: ExportFormat;
  filename: string;
  mime: string;
  data: Buffer;
  slides: number;
  experimental: boolean;
  warnings: string[];
  manifest: PortableManifest;
}

export class ExportError extends Error {
  readonly code: 'bad-format' | 'no-slides';
  constructor(code: ExportError['code'], message: string) {
    super(message);
    this.name = 'ExportError';
    this.code = code;
  }
}

export interface ExportServiceOptions { tmpRoot?: string; concurrency?: number }

const MIMES: Record<ExportFormat, string> = {
  html: 'text/html; charset=utf-8',
  pdf: 'application/pdf',
  png: 'image/png',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'pptx-editable': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

const pad = (n: number) => String(n).padStart(2, '0');

/** `rgb(12, 34, 56)` or `rgba(...)` to RRGGBB, or null when fully transparent. */
export function cssColorToHex(css: string): string | null {
  const m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/.exec(css);
  if (!m) return '000000';
  if (m[4] !== undefined && Number(m[4]) === 0) return null;
  return [m[1], m[2], m[3]].map((v) => Math.max(0, Math.min(255, Number(v))).toString(16).padStart(2, '0')).join('');
}

async function pool<T>(items: T[], size: number, work: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  let failure: unknown = null;
  const worker = async () => {
    while (failure === null) {
      const i = next++;
      if (i >= items.length) return;
      try { await work(items[i]); } catch (error) { failure = error; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
  if (failure !== null) throw failure;
}

export class ExportService {
  private readonly driver: CaptureDriver;
  private readonly tmpRoot: string;
  private readonly concurrency: number;
  private readonly dirs = new Set<string>();

  constructor(driver: CaptureDriver, options: ExportServiceOptions = {}) {
    this.driver = driver;
    this.tmpRoot = options.tmpRoot ?? tmpdir();
    this.concurrency = options.concurrency ?? 3;
  }

  async export(request: ExportRequest): Promise<ExportArtifact> {
    if (!EXPORT_FORMATS.includes(request.format)) throw new ExportError('bad-format', `unknown export format: ${request.format}`);
    const source = request.source.replace(/^﻿/, '');
    const slides = inspectDeck(parseSource(source)).slides.length;
    if (slides === 0) throw new ExportError('no-slides', 'The deck has no slides to export.');
    const stem = basename(request.deckPath, extname(request.deckPath)) || 'deck';

    // A portable HTML file promises to work offline, so remote references are refused unless the caller opts in. PDF,
    // PNG and PPTX are renderings of what Chrome shows (it may fetch remote styles while rendering), so they never are.
    const rendered = request.format !== 'html';
    const portable = await createPortableHtml({ deckPath: request.deckPath, source, allowRemote: rendered || request.allowRemote });
    const remoteWarning = / is still a remote reference; /;
    const manifest = rendered ? { ...portable.manifest, remote: [], warnings: portable.manifest.warnings.filter((w) => !remoteWarning.test(w)) } : portable.manifest;
    const common = { format: request.format, slides, warnings: manifest.warnings, manifest, mime: MIMES[request.format] };
    if (request.format === 'html') {
      return { ...common, filename: `${stem}.html`, data: Buffer.from(portable.html, 'utf8'), experimental: false };
    }

    const dir = await mkdtemp(join(this.tmpRoot, 'nm-export-'));
    this.dirs.add(dir);
    try {
      const page = join(dir, 'capture.html');
      await writeFile(page, withCaptureRuntime(portable.html));
      const numbers = Array.from({ length: slides }, (_, i) => i + 1);

      if (request.format === 'pdf') {
        const out = join(dir, 'deck.pdf');
        await this.driver.pdf(page, out);
        return { ...common, filename: `${stem}.pdf`, data: await readFile(out), experimental: false };
      }

      const shoot = async (hash: string, name: string) => {
        const out = join(dir, name);
        await this.driver.png(page, hash, out);
        return readFile(out);
      };

      if (request.format === 'png') {
        const pngs = new Map<number, Buffer>();
        await pool(numbers, this.concurrency, async (n) => { pngs.set(n, await shoot(`nm-slide=${n}`, `slide-${pad(n)}.png`)); });
        if (slides === 1) return { ...common, filename: `${stem}-slide-01.png`, data: pngs.get(1)!, experimental: false };
        const zip = createZip(numbers.map((n) => ({ name: `${stem}-slide-${pad(n)}.png`, data: pngs.get(n)! })));
        return { ...common, filename: `${stem}-slides.zip`, mime: 'application/zip', data: zip, experimental: false };
      }

      const editable = request.format === 'pptx-editable';
      const boxes: TextBox[] = editable ? await this.driver.geometry(page) : [];
      const pngs = new Map<number, Buffer>();
      await pool(numbers, this.concurrency, async (n) => {
        pngs.set(n, await shoot(editable ? `nm-slide=${n}&nm-notext` : `nm-slide=${n}`, `slide-${pad(n)}.png`));
      });
      const deck = createPptx({
        editable,
        slides: numbers.map((n) => ({
          png: pngs.get(n)!,
          texts: boxes.filter((box) => box.slide === n).flatMap((box): PptxText[] => {
            const color = cssColorToHex(box.color);
            if (color === null) return [];
            return [{ text: box.text, x: box.x, y: box.y, width: box.width, height: box.height, fontSize: box.fontSize, rtl: box.rtl, color, fontFamily: box.fontFamily, bold: box.bold }];
          }),
        })),
      });
      const warnings = editable
        ? [...manifest.warnings, 'Editable PPTX is experimental: text boxes are measured from the rendered slide, and fonts must be installed on the viewing machine.']
        : manifest.warnings;
      return { ...common, warnings, filename: `${stem}${editable ? '-editable' : ''}.pptx`, data: deck, experimental: editable };
    } finally {
      this.dirs.delete(dir);
      await rm(dir, { recursive: true, force: true });
    }
  }

  async close(): Promise<void> {
    await this.driver.close();
    await Promise.all([...this.dirs].map((dir) => rm(dir, { recursive: true, force: true })));
    this.dirs.clear();
  }
}
