// The canvas: a pressed well holding the live 1920x1080 preview iframe at fit (or fixed) zoom, a transparent hit
// layer that turns pointer input into hit tests through __nm.hitLocal, and the overlay layer (hover box, selection
// box with its role tag) drawn in this document, never inside the deck.
import { useEffect, useRef, useState } from 'preact/hooks';
import { commitGesture, goToSlide, select } from './actions.ts';
import { attachFrame, editLayer, elementByKey, stageRect } from './frame.ts';
import { digits } from './i18n.ts';
import { areaRect, pinPoint } from './notes.ts';
import { acceptsManipulationPointer, snapMove, type Guide, type Distance } from './manipulation.ts';
import { descendToward, elementRole, meaningfulBlock, roleLabel } from './roles.ts';
import { areaTargeting, currentSlide, fitZoom, hover, lang, layoutTick, noteArea, notes, panelTab, playing, selectedKeys, selection, t, textSession, zoom, zoomMode } from './state.ts';
import type { Handle } from '../engine/class-algebra.ts';
import { beginTextSession, finishTextSession } from './text-session.ts';

export const STAGE_W = 1920;
export const STAGE_H = 1080;
/** Breathing room between the slide and the well's edge at fit zoom. */
export const WELL_PAD = 64;

export function computeFit(wellW: number, wellH: number, pad = WELL_PAD): number {
  const z = Math.min((wellW - 2 * pad) / STAGE_W, (wellH - 2 * pad) / STAGE_H);
  return Math.max(0.05, Math.floor(z * 1000) / 1000);
}

/** The element under a pointer event, in stage coordinates via the edit layer. */
function hitAt(e: MouseEvent, stage: HTMLElement): Element | null {
  const layer = editLayer();
  if (!layer) return null;
  const r = stage.getBoundingClientRect();
  const z = zoom.value;
  const hit = layer.hitLocal((e.clientX - r.left) / z, (e.clientY - r.top) / z);
  return hit ? elementByKey(hit.key) : null;
}

const keyOf = (el: Element | null) => el?.getAttribute('data-nm-key') ?? null;

const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

function Box({ k, kind, primary, onPointerDown }: { k: string; kind: 'hover' | 'selection'; primary?: boolean; onPointerDown?: (e: PointerEvent, key: string, handle?: Handle) => void }) {
  void layoutTick.value; // re-measure when geometry may have changed
  const el = elementByKey(k);
  if (!el) return null;
  const r = stageRect(el);
  const z = zoom.value;
  const style = { left: `${r.left * z}px`, top: `${r.top * z}px`, width: `${Math.max(1, r.width * z)}px`, height: `${Math.max(1, r.height * z)}px` };
  if (kind === 'hover') return <div class="ov-hover" style={style} aria-hidden="true" data-testid="hover-box" />;
  return (
    <div class={`ov-sel${primary ? ' is-primary' : ''}`} style={style} data-testid="selection-box" data-key={k}>
      {primary && <span class={`ov-tag ${lang.value === 'ar' ? 'at-right' : 'at-left'}`}>{roleLabel(elementRole(el), t.value)}</span>}
      {primary && HANDLES.map((handle) => <i key={handle} class={`h h-${handle}`} data-handle={handle}
        onPointerDown={(e) => { e.stopPropagation(); onPointerDown?.(e, k, handle); }} />)}
    </div>
  );
}

function DragMarks({ guides, distances, equal }: { guides: Guide[]; distances: Distance[]; equal: boolean }) {
  const z = zoom.value;
  return <div class="drag-marks" aria-hidden="true" data-testid="drag-marks" data-equal={equal ? '' : undefined}>
    {guides.map((g, i) => <i key={`g${i}`} class={`guide ${g.axis}`} style={g.axis === 'x'
      ? { left: `${g.at * z}px`, top: `${g.from * z}px`, height: `${(g.to - g.from) * z}px` }
      : { top: `${g.at * z}px`, left: `${g.from * z}px`, width: `${(g.to - g.from) * z}px` }} />)}
    {distances.map((d, i) => <span key={`d${i}`} class="distance" style={{ left: `${d.x * z}px`, top: `${d.y * z}px` }}>{d.value}px</span>)}
  </div>;
}

function NoteMarks() {
  void layoutTick.value;
  const z = zoom.value;
  const shown = notes.value.notes.filter((note) => note.status === 'open' && note.target.slide === currentSlide.value + 1);
  return (
    <div class="note-marks" aria-label={t.value.openNotes}>
      {shown.map((note) => {
        const rect = note.target.kind === 'area'
          ? note.target.rect
          : (() => {
              const element = elementByKey(note.target.key);
              if (!element) return null;
              const box = stageRect(element);
              return { x: box.left, y: box.top, width: box.width, height: box.height };
            })();
        if (!rect) return null;
        const point = pinPoint(rect);
        const jump = () => {
          goToSlide(note.target.slide - 1);
          selection.value = note.target.kind === 'element' ? note.target.key : null;
          panelTab.value = 'agent';
        };
        return (
          <div key={note.id}>
            {note.target.kind === 'area' && <button type="button" class="note-area-mark" style={{ left: `${rect.x * z}px`, top: `${rect.y * z}px`, width: `${rect.width * z}px`, height: `${rect.height * z}px` }} aria-label={note.text} data-testid="note-area" onClick={jump} />}
            <button type="button" class="note-pin" style={{ left: `${point.x * z}px`, top: `${point.y * z}px` }} title={note.text} aria-label={note.text} data-testid="note-pin" data-note-id={note.id} onClick={jump}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v10H9l-4 4z" /></svg>
            </button>
          </div>
        );
      })}
      {noteArea.value && (
        <div class="note-area-draft" style={{ left: `${noteArea.value.x * z}px`, top: `${noteArea.value.y * z}px`, width: `${noteArea.value.width * z}px`, height: `${noteArea.value.height * z}px` }} aria-hidden="true" />
      )}
    </div>
  );
}

export function Canvas() {
  const scroller = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const doubleClickOrigin = useRef<string | null>(null);
  const areaStart = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const activeDrag = useRef(false);
  const [dragMarks, setDragMarks] = useState<{ guides: Guide[]; distances: Distance[]; equal: boolean } | null>(null);
  const s = t.value;
  const z = zoom.value;

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => { fitZoom.value = computeFit(el.clientWidth, el.clientHeight); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onMove = (e: MouseEvent) => {
    if (!stage.current || playing.value || activeDrag.current) return;
    if (areaTargeting.value && areaStart.current) {
      const r = stage.current.getBoundingClientRect();
      noteArea.value = areaRect(areaStart.current, { x: (e.clientX - r.left) / zoom.value, y: (e.clientY - r.top) / zoom.value });
      return;
    }
    const hit = hitAt(e, stage.current);
    const target = hit && !(e.ctrlKey || e.metaKey) ? meaningfulBlock(hit) : hit;
    const k = keyOf(target);
    hover.value = k === selection.value ? null : k;
  };
  const onClick = (e: MouseEvent) => {
    if (!stage.current || playing.value) return;
    if (suppressClick.current) { suppressClick.current = false; return; }
    if (areaTargeting.value) return;
    const hit = hitAt(e, stage.current);
    if (e.detail > 1) {
      const origin = elementByKey(doubleClickOrigin.current);
      doubleClickOrigin.current = null;
      if (!hit) return;
      // Preserve Phase 2b's hierarchy gesture: when the double-click started with an ancestor selected, it
      // descends exactly one keyed level. A double-click without that ancestor context is Phase 3's deliberate
      // text-edit gesture, including blocks whose text is a direct text node (there is no keyed child to descend to).
      if (origin && origin !== hit && origin.contains(hit)) {
        const down = descendToward(origin, hit);
        if (down) select(keyOf(down));
        return;
      }
      const key = keyOf(hit);
      if (key && (hit.textContent ?? '').trim() && beginTextSession(key)) return;
      select(key);
      return;
    }
    if (textSession.value) { finishTextSession(true).catch(() => {}); return; }
    const target = hit && !(e.ctrlKey || e.metaKey) ? meaningfulBlock(hit) : hit;
    select(keyOf(target), e.shiftKey);
    hover.value = null;
  };

  const startManipulation = (down: PointerEvent, key: string, handle?: Handle) => {
    if (!acceptsManipulationPointer(down) || playing.value || textSession.value) return;
    down.preventDefault();
    down.stopPropagation();
    if (!selectedKeys.value.includes(key)) select(key);
    const keys = handle ? [key] : (selectedKeys.value.includes(key) ? [...selectedKeys.value] : [key]);
    const primary = elementByKey(key) as HTMLElement | null;
    if (!primary) return;
    const startRect = stageRect(primary);
    const rect = { x: startRect.left, y: startRect.top, width: startRect.width, height: startRect.height };
    const siblings = Array.from(primary.parentElement?.children ?? [])
      .filter((node) => node !== primary && !keys.includes(node.getAttribute('data-nm-key') ?? ''))
      .map((node) => stageRect(node)).map((r) => ({ x: r.left, y: r.top, width: r.width, height: r.height }));
    const elements = keys.map((k) => elementByKey(k) as HTMLElement | null).filter((el): el is HTMLElement => !!el);
    const saved = elements.map((el) => ({ el, translate: el.style.translate, width: el.style.width, height: el.style.height }));
    const sx = down.clientX;
    const sy = down.clientY;
    let lastDx = 0;
    let lastDy = 0;
    activeDrag.current = true;
    hover.value = null;

    const move = (event: PointerEvent) => {
      const rawX = (event.clientX - sx) / zoom.value;
      const rawY = (event.clientY - sy) / zoom.value;
      const snapped = !handle && !(event.ctrlKey || event.metaKey)
        ? snapMove(rect, rawX, rawY, siblings, zoom.value)
        : { dx: rawX, dy: rawY, guides: [], distances: [], equalSpacing: false };
      lastDx = snapped.dx;
      lastDy = snapped.dy;
      if (handle) {
        const west = handle.includes('w');
        const north = handle.includes('n');
        primary.style.width = `${Math.max(1, rect.width + (handle.includes('e') ? lastDx : west ? -lastDx : 0))}px`;
        primary.style.height = `${Math.max(1, rect.height + (handle.includes('s') ? lastDy : north ? -lastDy : 0))}px`;
        primary.style.translate = `${west ? lastDx : 0}px ${north ? lastDy : 0}px`;
      } else {
        elements.forEach((el) => { el.style.translate = `${lastDx}px ${lastDy}px`; });
      }
      setDragMarks({ guides: snapped.guides, distances: snapped.distances, equal: snapped.equalSpacing });
    };
    const finish = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', cancel);
      saved.forEach(({ el, translate, width, height }) => { el.style.translate = translate; el.style.width = width; el.style.height = height; });
      activeDrag.current = false;
      setDragMarks(null);
      if (Math.round(lastDx) || Math.round(lastDy)) {
        void commitGesture(keys, handle
          ? { kind: 'resize', handle, dx: lastDx, dy: lastDy }
          : { kind: 'move', dx: lastDx, dy: lastDy });
      }
    };
    const cancel = () => {
      lastDx = 0; lastDy = 0;
      finish();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish, { once: true });
    window.addEventListener('pointercancel', cancel, { once: true });
  };

  const pct = Math.round(z * 100);
  return (
    <main class="well pressed" aria-label={s.canvasLabel}>
      <div class="scroller" ref={scroller}>
        <div class="stage-pad" style={{ padding: `${WELL_PAD}px` }}>
          <div class="stage" ref={stage} dir="ltr" style={{ width: `${STAGE_W * z}px`, height: `${STAGE_H * z}px` }}>
            <div class="clip">
              <iframe
                id="frame"
                name="nm-preview"
                ref={attachFrame}
                title={s.previewTitle}
                tabIndex={-1}
                style={{ transform: `scale(${z})` }}
              />
            </div>
            <div
              class={`hit${playing.value ? ' is-playing' : ''}${textSession.value ? ' is-editing' : ''}${areaTargeting.value ? ' is-targeting' : ''}`}
              onPointerDown={(e) => {
                if (!stage.current || areaTargeting.value) return;
                const hit = hitAt(e, stage.current);
                const target = hit && !(e.ctrlKey || e.metaKey) ? meaningfulBlock(hit) : hit;
                const key = keyOf(target);
                if (key && selectedKeys.value.includes(key)) { startManipulation(e, key); return; }
                // Pressing anywhere inside a selected element drags that element (PowerPoint behaviour),
                // even when the point lands on one of its children.
                // The drag starts only once the pointer travels 3px, so a click or double-click on a child keeps
                // its selection meaning (double-click descends one level).
                const owner = hit ? selectedKeys.value.find((k) => elementByKey(k)?.contains(hit)) : undefined;
                if (!owner || !acceptsManipulationPointer(e)) return;
                const down = e;
                const watch = (ev: PointerEvent) => {
                  if (Math.hypot(ev.clientX - down.clientX, ev.clientY - down.clientY) < 3) return;
                  stopWatch();
                  startManipulation(down, owner);
                };
                const stopWatch = () => { window.removeEventListener('pointermove', watch); window.removeEventListener('pointerup', stopWatch); };
                window.addEventListener('pointermove', watch);
                window.addEventListener('pointerup', stopWatch);
              }}
              onMouseDown={(e) => {
                if (areaTargeting.value && stage.current) {
                  const r = stage.current.getBoundingClientRect();
                  areaStart.current = { x: (e.clientX - r.left) / zoom.value, y: (e.clientY - r.top) / zoom.value };
                  noteArea.value = null;
                  e.preventDefault();
                  return;
                }
                if (e.detail === 1) doubleClickOrigin.current = selection.value;
              }}
              onMouseMove={onMove}
              onMouseUp={(e) => {
                if (!areaStart.current || !stage.current) return;
                const r = stage.current.getBoundingClientRect();
                noteArea.value = areaRect(areaStart.current, { x: (e.clientX - r.left) / zoom.value, y: (e.clientY - r.top) / zoom.value });
                areaStart.current = null;
                if (noteArea.value) areaTargeting.value = false;
                suppressClick.current = true;
              }}
              onMouseLeave={() => { hover.value = null; }}
              onClick={onClick}
              data-testid="hit-layer"
            />
            {!playing.value && !textSession.value && (
              <div class="overlays">
                {hover.value && <Box k={hover.value} kind="hover" />}
                {selectedKeys.value.map((key) => <Box key={key} k={key} kind="selection" primary={key === selection.value} onPointerDown={startManipulation} />)}
                {dragMarks && <DragMarks guides={dragMarks.guides} distances={dragMarks.distances} equal={dragMarks.equal} />}
              </div>
            )}
            {!playing.value && <NoteMarks />}
          </div>
        </div>
      </div>
      <output class="zoomw" aria-label={s.zoomLabel} data-testid="zoom-readout">
        <span class="read">{digits(pct, lang.value)}{lang.value === 'ar' ? '٪' : '%'}</span>
        {zoomMode.value === 'fit' && <span>{s.zoomFit}</span>}
      </output>
    </main>
  );
}
