import { describe, expect, it } from 'vitest';
import { directShortcut, toggleSelection } from '../../src/ui/direct-shortcuts.ts';

const key = (code: string, extra: Partial<KeyboardEvent> = {}) => ({ code, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...extra } as KeyboardEvent);

describe('PowerPoint-compatible direct manipulation shortcuts', () => {
  it.each([
    ['ArrowLeft', -1, 0], ['ArrowRight', 1, 0], ['ArrowUp', 0, -1], ['ArrowDown', 0, 1],
  ])('%s nudges by one pixel', (code, dx, dy) => {
    expect(directShortcut(key(code), true)).toEqual({ kind: 'nudge', dx, dy });
  });

  it('Shift plus an arrow nudges by ten pixels', () => {
    expect(directShortcut(key('ArrowRight', { shiftKey: true }), true)).toEqual({ kind: 'nudge', dx: 10, dy: 0 });
  });

  it('maps duplicate, delete, and z-order keys', () => {
    expect(directShortcut(key('KeyD', { ctrlKey: true }), true)).toEqual({ kind: 'duplicate' });
    expect(directShortcut(key('Delete'), true)).toEqual({ kind: 'delete' });
    expect(directShortcut(key('BracketRight', { metaKey: true }), true)).toEqual({ kind: 'z', delta: 1, extreme: false });
    expect(directShortcut(key('BracketLeft', { metaKey: true, shiftKey: true }), true)).toEqual({ kind: 'z', delta: -1, extreme: true });
  });

  it('does not claim direct-manipulation keys without a selection', () => {
    expect(directShortcut(key('ArrowRight'), false)).toBeNull();
    expect(directShortcut(key('Delete'), false)).toBeNull();
  });
});

describe('toggleSelection', () => {
  it('adds, removes, and keeps a deterministic primary selection', () => {
    expect(toggleSelection(['a'], 'b')).toEqual({ keys: ['a', 'b'], primary: 'b' });
    expect(toggleSelection(['a', 'b'], 'b')).toEqual({ keys: ['a'], primary: 'a' });
    expect(toggleSelection(['a'], 'a')).toEqual({ keys: [], primary: null });
  });
});
