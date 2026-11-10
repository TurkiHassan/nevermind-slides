import { useState } from 'preact/hooks';
import { goToSlide } from './actions.ts';
import { api } from './api.ts';
import { Icon } from './icons.tsx';
import {
  areaTargeting, banner, currentSlide, noteArea, noteTargetMode, notes, panelTab, selection, t,
} from './state.ts';
import type { AgentNote } from './types.ts';
import { AiRequest } from './ai-request.tsx';

function navigate(note: AgentNote): void {
  goToSlide(note.target.slide - 1);
  selection.value = note.target.kind === 'element' ? note.target.key : null;
  panelTab.value = 'agent';
}

export function AgentNotes() {
  const s = t.value;
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const open = notes.value.notes.filter((note) => note.status === 'open');
  const mode = noteTargetMode.value;
  const ready = mode === 'element' ? !!selection.value : !!noteArea.value;

  const chooseElement = () => {
    noteTargetMode.value = 'element';
    noteArea.value = null;
    areaTargeting.value = false;
  };
  const chooseArea = () => {
    noteTargetMode.value = 'area';
    noteArea.value = null;
    areaTargeting.value = true;
  };
  const submit = async () => {
    const value = text.trim();
    if (!value || !ready || busy) return;
    setBusy(true);
    try {
      const target = mode === 'element'
        ? { kind: 'element' as const, key: selection.value! }
        : { kind: 'area' as const, slide: currentSlide.value + 1, rect: noteArea.value! };
      const result = await api.createNote(value, target);
      notes.value = result.notes;
      setText('');
      noteArea.value = null;
      areaTargeting.value = false;
    } catch (error) {
      banner.value = { kind: 'error', message: error instanceof Error ? error.message : String(error) };
    } finally {
      setBusy(false);
    }
  };
  const complete = async (id: string) => {
    try { notes.value = (await api.doneNote(id)).notes; }
    catch (error) { banner.value = { kind: 'error', message: error instanceof Error ? error.message : String(error) }; }
  };

  return (
    <div class="agent-notes" data-testid="agent-notes">
      <AiRequest />
      <div class="agent-divider" />
      <p class="hint">{s.agentIntro}</p>
      <div class="note-target tray" role="group" aria-label={s.noteText}>
        <button type="button" class={mode === 'element' ? 'on' : ''} aria-pressed={mode === 'element'} data-testid="element-target" onClick={chooseElement}>{s.noteElement}</button>
        <button type="button" class={mode === 'area' ? 'on' : ''} aria-pressed={mode === 'area'} data-testid="area-target" onClick={chooseArea}>{s.noteArea}</button>
      </div>
      <p class={`note-target-help${ready ? ' ready' : ''}`}>
        {mode === 'element' ? (ready ? s.noteElement : s.noteSelectElement) : noteArea.value ? s.noteAreaReady : s.noteDrawArea}
      </p>
      <label class="note-compose">
        <span class="lbl">{s.noteText}</span>
        <textarea
          value={text}
          maxLength={4000}
          placeholder={s.notePlaceholder}
          data-testid="note-text"
          onInput={(event) => setText(event.currentTarget.value)}
        />
      </label>
      <button type="button" class="note-add raised-s" disabled={!text.trim() || !ready || busy} data-testid="add-note" onClick={() => { void submit(); }}>
        <Icon name="plus" />{busy ? s.addingNote : s.addNote}
      </button>

      {open.length > 0 ? (
        <section class="note-list" aria-label={s.openNotes}>
          <h3>{s.openNotes}</h3>
          <ul>
            {open.map((note) => (
              <li key={note.id} class="note-row" data-testid="note-row" data-note-id={note.id}>
                <button type="button" class="note-jump" onClick={() => navigate(note)}>
                  <span>{note.text}</span>
                  <small>{note.target.kind === 'element' ? s.noteElementTarget(note.target.role) : s.noteAreaTarget} · {s.noteOnSlide(note.target.slide)}</small>
                </button>
                <button type="button" class="note-done raised-s" onClick={() => { void complete(note.id); }}>{s.doneNote}</button>
              </li>
            ))}
          </ul>
        </section>
      ) : <p class="hint agent">{s.agentEmpty}</p>}
    </div>
  );
}
