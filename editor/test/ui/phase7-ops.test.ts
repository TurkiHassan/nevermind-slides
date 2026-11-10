import { describe, expect, it } from 'vitest';
import {
  anatomyColourOp,
  entranceOps,
  identityColourOp,
  identityFontOp,
  morphPairOps,
  zoomOrderOps,
} from '../../src/ui/phase7-ops.ts';
import { changeEntrance } from '../../src/ui/phase7-panel.tsx';
import { api } from '../../src/ui/api.ts';
import { info, version } from '../../src/ui/state.ts';
import { afterEach, vi } from 'vitest';

describe('Phase 7 motion operations', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    info.value = null;
    version.value = 0;
  });

  it('writes an entrance kind, stable order, and millisecond delay as source attributes', () => {
    expect(entranceOps('n1', { kind: 'fade-up', order: 3, delay: 450 })).toEqual([
      { kind: 'setAttr', id: 'n1', name: 'data-entrance', value: 'fade-up' },
      { kind: 'setAttr', id: 'n1', name: 'data-entrance-order', value: '3' },
      { kind: 'setAttr', id: 'n1', name: 'data-entrance-delay', value: '450' },
    ]);
  });

  it('computes each queued entrance field from the latest inspected entrance', async () => {
    info.value = {
      entrances: [{ key: 'n1', kind: 'reveal', order: 1, delay: 0 }],
    } as any;
    const sent: unknown[][] = [];
    vi.spyOn(api, 'ops').mockImplementation(async (ops) => {
      sent.push(ops);
      if (sent.length === 1) {
        info.value = {
          entrances: [{ key: 'n1', kind: 'scale', order: 1, delay: 0 }],
        } as any;
      }
      return {
        version: 0, changed: [], removed: [], created: [], previewPatch: [], stale: false,
        dirty: true, changedLines: 1, canUndo: true, canRedo: false,
      };
    });

    const kind = changeEntrance('n1', 'kind', 'scale');
    const order = changeEntrance('n1', 'order', 2);
    await Promise.all([kind, order]);

    expect(sent[1]).toEqual([
      { kind: 'setAttr', id: 'n1', name: 'data-entrance', value: 'scale' },
      { kind: 'setAttr', id: 'n1', name: 'data-entrance-order', value: '2' },
      { kind: 'setAttr', id: 'n1', name: 'data-entrance-delay', value: '0' },
    ]);
  });

  it('pairs only consecutive slides with one safe collision-free Morph group', () => {
    expect(morphPairOps({ fromKey: 'a', toKey: 'b', fromSlide: 1, toSlide: 2, group: 'Hero Card', existingGroups: ['hero-card'] })).toEqual([
      { kind: 'setAttr', id: 'a', name: 'data-morph', value: 'hero-card-2' },
      { kind: 'setAttr', id: 'b', name: 'data-morph', value: 'hero-card-2' },
    ]);
    expect(() => morphPairOps({ fromKey: 'a', toKey: 'c', fromSlide: 1, toSlide: 3, group: 'x', existingGroups: [] })).toThrow(/consecutive/);
  });

  it('renumbers Zoom steps in visual order and preserves their labels', () => {
    expect(zoomOrderOps([
      { key: 'z2', label: 'الثاني' },
      { key: 'z1', label: null },
    ])).toEqual([
      { kind: 'setAttr', id: 'z2', name: 'data-zoom-step', value: '1' },
      { kind: 'setAttr', id: 'z2', name: 'data-zoom-label', value: 'الثاني' },
      { kind: 'setAttr', id: 'z1', name: 'data-zoom-step', value: '2' },
      { kind: 'setAttr', id: 'z1', name: 'data-zoom-label', value: null },
    ]);
  });
});

describe('Phase 7 identity and anatomy operations', () => {
  it('maps identity fields to the existing surgical Tailwind token op', () => {
    expect(identityColourOp('verm', '#ff3300')).toEqual({ kind: 'setToken', path: ['colors', 'verm'], value: '#ff3300' });
    expect(identityFontOp('body', 'Thmanyah Sans')).toEqual({ kind: 'setToken', path: ['fontFamily', 'body'], value: 'Thmanyah Sans' });
    expect(identityFontOp('display', "'Zain Rounded', sans-serif")).toEqual({ kind: 'setToken', path: ['fontFamily', 'display'], value: "'Zain Rounded', sans-serif" });
  });

  it('edits only --anatomy-* host variables and rejects unsafe CSS values', () => {
    expect(anatomyColourOp('figure', '--anatomy-artery', '#d7263d')).toEqual({
      kind: 'setStyle', id: 'figure', prop: '--anatomy-artery', value: '#d7263d',
    });
    expect(() => anatomyColourOp('figure', '--brand', '#fff')).toThrow(/anatomy/);
    expect(() => anatomyColourOp('figure', '--anatomy-fill', 'red; display:none')).toThrow(/CSS/);
  });
});
