// Regression for the Phase 7 entrance write-back: the inspected deck info is refreshed asynchronously after an op,
// so a queued field change must wait for the inspection of the version it builds on instead of reading stale info.
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/ui/frame.ts', () => ({
  editLayer: () => ({ applyPatch: () => [] }),
  elementByKey: () => null,
  loadPreview: async () => 0,
  frameWin: () => null,
  stageRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
  showSlide: () => {},
}));

import { api } from '../../src/ui/api.ts';
import { changeEntrance } from '../../src/ui/phase7-panel.tsx';
import { info, version } from '../../src/ui/state.ts';

describe('Phase 7 entrance edits against the real refresh timing', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    info.value = null;
    version.value = 0;
  });

  it('rapid kind, order and delay edits compose even though inspection lags behind the op response', async () => {
    // The server's view of the element: a legacy `.reveal` heading with no data-entrance attribute yet.
    const server = { version: 0, entrance: { key: 'n1', kind: 'reveal', order: 2, delay: 0 } };
    const attr: Record<string, 'kind' | 'order' | 'delay'> = {
      'data-entrance': 'kind', 'data-entrance-order': 'order', 'data-entrance-delay': 'delay',
    };
    info.value = { entrances: [{ ...server.entrance }] } as any;
    const sent: any[][] = [];
    vi.spyOn(api, 'ops').mockImplementation(async (ops: any) => {
      sent.push(ops);
      for (const op of ops) {
        const field = attr[op.name];
        (server.entrance as any)[field] = field === 'kind' ? op.value : Number(op.value);
      }
      server.version += 1;
      return {
        version: server.version, changed: [], removed: [], created: [], previewPatch: [], stale: false,
        dirty: true, changedLines: 1, canUndo: true, canRedo: false,
      } as any;
    });
    vi.spyOn(api, 'state').mockImplementation(async () => {
      const snapshot = { version: server.version, entrances: [{ ...server.entrance }] };
      await new Promise((resolve) => setTimeout(resolve, 20)); // inspection always lands after the op response
      return {
        version: snapshot.version, fingerprint: '', conflict: null, info: { entrances: snapshot.entrances },
        lint: [], notes: {}, dirty: true, changedLines: 1, canUndo: true, canRedo: false,
      } as any;
    });

    await Promise.all([
      changeEntrance('n1', 'kind', 'scale'),
      changeEntrance('n1', 'order', 2),
      changeEntrance('n1', 'delay', 250),
    ]);

    expect(sent).toHaveLength(3);
    expect(sent[2]).toEqual([
      { kind: 'setAttr', id: 'n1', name: 'data-entrance', value: 'scale' },
      { kind: 'setAttr', id: 'n1', name: 'data-entrance-order', value: '2' },
      { kind: 'setAttr', id: 'n1', name: 'data-entrance-delay', value: '250' },
    ]);
    expect(server.entrance).toEqual({ key: 'n1', kind: 'scale', order: 2, delay: 250 });
  });
});
