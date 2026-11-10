// Shared test helpers. No vitest imports here: scripts/phase1-gate.mjs imports this file too.
import { cpSync, existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const fixturePath = (rel: string) => join(ROOT, 'fixtures', rel);

export function loadFixture(rel: string): string | null {
  const p = fixturePath(rel);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
}

export const toCrlf = (s: string) => s.replace(/\r?\n/g, '\r\n');
export const toBom = (s: string) => '﻿' + s;

export interface Fixture { name: string; text: string | null; real: boolean }

const minimal = loadFixture('synthetic/minimal-deck.html');
const edge = loadFixture('synthetic/edge-cases.html');

export const ATTENTION = 'real/attention/deck.html';
export const MECHANISTIC = 'real/mechanistic/deck.html';
export const MINIMAL = 'synthetic/minimal-deck.html';
export const EDGE = 'synthetic/edge-cases.html';

/** Every fixture plus CRLF and BOM variants generated in memory. Real decks are null when absent. */
export const ALL_FIXTURES: Fixture[] = [
  { name: 'synthetic/minimal-deck', text: minimal, real: false },
  { name: 'synthetic/minimal-deck (CRLF)', text: minimal && toCrlf(minimal), real: false },
  { name: 'synthetic/minimal-deck (BOM)', text: minimal && toBom(minimal), real: false },
  { name: 'synthetic/edge-cases', text: edge, real: false },
  { name: 'synthetic/edge-cases (CRLF)', text: edge && toCrlf(edge), real: false },
  { name: 'synthetic/edge-cases (BOM)', text: edge && toBom(edge), real: false },
  { name: 'synthetic/edge-cases (CRLF+BOM)', text: edge && toBom(toCrlf(edge)), real: false },
  { name: 'real/attention', text: loadFixture(ATTENTION), real: true },
  { name: 'real/mechanistic', text: loadFixture(MECHANISTIC), real: true },
];

/** The four deck files used by the property tests and the gate. */
export const DECKS: { rel: string; text: string | null }[] = [MINIMAL, EDGE, ATTENTION, MECHANISTIC].map((rel) => ({
  rel,
  text: loadFixture(rel),
}));

/** Copy a fixture deck's directory (deck and assets) into a new temp dir. Returns the deck path in the copy. */
export function tempCopyDeck(rel: string): { dir: string; path: string } {
  const src = fixturePath(rel);
  if (!existsSync(src)) throw new Error(`fixture missing: ${rel}`);
  const dir = mkdtempSync(join(tmpdir(), 'nm-studio-test-'));
  const srcDir = dirname(src);
  if (rel.startsWith('real/')) cpSync(srcDir, dir, { recursive: true });
  else cpSync(src, join(dir, 'deck.html'));
  const name = rel.startsWith('real/') ? rel.split('/').pop()! : 'deck.html';
  return { dir, path: join(dir, name) };
}

/** Deterministic PRNG (mulberry32). */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const step = arr.length / max;
  return Array.from({ length: max }, (_, i) => arr[Math.floor(i * step)]);
}
