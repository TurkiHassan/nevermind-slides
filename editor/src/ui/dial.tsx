import { useEffect, useRef, useState } from 'preact/hooks';
import { dialGeometry } from './dial-geometry.ts';
import { dialValueFromPoint, keyDialValue, settleDial } from './dial-input.ts';

const SIZE = 168;
const RADIUS = 72;
export const DIAL_MIN = 12;
export const DIAL_MAX = 240;

export function Dial({ value, unit, label, stops = [], onCommit }: {
  value: number; unit: string; label: string; stops?: number[]; onCommit?: (value: number) => void;
}) {
  const [live, setLive] = useState(value);
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; value: number; time: number; velocity: number } | null>(null);
  const animation = useRef<number | null>(null);
  useEffect(() => {
    if (!drag.current && animation.current === null) setLive(value);
  }, [value]);
  useEffect(() => () => { if (animation.current !== null) cancelAnimationFrame(animation.current); }, []);
  const g = dialGeometry(live, DIAL_MIN, DIAL_MAX, SIZE, RADIUS);
  const c = SIZE / 2;
  const shown = Number.isInteger(live) ? String(live) : live.toFixed(1);

  const pointValue = (e: PointerEvent) => {
    const box = ref.current?.getBoundingClientRect();
    return box ? dialValueFromPoint(e.clientX, e.clientY, box, DIAL_MIN, DIAL_MAX) : live;
  };
  const onPointerDown = (e: PointerEvent) => {
    if (!onCommit || !ref.current) return;
    e.preventDefault();
    if (animation.current !== null) { cancelAnimationFrame(animation.current); animation.current = null; }
    ref.current.setPointerCapture(e.pointerId);
    const next = pointValue(e);
    drag.current = { id: e.pointerId, value: next, time: e.timeStamp, velocity: 0 };
    setLive(next);
    ref.current.focus();
  };
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const next = pointValue(e);
    const elapsed = Math.max(1, e.timeStamp - d.time);
    d.velocity = (next - d.value) / elapsed;
    d.value = next;
    d.time = e.timeStamp;
    setLive(next);
  };
  const onPointerUp = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const next = settleDial(d.value, d.velocity, stops, reduced, DIAL_MIN, DIAL_MAX);
    if (reduced || Math.abs(next - d.value) < 0.1) {
      setLive(next);
      onCommit?.(next);
      return;
    }
    const from = d.value;
    const started = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / 180);
      const eased = 1 - (1 - progress) ** 3;
      setLive(Math.round((from + (next - from) * eased) * 10) / 10);
      if (progress < 1) animation.current = requestAnimationFrame(tick);
      else { animation.current = null; onCommit?.(next); }
    };
    animation.current = requestAnimationFrame(tick);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (!onCommit || !['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'Home', 'End'].includes(e.code)) return;
    e.preventDefault();
    if (animation.current !== null) { cancelAnimationFrame(animation.current); animation.current = null; }
    const next = keyDialValue(live, e.code, e.shiftKey, DIAL_MIN, DIAL_MAX);
    setLive(next);
    onCommit(next);
  };
  return (
    <div
      ref={ref} class="dial raised" role="slider" tabIndex={onCommit ? 0 : -1} aria-label={label}
      aria-valuemin={DIAL_MIN} aria-valuemax={DIAL_MAX} aria-valuenow={live} data-testid="dial"
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
    >
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        <defs>
          <linearGradient id="nm-dial-g" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stop-color="#4cc9f0" />
            <stop offset=".55" stop-color="#a8d98a" />
            <stop offset="1" stop-color="#ff8a4c" />
          </linearGradient>
        </defs>
        <circle cx={c} cy={c} r={RADIUS} class="dial-track" stroke-dasharray={`${g.track} ${g.circumference}`} transform={`rotate(135 ${c} ${c})`} />
        {g.arc > 0.5 && (
          <circle cx={c} cy={c} r={RADIUS} class="dial-arc" stroke-dasharray={`${g.arc} ${g.circumference}`} transform={`rotate(135 ${c} ${c})`} />
        )}
        <circle cx={g.marker.x} cy={g.marker.y} r="6" class="dial-marker" />
      </svg>
      <div class="knob raised-s">
        <div>
          <span class={`read dial-value${shown.length > 3 ? ' long' : ''}`} data-testid="font-size">{shown}</span>
          <small>{unit}</small>
        </div>
      </div>
    </div>
  );
}
