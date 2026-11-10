import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createPortableHtml, PortableExportError } from '../../src/export/portable-html.ts';

function project() {
  const dir = mkdtempSync(join(tmpdir(), 'nm-portable-'));
  mkdirSync(join(dir, 'assets', 'fonts'), { recursive: true });
  mkdirSync(join(dir, 'styles'), { recursive: true });
  writeFileSync(join(dir, 'assets', 'pixel.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]));
  writeFileSync(join(dir, 'assets', 'mark.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h1v1z"/></svg>');
  writeFileSync(join(dir, 'assets', 'fonts', 'deck.woff2'), Buffer.from('font-bytes'));
  writeFileSync(join(dir, 'assets', 'fonts', 'OFL.txt'), 'SIL OPEN FONT LICENSE Version 1.1');
  writeFileSync(join(dir, 'styles', 'deck.css'), '@font-face{font-family:Deck;src:url(../assets/fonts/deck.woff2)} .hero{background:url("../assets/mark.svg")}');
  writeFileSync(join(dir, 'runtime.js'), 'window.deckReady = true;');
  const source = '<!doctype html><html><head><link rel="stylesheet" href="styles/deck.css"><script src="runtime.js"></script></head><body><section class="slide"><img src="assets/pixel.png"><picture><source srcset="assets/pixel.png 1x, assets/mark.svg 2x"></picture></section></body></html>';
  const deckPath = join(dir, 'deck.html');
  writeFileSync(deckPath, source);
  return { dir, deckPath, source };
}

describe('createPortableHtml', () => {
  it('inlines local HTML, CSS, script, image, SVG, srcset, and font references into one document', async () => {
    const p = project();
    const result = await createPortableHtml({ deckPath: p.deckPath, source: p.source });

    expect(result.html).toContain('<style data-nm-inline="styles/deck.css">');
    expect(result.html).toContain('data:image/png;base64,');
    expect(result.html).toContain('data:image/svg+xml;base64,');
    expect(result.html).toContain('data:font/woff2;base64,');
    expect(result.html).toContain('<script data-nm-inline="runtime.js">window.deckReady = true;</script>');
    expect(result.html).not.toMatch(/(?:src|href)=["'](?:assets|styles)\//);
    expect(result.manifest.assets.map((asset) => asset.path)).toEqual([
      'assets/fonts/deck.woff2', 'assets/mark.svg', 'assets/pixel.png', 'runtime.js', 'styles/deck.css',
    ]);
    expect(result.manifest.fonts).toEqual([
      expect.objectContaining({ path: 'assets/fonts/deck.woff2', licensed: true, licence: 'assets/fonts/OFL.txt' }),
    ]);
    expect(result.manifest.warnings).toEqual([]);
    expect(readFileSync(p.deckPath, 'utf8')).toBe(p.source);
  });

  it('reports missing font licence evidence without claiming redistribution permission', async () => {
    const p = project();
    mkdirSync(join(p.dir, 'unlicensed'), { recursive: true });
    writeFileSync(join(p.dir, 'styles', 'deck.css'), '@font-face{font-family:Deck;src:url(../unlicensed/font.ttf)}');
    writeFileSync(join(p.dir, 'unlicensed', 'font.ttf'), 'font');
    const result = await createPortableHtml({ deckPath: p.deckPath, source: p.source });
    expect(result.manifest.fonts).toEqual([
      expect.objectContaining({ path: 'unlicensed/font.ttf', licensed: false, licence: null }),
    ]);
    expect(result.manifest.warnings[0]).toMatch(/does not grant redistribution rights/i);
  });

  it.each([
    ['remote image', '<img src="https://example.com/image.png">', 'remote-asset'],
    ['remote font', '<style>@font-face{font-family:X;src:url(https://example.com/x.woff2)}</style>', 'remote-asset'],
    ['missing asset', '<img src="assets/missing.png">', 'missing-asset'],
    ['traversal', '<img src="../outside.png">', 'outside-root'],
  ])('rejects %s instead of producing a falsely portable document', async (_name, body, code) => {
    const p = project();
    await expect(createPortableHtml({ deckPath: p.deckPath, source: `<html><body>${body}</body></html>` }))
      .rejects.toMatchObject({ code });
  });

  it('leaves fragments, data URLs, mail links, and ordinary hyperlinks unchanged', async () => {
    const p = project();
    const source = '<html><body><a href="#slide-2">next</a><a href="https://example.com">site</a><img src="data:image/png;base64,AA=="></body></html>';
    expect((await createPortableHtml({ deckPath: p.deckPath, source })).html).toContain(source);
  });

  it('enforces individual and aggregate byte limits', async () => {
    const p = project();
    await expect(createPortableHtml({ deckPath: p.deckPath, source: p.source, maxAssetBytes: 2 }))
      .rejects.toMatchObject<Partial<PortableExportError>>({ code: 'asset-too-large' });
    await expect(createPortableHtml({ deckPath: p.deckPath, source: p.source, maxTotalBytes: 10 }))
      .rejects.toMatchObject<Partial<PortableExportError>>({ code: 'export-too-large' });
  });
});

describe('createPortableHtml on realistic decks', () => {
  it('does not treat markup inside JavaScript strings or comments as references', async () => {
    const p = project();
    const source = '<html><body><!-- <img src="assets/gone.png"> --><script>const t = `<img src="${x}"><div style="background:url(${y})">`; const u = "url(cx, cy)";</script><img src="assets/pixel.png"></body></html>';
    const result = await createPortableHtml({ deckPath: p.deckPath, source });
    expect(result.html).toContain('<img src="${x}">');
    expect(result.html).toContain('url(${y})');
    expect(result.html).toContain('<img src="assets/gone.png">');
    expect(result.html).toContain('data:image/png;base64,');
  });

  it('turns a local iframe page into srcdoc and inlines that page\'s own relative references', async () => {
    const p = project();
    writeFileSync(join(p.dir, 'assets', 'inner.html'), '<style>@font-face{font-family:I;src:url(\'fonts/deck.woff2\')}</style><img src="pixel.png">');
    const source = '<html><body><iframe src="assets/inner.html?v=2" title="x"></iframe></body></html>';
    const result = await createPortableHtml({ deckPath: p.deckPath, source });
    expect(result.html).not.toContain('assets/inner.html');
    const srcdoc = /srcdoc="([^"]*)"/.exec(result.html)![1];
    expect(srcdoc).toContain('data:font/woff2;base64,');
    expect(srcdoc).toContain('data:image/png;base64,');
    expect(srcdoc).not.toMatch(/fonts\/deck|"pixel\.png"/);
  });

  it('inlines multi-line style attributes, Tailwind url() classes and favicons; drops local preloads', async () => {
    const p = project();
    const source = '<html><head><link rel="icon" href="assets/pixel.png"><link rel="preload" href="assets/mark.svg" as="image"><link rel="preconnect" href="https://fonts.googleapis.com"></head><body><div style="color:red;\n background:url(assets/mark.svg)" class="bg-[url(assets/pixel.png)]"></div></body></html>';
    const result = await createPortableHtml({ deckPath: p.deckPath, source });
    expect(result.html).not.toMatch(/assets\//);
    expect(result.html).toContain('rel="preconnect" href="https://fonts.googleapis.com"');
    expect(result.html).toContain('bg-[url(data:image/png;base64,');
  });

  it('keeps remote stylesheets and scripts only when allowed, and reports them', async () => {
    const p = project();
    const source = '<html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=X"><script src="https://cdn.example.com/t.js"></script></head><body></body></html>';
    await expect(createPortableHtml({ deckPath: p.deckPath, source })).rejects.toMatchObject({ code: 'remote-asset' });
    const result = await createPortableHtml({ deckPath: p.deckPath, source, allowRemote: true });
    expect(result.html).toContain('href="https://fonts.googleapis.com/css2?family=X"');
    expect(result.manifest.remote).toEqual(['https://cdn.example.com/t.js', 'https://fonts.googleapis.com/css2?family=X']);
    expect(result.manifest.warnings.join('\n')).toMatch(/needs a network connection/);
  });

  it('does not accept a project-level licence higher up as evidence for a font', async () => {
    const p = project();
    writeFileSync(join(p.dir, 'LICENSE'), 'MIT');
    mkdirSync(join(p.dir, 'f'), { recursive: true });
    writeFileSync(join(p.dir, 'f', 'x.otf'), 'font');
    writeFileSync(join(p.dir, 'styles', 'deck.css'), '@font-face{font-family:Deck;src:url(../f/x.otf)}');
    const result = await createPortableHtml({ deckPath: p.deckPath, source: p.source });
    expect(result.manifest.fonts).toEqual([expect.objectContaining({ path: 'f/x.otf', licensed: false })]);
  });
});
