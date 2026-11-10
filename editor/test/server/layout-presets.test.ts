import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LayoutPresetError, listLayoutPresets, readLayoutPreset } from '../../src/server/layout-presets.ts';

describe('Phase 6 layout preset catalog', () => {
  it('publishes the fixed 23-item contract with safe unique identifiers', () => {
    const presets = listLayoutPresets();
    expect(presets).toHaveLength(23);
    expect(new Set(presets.map((preset) => preset.id)).size).toBe(23);
    expect(presets.every((preset) => /^[a-z-]+\/[a-z-]+$/.test(preset.id))).toBe(true);
    expect(new Set(presets.map((preset) => preset.slot)).size).toBeGreaterThan(5);
  });

  it('extracts only the slide fragment and removes the demo active state', () => {
    const root = mkdtempSync(join(tmpdir(), 'nm-presets-'));
    const dir = join(root, 'opening', 'offset-marquee');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'preview.html'), '<!doctype html><html><body><div class="deck-stage"><section class="slide lp active bg-white"><svg><defs><linearGradient id="g"/></defs><rect fill="url(#g)"/></svg><h1>Hello</h1></section></div><script>bad()</script></body></html>');
    const preset = readLayoutPreset('opening/offset-marquee', root);
    expect(preset.html).toBe('<section class="slide lp bg-white"><svg><defs><linearGradient id="g"/></defs><rect fill="url(#g)"/></svg><h1>Hello</h1></section>');
    expect(preset.html).not.toContain('<script>');
  });

  it('rejects unknown identifiers, traversal, and missing resources', () => {
    const root = mkdtempSync(join(tmpdir(), 'nm-presets-'));
    expect(() => readLayoutPreset('../../secret', root)).toThrow(LayoutPresetError);
    expect(() => readLayoutPreset('opening/not-in-catalog', root)).toThrow(/unknown layout preset/);
    expect(() => readLayoutPreset('opening/offset-marquee', root)).toThrow(/not installed/);
  });
});
