export type DirectCommand =
  | { kind: 'nudge'; dx: number; dy: number }
  | { kind: 'duplicate' }
  | { kind: 'delete' }
  | { kind: 'z'; delta: 1 | -1; extreme: boolean };

export function directShortcut(event: Pick<KeyboardEvent, 'code' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>, hasSelection: boolean): DirectCommand | null {
  if (!hasSelection || event.altKey) return null;
  const mod = event.ctrlKey || event.metaKey;
  if (mod && event.code === 'KeyD') return { kind: 'duplicate' };
  if (mod && (event.code === 'BracketRight' || event.code === 'BracketLeft')) {
    return { kind: 'z', delta: event.code === 'BracketRight' ? 1 : -1, extreme: event.shiftKey };
  }
  if (!mod && (event.code === 'Delete' || event.code === 'Backspace')) return { kind: 'delete' };
  if (!mod && /^Arrow(?:Left|Right|Up|Down)$/.test(event.code)) {
    const step = event.shiftKey ? 10 : 1;
    return {
      kind: 'nudge',
      dx: event.code === 'ArrowLeft' ? -step : event.code === 'ArrowRight' ? step : 0,
      dy: event.code === 'ArrowUp' ? -step : event.code === 'ArrowDown' ? step : 0,
    };
  }
  return null;
}

export function toggleSelection(keys: string[], key: string): { keys: string[]; primary: string | null } {
  const has = keys.includes(key);
  const next = has ? keys.filter((k) => k !== key) : [...keys, key];
  return { keys: next, primary: has ? next[next.length - 1] ?? null : key };
}
