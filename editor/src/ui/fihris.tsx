// The fihris: the deck as a printed contents page along the bottom. Each tile is the slide's number in the house
// serif and its title. The current tile has one same-origin /thumbnail iframe, CSS-scaled, frozen and loaded lazily;
// the remaining entries use the plan's title-tile fallback. Patches reach the loaded thumbnail with the main preview.
import { signal } from '@preact/signals';
import { useEffect, useRef, useState } from 'preact/hooks';
import { addSlideFromPreset, deleteSlide, duplicateSlide, goToSlide, moveSlide } from './actions.ts';
import { api, thumbnailUrl } from './api.ts';
import { onPreviewChange } from './events.ts';
import { Icon } from './icons.tsx';
import { currentSlide, fihrisCompact, slideCount, slideTitle, t } from './state.ts';
import { nextBatch, type ThumbState } from './thumb-schedule.ts';
import type { EditLayer, PreviewPatch } from './types.ts';
import type { LayoutPreset } from './types.ts';

// The external full-suite measurement showed that several live deck iframes per editor exhaust Chromium and make
// both the thumbnails and unrelated preview tests flaky. Phase 2b's specified fallback is therefore active: the
// current slide has one live thumbnail and the remaining entries are title tiles.
const SLOTS = 1;
const THUMB_W = 172;
const SCALE = THUMB_W / 1920;

const states = signal<ThumbState[]>([]);
const frames = new Map<number, HTMLIFrameElement>();
const visible = new Set<number>();
let reloadTimer: ReturnType<typeof setTimeout> | null = null;

/** Load timing of the fihris, for the measurement the plan asks for (read by test/ui/fihris.spec.ts). */
export const thumbStats = { firstRequest: 0, lastReady: 0, loads: 0 };

const layerOf = (f: HTMLIFrameElement | undefined): EditLayer | null => {
  try { return (f?.contentWindow as (Window & { __nm?: EditLayer }) | null)?.__nm ?? null; } catch { return null; }
};

function setState(i: number, s: ThumbState): void {
  const next = states.value.slice();
  next[i] = s;
  states.value = next;
}

function pump(): void {
  if (fihrisCompact.value) return;
  const currentVisible = visible.has(currentSlide.value) ? new Set([currentSlide.value]) : new Set<number>();
  for (const i of nextBatch(states.value, currentSlide.value, currentVisible, SLOTS)) {
    const f = frames.get(i);
    if (!f) continue;
    if (!thumbStats.firstRequest) thumbStats.firstRequest = performance.now();
    setState(i, 'loading');
    f.src = thumbnailUrl();
  }
}

function onThumbLoad(i: number): void {
  const f = frames.get(i);
  const layer = layerOf(f);
  if (!f || !layer || !f.src) return;
  layer.goTo(i);
  setState(i, 'ready');
  thumbStats.loads++;
  thumbStats.lastReady = performance.now();
  pump();
}

function resetAll(): void {
  states.value = states.value.map(() => 'idle');
  pump();
}

onPreviewChange((how, change) => {
  if (how === 'reloaded') {
    // structural change: every thumbnail is stale; reload them after the edits settle
    if (reloadTimer) clearTimeout(reloadTimer);
    reloadTimer = setTimeout(resetAll, 600);
    return;
  }
  const patch = change.previewPatch as Exclude<PreviewPatch, 'reload'>;
  states.value.forEach((s, i) => {
    if (s !== 'ready') return;
    const missing = layerOf(frames.get(i))?.applyPatch(patch) ?? ['gone'];
    if (missing.length) setState(i, 'idle');
  });
  pump();
});

function Tile({ i, observer }: { i: number; observer: IntersectionObserver | null }) {
  const s = t.value;
  const ref = useRef<HTMLButtonElement>(null);
  const cur = i === currentSlide.value;
  const title = slideTitle(i) ?? s.untitled;
  const state = states.value[i] ?? 'idle';
  useEffect(() => {
    const el = ref.current;
    if (!el || !observer) return;
    observer.observe(el);
    return () => observer.unobserve(el);
  }, [observer]);
  useEffect(() => () => { frames.delete(i); }, [i]);
  return (
    <button
      ref={ref}
      type="button"
      class={`tile ${cur ? 'cur' : 'raised-s'}`}
      data-index={i}
      aria-current={cur ? 'true' : undefined}
      tabIndex={cur ? 0 : -1}
      onClick={() => goToSlide(i)}
      title={title}
      data-testid="fihris-tile"
    >
      {!fihrisCompact.value && (
        <span class={`thumb ${state}`} aria-hidden="true">
          {cur && (
            <iframe
              ref={(f) => { if (f) frames.set(i, f); else frames.delete(i); }}
              tabIndex={-1}
              title=""
              aria-hidden="true"
              onLoad={() => onThumbLoad(i)}
              style={{ transform: `scale(${SCALE})` }}
            />
          )}
        </span>
      )}
      <span class="cap">
        <span class="n">{s.fihrisNumber(i + 1)}</span>
        <span class="tt">{title}</span>
      </span>
    </button>
  );
}

export function Fihris() {
  const s = t.value;
  const n = slideCount.value;
  const list = useRef<HTMLDivElement>(null);
  const observer = useRef<IntersectionObserver | null>(null);
  const [picker, setPicker] = useState(false);
  const [presets, setPresets] = useState<LayoutPreset[]>([]);
  useEffect(() => {
    if (!picker || presets.length) return;
    let live = true;
    api.layoutPresets().then((result) => { if (live) setPresets(result.presets); }).catch(() => { if (live) setPresets([]); });
    return () => { live = false; };
  }, [picker]);

  if (states.value.length !== n) states.value = Array.from({ length: n }, (_, i) => states.value[i] ?? 'idle');

  if (!observer.current && typeof IntersectionObserver !== 'undefined') {
    observer.current = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const i = Number((e.target as HTMLElement).dataset.index);
        if (e.isIntersecting) visible.add(i);
        else visible.delete(i);
      }
      pump();
    }, { rootMargin: '0px 200px' });
  }

  // keep the current tile in view
  useEffect(() => {
    list.current?.querySelector('.tile.cur')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    pump();
  }, [currentSlide.value, n]);

  // compact mode unmounts the thumbnails; expanding starts them again from blank frames
  useEffect(() => { resetAll(); }, [fihrisCompact.value]);

  const onKey = (e: KeyboardEvent) => {
    const tiles = Array.from(list.current?.querySelectorAll<HTMLButtonElement>('.tile') ?? []);
    const at = tiles.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    const rtl = getComputedStyle(list.current as Element).direction === 'rtl';
    const step = { ArrowLeft: rtl ? 1 : -1, ArrowRight: rtl ? -1 : 1, Home: -Infinity, End: Infinity }[e.code];
    if (step === undefined) return;
    e.preventDefault();
    const to = Math.max(0, Math.min(tiles.length - 1, Number.isFinite(step) ? at + step : step > 0 ? tiles.length - 1 : 0));
    tiles.forEach((b, k) => { b.tabIndex = k === to ? 0 : -1; });
    tiles[to].focus();
  };

  return (
    <nav class={`fihris raised${fihrisCompact.value ? ' compact' : ''}`} aria-label={s.fihrisLabel}>
      <div class="tiles" ref={list} onKeyDown={onKey}>
        {Array.from({ length: n }, (_, i) => <Tile key={i} i={i} observer={observer.current} />)}
      </div>
      <button type="button" class="add raised-s" onClick={() => setPicker(!picker)} aria-expanded={picker} title={s.addSlide} aria-label={s.addSlide} data-testid="add-slide">
        <Icon name="plus" />
      </button>
      <div class="slide-actions" role="group" aria-label={s.fihrisLabel}>
        <button type="button" title={s.moveSlideBefore} aria-label={s.moveSlideBefore} onClick={() => void moveSlide(-1)}><Icon name="chevronUp" /></button>
        <button type="button" title={s.moveSlideAfter} aria-label={s.moveSlideAfter} onClick={() => void moveSlide(1)}><Icon name="chevronDown" /></button>
        <button type="button" title={s.duplicateSlide} aria-label={s.duplicateSlide} onClick={() => void duplicateSlide()}><span aria-hidden="true">++</span></button>
        <button type="button" title={s.deleteSlide} aria-label={s.deleteSlide} onClick={() => void deleteSlide()}><Icon name="close" /></button>
      </div>
      {picker && (
        <div class="layout-picker raised" role="dialog" aria-label={s.chooseLayout} data-testid="layout-picker">
          <div class="layout-picker-head"><strong>{s.chooseLayout}</strong><button type="button" onClick={() => setPicker(false)} aria-label={s.dismiss}><Icon name="close" /></button></div>
          <div class="layout-list">{presets.map((preset) => (
            <button type="button" key={preset.id} data-preset={preset.id} onClick={() => { setPicker(false); void addSlideFromPreset(preset.id); }}>
              <small>{preset.slot}</small><span>{preset.name}</span>
            </button>
          ))}</div>
        </div>
      )}
      <button
        type="button"
        class="fold raised-s"
        onClick={() => { fihrisCompact.value = !fihrisCompact.value; }}
        aria-expanded={!fihrisCompact.value}
        title={fihrisCompact.value ? s.fihrisExpand : s.fihrisCollapse}
        aria-label={fihrisCompact.value ? s.fihrisExpand : s.fihrisCollapse}
        data-testid="fihris-fold"
      >
        <Icon name={fihrisCompact.value ? 'chevronUp' : 'chevronDown'} />
      </button>
    </nav>
  );
}
