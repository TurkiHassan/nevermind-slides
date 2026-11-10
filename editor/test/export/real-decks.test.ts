import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createPortableHtml } from '../../src/export/portable-html.ts';
import { ATTENTION, MECHANISTIC, tempCopyDeck } from '../helpers.ts';

describe('portable export of the real decks', () => {
  it('makes the attention deck self-contained: no deck-relative reference survives', async () => {
    const copy = tempCopyDeck(ATTENTION);
    const source = readFileSync(copy.path, 'utf8');
    const { html, manifest } = await createPortableHtml({ deckPath: copy.path, source });
    expect(html).not.toMatch(/(?:src|href)=["']assets\//);
    expect(html).not.toMatch(/url\(\s*['"]?(?:\.\/)?assets\//);
    expect(html).toContain('srcdoc="');
    expect(manifest.assets.some((a) => a.path === 'assets/tailwind.js')).toBe(true);
    expect(manifest.fonts.length).toBeGreaterThan(10);
    expect(manifest.remote).toEqual([]);
  });

  it('refuses the mechanistic deck by default (Tailwind CDN, Google Fonts) and exports it when remote is allowed', async () => {
    const copy = tempCopyDeck(MECHANISTIC);
    const source = readFileSync(copy.path, 'utf8');
    await expect(createPortableHtml({ deckPath: copy.path, source })).rejects.toMatchObject({ code: 'remote-asset' });
    const { html, manifest } = await createPortableHtml({ deckPath: copy.path, source, allowRemote: true });
    expect(manifest.remote).toEqual(expect.arrayContaining(['https://cdn.tailwindcss.com']));
    expect(html).not.toMatch(/src="assets\//);
  });
});
