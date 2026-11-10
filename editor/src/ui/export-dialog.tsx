// The export dialog. A native modal <dialog>: the browser traps focus, closes on Escape and returns focus to the
// button that opened it. The server exports the editor's current text, so unsaved changes are included.
import { useEffect, useRef, useState } from 'preact/hooks';
import { api, exportDownloadUrl } from './api.ts';
import { Icon } from './icons.tsx';
import { exportOpen, t } from './state.ts';
import type { ExportFormat, ExportJob } from './types.ts';

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const FORMATS: ExportFormat[] = ['html', 'pdf', 'png', 'pptx', 'pptx-editable'];

export function ExportDialog() {
  const s = t.value;
  const ref = useRef<HTMLDialogElement>(null);
  const [format, setFormat] = useState<ExportFormat>('html');
  const [allowRemote, setAllowRemote] = useState(false);
  const [job, setJob] = useState<ExportJob | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const ticket = useRef(0);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (exportOpen.value && !dialog.open) dialog.showModal();
    if (!exportOpen.value && dialog.open) dialog.close();
  }, [exportOpen.value]);

  const names: Record<ExportFormat, [string, string]> = {
    html: [s.exportHtml, s.exportHtmlHint], pdf: [s.exportPdf, s.exportPdfHint], png: [s.exportPng, s.exportPngHint],
    pptx: [s.exportPptx, s.exportPptxHint], 'pptx-editable': [s.exportPptxEditable, s.exportPptxEditableHint],
  };

  const run = async () => {
    const mine = ++ticket.current;
    setFailure(null);
    try {
      let next = await api.createExport(format, allowRemote);
      setJob(next);
      while (next.status === 'running') {
        await wait(400);
        if (mine !== ticket.current) return;
        next = await api.exportJob(next.id);
        setJob(next);
      }
    } catch (error) {
      if (mine === ticket.current) { setJob(null); setFailure(error instanceof Error ? error.message : String(error)); }
    }
  };

  const running = job?.status === 'running';
  const failed = failure ?? (job?.status === 'failed' ? job.error ?? '' : null);
  const unlicensed = job?.status === 'ready' ? (job.fonts ?? []).filter((font) => !font.licensed) : [];
  return (
    <dialog
      ref={ref}
      class="export-dialog raised"
      aria-labelledby="export-title"
      data-testid="export-dialog"
      onKeyDown={(e) => {
        if (e.key !== 'Tab') return;
        const items = [...(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href]') ?? [])];
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || !ref.current?.contains(active))) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (active === last || !ref.current?.contains(active))) { e.preventDefault(); first.focus(); }
      }}
      onClose={() => { ticket.current++; exportOpen.value = false; }}
    >
      {exportOpen.value && (
        <>
      <div class="export-head">
        <h2 id="export-title">{s.exportTitle}</h2>
        <button type="button" class="round raised-s" aria-label={s.exportClose} title={s.exportClose} onClick={() => ref.current?.close()}>
          <Icon name="close" />
        </button>
      </div>
      <p class="export-intro">{s.exportIntro}</p>
      <fieldset class="export-formats" disabled={running}>
        <legend>{s.exportFormatLabel}</legend>
        {FORMATS.map((f) => (
          <label key={f} class={`export-format${format === f ? ' on' : ''}`}>
            <input type="radio" name="export-format" value={f} checked={format === f} onChange={() => { setFormat(f); setJob(null); setFailure(null); }} data-testid={`export-format-${f}`} />
            <span class="name">
              {names[f][0]}
              {f === 'pptx-editable' && <em class="chip" data-testid="export-experimental">{s.exportExperimental}</em>}
            </span>
            <span class="hint">{names[f][1]}</span>
          </label>
        ))}
      </fieldset>
      {format === 'html' && <label class="export-check">
        <input type="checkbox" checked={allowRemote} disabled={running} onChange={(e) => setAllowRemote((e.currentTarget as HTMLInputElement).checked)} data-testid="export-allow-remote" />
        <span>{s.exportAllowRemote}</span>
      </label>}
      <div class="export-status" role="status" aria-live="polite" data-testid="export-status" data-state={failed !== null ? 'failed' : job?.status ?? 'idle'}>
        {running && <span>{s.exportRunning}</span>}
        {failed !== null && <span class="bad">{s.exportFailed(failed)}</span>}
        {job?.status === 'ready' && job.filename && <span>{s.exportReady(job.filename, job.slides ?? 0)}</span>}
      </div>
      {job?.status === 'ready' && (job.experimental || unlicensed.length > 0 || (job.remote ?? []).length > 0) && (
        <section class="export-warn" aria-labelledby="export-warn-title" data-testid="export-warnings">
          <h3 id="export-warn-title">{s.exportWarnTitle}</h3>
          <ul>
            {job.experimental && <li>{s.exportExperimentalWarn}</li>}
            {unlicensed.length > 0 && <li>{s.exportFontNote}</li>}
            {unlicensed.map((font) => <li key={font.path}>{s.exportFontWarn} <bdi dir="ltr" class="path">{font.path}</bdi></li>)}
            {(job.remote ?? []).map((url) => <li key={url}>{s.exportRemoteWarn(url)}</li>)}
          </ul>
        </section>
      )}
      <div class="export-actions">
        {job?.status === 'ready' && (
          <a class="export-download raised-s" href={exportDownloadUrl(job.id)} download={job.filename} data-testid="export-download">{s.exportDownload}</a>
        )}
        <button type="button" class="export-run raised-s" onClick={run} disabled={running} data-testid="export-run">{s.exportRun}</button>
      </div>
        </>
      )}
    </dialog>
  );
}
