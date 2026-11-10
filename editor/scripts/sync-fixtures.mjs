// Copies the two real decks (licensed fonts, so git-ignored) into fixtures/real/.
// Source paths live outside the repo and are listed in fixtures/real-sources.json
// (git-ignored; start from fixtures/real-sources.example.json).
// Missing sources are reported, never fatal: exit code is always 0.
import { cpSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const realDir = join(root, 'fixtures', 'real');
const sourcesFile = join(root, 'fixtures', 'real-sources.json');

if (!existsSync(sourcesFile)) {
  console.log('no fixtures/real-sources.json: nothing to copy (see fixtures/real-sources.example.json)');
  process.exit(0);
}

const decks = JSON.parse(readFileSync(sourcesFile, 'utf8'));
const missing = [];
for (const d of decks) {
  if (!existsSync(d.deck)) {
    missing.push(d.deck);
    continue;
  }
  const outDir = join(realDir, d.name);
  mkdirSync(outDir, { recursive: true });
  cpSync(d.deck, join(outDir, 'deck.html'));
  const srcDir = dirname(d.deck);
  for (const rel of d.assets ?? []) {
    const src = join(srcDir, rel);
    if (!existsSync(src)) {
      missing.push(src);
      continue;
    }
    const dst = join(outDir, rel);
    mkdirSync(dirname(dst), { recursive: true });
    cpSync(src, dst, { recursive: statSync(src).isDirectory() });
  }
  console.log(`copied ${d.name} -> ${outDir}`);
}

if (missing.length) {
  console.log('missing sources (skipped):');
  for (const m of missing) console.log('  ' + m);
} else {
  console.log('all sources present');
}
process.exit(0);
