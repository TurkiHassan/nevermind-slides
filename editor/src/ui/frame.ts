// The main preview iframe. The UI reaches deck DOM only through this module: the edit layer API (__nm) for
// navigation, hit tests and patches, and read-only queries (element boxes and computed style) for overlays and the
// panel. Nothing here writes into the deck document except through __nm.
import { previewUrl } from './api.ts';
import { bumpLayout, currentSlide, liveTitles } from './state.ts';
import type { EditLayer, NodeKey } from './types.ts';

let frameEl: HTMLIFrameElement | null = null;
let loading: Promise<void> | null = null;

export function attachFrame(el: HTMLIFrameElement | null): void { frameEl = el; }
export const frame = () => frameEl;

export function editLayer(): EditLayer | null {
  try {
    return ((frameEl?.contentWindow as (Window & { __nm?: EditLayer }) | null)?.__nm) ?? null;
  } catch {
    return null;
  }
}

export const frameDoc = (): Document | null => (editLayer() ? frameEl?.contentDocument ?? null : null);
export const frameWin = (): Window | null => (editLayer() ? frameEl?.contentWindow ?? null : null);

const keySelector = (key: NodeKey) => `[data-nm-key="${key.replace(/[^a-z0-9]/gi, '')}"]`;
export const elementByKey = (key: NodeKey | null): Element | null => (key ? frameDoc()?.querySelector(keySelector(key)) ?? null : null);

export function currentSlideEl(): Element | null {
  return frameDoc()?.querySelector('.slide[data-nm-current]') ?? null;
}

/** Box of an element in stage pixels (the iframe viewport is the 1920x1080 stage). */
export function stageRect(el: Element): DOMRect {
  return el.getBoundingClientRect();
}

/** Move the preview to slide i (clamped by the caller). */
export function showSlide(i: number): void {
  editLayer()?.goTo(i);
  bumpLayout();
}

/** Titles for slides the deck adapter left untitled: the first heading or text block in the live slide. */
function harvestTitles(): void {
  const doc = frameDoc();
  if (!doc) return;
  const found: Record<number, string> = {};
  doc.querySelectorAll('.slide').forEach((s, i) => {
    const h = s.querySelector('h1, h2, h3, [class*="font-display"]');
    const text = (h?.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (text) found[i] = text.slice(0, 80);
  });
  liveTitles.value = found;
}

/**
 * Load (or reload) the preview. Resolves with the version the served preview carries (<meta name="nm-version">),
 * after restoring the current slide. Concurrent calls share one load.
 */
export function loadPreview(): Promise<number> {
  const el = frameEl;
  if (!el) return Promise.reject(new Error('preview frame not mounted'));
  const run = new Promise<number>((resolve) => {
    const onload = () => {
      el.removeEventListener('load', onload);
      const doc = el.contentDocument;
      const meta = doc?.querySelector('meta[name="nm-version"]');
      showSlide(currentSlide.value);
      harvestTitles();
      doc?.fonts?.ready.then(bumpLayout, () => {});
      resolve(meta ? Number(meta.getAttribute('content')) : 0);
    };
    el.addEventListener('load', onload);
    el.src = previewUrl();
  });
  loading = run.then(() => undefined);
  return run;
}

export const previewLoading = () => loading;
