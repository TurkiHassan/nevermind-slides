// What the chrome's controls and shortcuts do. Server calls go through api.ts and their results through the same
// serial patch-or-reload pipeline as SSE events.
import { ApiError, api } from './api.ts';
import { bringUpToDate, ensureInspected, refreshState, serial, type Outcome } from './events.ts';
import { editLayer, showSlide } from './frame.ts';
import { elementByKey, frameWin, stageRect } from './frame.ts';
import type { Lang } from './i18n.ts';
import { freePositionClasses, manipulationClasses, manipulationRefusal, type Gesture } from './manipulation.ts';
import { imageClasses, propertyClasses, type FullProperty, type ImageClassChange } from './property-ops.ts';
import {
  banner, conflict, currentSlide, fitZoom, flags, hover, info, lang, panelTab, playing, saveRefused, saving, selection,
  selectedKeys, slideCount, toast, version, zoom, zoomMode,
} from './state.ts';
import type { TxResult } from './types.ts';

function fail(e: unknown): void {
  if (e instanceof ApiError && e.code === 'conflict') {
    saveRefused.value = true;
    if (!conflict.value) conflict.value = { diskFingerprint: String(e.body.diskFingerprint ?? '') };
    return;
  }
  banner.value = { kind: 'error', message: e instanceof Error ? e.message : String(e) };
}

async function applyResult(r: TxResult): Promise<TxResult & { how: Outcome }> {
  const how = await bringUpToDate(r);
  if (how === 'skipped') flags.value = { dirty: r.dirty, changedLines: r.changedLines, canUndo: r.canUndo, canRedo: r.canRedo };
  return { ...r, how };
}

let sourceChain: Promise<unknown> = Promise.resolve();
/** Keep source mutations and saves ordered through their complete server + preview lifecycle. */
function serialSource<T>(fn: () => Promise<T>): Promise<T> {
  const run = sourceChain.then(fn, fn);
  sourceChain = run.catch(() => {});
  return run;
}

/** Resolves once every source mutation queued so far has finished its server call and its preview patch or reload. */
export function settled(): Promise<void> {
  return serialSource(() => serial(() => undefined));
}

/** Send ops (Phase 3 controls; tests drive it today). The base version is read when the request is made. */
export async function postOps(ops: unknown[], extra: { label?: string; coalesceKey?: string } = {}): Promise<TxResult & { how: Outcome }> {
  return serialSource(async () => {
    const r = await serial(() => api.ops(ops, version.value, extra));
    return applyResult(r);
  });
}

/** Compute source-dependent ops only after earlier source mutations have reached the preview and been inspected. */
export async function postComputedOps(compute: () => unknown[], extra: { label?: string; coalesceKey?: string } = {}): Promise<(TxResult & { how: Outcome }) | null> {
  return serialSource(async () => {
    await ensureInspected();
    const ops = compute();
    if (!ops.length) return null;
    const r = await serial(() => api.ops(ops, version.value, extra));
    return applyResult(r);
  });
}

/** Accept a reviewed AI proposal through the normal version and preview pipeline. */
export async function acceptAiProposal(id: string): Promise<void> {
  await serialSource(async () => { await applyResult((await api.acceptAiRequest(id)).result); });
}

export async function undo(): Promise<void> {
  if (!flags.value.canUndo) return;
  try { await applyResult(await api.undo()); } catch (e) { fail(e); }
}

export async function redo(): Promise<void> {
  if (!flags.value.canRedo) return;
  try { await applyResult(await api.redo()); } catch (e) { fail(e); }
}

export async function save(): Promise<void> {
  if (saving.value) return;
  saving.value = true;
  try {
    await serialSource(async () => {
      if (conflict.value) { saveRefused.value = true; return; }
      if (!flags.value.dirty) return;
      const r = await api.save();
      flags.value = { ...flags.value, dirty: r.dirty, changedLines: r.changedLines };
      toast.value = 'savedToast';
    });
  } catch (e) {
    fail(e);
  } finally {
    saving.value = false;
  }
}

export async function resolve(strategy: 'reload' | 'reapply'): Promise<void> {
  try {
    const r = await api.resolve(strategy);
    conflict.value = null;
    saveRefused.value = false;
    // the resolve publishes a 'version' event (reload); refresh the rest now
    await refreshState();
    if (r.failed.length) banner.value = { kind: 'resolved', failed: r.failed.map((f) => f.label || f.code) };
    else { banner.value = null; toast.value = strategy === 'reload' ? 'resolvedReload' : 'resolvedOk'; }
  } catch (e) {
    if (e instanceof ApiError && e.code === 'not-replayable') banner.value = { kind: 'not-replayable' };
    else fail(e);
  }
}

// --- navigation and selection ------------------------------------------------------------------------------------

export function goToSlide(i: number): void {
  const n = slideCount.value;
  if (n === 0) return;
  const k = Math.max(0, Math.min(n - 1, i));
  if (k !== currentSlide.value) {
    selection.value = null;
    selectedKeys.value = [];
    hover.value = null;
  }
  currentSlide.value = k;
  showSlide(k);
}

export function select(key: string | null, additive = false): void {
  if (additive && key) {
    const has = selectedKeys.value.includes(key);
    selectedKeys.value = has ? selectedKeys.value.filter((k) => k !== key) : [...selectedKeys.value, key];
    selection.value = has ? selectedKeys.value[selectedKeys.value.length - 1] ?? null : key;
  } else {
    selectedKeys.value = key ? [key] : [];
    selection.value = key;
  }
  if (key && panelTab.value === 'agent') panelTab.value = 'props';
}

const classesOf = (el: Element): string[] => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);

export async function commitGesture(keys: string[], gesture: Gesture, coalesceKey?: string): Promise<void> {
  const win = frameWin();
  if (!win) return;
  const ops = keys.flatMap((key) => {
    const el = elementByKey(key);
    if (!el) return [];
    const before = classesOf(el);
    const r = stageRect(el);
    const after = manipulationClasses(before, win.getComputedStyle(el).position,
      { x: r.left, y: r.top, width: r.width, height: r.height }, gesture);
    const refusal = manipulationRefusal(after);
    if (refusal) { banner.value = { kind: 'error', message: refusal }; return []; }
    return after.join(' ') === before.join(' ') ? [] : [{ kind: 'setClasses', id: key, classes: after }];
  });
  if (ops.length) await postOps(ops, { label: gesture.kind === 'move' ? 'Move selection' : 'Resize selection', ...(coalesceKey ? { coalesceKey } : {}) });
}

export async function duplicateSelection(): Promise<void> {
  const keys = [...selectedKeys.value];
  if (keys.length) await postOps(keys.map((id) => ({ kind: 'duplicate', id })), { label: 'Duplicate selection' });
}

export async function deleteSelection(): Promise<void> {
  const keys = selectedKeys.value.filter((key) => {
    const el = elementByKey(key);
    return el && !selectedKeys.value.some((other) => other !== key && elementByKey(other)?.contains(el));
  });
  if (!keys.length) return;
  await postOps(keys.map((id) => ({ kind: 'remove', id })), { label: 'Delete selection' });
  select(null);
}

export async function changeZOrder(delta: 1 | -1, extreme: boolean): Promise<void> {
  const el = elementByKey(selection.value);
  const parent = el?.parentElement;
  const parentKey = parent?.getAttribute('data-nm-key');
  if (!el || !parent || !parentKey) return;
  const siblings = Array.from(parent.children).filter((node) => node.hasAttribute('data-nm-key'));
  const current = siblings.indexOf(el);
  const index = extreme ? (delta > 0 ? siblings.length - 1 : 0) : Math.max(0, Math.min(siblings.length - 1, current + delta));
  if (index !== current) await postOps([{ kind: 'move', id: selection.value, parent: parentKey, index }], { label: 'Change z-order' });
}

export async function freePosition(): Promise<void> {
  const key = selection.value;
  const el = elementByKey(key);
  const containingBlock = el && 'offsetParent' in el ? (el as HTMLElement).offsetParent : null;
  if (!key || !el || !containingBlock) return;
  const r = stageRect(el);
  const p = stageRect(containingBlock);
  const classes = freePositionClasses(classesOf(el), { x: r.left, y: r.top, width: r.width, height: r.height },
    { x: p.left, y: p.top, width: p.width, height: p.height });
  await postOps([{ kind: 'setClasses', id: key, classes }], { label: 'Free position' });
}

// --- Phase 6 properties, layers, slides, and images --------------------------------------------------------------

export async function setFullProperty(key: string, property: FullProperty, value: string | number): Promise<void> {
  await postComputedOps(() => {
    const el = elementByKey(key);
    return el ? [{ kind: 'setClasses', id: key, classes: propertyClasses(classesOf(el), property, value) }] : [];
  }, { label: `Set ${property}`, coalesceKey: `property:${key}:${property}` });
}

export async function setImagePresentation(key: string, change: ImageClassChange): Promise<void> {
  await postComputedOps(() => {
    const el = elementByKey(key);
    return el?.tagName.toLowerCase() === 'img'
      ? [{ kind: 'setClasses', id: key, classes: imageClasses(classesOf(el), change) }]
      : [];
  }, { label: 'Set image crop', coalesceKey: `image:${key}` });
}

export async function setLayerHidden(key: string, hidden: boolean): Promise<void> {
  const el = elementByKey(key);
  if (!el) return;
  const classes = classesOf(el).filter((name) => name !== 'hidden');
  if (hidden) classes.push('hidden');
  await postOps([{ kind: 'setClasses', id: key, classes }], { label: hidden ? 'Hide layer' : 'Show layer' });
}

export async function moveElement(key: string, delta: -1 | 1): Promise<void> {
  const el = elementByKey(key);
  const parent = el?.parentElement;
  const parentKey = parent?.getAttribute('data-nm-key');
  if (!el || !parent || !parentKey) return;
  const siblings = Array.from(parent.children).filter((node) => node.hasAttribute('data-nm-key'));
  const at = siblings.indexOf(el);
  const index = Math.max(0, Math.min(siblings.length - 1, at + delta));
  if (index !== at) await postOps([{ kind: 'move', id: key, parent: parentKey, index }], { label: 'Reorder layer' });
}

export async function addSlideFromPreset(id: string): Promise<void> {
  const slide = elementByKey(info.value?.slides[currentSlide.value]?.key ?? null);
  const stage = slide?.parentElement;
  const parent = stage?.getAttribute('data-nm-key');
  if (!stage || !parent) return;
  const preset = await api.layoutPreset(id);
  const index = Array.from(stage.children).filter((node) => node.matches('section.slide') && node.hasAttribute('data-nm-key')).length;
  await postOps([{ kind: 'insertHtml', parent, index, html: preset.html }], { label: `Add slide: ${preset.name}` });
  await refreshState();
  goToSlide(Math.min(index, slideCount.value - 1));
}

export async function duplicateSlide(): Promise<void> {
  const slide = info.value?.slides[currentSlide.value];
  if (!slide) return;
  const target = currentSlide.value + 1;
  await postOps([{ kind: 'duplicate', id: slide.key }], { label: 'Duplicate slide' });
  await refreshState();
  goToSlide(Math.min(target, slideCount.value - 1));
}

export async function deleteSlide(): Promise<void> {
  const slide = info.value?.slides[currentSlide.value];
  if (!slide || slideCount.value <= 1) return;
  const target = Math.max(0, currentSlide.value - (currentSlide.value === slideCount.value - 1 ? 1 : 0));
  await postOps([{ kind: 'remove', id: slide.key }], { label: 'Delete slide' });
  await refreshState();
  goToSlide(target);
}

export async function moveSlide(delta: -1 | 1): Promise<void> {
  const slide = elementByKey(info.value?.slides[currentSlide.value]?.key ?? null);
  const parent = slide?.parentElement;
  const parentKey = parent?.getAttribute('data-nm-key');
  if (!slide || !parent || !parentKey) return;
  const slides = Array.from(parent.children).filter((node) => node.matches('section.slide') && node.hasAttribute('data-nm-key'));
  const at = slides.indexOf(slide);
  const index = Math.max(0, Math.min(slides.length - 1, at + delta));
  if (index === at) return;
  await postOps([{ kind: 'move', id: slide.getAttribute('data-nm-key'), parent: parentKey, index }], { label: 'Reorder slide' });
  await refreshState();
  goToSlide(index);
}

const fileBase64 = async (file: File): Promise<string> => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};

export async function uploadAndReplaceImage(key: string, file: File): Promise<void> {
  const el = elementByKey(key);
  if (!el || el.tagName.toLowerCase() !== 'img') return;
  const saved = await api.uploadImage({ name: file.name, type: file.type, data: await fileBase64(file) });
  await postOps([{ kind: 'setAttr', id: key, name: 'src', value: saved.path }], { label: 'Replace image' });
}

// --- zoom ---------------------------------------------------------------------------------------------------------

export const ZOOM_STEPS = [0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3];

export function nextZoom(current: number, dir: 1 | -1): number {
  if (dir > 0) return ZOOM_STEPS.find((z) => z > current + 0.001) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1];
  return [...ZOOM_STEPS].reverse().find((z) => z < current - 0.001) ?? ZOOM_STEPS[0];
}

export function zoomBy(dir: 1 | -1): void {
  const next = nextZoom(zoom.value, dir);
  // stepping across the fit zoom lands on fit, so the common "back to whole slide" is one keypress
  const fit = fitZoom.value;
  const crosses = (zoom.value < fit && next > fit) || (zoom.value > fit && next < fit);
  zoomMode.value = crosses ? 'fit' : next;
}

export const zoomFit = () => { zoomMode.value = 'fit'; };

// --- language and play --------------------------------------------------------------------------------------------

export function setLang(l: Lang): void {
  lang.value = l;
  const url = new URL(location.href);
  if (l === 'en') url.searchParams.set('lang', 'en');
  else url.searchParams.delete('lang');
  history.replaceState(null, '', url);
}

export function togglePlay(): void {
  const layer = editLayer();
  if (!layer) return;
  const on = !playing.value;
  playing.value = on;
  layer.freeze(!on);
  if (!on) showSlide(currentSlide.value); // the deck may have moved itself while playing
}
