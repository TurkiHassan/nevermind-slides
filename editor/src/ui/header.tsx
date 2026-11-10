// The header: wordmark and deck title, the mode tray (only تحرير works in this phase), the unsaved-lines pill,
// undo/redo, play, language and save.
import { useEffect, useRef } from 'preact/hooks';
import { redo, save, setLang, togglePlay, undo } from './actions.ts';
import { digits } from './i18n.ts';
import { Icon, type IconName } from './icons.tsx';
import { conflict, exportOpen, flags, lang, playing, saving, slideTitle, t, workspaceMode } from './state.ts';

const MODES: { id: 'edit' | 'insert' | 'motion' | 'identity'; icon: IconName }[] = [
  { id: 'edit', icon: 'edit' },
  { id: 'insert', icon: 'insert' },
  { id: 'motion', icon: 'motion' },
  { id: 'identity', icon: 'identity' },
];

function DirtyPill() {
  const s = t.value;
  const { dirty, changedLines } = flags.value;
  const numRef = useRef<HTMLSpanElement>(null);
  const prev = useRef(changedLines);
  useEffect(() => {
    const el = numRef.current;
    if (el && prev.current !== changedLines && dirty) {
      el.classList.remove('tick');
      void el.offsetWidth; // restart the animation
      el.classList.add('tick');
    }
    prev.current = changedLines;
  }, [changedLines, dirty]);
  return (
    <span class={`pill raised-s${dirty ? ' is-dirty' : ''}`} role="status" aria-label={dirty ? s.linesLabel(changedLines) : s.saved} data-testid="dirty-pill">
      <i class="dot" aria-hidden="true" />
      {dirty ? (
        <>
          <span>{s.unsaved}</span>
          <span class="read pill-n" ref={numRef} data-testid="dirty-count">{digits(changedLines, lang.value)}</span>
          <span>{s.linesWord(changedLines)}</span>
        </>
      ) : (
        <span>{s.saved}</span>
      )}
    </span>
  );
}

export function Header() {
  const s = t.value;
  const deck = slideTitle(0) ?? '';
  const f = flags.value;
  const modeName = { edit: s.modeEdit, insert: s.modeInsert, motion: s.modeMotion, identity: s.modeIdentity };
  return (
    <header class="masthead">
      <div class="mark">
        <span class="logo raised-s" aria-hidden="true"><i /></span>
        <div class="mark-text">
          <b class="wordmark">{s.appName}</b>
          <span class="mark-sub" title={deck}>{s.appSub}{deck ? ` · ${deck}` : ''}</span>
        </div>
      </div>
      <nav class="seg tray" aria-label={s.modesLabel}>
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            class={m.id === workspaceMode.value ? 'on' : ''}
            aria-pressed={m.id === workspaceMode.value}
            aria-disabled={m.id === 'insert'}
            title={m.id === 'insert' ? s.modeLater : undefined}
            data-tip={m.id === 'insert' ? s.modeLater : undefined}
            onClick={() => { if (m.id !== 'insert') workspaceMode.value = m.id; }}
          >
            <Icon name={m.icon} />
            {modeName[m.id]}
          </button>
        ))}
      </nav>
      <span class="sp" />
      <DirtyPill />
      <button type="button" class="round raised-s" onClick={undo} disabled={!f.canUndo} title={s.undo} aria-label={s.undo} data-testid="undo">
        <Icon name="undo" />
      </button>
      <button type="button" class="round raised-s" onClick={redo} disabled={!f.canRedo} title={s.redo} aria-label={s.redo} data-testid="redo">
        <Icon name="redo" />
      </button>
      <button type="button" class="round raised-s" onClick={() => { exportOpen.value = true; }} title={s.exportOpen} aria-label={s.exportOpen} aria-haspopup="dialog" data-testid="export-open">
        <Icon name="export" />
      </button>
      <button type="button" class={`round ${playing.value ? 'pressed is-on' : 'raised-s'}`} onClick={togglePlay} aria-pressed={playing.value} title={playing.value ? s.pause : s.play} aria-label={playing.value ? s.pause : s.play} data-testid="play">
        <Icon name={playing.value ? 'pause' : 'play'} />
      </button>
      <button type="button" class="round raised-s lang" onClick={() => setLang(lang.value === 'ar' ? 'en' : 'ar')} title={s.langSwitch} aria-label={s.langSwitch} lang={lang.value === 'ar' ? 'en' : 'ar'} data-testid="lang">
        {s.langButton}
      </button>
      <button
        type="button"
        class="save raised-s"
        onClick={save}
        aria-disabled={!f.dirty || saving.value}
        data-conflict={conflict.value ? '' : undefined}
        data-testid="save"
      >
        {saving.value ? s.saving : s.save}
      </button>
    </header>
  );
}
