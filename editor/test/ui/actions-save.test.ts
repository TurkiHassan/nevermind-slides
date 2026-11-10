import { afterEach, describe, expect, it, vi } from 'vitest';
import { postComputedOps, postOps, save } from '../../src/ui/actions.ts';
import { api } from '../../src/ui/api.ts';
import { flags, saving, version } from '../../src/ui/state.ts';
import type { TxResult } from '../../src/ui/types.ts';

const txResult = (): TxResult => ({
  version: 0,
  changed: [],
  removed: [],
  created: [],
  previewPatch: [],
  stale: false,
  dirty: true,
  changedLines: 1,
  canUndo: true,
  canRedo: false,
});

describe('saving queued editor operations', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    flags.value = { dirty: false, changedLines: 0, canUndo: false, canRedo: false };
    saving.value = false;
    version.value = 0;
  });

  it('does not save the source before a pending property operation reaches the server', async () => {
    let releaseOp!: (result: TxResult) => void;
    let markOpStarted!: () => void;
    const pendingOp = new Promise<TxResult>((resolve) => { releaseOp = resolve; });
    const opStarted = new Promise<void>((resolve) => { markOpStarted = resolve; });
    const order: string[] = [];
    vi.spyOn(api, 'ops').mockImplementation(async () => {
      order.push('op:start');
      markOpStarted();
      const result = await pendingOp;
      order.push('op:done');
      return result;
    });
    vi.spyOn(api, 'save').mockImplementation(async () => {
      order.push('save');
      return { fingerprint: 'saved', dirty: false, changedLines: 0, version: 0 };
    });
    flags.value = { dirty: true, changedLines: 1, canUndo: true, canRedo: false };

    const operation = postOps([{ kind: 'setUtility', id: 'n1', group: 'right', value: '77' }]);
    const savingSource = save();
    await opStarted;

    expect(order).toEqual(['op:start']);
    releaseOp(txResult());
    await Promise.all([operation, savingSource]);
    expect(order).toEqual(['op:start', 'op:done', 'save']);
    expect(flags.value.dirty).toBe(false);
  });

  it('computes a queued class mutation only after the preceding source mutation finishes', async () => {
    let releaseFirst!: (result: TxResult) => void;
    let markFirstStarted!: () => void;
    const firstPending = new Promise<TxResult>((resolve) => { releaseFirst = resolve; });
    const firstStarted = new Promise<void>((resolve) => { markFirstStarted = resolve; });
    const computedFrom: string[] = [];
    const sent: unknown[][] = [];
    let sourceClass = 'rounded-lg';
    vi.spyOn(api, 'ops').mockImplementation(async (ops) => {
      sent.push(ops);
      if (sent.length === 1) {
        markFirstStarted();
        const result = await firstPending;
        sourceClass = 'rounded-[18px]';
        return result;
      }
      return txResult();
    });

    const first = postOps([{ kind: 'setClasses', id: 'n1', classes: ['rounded-[18px]'] }]);
    const second = postComputedOps(() => {
      computedFrom.push(sourceClass);
      return [{ kind: 'setClasses', id: 'n1', classes: [sourceClass, 'shadow-lg'] }];
    });
    await firstStarted;

    expect(computedFrom).toEqual([]);
    releaseFirst(txResult());
    await Promise.all([first, second]);
    expect(computedFrom).toEqual(['rounded-[18px]']);
    expect(sent[1]).toEqual([{ kind: 'setClasses', id: 'n1', classes: ['rounded-[18px]', 'shadow-lg'] }]);
  });
});
