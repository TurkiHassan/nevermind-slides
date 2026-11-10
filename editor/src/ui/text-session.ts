import { postOps, save } from './actions.ts';
import { editLayer, frameWin } from './frame.ts';
import { bumpLayout, selection, textSession } from './state.ts';
import type { NodeKey, TextSessionResult } from './types.ts';

let bridgedWindow: Window | null = null;

async function accept(result: TextSessionResult | null, saveAfter = false): Promise<void> {
  textSession.value = null;
  if (!result || result.cancelled || !result.changed) {
    bumpLayout();
    return;
  }
  await postOps([{ kind: 'setText', id: result.key, text: result.text }], {
    label: 'Edit text', coalesceKey: `text:${result.key}:${Date.now()}`,
  });
  if (saveAfter) await save();
}

function ensureBridge(): void {
  const win = frameWin();
  if (!win || win === bridgedWindow) return;
  bridgedWindow = win;
  win.addEventListener('nm-text-command', ((event: CustomEvent<{ result: TextSessionResult | null; save: boolean }>) => {
    accept(event.detail.result, event.detail.save).catch(() => {});
  }) as EventListener);
}

export function beginTextSession(key: NodeKey): boolean {
  ensureBridge();
  const started = editLayer()?.beginText(key) ?? null;
  if (!started) return false;
  selection.value = key;
  textSession.value = key;
  bumpLayout();
  return true;
}

export async function finishTextSession(commit = true): Promise<void> {
  await accept(editLayer()?.endText(commit) ?? null);
}
