// The editing session of one deck: the EditorDocument, the file on disk, a version counter, the log of unsaved
// transactions, and the rules for external changes. No HTTP in here.
import { dirname } from 'node:path';
import {
  ConflictError, EditorDocument, OpError, RefMap, StaleRefError, classList, findAttr, inspectDeck, lintDeck, loadDeck, outline, saveDeck, visibleText,
  type DeckInfo, type KeyedOp, type LintIssue, type LoadedFile, type NodeKey, type OutlineNode, type Transaction,
} from '../engine/index.ts';
import type { ElementNoteTarget } from './notes.ts';
import { changedLinesCache } from './changed-lines.ts';
import { previewPatch, type PreviewPatch } from './preview.ts';
import type { AgentSelectionSnapshot } from './agent-proposals.ts';

export class HttpError extends Error {
  status: number;
  code: string;
  extra: Record<string, unknown>;
  constructor(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export interface OpsRequest { ops: KeyedOp[]; label?: string; coalesceKey?: string; baseVersion: number; clientId?: string }

export interface TxResult {
  version: number;
  changed: NodeKey[];
  removed: NodeKey[];
  created: NodeKey[];
  previewPatch: PreviewPatch;
  /** The request's baseVersion was behind: this tab missed versions, so previewPatch is forced to 'reload'. */
  stale: boolean;
  dirty: boolean;
  /** Source lines that differ from the file on disk (0 when clean): the editor's unsaved-changes count. */
  changedLines: number;
  canUndo: boolean;
  canRedo: boolean;
}

export type SessionEvent =
  | { event: 'version'; data: Omit<TxResult, 'stale'> & { source: 'ops' | 'undo' | 'redo' | 'reload' | 'resolve'; origin?: string } }
  | { event: 'saved'; data: { fingerprint: string; dirty: boolean; changedLines: number; version: number } }
  | { event: 'disk-changed'; data: { reloaded: boolean; conflict: boolean; fingerprint?: string; diskFingerprint?: string; deleted?: boolean; version: number; resolved?: string } }
  | { event: 'lint'; data: { version: number; issues: KeyedLint[] } };

type KeyedLint = LintIssue & { nodeKey: NodeKey | null };

export interface FailedReplay { label: string; ops: KeyedOp[]; code: string; message: string }

interface LogEntry { tx: Transaction; ops: KeyedOp[]; label: string; minted: NodeKey[] }

export interface KeyedInfo extends Omit<DeckInfo, 'slides' | 'zoomSteps' | 'morph' | 'entrances' | 'anatomy'> {
  slides: (DeckInfo['slides'][number] & { key: NodeKey })[];
  zoomSteps: (DeckInfo['zoomSteps'][number] & { key: NodeKey; slideKey: NodeKey | null })[];
  entrances: (DeckInfo['entrances'][number] & { key: NodeKey; slideKey: NodeKey | null })[];
  anatomy: (DeckInfo['anatomy'][number] & { key: NodeKey; slideKey: NodeKey | null })[];
  morph: Record<string, NodeKey[]>;
}

export interface SessionState {
  version: number;
  fingerprint: string;
  dirty: boolean;
  changedLines: number;
  canUndo: boolean;
  canRedo: boolean;
  conflict: { diskFingerprint: string; deleted?: boolean } | null;
  info: KeyedInfo;
  lint: KeyedLint[];
}

const LINT_DELAY_MS = 250;

export class Session {
  readonly deckPath: string;
  private file: LoadedFile;
  private doc: EditorDocument;
  private baseRefs: RefMap;
  private version = 1;
  private conflict: SessionState['conflict'] = null;
  private done: LogEntry[] = [];
  private undone: LogEntry[] = [];
  private marker: LogEntry | null = null; // top of the log when we last saved or loaded
  private listeners = new Set<(e: SessionEvent) => void>();
  private chain: Promise<unknown> = Promise.resolve();
  private lintTimer: NodeJS.Timeout | null = null;
  private lastLint = '';
  private closed = false;
  private readonly countLines = changedLinesCache();

  private constructor(deckPath: string, file: LoadedFile) {
    this.deckPath = deckPath;
    this.file = file;
    this.doc = EditorDocument.fromText(file.text);
    this.baseRefs = this.doc.refs;
  }

  static async open(deckPath: string): Promise<Session> {
    const s = new Session(deckPath, await loadDeck(deckPath));
    s.lastLint = JSON.stringify(s.lint());
    return s;
  }

  close(): void {
    this.closed = true;
    if (this.lintTimer) clearTimeout(this.lintTimer);
    this.listeners.clear();
  }

  subscribe(fn: (e: SessionEvent) => void): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  private emit(e: SessionEvent): void {
    for (const fn of this.listeners) fn(e);
  }

  /** Serialise everything that touches the file or replaces the document. */
  private exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn, fn);
    this.chain = run.catch(() => {});
    return run;
  }

  // --- reads ----------------------------------------------------------------------------------------------------

  get currentVersion(): number { return this.version; }
  get text(): string { return this.doc.text; }
  get isDirty(): boolean { return this.doc.text !== this.file.text; }
  get changedLines(): number { return this.countLines(this.file.text, this.doc.text); }

  /** The editor's current text (unsaved edits included) and its version: what an export is made from. */
  exportSource(): { text: string; version: number } {
    return { text: this.doc.text, version: this.version };
  }

  /** The current document for rendering a preview. */
  snapshot(): { doc: EditorDocument['doc']; refs: RefMap; version: number } {
    return { doc: this.doc.doc, refs: this.doc.refs, version: this.version };
  }

  private info(): KeyedInfo {
    const doc = this.doc.doc;
    const refs = this.doc.refs;
    const info = inspectDeck(doc);
    const key = (id: number) => refs.keyOf(id);
    const morph: Record<string, NodeKey[]> = {};
    for (const [name, ids] of Object.entries(info.morph)) morph[name] = ids.map(key);
    return {
      ...info,
      slides: info.slides.map((s) => ({ ...s, key: key(s.id) })),
      zoomSteps: info.zoomSteps.map((z) => ({ ...z, key: key(z.id), slideKey: z.slideId >= 0 ? key(z.slideId) : null })),
      entrances: info.entrances.map((item) => ({ ...item, key: key(item.id), slideKey: item.slideId >= 0 ? key(item.slideId) : null })),
      anatomy: info.anatomy.map((item) => ({ ...item, key: key(item.id), slideKey: item.slideId >= 0 ? key(item.slideId) : null })),
      morph,
    };
  }

  private lint(): KeyedLint[] {
    const doc = this.doc.doc;
    const refs = this.doc.refs;
    return lintDeck(doc, inspectDeck(doc), dirname(this.deckPath)).map((i) => ({
      ...i,
      nodeKey: i.nodeId !== null && i.nodeId >= 0 && i.nodeId < doc.nodes.length ? refs.keyOf(i.nodeId) : null,
    }));
  }

  state(): SessionState {
    return {
      version: this.version,
      fingerprint: this.file.fingerprint,
      dirty: this.isDirty,
      changedLines: this.changedLines,
      canUndo: this.doc.canUndo(),
      canRedo: this.doc.canRedo(),
      conflict: this.conflict,
      info: this.info(),
      lint: this.lint(),
    };
  }

  outline(slide: number, depth: number): { version: number; slide: number; outline: OutlineNode } {
    const doc = this.doc.doc;
    const slides = inspectDeck(doc).slides;
    const s = slides[slide - 1];
    if (!s) throw new HttpError(400, 'bad-slide', `slide ${slide}: the deck has ${slides.length} slides (numbered from 1)`);
    const refs = this.doc.refs;
    return { version: this.version, slide, outline: outline(doc, s.id, depth, (id) => refs.keyOf(id)) };
  }

  /** Resolve a transient client key to immutable, server-owned context for a durable agent note. */
  noteTarget(key: NodeKey): ElementNoteTarget {
    const doc = this.doc.doc;
    const id = this.doc.refs.idOf(key);
    if (id === null) throw new HttpError(409, 'stale-ref', `node reference ${JSON.stringify(key)} does not resolve`, { key });
    const node = doc.nodes[id];
    const info = inspectDeck(doc);
    const slideIndex = info.slides.findIndex((slide) => {
      for (let p: number | null = id; p !== null; p = doc.nodes[p].parent) if (p === slide.id) return true;
      return false;
    });
    if (slideIndex < 0) throw new HttpError(400, 'bad-note-target', 'element notes must target an element inside a slide');
    const slide = info.slides[slideIndex];
    let text = '';
    try { text = visibleText(doc, id).replace(/\s+/g, ' ').trim().slice(0, 500); } catch { /* non-text element */ }
    const firstHeading = doc.nodes.find((candidate) => {
      if (!/^h[12]$/.test(candidate.tag)) return false;
      for (let p: number | null = candidate.id; p !== null; p = doc.nodes[p].parent) if (p === slide.id) return true;
      return false;
    });
    const childTags = node.children.map((child) => doc.nodes[child].tag);
    const inline = new Set(['span', 'b', 'strong', 'i', 'em', 'small', 'sup', 'sub', 'a', 'mark', 'u', 'br', 'bdi', 'bdo', 'code', 'abbr', 'time', 's', 'q']);
    const role = node.id === slide.id ? 'شريحة'
      : /^h[12]$/.test(node.tag) ? (firstHeading?.id === node.id ? 'العنوان الرئيس' : 'عنوان')
      : /^h[3-6]$/.test(node.tag) ? 'عنوان'
      : ['img', 'picture', 'video', 'canvas'].includes(node.tag) ? 'صورة'
      : ['iframe', 'object', 'embed'].includes(node.tag) ? 'مجسّم'
      : node.tag === 'svg' ? (childTags.includes('image') ? 'صورة' : 'شكل')
      : childTags.length ? (text && childTags.every((tag) => inline.has(tag)) ? 'نص' : 'مجموعة')
      : text ? 'نص' : 'شكل';
    return {
      kind: 'element', key,
      ...(findAttr(node, 'data-nid')?.value ? { dataNid: findAttr(node, 'data-nid')!.value } : {}),
      slide: slideIndex + 1,
      ...(slide.title ? { slideTitle: slide.title } : {}),
      tag: node.tag,
      role,
      ...(text ? { text } : {}),
      classes: classList(node),
    };
  }

  /** Capture the selected source element and the immutable session version an AI proposal is based on. */
  agentSelection(key: NodeKey): AgentSelectionSnapshot {
    const target = this.noteTarget(key);
    const id = this.doc.refs.idOf(key);
    if (id === null) throw new HttpError(409, 'stale-ref', `node reference ${JSON.stringify(key)} does not resolve`, { key });
    const node = this.doc.doc.nodes[id];
    if (!node.patchable || node.start < 0 || node.end < node.start) {
      throw new HttpError(422, 'unpatchable-selection', 'the selected element has no editable source range');
    }
    return {
      baseVersion: this.version,
      deckPath: this.deckPath,
      source: this.doc.text,
      key,
      id,
      slide: target.slide,
      tag: node.tag,
      role: target.role,
      ...(target.text ? { text: target.text } : {}),
      classes: classList(node),
      html: this.doc.text.slice(node.start, node.end),
      ...(findAttr(node, 'src')?.value ? { src: findAttr(node, 'src')!.value } : {}),
    };
  }

  // --- edits ----------------------------------------------------------------------------------------------------

  private flags() {
    return { dirty: this.isDirty, changedLines: this.changedLines, canUndo: this.doc.canUndo(), canRedo: this.doc.canRedo() };
  }

  private scheduleLint(): void {
    if (this.lintTimer || this.closed) return;
    this.lintTimer = setTimeout(() => {
      this.lintTimer = null;
      if (this.closed) return;
      try {
        const issues = this.lint();
        const json = JSON.stringify(issues);
        if (json === this.lastLint) return;
        this.lastLint = json;
        this.emit({ event: 'lint', data: { version: this.version, issues } });
      } catch {
        // lint is advice: a failure here must never take the editor (and unsaved edits) down
      }
    }, LINT_DELAY_MS);
    this.lintTimer.unref();
  }

  /** Turn the difference between two reference maps into the response and the broadcast. */
  private publish(
    before: RefMap,
    source: 'ops' | 'undo' | 'redo' | 'reload' | 'resolve',
    stale: boolean,
    origin?: string,
    structuralTextKeys: readonly NodeKey[] = [],
  ): TxResult {
    this.version++;
    const after = this.doc.refs;
    const diff = RefMap.diff(before, after);
    const patch = source === 'reload' || source === 'resolve'
      ? 'reload'
      : previewPatch(this.doc.doc, after, diff, structuralTextKeys);
    const base = {
      version: this.version,
      changed: [...diff.created, ...diff.content, ...diff.attrs],
      removed: diff.removed,
      created: diff.created,
      previewPatch: patch,
      ...this.flags(),
    };
    this.emit({ event: 'version', data: { ...base, source, ...(origin ? { origin } : {}) } });
    this.scheduleLint();
    return { ...base, previewPatch: stale ? 'reload' : patch, stale };
  }

  applyOps(req: OpsRequest): TxResult {
    const stale = req.baseVersion !== this.version;
    const before = this.doc.refs;
    const textBefore = this.doc.text;
    const top = this.done[this.done.length - 1];
    // Never merge a post-save op into the transaction that was saved: the unsaved log must stay separable.
    const coalesceKey = top && top === this.marker ? undefined : req.coalesceKey;
    let tx: Transaction;
    try {
      tx = this.doc.applyKeyed(req.ops, { label: req.label, coalesceKey });
    } catch (e) {
      if (e instanceof StaleRefError) throw new HttpError(409, 'stale-ref', e.message, { key: e.key });
      if (e instanceof OpError) throw new HttpError(422, 'op-error', e.message, { opCode: e.code });
      throw e;
    }
    if (this.doc.text === textBefore) {
      return { version: this.version, changed: [], removed: [], created: [], previewPatch: [], stale, ...this.flags() };
    }
    const minted = this.doc.mintedBy(tx);
    if (top && top.tx === tx) {
      top.ops.push(...req.ops);
      top.minted = minted;
    } else {
      this.done.push({ tx, ops: [...req.ops], label: tx.label, minted });
      this.undone = [];
    }
    const structuralTextKeys = req.ops.length > 0 && req.ops.every((op) => op.kind === 'setText')
      ? req.ops.map((op) => (op as Extract<KeyedOp, { kind: 'setText' }>).id)
      : [];
    return this.publish(before, 'ops', stale, req.clientId, structuralTextKeys);
  }

  /** Apply a reviewed AI proposal as one transaction, only against the exact version it inspected. */
  acceptAgentOps(req: { baseVersion: number; ops: KeyedOp[]; label: string; clientId?: string }): TxResult {
    if (req.baseVersion !== this.version) {
      throw new HttpError(409, 'stale-proposal', `proposal version ${req.baseVersion} does not match current version ${this.version}`, {
        proposalVersion: req.baseVersion,
        currentVersion: this.version,
      });
    }
    return this.applyOps({ ...req, coalesceKey: undefined });
  }

  undo(): TxResult {
    const before = this.doc.refs;
    if (!this.doc.undo()) return { version: this.version, changed: [], removed: [], created: [], previewPatch: [], stale: false, ...this.flags() };
    const e = this.done.pop();
    if (e) this.undone.push(e);
    return this.publish(before, 'undo', false);
  }

  redo(): TxResult {
    const before = this.doc.refs;
    if (!this.doc.redo()) return { version: this.version, changed: [], removed: [], created: [], previewPatch: [], stale: false, ...this.flags() };
    const e = this.undone.pop();
    if (e) this.done.push(e);
    return this.publish(before, 'redo', false);
  }

  // --- saving ---------------------------------------------------------------------------------------------------

  save(): Promise<{ fingerprint: string; dirty: boolean; version: number }> {
    return this.exclusive(async () => {
      if (this.conflict) {
        throw new HttpError(409, 'conflict', 'the file changed on disk while there are unsaved edits; resolve first (reload or reapply)', {
          diskFingerprint: this.conflict.diskFingerprint,
        });
      }
      // Everything the save is about is captured now: a second tab's op may land while the write is in flight.
      const text = this.doc.text;
      const refs = this.doc.refs;
      const top = this.done[this.done.length - 1] ?? null;
      let saved: LoadedFile;
      try {
        saved = await saveDeck(this.file, text);
      } catch (e) {
        if (e instanceof ConflictError) {
          this.conflict = { diskFingerprint: e.diskFingerprint };
          this.emit({ event: 'disk-changed', data: { reloaded: false, conflict: true, diskFingerprint: e.diskFingerprint, version: this.version } });
          throw new HttpError(409, 'conflict', e.message, { diskFingerprint: e.diskFingerprint });
        }
        throw e;
      }
      this.file = saved;
      this.baseRefs = refs;
      this.marker = top;
      const out = { fingerprint: saved.fingerprint, dirty: this.isDirty, changedLines: this.changedLines, version: this.version };
      this.emit({ event: 'saved', data: out });
      return out;
    });
  }

  // --- external changes -----------------------------------------------------------------------------------------

  private install(file: LoadedFile): void {
    this.file = file;
    this.doc = EditorDocument.fromText(file.text, { keysFrom: this.baseRefs });
    this.baseRefs = this.doc.refs;
    this.done = [];
    this.undone = [];
    this.marker = null;
    this.conflict = null;
  }

  /** Compare the disk with what we last loaded or wrote, and react (reload silently, or flag a conflict). */
  checkDisk(): Promise<void> {
    return this.exclusive(async () => {
      if (this.closed) return;
      let disk: LoadedFile;
      try {
        disk = await loadDeck(this.deckPath);
      } catch (e) {
        const gone = (e as NodeJS.ErrnoException).code === 'ENOENT';
        const diskFingerprint = gone ? '' : 'unreadable';
        if (this.conflict?.diskFingerprint !== diskFingerprint) {
          this.conflict = { diskFingerprint, ...(gone ? { deleted: true } : {}) };
          this.emit({ event: 'disk-changed', data: { reloaded: false, conflict: true, diskFingerprint, deleted: gone, version: this.version } });
        }
        return;
      }
      if (disk.fingerprint === this.file.fingerprint) {
        if (this.conflict) {
          this.conflict = null;
          this.emit({ event: 'disk-changed', data: { reloaded: false, conflict: false, fingerprint: disk.fingerprint, version: this.version } });
        }
        return;
      }
      if (this.doc.text === this.file.text) {
        const before = this.doc.refs;
        this.install(disk);
        const r = this.publish(before, 'reload', false);
        this.emit({ event: 'disk-changed', data: { reloaded: true, conflict: false, fingerprint: disk.fingerprint, version: r.version } });
      } else if (this.conflict?.diskFingerprint !== disk.fingerprint) {
        this.conflict = { diskFingerprint: disk.fingerprint };
        this.emit({ event: 'disk-changed', data: { reloaded: false, conflict: true, diskFingerprint: disk.fingerprint, version: this.version } });
      }
    });
  }

  /** The transactions applied since the last save or load, oldest first; null when undo has gone past that point. */
  private unsaved(): LogEntry[] | null {
    if (this.marker === null) return this.done;
    const i = this.done.indexOf(this.marker);
    return i < 0 ? null : this.done.slice(i + 1);
  }

  resolve(strategy: 'reload' | 'reapply'): Promise<{ version: number; applied: number; failed: FailedReplay[]; dirty: boolean }> {
    return this.exclusive(async () => {
      const entries = strategy === 'reapply' ? this.unsaved() : [];
      if (entries === null) {
        throw new HttpError(409, 'not-replayable', 'the edits since the last save cannot be replayed (undo went past the save point); use strategy "reload"');
      }
      const disk = await loadDeck(this.deckPath);
      const before = this.doc.refs;
      this.install(disk);
      const failed: FailedReplay[] = [];
      let applied = 0;
      for (const e of entries) {
        try {
          const tx = this.doc.applyKeyed(e.ops, { label: e.label, reuseKeys: e.minted });
          if (tx.forward.flat().length > 0) {
            const prev = this.done[this.done.length - 1];
            if (prev && prev.tx === tx) prev.ops.push(...e.ops);
            else this.done.push({ tx, ops: [...e.ops], label: e.label, minted: this.doc.mintedBy(tx) });
            applied++;
          }
        } catch (err) {
          const code = err instanceof StaleRefError ? 'stale-ref' : err instanceof OpError ? err.code : 'error';
          failed.push({ label: e.label, ops: e.ops, code, message: (err as Error).message });
        }
      }
      this.marker = null;
      const r = this.publish(before, 'resolve', false);
      this.emit({ event: 'disk-changed', data: { reloaded: true, conflict: false, fingerprint: disk.fingerprint, version: r.version, resolved: strategy } });
      return { version: r.version, applied, failed, dirty: this.isDirty };
    });
  }
}
