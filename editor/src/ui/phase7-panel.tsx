import { useEffect, useRef, useState } from 'preact/hooks';
import { postComputedOps, postOps } from './actions.ts';
import { api } from './api.ts';
import { editLayer, elementByKey } from './frame.ts';
import { anatomyColourOp, entranceOps, identityColourOp, identityFontOp, morphPairOps, zoomOrderOps } from './phase7-ops.ts';
import { currentSlide, info, lang, selection } from './state.ts';
import type { OutlineNode } from './types.ts';

const copy = {
  ar: {
    motion: 'الحركة', select: 'حدّد عنصرًا في الشريحة لتحرير حركته.', entrance: 'دخول العنصر', kind: 'نوع الدخول', order: 'الترتيب', delay: 'التأخير (ms)', previewEntrance: 'معاينة الدخول', morph: 'ربط Morph بالشريحة التالية', target: 'العنصر المقابل', link: 'إنشاء الربط', zoom: 'خطوات Zoom', addZoom: 'إضافة المحدد كخطوة', preview: 'معاينة', up: 'لأعلى', down: 'لأسفل', label: 'التسمية', anatomy: 'ألوان anatomy', identity: 'هوية العرض', colours: 'الألوان', fonts: 'ثنائية الخطوط', body: 'خط النص', display: 'خط العناوين', noConfig: 'لا يحتوي العرض على tailwind.config قابل للتحرير.', noNext: 'لا توجد شريحة تالية لربط Morph.',
  },
  en: {
    motion: 'Motion', select: 'Select an element on the slide to edit its motion.', entrance: 'Element entrance', kind: 'Entrance type', order: 'Order', delay: 'Delay (ms)', previewEntrance: 'Preview entrance', morph: 'Morph to next slide', target: 'Matching element', link: 'Create link', zoom: 'Zoom steps', addZoom: 'Add selection as step', preview: 'Preview', up: 'Move up', down: 'Move down', label: 'Label', anatomy: 'Anatomy colours', identity: 'Deck identity', colours: 'Colours', fonts: 'Font pairing', body: 'Body font', display: 'Display font', noConfig: 'This deck has no editable tailwind.config.', noNext: 'There is no next slide for a Morph pair.',
  },
} as const;

function flatten(root: OutlineNode | null): { key: string; name: string }[] {
  if (!root) return [];
  const out: { key: string; name: string }[] = [];
  const walk = (node: OutlineNode) => {
    if (node.key) out.push({ key: node.key, name: node.text.trim().slice(0, 60) || `<${node.tag}>` });
    node.children.forEach(walk);
  };
  root.children.forEach(walk);
  return out;
}

export function changeEntrance(key: string, field: 'kind' | 'order' | 'delay', value: string | number) {
  return postComputedOps(() => {
    const entrance = info.value?.entrances.find((item) => item.key === key);
    const next = { kind: entrance?.kind ?? 'fade-up', order: entrance?.order ?? 1, delay: entrance?.delay ?? 0, [field]: value };
    return entranceOps(key, next);
  }, { label: 'Set entrance', coalesceKey: `entrance:${key}` });
}

/**
 * A text or number field that commits on change (blur or Enter). The inspected value arrives asynchronously, so while
 * the user is typing the draft wins: a state refresh must never write the old value back over it. The draft is
 * dropped once the inspected value moves, which is when the committed edit (or an outside one) has landed.
 */
function DraftInput(props: {
  value: string; onCommit: (value: string) => void; type?: 'number' | 'text'; min?: string; step?: string; 'aria-label'?: string;
}) {
  const { value, onCommit, type = 'text', ...rest } = props;
  const [draft, setDraft] = useState<string | null>(null);
  const inspectedValue = useRef(value);
  useEffect(() => {
    if (inspectedValue.current === value) return;
    inspectedValue.current = value;
    setDraft(null);
  }, [value]);
  const field = {
    ...rest, value: draft ?? value,
    onInput: (e: { currentTarget: HTMLInputElement }) => setDraft(e.currentTarget.value),
    onChange: (e: { currentTarget: HTMLInputElement }) => { setDraft(e.currentTarget.value); onCommit(e.currentTarget.value); },
  };
  return type === 'number' ? <input type="number" {...field} /> : <input type="text" {...field} />;
}

export function MotionPanel() {
  const deck = info.value;
  const key = selection.value;
  const slide = currentSlide.value;
  const s = copy[lang.value];
  const [nextOutline, setNextOutline] = useState<OutlineNode | null>(null);
  const [target, setTarget] = useState('');
  useEffect(() => {
    let live = true;
    setNextOutline(null);
    if (!deck || slide + 1 >= deck.slides.length) return () => { live = false; };
    api.outline(slide + 2).then((value) => { if (live) setNextOutline(value.outline); }).catch(() => {});
    return () => { live = false; };
  }, [slide, deck?.slides.length, deck?.runtime.version]);
  if (!deck) return null;
  const entrance = deck.entrances.find((item) => item.key === key);
  const zoom = deck.zoomSteps.filter((item) => item.slideKey === deck.slides[slide]?.key).sort((a, b) => a.step - b.step);
  const anatomy = deck.anatomy.find((item) => item.key === key);
  const anatomyVariables = (() => {
    if (!anatomy) return {} as Record<string, string>;
    const variables = { ...anatomy.variables };
    const host = elementByKey(anatomy.key) as HTMLIFrameElement | null;
    if (host?.tagName === 'IFRAME') {
      try {
        host.contentDocument?.querySelectorAll<HTMLElement>('[style]').forEach((node) => {
          for (let i = 0; i < node.style.length; i++) {
            const name = node.style[i];
            if (/^--anatomy-/.test(name) && !(name in variables)) variables[name] = node.style.getPropertyValue(name).trim();
          }
        });
      } catch { /* cross-origin anatomy remains movable/resizable but cannot expose internal variables */ }
    }
    return variables;
  })();
  const candidates = flatten(nextOutline);
  const commitEntrance = (field: 'kind' | 'order' | 'delay', value: string | number) => {
    if (!key) return;
    void changeEntrance(key, field, value);
  };
  const reorderZoom = (at: number, delta: -1 | 1) => {
    const next = [...zoom];
    const to = Math.max(0, Math.min(next.length - 1, at + delta));
    if (to === at) return;
    const [item] = next.splice(at, 1); next.splice(to, 0, item);
    void postOps(zoomOrderOps(next), { label: 'Reorder zoom steps' });
  };
  return <div class="phase7-panel" data-testid="motion-panel">
    <h2>{s.motion}</h2>
    {!key ? <p class="hint">{s.select}</p> : <>
      <fieldset><legend>{s.entrance}</legend>
        <label>{s.kind}<select value={entrance?.kind ?? 'fade-up'} onChange={(e) => commitEntrance('kind', e.currentTarget.value)}><option value="fade-up">fade-up</option><option value="fade">fade</option><option value="scale">scale</option><option value="slide-right">slide-right</option></select></label>
        <label>{s.order}<DraftInput key={`order:${key}`} type="number" min="1" value={String(entrance?.order ?? 1)} onCommit={(value) => commitEntrance('order', Number(value))} /></label>
        <label>{s.delay}<DraftInput key={`delay:${key}`} type="number" min="0" step="50" value={String(entrance?.delay ?? 0)} onCommit={(value) => commitEntrance('delay', Number(value))} /></label>
        <button type="button" class="raised-s" onClick={() => editLayer()?.previewEntrance(slide)}>{s.previewEntrance}</button>
      </fieldset>
      <fieldset><legend>{s.morph}</legend>
        {slide + 1 >= deck.slides.length ? <p class="hint">{s.noNext}</p> : <>
          <label>{s.target}<select value={target} onChange={(e) => setTarget(e.currentTarget.value)}><option value="" />{candidates.map((item) => <option value={item.key}>{item.name}</option>)}</select></label>
          <button type="button" class="raised-s" disabled={!target} onClick={() => {
            if (!target) return;
            const group = `morph-${slide + 1}-${Object.keys(deck.morph).length + 1}`;
            void postOps(morphPairOps({ fromKey: key, toKey: target, fromSlide: slide + 1, toSlide: slide + 2, group, existingGroups: Object.keys(deck.morph) }), { label: 'Pair Morph elements' });
          }}>{s.link}</button>
        </>}
      </fieldset>
    </>}
    <fieldset><legend>{s.zoom}</legend>
      {key && !zoom.some((item) => item.key === key) && <button type="button" class="raised-s" onClick={() => void postOps(zoomOrderOps([...zoom.map((item) => ({ key: item.key, label: item.label })), { key, label: null }]), { label: 'Add zoom step' })}>{s.addZoom}</button>}
      <ol class="motion-list">{zoom.map((item, index) => <li key={item.key}>
        <DraftInput aria-label={s.label} value={item.label ?? ''} onCommit={(value) => void postOps([{ kind: 'setAttr', id: item.key, name: 'data-zoom-label', value: value || null }], { label: 'Label zoom step', coalesceKey: `zoom-label:${item.key}` })} />
        <button type="button" aria-label={s.up} onClick={() => reorderZoom(index, -1)}>↑</button><button type="button" aria-label={s.down} onClick={() => reorderZoom(index, 1)}>↓</button>
        <button type="button" onClick={() => editLayer()?.previewZoom(slide, index + 1)}>{s.preview}</button>
      </li>)}</ol>
    </fieldset>
    {anatomy && Object.keys(anatomyVariables).length > 0 && <fieldset data-testid="anatomy-controls"><legend>{s.anatomy}</legend>{Object.entries(anatomyVariables).map(([variable, value]) => <label key={variable}>{variable}<input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'} onChange={(e) => void postOps([anatomyColourOp(anatomy.key, variable, e.currentTarget.value)], { label: `Set ${variable}` })} /></label>)}</fieldset>}
  </div>;
}

function fontValue(value: unknown): string { return Array.isArray(value) ? value.join(', ') : typeof value === 'string' ? value : ''; }

export function IdentityPanel() {
  const deck = info.value;
  const s = copy[lang.value];
  if (!deck) return null;
  const colours = Object.entries(deck.identity.colours).filter((entry): entry is [string, string] => typeof entry[1] === 'string');
  const families = deck.fonts.map((font) => font.family);
  const set = (op: unknown, label: string) => { void postOps([op], { label }); };
  return <div class="phase7-panel" data-testid="identity-panel"><h2>{s.identity}</h2>
    {deck.tokens.colors.length === 0 && deck.tokens.fontFamilies.length === 0 ? <p class="hint">{s.noConfig}</p> : <>
      <fieldset><legend>{s.colours}</legend><div class="identity-colours">{colours.map(([token, value]) => <label key={token}><span>{token}</span><input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'} onChange={(e) => set(identityColourOp(token, e.currentTarget.value), `Set identity colour ${token}`)} /></label>)}</div></fieldset>
      <fieldset><legend>{s.fonts}</legend>{(['body', 'display'] as const).map((role) => <label key={role}>{s[role]}<select value={fontValue(deck.identity.fonts[role])} onChange={(e) => set(identityFontOp(role, e.currentTarget.value), `Set ${role} font`)}><option value={fontValue(deck.identity.fonts[role])}>{fontValue(deck.identity.fonts[role]) || '—'}</option>{families.filter((family) => family !== fontValue(deck.identity.fonts[role])).map((family) => <option value={family}>{family}</option>)}</select></label>)}</fieldset>
    </>}
  </div>;
}
