import { postOps, save } from './actions.ts';
import { editLayer, frameWin } from './frame.ts';
import { elementByKey } from './frame.ts';
import { bumpLayout, diagramSource, formulaSource, info, selection, textSession, toast } from './state.ts';
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
  if ('readOnly' in started) {
    // Runtime-generated content: a diagram opens its DSL source for editing; anything else says why it is read-only.
    selection.value = key;
    const diagram = started.readOnly === 'diagram' ? info.value?.diagrams.find((d) => d.key === key) : undefined;
    if (diagram?.sourceKey) { diagramSource.value = { figureKey: key, sourceKey: diagram.sourceKey }; return true; }
    if (started.readOnly === 'math') {
      // the formula root: the outermost <math>, or the data-tex host around a generated one
      const el = elementByKey(key);
      let math: Element | null = el?.closest('math') ?? null;
      while (math?.parentElement?.closest('math')) math = math.parentElement.closest('math');
      const root = el?.closest('[data-tex]') ?? math;
      const rootKey = root?.getAttribute('data-nm-key') ?? null;
      const eq = rootKey ? info.value?.equations.find((e) => e.key === rootKey) : undefined;
      if (eq) { selection.value = eq.key; formulaSource.value = { key: eq.key, kind: eq.kind, source: eq.source }; return true; }
    }
    toast.value = started.readOnly === 'math' || started.readOnly === 'contains-math' ? 'readOnlyMath' : 'readOnlyGenerated';
    return true;
  }
  selection.value = key;
  textSession.value = key;
  bumpLayout();
  return true;
}

export async function finishTextSession(commit = true): Promise<void> {
  await accept(editLayer()?.endText(commit) ?? null);
}
