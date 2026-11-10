// The side panel: editable basic properties for the selected element, the slide outline, and the Phase 4 agent tab.
import { useEffect, useRef, useState } from 'preact/hooks';
import { freePosition, moveElement, postOps, select, setFullProperty, setImagePresentation, setLayerHidden, uploadAndReplaceImage } from './actions.ts';
import { AgentNotes } from './agent-notes.tsx';
import { api } from './api.ts';
import { Dial } from './dial.tsx';
import { elementByKey, frameWin } from './frame.ts';
import { colourName, digits, fontName, type Strings } from './i18n.ts';
import { Icon } from './icons.tsx';
import { propertyOp, sizeStops, type EditableProperty } from './property-ops.ts';
import { deckColours, nearestWeight, readElement, WEIGHTS, type Readout } from './readouts.ts';
import { elementRole, outlineRoles, pathTo, roleLabel } from './roles.ts';
import {
  banner, currentSlide, hover, info, lang, layoutTick, lint, notes as agentNotes, panelTab, selection, slideTitle, t, version, type PanelTab,
} from './state.ts';
import { finishTextSession } from './text-session.ts';
import type { LintIssue, OutlineNode } from './types.ts';
import { IdentityPanel, MotionPanel } from './phase7-panel.tsx';
import { workspaceMode } from './state.ts';

// --- small shared pieces ------------------------------------------------------------------------------------------

function Meter({ label, value, shown, min, max, step, testid, onChange }: {
  label: string; value: number | null; shown: string; min: number; max: number; step?: number; testid: string; onChange?: (value: number) => void;
}) {
  const frac = value === null ? 0 : Math.min(1, Math.max(0, (value - min) / (max - min)));
  return (
    <div class="sl" role="meter" aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value ?? undefined} aria-valuetext={shown}>
      <div class="h"><span>{label}</span><span class="read" data-testid={testid}>{shown}</span></div>
      <div class="track pressed">
        <span class="fill" style={{ inlineSize: `calc(${frac * 100}% - 4px)` }} />
        <span class="thumb raised-s" style={{ insetInlineStart: `calc(${frac * 100}% - ${frac * 26}px)` }}><i /></span>
        {onChange && <input aria-label={label} type="range" min={min} max={max} step={step ?? 0.01} value={value ?? min} onChange={(e) => onChange(Number(e.currentTarget.value))} />}
      </div>
    </div>
  );
}

const WEIGHT_LABEL = (w: number, s: Strings) => ({ 300: s.weightLight, 400: s.weightRegular, 700: s.weightBold, 900: s.weightBlack } as Record<number, string>)[w];

/** The engine's lint codes in the reader's language (the class name or file stays as written). */
/** Number input that keeps what the user is typing while focused: a re-render from another edit's
 *  response (Preact resyncs `value` to the DOM) must not wipe a half-typed value before it commits. */
function DraftNumber(props: { value: number; onCommit: (v: number) => void } & Record<string, unknown>) {
  const { value, onCommit, ...rest } = props;
  const focused = useRef(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!focused.current && ref.current) ref.current.value = String(value); }, [value]);
  return <input {...rest} ref={ref} type="number" defaultValue={String(value)}
    onFocus={() => { focused.current = true; }}
    onBlur={() => { focused.current = false; if (ref.current) ref.current.value = String(value); }}
    onChange={(e) => onCommit(Number((e.currentTarget as HTMLInputElement).value))} />;
}

export function lintText(i: LintIssue, s: Strings): string {
  const first = i.message.split(/[\s:]/)[0];
  switch (i.code) {
    case 'alpha-on-var-color': return s.lintAlpha(first);
    case 'letter-spacing-arabic': return s.lintLetterSpacing(first);
    case 'mixed-digits': return s.lintMixedDigits;
    case 'missing-font-weight': return s.lintMissingWeight(first);
    case 'missing-asset': return s.lintMissingAsset(i.message.replace(/^asset not found:\s*/, ''));
    case 'emoji': return s.lintEmoji;
    case 'slide-relative': return s.lintSlideRelative;
    default: return i.message;
  }
}

function Issues({ items }: { items: LintIssue[] }) {
  const s = t.value;
  if (!items.length) return null;
  return (
    <div class="fix pressed" role="group" aria-label={s.issuesLabel} data-testid="issues">
      <Icon name="warn" />
      <ul>{items.map((i, k) => <li key={k}><bdi>{lintText(i, s)}</bdi></li>)}</ul>
    </div>
  );
}

// --- properties ---------------------------------------------------------------------------------------------------

function Breadcrumb({ el }: { el: Element }) {
  const s = t.value;
  const path = pathTo(el);
  return (
    <nav class="crumbs" aria-label={s.breadcrumbLabel} data-testid="breadcrumb">
      {path.map((p, i) => {
        const k = p.getAttribute('data-nm-key') ?? '';
        const last = i === path.length - 1;
        const name = p.classList.contains('slide') ? s.slideN(currentSlide.value + 1) : roleLabel(elementRole(p), s);
        return (
          <span key={k} class="crumb">
            {last ? <span aria-current="location">{name}</span> : <button type="button" onClick={() => select(k)}>{name}</button>}
          </span>
        );
      })}
    </nav>
  );
}

function Properties() {
  const s = t.value;
  const l = lang.value;
  void layoutTick.value;
  void version.value;
  const key = selection.value;
  const el = elementByKey(key);
  const win = frameWin();
  const deck = info.value;
  const slideNo = currentSlide.value + 1;
  const slideIssues = lint.value.filter((i) => i.nodeKey === deck?.slides[currentSlide.value]?.key);

  if (!key || !el || !win || !deck) {
    return (
      <div class="props empty">
        <div class="el">
          <div class="lbl">{s.slideN(slideNo)}</div>
          <div class="t">{slideTitle(currentSlide.value) ?? s.untitled}</div>
        </div>
        <p class="hint">{s.noSelection}</p>
        <Issues items={slideIssues} />
      </div>
    );
  }

  const rtl = l === 'ar';
  const tokens = deckColours(win, el, deck);
  const r: Readout = readElement(win, el, key, deck, tokens, rtl);
  const role = elementRole(el);
  const name = r.text ? r.text.slice(0, 70) : roleLabel(role, s);
  const weight = nearestWeight(r.fontWeight);
  const sideLabel = { right: s.fromRight, left: s.fromLeft, top: s.fromTop, bottom: s.fromBottom };
  const items = lint.value.filter((i) => i.nodeKey === key);
  const families = [...new Set([r.fontFamily, ...deck.fonts.map((f) => f.family)])];
  const stops = sizeStops(Array.from(win.document.querySelectorAll('[data-nm-key]')).map((node) => parseFloat(win.getComputedStyle(node).fontSize)));
  // Typography goes to the elements that actually carry the text's style (see typographyTargets); box properties to the element.
  const TYPO: EditableProperty[] = ['fontFamily', 'fontSize', 'fontWeight', 'textColour', 'lineHeight'];
  const commit = (property: EditableProperty, value: string | number) => {
    const ids = TYPO.includes(property) ? r.typoKeys : [key];
    void finishTextSession(true)
      .then(() => postOps(ids.map((id) => propertyOp(id, property, value)), { label: `Set ${property}`, coalesceKey: `property:${key}:${property}` }))
      .catch((error: unknown) => { banner.value = { kind: 'error', message: error instanceof Error ? error.message : String(error) }; });
  };
  const visual = win.getComputedStyle(el);
  const visualNumber = (value: string) => Number.parseFloat(value) || 0;
  const commitFull = (property: Parameters<typeof setFullProperty>[1], value: string | number) => {
    void finishTextSession(true).then(() => setFullProperty(key, property, value)).catch((error: unknown) => {
      banner.value = { kind: 'error', message: error instanceof Error ? error.message : String(error) };
    });
  };
  const isImage = el.tagName.toLowerCase() === 'img';
  const objectPosition = visual.objectPosition.match(/([\d.]+)%\s+([\d.]+)%/);

  return (
    <div class="props" data-testid="props" data-key={key}>
      <Breadcrumb el={el} />
      <div class="el">
        <div class="lbl">{roleLabel(role, s)} · {s.slideN(slideNo)}</div>
        <div class="t" data-testid="element-name">{name}</div>
        {r.hasText && r.typoMixed && <div class="lbl" data-testid="typo-mixed">{s.typoMixed}</div>}
      </div>

      {r.hasText && (
        <div class="dialrow">
          <Dial key={key} value={r.fontSize} unit={s.sizeUnit} label={s.sizeLabel} stops={stops} onCommit={(value) => commit('fontSize', value)} />
          <div class="side">
            <label class="font-select lbl">
              <span>{s.fontFamily}</span>
              <select aria-label={s.fontFamily} value={r.fontFamily} data-testid="font-family" onChange={(e) => commit('fontFamily', e.currentTarget.value)}>
                {families.map((family) => <option key={family} value={family}>{fontName(family, l)}</option>)}
              </select>
            </label>
            <div class="wt" role="group" aria-label={s.weightLabel} data-testid="weight" data-weight={r.fontWeight}>
              {WEIGHTS.map((w) => (
                <button type="button" key={w} class={w === weight ? 'on' : 'raised-s'} aria-pressed={w === weight} onClick={() => commit('fontWeight', w)}>{WEIGHT_LABEL(w, s)}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {r.colour && (
        <div class="colours">
          <div class="lbl" data-testid="colour-label">
            {r.colour.prop === 'color' ? s.textColour : s.fillColour} · {r.colour.token ? s.colourFromDeck(colourName(r.colour.token, l)) : s.colourOutside(r.colour.hex)}
          </div>
          <div class="sw" role="group" aria-label={s.deckColours} data-testid="swatches" data-hex={r.colour.hex}>
            {tokens.slice(0, 8).map((c) => {
              const on = c.token === r.colour?.token;
              return (
                <button type="button" key={c.token} data-token={c.token} class={on ? 'on' : 'raised-s'} title={colourName(c.token, l)} aria-label={colourName(c.token, l)} aria-pressed={on} onClick={() => commit(r.colour?.prop === 'color' ? 'textColour' : 'fillColour', c.token)}>
                  <i style={{ background: c.hex }} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {r.hasText && (
        <Meter label={s.lineHeight} value={r.lineHeight} shown={r.lineHeight === null ? s.lineHeightNormal : r.lineHeight.toFixed(2)} min={0.6} max={2.4} step={0.05} testid="line-height" onChange={(value) => commit('lineHeight', value)} />
      )}
      <Meter label={s.opacity} value={r.opacity} shown={`${Math.round(r.opacity * 100)}${l === 'ar' ? '٪' : '%'}`} min={0} max={1} step={0.05} testid="opacity" onChange={(value) => commit('opacity', value)} />

      <fieldset class="full-props" data-testid="full-properties">
        <legend class="lbl">{s.spacing}</legend>
        <div class="prop-grid">
          <label><span>{s.padding}</span><DraftNumber min="0" max="240" value={visualNumber(visual.paddingTop)} onCommit={(v) => commitFull('padding', v)} /></label>
          <label><span>{s.margin}</span><DraftNumber min="0" max="240" value={Math.max(0, visualNumber(visual.marginTop))} onCommit={(v) => commitFull('margin', v)} /></label>
          <label><span>{s.radius}</span><DraftNumber min="0" max="240" value={visualNumber(visual.borderTopLeftRadius)} onCommit={(v) => commitFull('radius', v)} /></label>
          <label><span>{s.borderWidth}</span><DraftNumber min="0" max="32" value={visualNumber(visual.borderTopWidth)} onCommit={(v) => commitFull('borderWidth', v)} /></label>
          <label><span>{s.shadow}</span><select aria-label={s.shadow} onChange={(e) => commitFull('shadow', e.currentTarget.value)}><option value="none">{s.shadowNone}</option><option value="sm">S</option><option value="md">M</option><option value="lg">L</option><option value="xl">XL</option></select></label>
          <label><span>{s.borderColour}</span><select aria-label={s.borderColour} onChange={(e) => commitFull('borderColour', e.currentTarget.value)}>{tokens.map((token) => <option value={token.token}>{colourName(token.token, l)}</option>)}</select></label>
        </div>
      </fieldset>

      {isImage && (
        <fieldset class="image-props" data-testid="image-properties">
          <legend class="lbl">{s.imageFit}</legend>
          <div class="segmented tray" role="group" aria-label={s.imageFit}>
            <button type="button" onClick={() => void setImagePresentation(key, { fit: 'cover' })}>{s.imageCover}</button>
            <button type="button" onClick={() => void setImagePresentation(key, { fit: 'contain' })}>{s.imageContain}</button>
          </div>
          <Meter label={s.focalX} value={Number(objectPosition?.[1] ?? 50)} shown={`${Math.round(Number(objectPosition?.[1] ?? 50))}%`} min={0} max={100} step={1} testid="focal-x" onChange={(value) => void setImagePresentation(key, { focalX: value })} />
          <Meter label={s.focalY} value={Number(objectPosition?.[2] ?? 50)} shown={`${Math.round(Number(objectPosition?.[2] ?? 50))}%`} min={0} max={100} step={1} testid="focal-y" onChange={(value) => void setImagePresentation(key, { focalY: value })} />
          <label class="upload raised-s">{s.replaceImage}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml" onChange={(e) => { const file = e.currentTarget.files?.[0]; if (file) void uploadAndReplaceImage(key, file); }} /></label>
        </fieldset>
      )}

      <div class="pos" role="group" aria-label={s.positionLabel}>
        {r.x && r.y ? (
          <>
            <label class="cell raised-s"><small>{sideLabel[r.x.side]}</small><DraftNumber class="read" step="1" value={r.x.px} data-testid="pos-x" data-side={r.x.side} onCommit={(v) => commit(r.x!.side, v)} /></label>
            <label class="cell raised-s"><small>{sideLabel[r.y.side]}</small><DraftNumber class="read" step="1" value={r.y.px} data-testid="pos-y" data-side={r.y.side} onCommit={(v) => commit(r.y!.side, v)} /></label>
          </>
        ) : (
          <div class="cell wide raised-s"><small>{s.positionLabel}</small><span class="flow">{s.inFlow}</span><button type="button" class="free-position" data-testid="free-position" onClick={() => { void freePosition(); }}>{s.freePosition}</button></div>
        )}
        <div class="cell raised-s"><small>{s.width}</small><span class="read" data-testid="size-w">{r.width}</span></div>
        <div class="cell raised-s"><small>{s.height}</small><span class="read" data-testid="size-h">{r.height}</span></div>
      </div>

      {r.morph && r.morph.slides.length > 0 && (
        <div class="tg"><div class="on" data-testid="morph"><span><Icon name="link" />{s.morphLinked}</span><small>{s.morphWith(r.morph.slides)}</small></div></div>
      )}

      <Issues items={items} />
    </div>
  );
}

// --- layers -------------------------------------------------------------------------------------------------------

function Layers() {
  const s = t.value;
  const [tree, setTree] = useState<OutlineNode | null>(null);
  const slide = currentSlide.value;
  const v = version.value;
  useEffect(() => {
    let live = true;
    api.outline(slide + 1).then((o) => { if (live) setTree(o.outline); }).catch(() => { if (live) setTree(null); });
    return () => { live = false; };
  }, [slide, v]);
  if (!tree) return <p class="hint">{s.layersEmpty}</p>;
  const roles = outlineRoles(tree);
  const rows: { n: OutlineNode; depth: number }[] = [];
  const walk = (n: OutlineNode, depth: number) => {
    if (!n.key) return;
    rows.push({ n, depth });
    if (n.tag === 'svg') return; // a drawing is one layer
    n.children.forEach((c) => walk(c, depth + 1));
  };
  tree.children.forEach((c) => walk(c, 0));
  if (!rows.length) return <p class="hint">{s.layersEmpty}</p>;
  return (
    <ul class="layers" aria-label={s.layersLabel} data-testid="layers">
      {rows.map(({ n, depth }) => {
        const on = n.key === selection.value;
        return (
          <li key={n.key} class="layer-row">
            <button
              type="button"
              class={on ? 'on' : ''}
              aria-current={on ? 'true' : undefined}
              style={{ paddingInlineStart: `${10 + depth * 14}px` }}
              onMouseEnter={() => { hover.value = n.key ?? null; }}
              onMouseLeave={() => { hover.value = null; }}
              onFocus={() => { hover.value = n.key ?? null; }}
              onBlur={() => { hover.value = null; }}
              onClick={() => select(n.key ?? null)}
              data-key={n.key}
            >
              <span class="role">{roleLabel(roles.get(n) ?? 'group', s)}</span>
              {n.text && <span class="snip">{n.text}</span>}
            </button>
            <span class="layer-actions">
              <button type="button" title={s.layerUp} aria-label={s.layerUp} onClick={() => void moveElement(n.key!, 1)}><Icon name="chevronUp" /></button>
              <button type="button" title={s.layerDown} aria-label={s.layerDown} onClick={() => void moveElement(n.key!, -1)}><Icon name="chevronDown" /></button>
              <button type="button" title={n.classes.includes('hidden') ? s.layerShow : s.layerHide} aria-label={n.classes.includes('hidden') ? s.layerShow : s.layerHide} onClick={() => void setLayerHidden(n.key!, !n.classes.includes('hidden'))}><Icon name={n.classes.includes('hidden') ? 'eye' : 'eyeOff'} /></button>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// --- frame --------------------------------------------------------------------------------------------------------

const TABS: PanelTab[] = ['props', 'layers', 'agent'];

export function Panel() {
  if (workspaceMode.value === 'motion') return <aside class="panel raised" aria-label={t.value.modeMotion}><MotionPanel /></aside>;
  if (workspaceMode.value === 'identity') return <aside class="panel raised" aria-label={t.value.modeIdentity}><IdentityPanel /></aside>;
  const s = t.value;
  const tabsRef = useRef<HTMLDivElement>(null);
  const names = { props: s.tabProps, layers: s.tabLayers, agent: s.tabAgent };
  const openNotes = agentNotes.value.notes.filter((note) => note.status === 'open').length;
  const onKey = (e: KeyboardEvent) => {
    const rtl = lang.value === 'ar';
    const step = e.code === 'ArrowLeft' ? (rtl ? 1 : -1) : e.code === 'ArrowRight' ? (rtl ? -1 : 1) : 0;
    if (!step) return;
    e.preventDefault();
    const next = TABS[(TABS.indexOf(panelTab.value) + step + TABS.length) % TABS.length];
    panelTab.value = next;
    tabsRef.current?.querySelector<HTMLButtonElement>(`[data-tab="${next}"]`)?.focus();
  };
  return (
    <aside class="panel raised" aria-label={s.tabsLabel}>
      <div class="tabs tray" role="tablist" ref={tabsRef} onKeyDown={onKey}>
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            data-tab={id}
            aria-selected={panelTab.value === id}
            aria-controls={`tabpanel-${id}`}
            tabIndex={panelTab.value === id ? 0 : -1}
            class={panelTab.value === id ? 'on' : ''}
            onClick={() => { panelTab.value = id; }}
          >
            {names[id]}{id === 'agent' && openNotes > 0 && <span class="tab-count" data-testid="agent-count">{digits(openNotes, lang.value)}</span>}
          </button>
        ))}
      </div>
      <div class="tabpanel" role="tabpanel" id={`tabpanel-${panelTab.value}`} aria-labelledby={`tab-${panelTab.value}`}>
        {panelTab.value === 'props' && <Properties />}
        {panelTab.value === 'layers' && <Layers />}
        {panelTab.value === 'agent' && <AgentNotes />}
      </div>
    </aside>
  );
}
