// Entry: language from ?lang, the chrome fonts, the layout, keyboard shortcuts, the start-up sequence (preview,
// state, events) and the window.nmShell test hook (the same surface the Phase 2a reference shell exposed).
import { effect } from '@preact/signals';
import { render } from 'preact';
import { changeZOrder, commitGesture, deleteSelection, duplicateSelection, goToSlide, postOps, redo, save, select, setLang, settled, togglePlay, undo, zoomBy, zoomFit } from './actions.ts';
import { api, clientId, fontUrl } from './api.ts';
import { Banners, Toast } from './banner.tsx';
import { bringUpToDate, eventLog, refreshState, reloadPreview, serial, subscribe } from './events.ts';
import { Fihris, thumbStats } from './fihris.tsx';
import { elementByKey, loadPreview } from './frame.ts';
import { ExportDialog } from './export-dialog.tsx';
import { Header } from './header.tsx';
import { Panel } from './panel.tsx';
import { Canvas } from './preview.tsx';
import { directShortcut } from './direct-shortcuts.ts';
import { keyedParent } from './roles.ts';
import { finishTextSession } from './text-session.ts';
import * as state from './state.ts';
import './styles.css';

const { currentSlide, fihrisCompact, info, lang, playing, selection, slideTitle, t, version, zoom } = state;

// --- language -----------------------------------------------------------------------------------------------------

lang.value = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'ar';
effect(() => {
  const l = lang.value;
  document.documentElement.lang = l;
  document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
});
effect(() => {
  const title = slideTitle(0);
  document.title = title ? t.value.documentTitle(title) : 'Nevermind Studio';
});
effect(() => {
  if (!info.value) return;
  const slide = currentSlide.value + 1;
  const key = selection.value ?? undefined;
  api.current(slide, key).catch(() => {});
});

// --- fonts (served by the server from the nevermind skill; the system stack stands in when absent) ------------------

const FONTS: [family: string, file: string, weight: string][] = [
  ['Thmanyah Sans', 'thmanyahsans-Regular.otf', '400'],
  ['Thmanyah Sans', 'thmanyahsans-Medium.otf', '500'],
  ['Thmanyah Sans', 'thmanyahsans-Bold.otf', '700'],
  ['Thmanyah Serif Display', 'thmanyahserifdisplay-Bold.otf', '700'],
  ['Thmanyah Serif Display', 'thmanyahserifdisplay-Black.otf', '900'],
  ['Zain Rounded', 'ZainRounded-VF.ttf', '200 900'],
];
let fontWarned = false;
for (const [family, file, weight] of FONTS) {
  const face = new FontFace(family, `url("${fontUrl(file)}")`, { weight, display: 'swap' });
  document.fonts.add(face);
  face.load().catch(() => {
    if (!fontWarned) { fontWarned = true; console.warn('nm-studio: editor fonts unavailable; using the system fonts'); }
  });
}

// --- shortcuts (by event.code, so they work on an Arabic keyboard layout) -----------------------------------------

function escapeUp(): void {
  if (playing.value) { togglePlay(); return; }
  const el = elementByKey(selection.value);
  if (!el) { select(null); return; }
  const up = keyedParent(el);
  select(up && !up.classList.contains('slide') ? up.getAttribute('data-nm-key') : null);
}

window.addEventListener('keydown', (e) => {
  const target = e.target as HTMLElement | null;
  if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
  if (state.exportOpen.value || target?.closest?.('dialog[open]')) return; // a modal dialog owns the keyboard
  const mod = e.ctrlKey || e.metaKey;
  const direct = directShortcut(e, state.selectedKeys.value.length > 0);
  if (direct) {
    e.preventDefault();
    if (direct.kind === 'nudge') void commitGesture(state.selectedKeys.value, { kind: 'move', dx: direct.dx, dy: direct.dy }, `nudge:${state.selectedKeys.value.join(',')}`);
    else if (direct.kind === 'duplicate') void duplicateSelection();
    else if (direct.kind === 'delete') void deleteSelection();
    else void changeZOrder(direct.delta, direct.extreme);
    return;
  }
  if (mod && e.code === 'KeyZ') { e.preventDefault(); (e.shiftKey ? redo : undo)(); return; }
  if (mod && e.code === 'KeyS') { e.preventDefault(); save(); return; }
  if (mod && (e.code === 'Equal' || e.code === 'NumpadAdd')) { e.preventDefault(); zoomBy(1); return; }
  if (mod && (e.code === 'Minus' || e.code === 'NumpadSubtract')) { e.preventDefault(); zoomBy(-1); return; }
  if (mod && (e.code === 'Digit0' || e.code === 'Numpad0')) { e.preventDefault(); zoomFit(); return; }
  if (mod || e.altKey) return;
  if (e.code === 'PageDown') { e.preventDefault(); goToSlide(currentSlide.value + 1); return; }
  if (e.code === 'PageUp') { e.preventDefault(); goToSlide(currentSlide.value - 1); return; }
  if (e.code === 'Escape') { escapeUp(); }
});

// Clicking away from a text edit, onto the well around the slide or onto any control, commits it (as in PowerPoint).
// Clicks on the slide itself are handled by the canvas; Esc still cancels.
window.addEventListener('pointerdown', (e) => {
  if (!state.textSession.value) return;
  const target = e.target as HTMLElement | null;
  if (target?.closest?.('.hit, #frame, dialog')) return;
  finishTextSession(true).catch(() => {});
}, true);

// --- layout -------------------------------------------------------------------------------------------------------

function App() {
  return (
    <div class={`app${fihrisCompact.value ? ' fihris-compact' : ''}`}>
      <Header />
      <Banners />
      <Canvas />
      <Panel />
      <Fihris />
      <Toast />
      <ExportDialog />
    </div>
  );
}

// Laptop-height screens use the compact fihris row. Keep following the media query when a window is resized;
// this also covers browser/OS chrome changes after the editor has opened. The fold button remains a manual toggle
// until the viewport crosses the breakpoint again.
const compactFihrisQuery = window.matchMedia('(max-height: 820px)');
fihrisCompact.value = compactFihrisQuery.matches;
compactFihrisQuery.addEventListener('change', (event) => { fihrisCompact.value = event.matches; });

render(<App />, document.getElementById('app') as HTMLElement);

// --- start-up -----------------------------------------------------------------------------------------------------

const ready = serial(async () => {
  const [shown] = await Promise.all([loadPreview(), refreshState()]);
  version.value = shown;
});
subscribe();

// --- test hook ----------------------------------------------------------------------------------------------------

declare global { interface Window { nmShell: unknown } }

window.nmShell = {
  clientId,
  events: eventLog,
  thumbStats,
  ready,
  signals: state,
  get state() { return info.value ? { info: info.value, version: version.value, ...state.flags.value, lint: state.lint.value, conflict: state.conflict.value } : null; },
  get version() { return version.value; },
  get current() { return currentSlide.value; },
  get zoom() { return zoom.value; },
  goTo: goToSlide,
  select,
  setLang,
  postOps,
  settled,
  api: (path: string, body?: unknown) => (body === undefined
    ? fetch(`${path}${path.includes('?') ? '&' : '?'}t=${encodeURIComponent(new URLSearchParams(location.search).get('t') ?? '')}`).then((r) => r.json())
    : fetch(path, { method: 'POST', headers: { 'X-NM-Token': new URLSearchParams(location.search).get('t') ?? '', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json())),
  apply: bringUpToDate,
  reload: reloadPreview,
  refresh: refreshState,
  serverState: api.state,
};
