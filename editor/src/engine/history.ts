// Undo history. A transaction stores, per op, the forward splices (against the text before that op) and their exact
// inverse (against the text after it), so undo and redo never need node identity.
import type { Op } from './ops.ts';
import { applySplices, type Splice } from './splice.ts';

export interface Transaction {
  label: string;
  ops: Op[];
  forward: Splice[][];
  inverse: Splice[][];
  at: number;
  coalesceKey?: string;
}

export const COALESCE_MS = 1000;

export function undoText(text: string, tx: Transaction): string {
  let t = text;
  for (let i = tx.inverse.length - 1; i >= 0; i--) t = applySplices(t, tx.inverse[i]);
  return t;
}

export function redoText(text: string, tx: Transaction): string {
  let t = text;
  for (const f of tx.forward) t = applySplices(t, f);
  return t;
}

export class History {
  private done: Transaction[] = [];
  private undone: Transaction[] = [];

  /** Record a transaction; merge it into the previous one when both carry the same key within COALESCE_MS. Clears redo. */
  push(tx: Transaction): Transaction {
    this.undone = [];
    const top = this.done[this.done.length - 1];
    if (top && tx.coalesceKey && top.coalesceKey === tx.coalesceKey && tx.at - top.at <= COALESCE_MS) {
      top.ops.push(...tx.ops);
      top.forward.push(...tx.forward);
      top.inverse.push(...tx.inverse);
      top.at = tx.at;
      return top;
    }
    this.done.push(tx);
    return tx;
  }

  canUndo(): boolean { return this.done.length > 0; }
  canRedo(): boolean { return this.undone.length > 0; }

  /** Move the newest transaction to the redo stack and return it. */
  popUndo(): Transaction | undefined {
    const tx = this.done.pop();
    if (tx) this.undone.push(tx);
    return tx;
  }

  popRedo(): Transaction | undefined {
    const tx = this.undone.pop();
    if (tx) this.done.push(tx);
    return tx;
  }

  get size(): number { return this.done.length; }
}
