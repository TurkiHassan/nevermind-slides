// The disk-conflict banner (with its two ways out), result and error banners, and the quiet toast.
import { useEffect, useRef } from 'preact/hooks';
import { resolve } from './actions.ts';
import { Icon } from './icons.tsx';
import { banner, conflict, connected, saveRefused, t, toast } from './state.ts';

export function Banners() {
  const s = t.value;
  const c = conflict.value;
  const b = banner.value;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (saveRefused.value) ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, [saveRefused.value]);
  return (
    <div class="banners">
      {c && (
        <div class="banner raised conflict" role="alert" ref={ref} data-testid="conflict-banner" data-refused={saveRefused.value ? '' : undefined}>
          <Icon name="warn" />
          <div class="msg">
            <b>{saveRefused.value ? s.saveRefused : s.conflictTitle}</b>
            <span>{c.deleted ? s.conflictDeleted : s.conflictBody}</span>
          </div>
          <div class="acts">
            <button type="button" class="raised-s" onClick={() => resolve('reload')} data-testid="resolve-reload">{s.acceptAgent}</button>
            <button type="button" class="raised-s" onClick={() => resolve('reapply')} disabled={!!c.deleted} data-testid="resolve-reapply">{s.reapply}</button>
          </div>
        </div>
      )}
      {!c && b && (
        <div class={`banner raised ${b.kind}`} role={b.kind === 'error' ? 'alert' : 'status'} data-testid="banner" data-kind={b.kind}>
          <Icon name="warn" />
          <div class="msg">
            {b.kind === 'resolved' && <b>{s.resolvedFailed(b.failed)}</b>}
            {b.kind === 'not-replayable' && <b>{s.notReplayable}</b>}
            {b.kind === 'error' && <b>{s.requestFailed(b.message)}</b>}
          </div>
          <div class="acts">
            {b.kind === 'not-replayable' && <button type="button" class="raised-s" onClick={() => resolve('reload')}>{s.acceptAgent}</button>}
            <button type="button" class="round raised-s" onClick={() => { banner.value = null; }} aria-label={s.dismiss} title={s.dismiss}><Icon name="close" /></button>
          </div>
        </div>
      )}
      {!connected.value && <div class="banner raised quiet" role="status">{s.reconnecting}</div>}
    </div>
  );
}

export function Toast() {
  const s = t.value;
  const key = toast.value;
  useEffect(() => {
    if (!key) return;
    const id = setTimeout(() => { toast.value = null; }, 3500);
    return () => clearTimeout(id);
  }, [key]);
  return (
    <div class="toast-slot" role="status" aria-live="polite">
      {key && <div class="toast raised-s" data-testid="toast">{s[key]}</div>}
    </div>
  );
}
