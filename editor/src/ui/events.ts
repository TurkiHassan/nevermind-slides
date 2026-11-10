// Keeping the preview in step with the server: the version rule (pure, tested in test/ui/version-rule.test.ts),
// the serialised patch-or-reload pipeline that every op response and SSE event goes through, and the SSE stream.
import { api, clientId, withToken } from './api.ts';
import { editLayer, elementByKey, loadPreview } from './frame.ts';
import {
  bumpLayout, conflict, connected, flags, hover, info, lint, notes, selectedKeys, selection, toast, version,
} from './state.ts';
import type { DiskChangedEvent, Flags, LintIssue, PreviewPatch, VersionEvent } from './types.ts';

export type Decision = 'skip' | 'patch' | 'reload';

export interface VersionedChange { version: number; previewPatch: PreviewPatch; stale?: boolean; origin?: string }

/**
 * The contract's rule. Ignore anything at or below the version shown, and this tab's own events (their op response
 * applies them). Patch only the very next version, when the patch is a list and the request was not stale.
 * Everything else reloads the preview.
 */
export function decide(local: number, ev: VersionedChange, self: string): Decision {
  if (ev.version <= local) return 'skip';
  if (ev.origin !== undefined && ev.origin === self) return 'skip';
  if (ev.version === local + 1 && Array.isArray(ev.previewPatch) && !ev.stale) return 'patch';
  return 'reload';
}

/** After an SSE reconnect there is no replay: a server ahead of us means we missed versions. */
export const helloDecision = (local: number, serverVersion: number): 'reload' | 'skip' => (local > 0 && serverVersion > local ? 'reload' : 'skip');

export type Outcome = 'skipped' | 'patched' | 'reloaded';
type ChangeListener = (outcome: Exclude<Outcome, 'skipped'>, change: VersionedChange) => void;
const listeners = new Set<ChangeListener>();
/** Called after the main preview patched or reloaded (the fihris follows along). */
export function onPreviewChange(fn: ChangeListener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

let chain: Promise<unknown> = Promise.resolve();
/** Run preview work strictly in order: responses and events never interleave. */
export function serial<T>(fn: () => Promise<T> | T): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => {});
  return run;
}

function applyFlags(f: Partial<Flags>): void {
  if (typeof f.dirty !== 'boolean') return;
  flags.value = { dirty: f.dirty, changedLines: f.changedLines ?? (f.dirty ? Math.max(1, flags.value.changedLines) : 0), canUndo: !!f.canUndo, canRedo: !!f.canRedo };
}

/** Drop selection or hover whose element no longer exists; then let overlays re-measure. */
function reconcileSelection(): void {
  if (selection.value && !elementByKey(selection.value)) selection.value = null;
  selectedKeys.value = selectedKeys.value.filter((key) => !!elementByKey(key));
  if (selection.value && !selectedKeys.value.includes(selection.value)) selectedKeys.value = [selection.value];
  if (hover.value && !elementByKey(hover.value)) hover.value = null;
  bumpLayout();
}

async function reloadNow(change: VersionedChange): Promise<Outcome> {
  const shown = await loadPreview();
  version.value = Math.max(shown, version.value);
  reconcileSelection();
  for (const fn of listeners) fn('reloaded', change);
  scheduleRefresh();
  return 'reloaded';
}

/** Bring the preview to an op/undo/redo result or a "version" event. */
export function bringUpToDate(change: VersionedChange & Partial<Flags>): Promise<Outcome> {
  return serial(async () => {
    const d = decide(version.value, change, clientId);
    if (d === 'skip') return 'skipped';
    applyFlags(change);
    if (d === 'patch') {
      const layer = editLayer();
      const missing = layer ? layer.applyPatch(change.previewPatch as Exclude<PreviewPatch, 'reload'>) : ['no-layer'];
      if (missing.length === 0) {
        version.value = change.version;
        reconcileSelection();
        for (const fn of listeners) fn('patched', change);
        scheduleRefresh();
        return 'patched';
      }
    }
    version.value = change.version;
    return reloadNow(change);
  });
}

export function reloadPreview(): Promise<Outcome> {
  return serial(() => reloadNow({ version: version.value, previewPatch: 'reload' }));
}

// --- server state ------------------------------------------------------------------------------------------------

let refreshTimer: ReturnType<typeof setTimeout> | null = null;
/** The source version the inspected deck info describes; it trails `version` until the refresh after an op lands. */
let inspectedVersion = 0;
export async function refreshState(): Promise<void> {
  const st = await api.state();
  if (st.version < inspectedVersion) return; // an older answer that arrived late must not replace a newer inspection
  inspectedVersion = st.version;
  info.value = st.info;
  lint.value = st.lint;
  notes.value = st.notes;
  conflict.value = st.conflict;
  applyFlags(st);
}
/** Wait until `info` describes the version shown. Ops computed from inspected state must not read a stale one. */
export async function ensureInspected(): Promise<void> {
  if (inspectedVersion < version.value) await refreshState();
}
export function scheduleRefresh(ms = 120): void {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => { refreshTimer = null; refreshState().catch(() => {}); }, ms);
}

// --- SSE ---------------------------------------------------------------------------------------------------------

export interface EventLogEntry { event: string; data: unknown }
/** Every SSE event received, for tests and diagnosis. */
export const eventLog: EventLogEntry[] = [];

export function subscribe(): EventSource {
  const es = new EventSource(withToken('/api/events'));
  const on = <T>(name: string, fn: (d: T) => void) => es.addEventListener(name, (ev) => {
    const data = JSON.parse((ev as MessageEvent<string>).data) as T;
    eventLog.push({ event: name, data });
    fn(data);
  });
  es.addEventListener('open', () => { connected.value = true; });
  es.addEventListener('error', () => { connected.value = false; });
  on<{ version: number }>('hello', (d) => {
    connected.value = true;
    if (helloDecision(version.value, d.version) === 'reload') {
      reloadPreview().catch(() => {});
    }
    scheduleRefresh(0);
  });
  on<VersionEvent>('version', (d) => {
    if (d.origin === clientId) return;
    bringUpToDate(d).catch(() => {});
  });
  on<{ dirty: boolean; changedLines?: number }>('saved', (d) => {
    flags.value = { ...flags.value, dirty: d.dirty, changedLines: d.changedLines ?? (d.dirty ? flags.value.changedLines : 0) };
    scheduleRefresh();
  });
  on<DiskChangedEvent>('disk-changed', (d) => {
    if (d.conflict) conflict.value = { diskFingerprint: d.diskFingerprint ?? '', ...(d.deleted ? { deleted: true } : {}) };
    else conflict.value = null;
    if (d.reloaded && !d.resolved) toast.value = 'agentUpdated';
    scheduleRefresh();
  });
  on<{ version: number; issues: LintIssue[] }>('lint', (d) => { lint.value = d.issues; });
  on<{ notes: import('./types.ts').NotesDocument }>('notes', (d) => { notes.value = d.notes; });
  return es;
}
