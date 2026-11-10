// Deck files on disk: fingerprinted load, conflict-checked atomic save, and snapshots in <deckdir>/.nevermind/history.
import { createHash, randomBytes } from 'node:crypto';
import { chmod, copyFile, mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

export interface LoadedFile { path: string; text: string; fingerprint: string /* sha256 of bytes */ }

export class ConflictError extends Error {
  diskFingerprint: string;
  constructor(path: string, expected: string, diskFingerprint: string) {
    super(`${path} changed on disk since it was loaded (expected ${expected.slice(0, 12)}, found ${diskFingerprint.slice(0, 12)}); ` +
      'refusing to overwrite. Reload the file and apply the edit again.');
    this.name = 'ConflictError';
    this.diskFingerprint = diskFingerprint;
  }
}

export const SNAPSHOT_LIMIT = 30;

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

async function diskFingerprint(path: string): Promise<string> {
  return sha256(await readFile(path));
}

export function historyDir(deckPath: string): string {
  return join(dirname(deckPath), '.nevermind', 'history');
}

/** Read a deck as UTF-8 (a BOM is kept as U+FEFF in the text). Refuses bytes that are not valid UTF-8. */
export async function loadDeck(path: string): Promise<LoadedFile> {
  const bytes = await readFile(path);
  const text = bytes.toString('utf8');
  if (!Buffer.from(text, 'utf8').equals(bytes)) {
    throw new Error(`${path} is not valid UTF-8; refusing to load it because saving would change bytes the edit did not touch`);
  }
  return { path, text, fingerprint: sha256(bytes) };
}

/** Snapshot file names sort by time: <basename>.<ISO time with '-' for ':'>[.<n>].html (pre-undo copies end .pre-undo.html). */
function snapshotName(deckPath: string, now: Date, tag: string): string {
  const iso = now.toISOString().replace(/:/g, '-');
  return `${basename(deckPath)}.${iso}${tag ? `.${tag}` : ''}.html`;
}

export interface Snapshot { path: string; name: string; preUndo: boolean }

/** Snapshots of a deck, oldest first. */
export async function listSnapshots(deckPath: string): Promise<Snapshot[]> {
  const dir = historyDir(deckPath);
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const prefix = basename(deckPath) + '.';
  return names
    .filter((n) => n.startsWith(prefix) && n.endsWith('.html') && /^\d{4}-\d\d-\d\dT/.test(n.slice(prefix.length)))
    .sort()
    .map((name) => ({ path: join(dir, name), name, preUndo: name.endsWith('.pre-undo.html') }));
}

async function takeSnapshot(deckPath: string, tag = ''): Promise<string> {
  const dir = historyDir(deckPath);
  await mkdir(dir, { recursive: true });
  const existing = new Set((await listSnapshots(deckPath)).map((s) => s.name));
  let now = new Date();
  let name = snapshotName(deckPath, now, tag);
  // Keep names unique and strictly increasing even within one millisecond.
  const all = [...existing].sort();
  while (existing.has(name) || (all.length && name <= all[all.length - 1])) {
    now = new Date(now.getTime() + 1);
    name = snapshotName(deckPath, now, tag);
  }
  const target = join(dir, name);
  await copyFile(deckPath, target);
  const snaps = await listSnapshots(deckPath);
  for (const s of snaps.slice(0, Math.max(0, snaps.length - SNAPSHOT_LIMIT))) await unlink(s.path);
  return target;
}

async function atomicWrite(path: string, bytes: Uint8Array): Promise<void> {
  const tmp = join(dirname(path), `.${basename(path)}.nm-tmp-${process.pid}-${randomBytes(4).toString('hex')}`);
  let mode: number | undefined;
  try {
    mode = (await stat(path)).mode & 0o7777;
  } catch { /* new file */ }
  try {
    await writeFile(tmp, bytes, { flag: 'wx' });
    if (mode !== undefined) await chmod(tmp, mode);
    await rename(tmp, path);
  } catch (e) {
    await unlink(tmp).catch(() => {});
    throw e;
  }
}

/**
 * Save `nextText` over the file. Refuses with ConflictError when the disk no longer matches `file.fingerprint`.
 * Snapshots the current disk file first (default), writes a temp file in the same directory and renames it into
 * place. A BOM is kept exactly as loaded. Saving the loaded text writes nothing.
 */
export async function saveDeck(file: LoadedFile, nextText: string, opts: { snapshot?: boolean } = {}): Promise<LoadedFile> {
  return save(file, nextText, opts.snapshot ?? true, '');
}

async function save(file: LoadedFile, nextText: string, snapshot: boolean, tag: string): Promise<LoadedFile> {
  const hadBom = file.text.charCodeAt(0) === 0xfeff;
  let text = nextText;
  if (hadBom && text.charCodeAt(0) !== 0xfeff) text = '﻿' + text;
  if (!hadBom && text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  if (text === file.text) return file;
  const disk = await diskFingerprint(file.path);
  if (disk !== file.fingerprint) throw new ConflictError(file.path, file.fingerprint, disk);
  if (snapshot) await takeSnapshot(file.path, tag);
  const bytes = Buffer.from(text, 'utf8');
  await atomicWrite(file.path, bytes);
  return { path: file.path, text, fingerprint: sha256(bytes) };
}

/**
 * Restore the newest snapshot (not counting pre-undo copies). The current file is first snapshotted as a pre-undo
 * copy, then the restored snapshot is removed, so repeated calls step further back. Returns null when there is none.
 */
export async function restoreLatestSnapshot(deckPath: string): Promise<{ file: LoadedFile; restored: string } | null> {
  const snaps = (await listSnapshots(deckPath)).filter((s) => !s.preUndo);
  const latest = snaps[snaps.length - 1];
  if (!latest) return null;
  const current = await loadDeck(deckPath);
  const restoredText = (await readFile(latest.path)).toString('utf8');
  let file = current;
  if (restoredText === current.text) {
    // Nothing to write; still consume the snapshot so the next undo steps back.
  } else {
    await takeSnapshot(deckPath, 'pre-undo');
    const bytes = Buffer.from(restoredText, 'utf8');
    if ((await diskFingerprint(deckPath)) !== current.fingerprint) throw new ConflictError(deckPath, current.fingerprint, await diskFingerprint(deckPath));
    await atomicWrite(deckPath, bytes);
    file = { path: deckPath, text: restoredText, fingerprint: sha256(bytes) };
  }
  await unlink(latest.path);
  return { file, restored: latest.name };
}
