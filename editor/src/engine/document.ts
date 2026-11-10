// EditorDocument: the façade. Holds the current text, resolves ops sequentially (each against the document the
// previous op produced), applies them all-or-nothing, and keeps the undo history.
import type { TokenContext } from './class-algebra.ts';
import { OpError } from './errors.ts';
import { History, redoText, undoText, type Transaction } from './history.ts';
import { resolveOp, type Op } from './ops.ts';
import { RefMap, resolveKeyed, type KeyedOp, type NodeKey } from './refs.ts';
import { classList, parseSource, type SourceDoc } from './source.ts';
import { applySplices, invertSplices, type Splice } from './splice.ts';
import { readTokens } from './tokens.ts';

export interface DocumentOptions {
  /** Clock for transaction timestamps and coalescing (default Date.now). */
  now?: () => number;
  /** Carry node keys over from the document this text was derived from outside the editor (see RefMap.reconcile). */
  keysFrom?: RefMap;
}

interface RefRecord { before: RefMap; after: RefMap; minted: NodeKey[] }

export interface ApplyOptions { label?: string; coalesceKey?: string }
export interface KeyedApplyOptions extends ApplyOptions {
  /** Keys to give the elements this transaction creates, in creation order (replaying a recorded transaction). */
  reuseKeys?: NodeKey[];
}

const unpatchableCount = (doc: SourceDoc) => doc.nodes.reduce((n, x) => n + (x.patchable ? 0 : 1), 0);

export class EditorDocument {
  private current: string;
  private readonly loaded: string;
  private parsed: SourceDoc | null = null;
  private ctx: TokenContext | null = null;
  private readonly history = new History();
  private readonly now: () => number;
  private refMap: RefMap | null = null;
  private tracking = false;
  private readonly keysFrom: RefMap | null;
  private readonly records = new WeakMap<Transaction, RefRecord>();

  private constructor(text: string, opts: DocumentOptions) {
    this.current = text;
    this.loaded = text;
    this.now = opts.now ?? Date.now;
    this.keysFrom = opts.keysFrom ?? null;
    this.tracking = this.keysFrom !== null;
  }

  static fromText(text: string, opts: DocumentOptions = {}): EditorDocument {
    return new EditorDocument(text, opts);
  }

  get text(): string { return this.current; }

  /** The parsed current text (parsed lazily; node ids are valid until the next apply, undo or redo). */
  get doc(): SourceDoc {
    if (!this.parsed) this.parsed = parseSource(this.current);
    return this.parsed;
  }

  get tokens(): TokenContext {
    if (!this.ctx) this.ctx = readTokens(this.doc).ctx;
    return this.ctx;
  }

  /** Stable keys for the current document's elements. Immutable: undo and redo swap in the map of that moment. */
  get refs(): RefMap {
    this.tracking = true;
    if (!this.refMap) this.refMap = this.keysFrom ? RefMap.reconcile(this.keysFrom, this.doc) : new RefMap(this.doc);
    return this.refMap;
  }

  /** Keys the transaction (as returned by apply or applyKeyed) created, in creation order. */
  mintedBy(tx: Transaction): NodeKey[] {
    return [...(this.records.get(tx)?.minted ?? [])];
  }

  get dirty(): boolean { return this.current !== this.loaded; }

  /**
   * Apply ops as one transaction. Each op resolves against the document produced by the previous one. If any op
   * throws, or would leave a node unpatchable (malformed inserted HTML), nothing changes and nothing is recorded.
   * A transaction that changes nothing is returned but not recorded.
   */
  apply(ops: Op[], opts: ApplyOptions = {}): Transaction {
    if (!Array.isArray(ops)) throw new OpError('invalid', 'apply expects an array of ops');
    return this.run(ops, false, opts);
  }

  /**
   * Like apply, but ops name elements by NodeKey. Each key is resolved against the document the previous op
   * produced, so `[insertHtml before X, setText X]` works. An unresolvable key throws StaleRefError.
   */
  applyKeyed(ops: KeyedOp[], opts: KeyedApplyOptions = {}): Transaction {
    if (!Array.isArray(ops)) throw new OpError('invalid', 'applyKeyed expects an array of ops');
    return this.run(ops, true, opts);
  }

  private run(rawOps: (Op | KeyedOp)[], keyed: boolean, opts: KeyedApplyOptions): Transaction {
    // Keys are only tracked once someone asks for them (refs, applyKeyed, keysFrom): plain apply stays as cheap as in Phase 1.
    const startRefs = keyed || this.tracking ? this.refs : null;
    let refs = startRefs;
    const minted: NodeKey[] = [];
    const reuse = [...(opts.reuseKeys ?? [])];
    const ops: Op[] = [];
    let text = this.current;
    let doc = this.doc;
    let ctx = this.tokens;
    const forward: Splice[][] = [];
    const inverse: Splice[][] = [];
    rawOps.forEach((raw, i) => {
      let splices: Splice[];
      let op: Op;
      try {
        op = keyed ? resolveKeyed(raw as KeyedOp, refs as RefMap) : (raw as Op);
        ops.push(op);
        splices = resolveOp(doc, op, ctx);
      } catch (e) {
        if (e instanceof OpError && rawOps.length > 1) e.message = `op ${i} (${(raw as Op).kind}): ${e.message}`;
        throw e;
      }
      if (splices.length === 0) {
        forward.push([]);
        inverse.push([]);
        return;
      }
      const next = applySplices(text, splices);
      const nextDoc = parseSource(next);
      if (unpatchableCount(nextDoc) > unpatchableCount(doc)) {
        throw new OpError('invalid', `op ${i} (${op.kind}) would produce markup the parser relocates (unbalanced or misnested HTML)`);
      }
      forward.push(splices);
      inverse.push(invertSplices(text, splices));
      if (op.kind === 'setToken') ctx = readTokens(nextDoc).ctx;
      if (refs) {
        refs = refs.rebase(nextDoc, splices, () => reuse.shift());
        minted.push(...refs.minted);
      }
      text = next;
      doc = nextDoc;
    });
    const tx: Transaction = {
      label: opts.label ?? ops.map((o) => o.kind).join(', '),
      ops,
      forward,
      inverse,
      at: this.now(),
      ...(opts.coalesceKey ? { coalesceKey: opts.coalesceKey } : {}),
    };
    if (text === this.current) return tx;
    this.current = text;
    this.parsed = doc;
    this.ctx = ctx;
    this.refMap = refs;
    const kept = this.history.push(tx);
    if (refs && startRefs) {
      const prior = this.records.get(kept);
      if (prior && kept !== tx) {
        this.records.set(kept, { before: prior.before, after: refs, minted: [...prior.minted, ...minted] });
      } else {
        this.records.set(kept, { before: startRefs, after: refs, minted });
      }
    }
    return kept;
  }

  undo(): boolean {
    const tx = this.history.popUndo();
    if (!tx) return false;
    this.setText(undoText(this.current, tx));
    this.refMap = this.records.get(tx)?.before ?? null;
    return true;
  }

  redo(): boolean {
    const tx = this.history.popRedo();
    if (!tx) return false;
    this.setText(redoText(this.current, tx));
    this.refMap = this.records.get(tx)?.after ?? null;
    return true;
  }

  canUndo(): boolean { return this.history.canUndo(); }
  canRedo(): boolean { return this.history.canRedo(); }

  /** Ids of `section.slide` elements, document order. */
  slides(): number[] {
    return this.doc.nodes.filter((n) => n.tag === 'section' && classList(n).includes('slide')).map((n) => n.id);
  }

  private setText(text: string): void {
    this.current = text;
    this.parsed = null;
    this.ctx = null;
  }
}
