#!/usr/bin/env node
// nm-studio: inspect, edit and lint a nevermind deck from the command line. JSON on stdout, errors on stderr.
import { readFileSync, realpathSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ConflictError, EditorDocument, inspectDeck, lintDeck, loadDeck, OpError, restoreLatestSnapshot, saveDeck,
  outline, type DeckInfo, type Op, type OutlineNode,
} from '../engine/index.ts';
import { startEditorServer } from '../server/server.ts';
import { NotesStore } from '../server/notes.ts';
import { unifiedDiff } from './unified-diff.ts';
import { createChromiumDriver } from '../export/chromium.ts';
import { EXPORT_FORMATS, ExportService, type ExportFormat } from '../export/service.ts';

const USAGE = `usage:
  nm-studio inspect <deck.html> [--slide N] [--depth D]
  nm-studio apply <deck.html> <ops.json | -> [--dry-run] [--expect <fingerprint>] [--label <text>]
  nm-studio lint <deck.html>
  nm-studio undo <deck.html>
  nm-studio notes list <deck.html> [--all]
  nm-studio notes done <deck.html> <note-id>
  nm-studio export <deck.html> --format <html|pdf|png|pptx|pptx-editable> --out <path> [--allow-remote]
  nm-studio edit <deck.html> [--port N] [--no-open]`;
const VERSION = '0.1.0';

class UsageError extends Error {}

interface Args { positional: string[]; flags: Map<string, string | true> }

function parseArgs(argv: string[]): Args {
  const positional: string[] = [];
  const flags = new Map<string, string | true>();
  const valued = new Set(['--slide', '--depth', '--expect', '--label', '--port', '--format', '--out']);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      if (valued.has(a)) {
        if (i + 1 >= argv.length) throw new UsageError(`${a} needs a value`);
        flags.set(a, argv[++i]);
      } else if (a === '--dry-run' || a === '--no-open' || a === '--all' || a === '--allow-remote') flags.set(a, true);
      else throw new UsageError(`unknown option ${a}`);
    } else positional.push(a);
  }
  return { positional, flags };
}

const out = (v: unknown) => process.stdout.write(JSON.stringify(v, (_k, x) => (x instanceof Set ? [...x] : x), 2) + '\n');

function intFlag(args: Args, name: string, def: number): number {
  const v = args.flags.get(name);
  if (v === undefined) return def;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) throw new UsageError(`${name} must be a non-negative integer`);
  return n;
}

async function inspect(args: Args): Promise<number> {
  const file = await loadDeck(args.positional[1]);
  const ed = EditorDocument.fromText(file.text);
  const info: DeckInfo & { fingerprint: string; outline?: OutlineNode } = { ...inspectDeck(ed.doc), fingerprint: file.fingerprint };
  if (args.flags.has('--slide')) {
    const n = intFlag(args, '--slide', 1);
    const slide = info.slides[n - 1];
    if (!slide) throw new UsageError(`--slide ${n}: the deck has ${info.slides.length} slides (numbered from 1)`);
    info.outline = outline(ed.doc, slide.id, intFlag(args, '--depth', 4));
  }
  out(info);
  return 0;
}

function readOps(source: string): { ops: Op[]; label?: string } {
  const raw = source === '-' ? readFileSync(0, 'utf8') : readFileSync(source, 'utf8');
  let data: unknown;
  try { data = JSON.parse(raw); } catch (e) { throw new UsageError(`ops are not valid JSON: ${(e as Error).message}`); }
  if (Array.isArray(data)) return { ops: data as Op[] };
  if (data && typeof data === 'object' && Array.isArray((data as { ops?: unknown }).ops)) {
    const d = data as { ops: Op[]; label?: unknown };
    return { ops: d.ops, label: typeof d.label === 'string' ? d.label : undefined };
  }
  if (data && typeof data === 'object' && 'kind' in data) return { ops: [data as Op] };
  throw new UsageError('ops JSON must be an array of ops, one op, or { "ops": [...], "label": "..." }');
}

async function apply(args: Args): Promise<number> {
  const [, deck, opsSource] = args.positional;
  if (!opsSource) throw new UsageError('apply needs <deck.html> and <ops.json | ->');
  const { ops, label } = readOps(opsSource);
  const file = await loadDeck(deck);
  const expect = args.flags.get('--expect');
  if (typeof expect === 'string' && expect !== file.fingerprint) {
    throw new ConflictError(deck, expect, file.fingerprint);
  }
  const ed = EditorDocument.fromText(file.text);
  const flagLabel = args.flags.get('--label');
  const tx = ed.apply(ops, { label: typeof flagLabel === 'string' ? flagLabel : label });
  if (args.flags.has('--dry-run')) {
    process.stdout.write(unifiedDiff(file.text, ed.text, basename(deck)));
    return 0;
  }
  const saved = await saveDeck(file, ed.text);
  const splices = tx.forward.flat();
  const changedBytes = tx.forward.flat().reduce((s, sp) => s + Buffer.byteLength(sp.text), 0) +
    tx.inverse.flat().reduce((s, sp) => s + Buffer.byteLength(sp.text), 0);
  out({ changedBytes, splices: splices.length, fingerprint: saved.fingerprint });
  return 0;
}

async function lint(args: Args): Promise<number> {
  const deck = args.positional[1];
  const file = await loadDeck(deck);
  const ed = EditorDocument.fromText(file.text);
  const issues = lintDeck(ed.doc, inspectDeck(ed.doc), dirname(resolve(deck)));
  out(issues);
  return issues.some((i) => i.severity === 'error') ? 1 : 0;
}

async function undo(args: Args): Promise<number> {
  const r = await restoreLatestSnapshot(args.positional[1]);
  if (!r) throw new Error(`no snapshot to restore for ${args.positional[1]}`);
  out({ restored: r.restored, fingerprint: r.file.fingerprint });
  return 0;
}

async function notes(args: Args): Promise<number> {
  const [, action, deck, id] = args.positional;
  if (action !== 'list' && action !== 'done') throw new UsageError('notes needs list or done');
  if (!deck) throw new UsageError(`notes ${action} needs <deck.html>`);
  await loadDeck(deck);
  const store = await NotesStore.open(resolve(deck));
  try {
    if (action === 'list') {
      const document = store.read();
      out(args.flags.has('--all') ? document : { ...document, notes: document.notes.filter((note) => note.status === 'open') });
      return 0;
    }
    if (!id) throw new UsageError('notes done needs <deck.html> and <note-id>');
    const note = await store.done(id);
    out({ note, notes: store.read() });
    return 0;
  } finally {
    store.close();
  }
}

/** Export the deck as it is on disk: portable HTML, PDF, PNG per slide, or PPTX. Writes only to --out. */
async function exportDeck(args: Args): Promise<number> {
  const format = args.flags.get('--format');
  const outPath = args.flags.get('--out');
  if (typeof format !== 'string' || !(EXPORT_FORMATS as readonly string[]).includes(format)) throw new UsageError(`--format must be one of ${EXPORT_FORMATS.join(', ')}`);
  if (typeof outPath !== 'string') throw new UsageError('export needs --out <path>');
  const file = await loadDeck(args.positional[1]);
  const service = new ExportService(createChromiumDriver());
  try {
    const artifact = await service.export({ format: format as ExportFormat, source: file.text, deckPath: resolve(args.positional[1]), allowRemote: args.flags.has('--allow-remote') });
    await writeFile(resolve(outPath), artifact.data);
    out({
      format: artifact.format, out: resolve(outPath), bytes: artifact.data.length, slides: artifact.slides, experimental: artifact.experimental,
      remote: artifact.manifest.remote, warnings: artifact.warnings,
    });
    for (const warning of artifact.warnings) process.stderr.write(`nm-studio: warning: ${warning}\n`);
    return 0;
  } finally {
    await service.close();
  }
}

/** Start the editor server, print where it is, and run until SIGINT/SIGTERM. */
async function edit(args: Args): Promise<number> {
  const deck = resolve(args.positional[1]);
  await loadDeck(deck); // fail early, with the usual message, on a missing or non-UTF-8 file
  const port = args.flags.has('--port') ? intFlag(args, '--port', 0) : undefined;
  if (port !== undefined && port > 65535) throw new UsageError('--port must be between 0 and 65535');
  const server = await startEditorServer({ deckPath: deck, port, open: !args.flags.has('--no-open') });
  out({ url: server.url, port: server.port, deck });
  process.stderr.write(`nm-studio: editing ${basename(deck)} at ${server.url}\nnm-studio: Ctrl+C to stop\n`);
  await new Promise<void>((done) => {
    const stop = () => { void server.close().then(() => done()); };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  });
  return 0;
}

export async function main(argv: string[]): Promise<number> {
  try {
    if (argv.length === 1 && (argv[0] === '--version' || argv[0] === '-v')) {
      process.stdout.write(`${VERSION}\n`);
      return 0;
    }
    const args = parseArgs(argv);
    const [cmd, deck] = args.positional;
    if (!cmd || cmd === 'help' || cmd === '--help') {
      process.stderr.write(USAGE + '\n');
      return cmd ? 0 : 1;
    }
    if (!deck) throw new UsageError(`${cmd} needs <deck.html>`);
    switch (cmd) {
      case 'inspect': return await inspect(args);
      case 'apply': return await apply(args);
      case 'lint': return await lint(args);
      case 'undo': return await undo(args);
      case 'notes': return await notes(args);
      case 'export': return await exportDeck(args);
      case 'edit': return await edit(args);
      default: throw new UsageError(`unknown command ${cmd}`);
    }
  } catch (e) {
    if (e instanceof UsageError) process.stderr.write(`nm-studio: ${e.message}\n${USAGE}\n`);
    else if (e instanceof OpError) process.stderr.write(`nm-studio: [${e.code}] ${e.message}\n`);
    else if (e instanceof ConflictError) process.stderr.write(`nm-studio: [conflict] ${e.message}\n`);
    else process.stderr.write(`nm-studio: ${(e as Error).message ?? String(e)}\n`);
    return 1;
  }
}

// import.meta.main needs Node 24.2; the built bundle must also start on Node 20.
const isMain = import.meta.main ?? (process.argv[1] !== undefined && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)));
if (isMain) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; });
}
