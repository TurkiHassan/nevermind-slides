import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { UploadError, saveUploadedImage } from '../../src/server/uploads.ts';

const PNG_1X1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

describe('Phase 6 image uploads', () => {
  it('writes an accepted image beneath assets with a deck-relative path', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'nm-upload-'));
    const deck = join(dir, 'deck.html');
    writeFileSync(deck, '<html></html>');
    const result = await saveUploadedImage(deck, { name: '../صورة رئيسة.png', type: 'image/png', data: PNG_1X1 });
    expect(result.path).toBe('assets/صورة-رئيسة.png');
    expect(existsSync(join(dir, result.path))).toBe(true);
    expect(readFileSync(join(dir, result.path)).subarray(1, 4).toString()).toBe('PNG');
  });

  it('never silently overwrites an existing asset', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'nm-upload-'));
    const deck = join(dir, 'deck.html');
    writeFileSync(deck, '<html></html>');
    const one = await saveUploadedImage(deck, { name: 'hero.png', type: 'image/png', data: PNG_1X1 });
    const two = await saveUploadedImage(deck, { name: 'hero.png', type: 'image/png', data: PNG_1X1 });
    expect(one.path).toBe('assets/hero.png');
    expect(two.path).toBe('assets/hero-2.png');
  });

  it('accepts inert SVG and rejects invalid base64, MIME mismatch, and active SVG content', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'nm-upload-'));
    const deck = join(dir, 'deck.html');
    writeFileSync(deck, '<html></html>');
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>').toString('base64');
    expect((await saveUploadedImage(deck, { name: 'shape.svg', type: 'image/svg+xml', data: svg })).path).toBe('assets/shape.svg');
    await expect(saveUploadedImage(deck, { name: 'bad.png', type: 'image/png', data: 'not base64!' })).rejects.toBeInstanceOf(UploadError);
    await expect(saveUploadedImage(deck, { name: 'fake.jpg', type: 'image/jpeg', data: PNG_1X1 })).rejects.toThrow(/does not match/);
    const active = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString('base64');
    await expect(saveUploadedImage(deck, { name: 'active.svg', type: 'image/svg+xml', data: active })).rejects.toThrow(/active content/);
  });
});
