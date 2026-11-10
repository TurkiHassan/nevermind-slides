// Watch a deck file for changes made outside the editor. The directory is watched, not the file: both our own save
// and `nm-studio apply` replace the file by rename, which ends a watch on the old inode.
import { statSync, watch, type FSWatcher } from 'node:fs';
import { basename, dirname } from 'node:path';

export interface Watcher { close(): void }

/** Calls `onChange` (debounced) when something named like the deck changes in its directory. The caller compares fingerprints. */
export function watchDeck(deckPath: string, onChange: () => void, debounceMs = 150): Watcher {
  const name = basename(deckPath);
  let timer: NodeJS.Timeout | null = null;
  let closed = false;
  const fire = () => {
    if (closed) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; if (!closed) onChange(); }, debounceMs);
  };
  // Some sandboxed filesystems do not deliver directory-watch events for rename-over saves. Keep a cheap metadata
  // signature as a fallback; inode catches atomic replacement even when size and timestamp happen to match.
  const signature = () => {
    try {
      const s = statSync(deckPath);
      return `${s.dev}:${s.ino}:${s.size}:${s.mtimeMs}:${s.ctimeMs}`;
    } catch {
      return 'missing';
    }
  };
  let seen = signature();
  const observe = () => {
    const next = signature();
    if (next === seen) return;
    seen = next;
    fire();
  };

  let w: FSWatcher | null = null;
  try {
    w = watch(dirname(deckPath), { persistent: false }, (_event, file) => {
      if (file === null || file === undefined || file.toString() === name) observe();
    });
    w.on('error', () => { /* the directory vanished: nothing more to watch; a save will report the conflict */ });
  } catch {
    w = null;
  }
  const poll = setInterval(observe, Math.max(25, Math.min(debounceMs, 250)));
  poll.unref();
  return {
    close() {
      closed = true;
      if (timer) clearTimeout(timer);
      clearInterval(poll);
      w?.close();
    },
  };
}
