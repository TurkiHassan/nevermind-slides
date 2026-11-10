// Phase 1 gate: for each fixture deck (temp copy with assets), apply 25 random op transactions through the CLI,
// audit the deck after each one (errors must never grow beyond the untouched copy's baseline), then undo everything
// through EditorDocument and check byte identity. Also checks that `nm-studio undo` walks the file back to the start.
// Run: node scripts/phase1-gate.mjs   (Node >= 24: imports TypeScript through type stripping)
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { EditorDocument, OpError, parseSource, resolveOp, applySplices } from '../src/engine/index.ts';
import { DECKS, ROOT, makeRng, tempCopyDeck } from '../test/helpers.ts';
import { randomOp } from '../test/random-ops.ts';

const TRANSACTIONS = 25;
const CLI = join(ROOT, 'src', 'cli', 'nm-studio.ts');
const AUDIT = join(homedir(), '.claude', 'skills', 'nevermind-slides', 'scripts', 'deck_helper.py');

function audit(path, out) {
  const r = spawnSync('python3', [AUDIT, 'audit-deck', '--html-path', path, '--output', out], { encoding: 'utf8' });
  if (!existsSync(out)) throw new Error(`audit-deck produced no report: ${r.stderr}`);
  return JSON.parse(readFileSync(out, 'utf8')).errors;
}

function cli(args, input) {
  const r = spawnSync(process.execPath, [CLI, ...args], { input, encoding: 'utf8' });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

/** A transaction of 1-3 ops; each op generated against the document the previous op produces. */
function randomTransaction(ed, rng) {
  const size = 1 + Math.floor(rng() * 3);
  const ops = [];
  let doc = ed.doc;
  let text = ed.text;
  for (let k = 0; k < size; k++) {
    const op = randomOp(doc, ed.tokens, rng, { scope: 'slides', protectStructure: true });
    if (!op) break;
    ops.push(op);
    try {
      text = applySplices(text, resolveOp(doc, op, ed.tokens));
      doc = parseSource(text);
    } catch {
      break;
    }
  }
  return ops;
}

const haveAudit = existsSync(AUDIT);
const results = [];
let failed = false;
const t0 = performance.now();

for (const [deckIndex, deck] of DECKS.entries()) {
  if (deck.text === null) {
    results.push({ deck: deck.rel, skipped: 'fixture absent' });
    continue;
  }
  const started = performance.now();
  const { dir, path } = tempCopyDeck(deck.rel);
  const original = readFileSync(path, 'utf8');
  const report = join(dir, 'audit.json');
  const baseline = haveAudit ? audit(path, report) : null;
  const rng = makeRng(0x5eed + deckIndex);
  const ed = EditorDocument.fromText(original);
  const r = { deck: deck.rel, baselineErrors: baseline, transactions: 0, ops: 0, rejected: 0, auditGrew: [], cliMismatch: 0, byKind: {} };
  while (r.transactions < TRANSACTIONS && r.rejected < 2000) {
    const ops = randomTransaction(ed, rng);
    if (ops.length === 0) { r.rejected++; continue; }
    const before = ed.text;
    try {
      ed.apply(ops);
    } catch (e) {
      if (!(e instanceof OpError)) throw e;
      r.rejected++;
      continue;
    }
    if (ed.text === before) { r.rejected++; continue; } // a no-op transaction is not recorded
    const fp = JSON.parse(cli(['inspect', path]).stdout).fingerprint;
    const res = cli(['apply', path, '-', '--expect', fp], JSON.stringify(ops));
    if (res.code !== 0 || readFileSync(path, 'utf8') !== ed.text) {
      r.cliMismatch++;
      failed = true;
      console.error(`[gate] ${deck.rel} transaction ${r.transactions}: CLI result differs (exit ${res.code}) ${res.stderr}`);
      break;
    }
    r.transactions++;
    r.ops += ops.length;
    for (const o of ops) r.byKind[o.kind] = (r.byKind[o.kind] ?? 0) + 1;
    if (haveAudit) {
      const errors = audit(path, report);
      const grown = errors.filter((e) => !baseline.includes(e));
      if (grown.length) {
        r.auditGrew.push({ transaction: r.transactions, ops, errors: grown });
        failed = true;
      }
    }
  }
  if (r.transactions < TRANSACTIONS) failed = true;
  const edited = ed.text;
  let undos = 0;
  while (ed.undo()) undos++;
  r.undoSteps = undos;
  r.undoByteIdentical = ed.text === original;
  while (ed.redo()) { /* redo all */ }
  r.redoByteIdentical = ed.text === edited;
  // The CLI's own undo walks the snapshots back to the original file.
  let cliUndos = 0;
  while (cli(['undo', path]).code === 0) cliUndos++;
  r.cliUndoSteps = cliUndos;
  r.cliUndoByteIdentical = readFileSync(path, 'utf8') === original;
  r.seconds = Number(((performance.now() - started) / 1000).toFixed(1));
  if (!r.undoByteIdentical || !r.redoByteIdentical || !r.cliUndoByteIdentical) failed = true;
  results.push(r);
  console.log(`[gate] ${deck.rel}: transactions=${r.transactions} ops=${r.ops} rejected=${r.rejected} baselineErrors=${baseline ? baseline.length : 'n/a'} ` +
    `auditGrew=${r.auditGrew.length} undo=${r.undoByteIdentical} redo=${r.redoByteIdentical} cliUndo=${r.cliUndoByteIdentical}(${cliUndos} steps) ${r.seconds}s`);
}

console.log(JSON.stringify({ audit: haveAudit ? AUDIT : 'not found (audit skipped)', results }, null, 2));
const total = ((performance.now() - t0) / 1000).toFixed(1);
console.log(`[gate] ${failed ? 'FAIL' : 'PASS'} in ${total}s`);
process.exitCode = failed ? 1 : 0;
