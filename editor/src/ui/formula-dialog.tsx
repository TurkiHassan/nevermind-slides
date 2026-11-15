// Edit a formula through its source (roadmap NM-11). A native <math> element: its inner MathML, saved as one setText
// on the <math> root (a minimal splice of the changed tokens; the root tag with display and data-term stays as
// written). A data-tex host: its TeX, saved as setAttr on data-tex. The runtime renders both again on reload; the
// MathML it generates for TeX is never written back (runtime contract, "Generated markup").
import { useEffect, useRef, useState } from 'preact/hooks';
import { postOps } from './actions.ts';
import { reloadPreview } from './events.ts';
import { Icon } from './icons.tsx';
import { banner, formulaSource, t } from './state.ts';

export function FormulaDialog() {
  const s = t.value;
  const ref = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState('');
  const open = formulaSource.value;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setText(open.source);
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open?.key]);

  const close = () => { formulaSource.value = null; };
  const save = async () => {
    if (!open) return;
    try {
      if (text !== open.source) {
        if (open.kind === 'tex') await postOps([{ kind: 'setAttr', id: open.key, name: 'data-tex', value: text.trim() }], { label: 'Edit formula' });
        else await postOps([{ kind: 'setText', id: open.key, text }], { label: 'Edit formula' });
        await reloadPreview();
      }
      close();
    } catch (error) {
      banner.value = { kind: 'error', message: error instanceof Error ? error.message : String(error) };
    }
  };

  return (
    <dialog ref={ref} class="export-dialog raised diagram-dialog" aria-labelledby="formula-title" data-testid="formula-dialog" onClose={close}>
      <div class="export-head">
        <h2 id="formula-title">{s.formulaTitle}</h2>
        <button type="button" class="round raised-s" aria-label={s.diagramCancel} title={s.diagramCancel} onClick={close}>
          <Icon name="close" />
        </button>
      </div>
      <p class="export-intro">{open?.kind === 'tex' ? s.formulaHintTex : s.formulaHintMathml}</p>
      {/* formulas read left to right, in Arabic decks too */}
      <textarea dir="ltr" spellcheck={false} rows={open?.kind === 'tex' ? 4 : 10} value={text} aria-label={s.formulaTitle}
        onInput={(e) => setText(e.currentTarget.value)} data-testid="formula-source" />
      <div class="dialog-actions">
        <button type="button" class="raised-s" onClick={close}>{s.diagramCancel}</button>
        <button type="button" class="raised-s" disabled={!open || text === open.source} onClick={() => void save()} data-testid="formula-save">{s.formulaSave}</button>
      </div>
    </dialog>
  );
}
