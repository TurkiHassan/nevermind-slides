// What kind of deck this is and what it contains (slides, tokens, fonts, motion attributes), plus deck lint.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseToken, type TokenContext } from './class-algebra.ts';
import { classList, findAttr, isWithin, RAW_TEXT_TAGS, type SourceDoc, type SourceNode } from './source.ts';
import { visibleText } from './text-diff.ts';
import { flattenColors, readTokens } from './tokens.ts';

export interface DeckInfo {
  kind: 'nevermind' | 'frontend-slides' | 'generic';
  slides: { id: number; index: number; title: string | null }[];
  tokens: TokenContext;
  fonts: { family: string; weights: number[]; src: string[] }[];
  morph: Record<string, number[]>;
  zoomSteps: { slideId: number; id: number; step: number; label: string | null }[];
  entrances: { slideId: number; id: number; kind: string; order: number; delay: number; legacy: boolean }[];
  anatomy: { slideId: number; id: number; kind: 'svg' | 'iframe'; name: string; variables: Record<string, string> }[];
  identity: { colours: Record<string, unknown>; fonts: Record<string, unknown> };
  runtime: { version: number | null; native: boolean };
  tailwind: 'local' | 'cdn' | 'none';
  legacyEditor: boolean;
}

export interface LintIssue { code: string; severity: 'error' | 'warn'; nodeId: number | null; message: string }

const isSlide = (n: SourceNode) => n.tag === 'section' && classList(n).includes('slide');
const isStage = (n: SourceNode) => classList(n).includes('deck-stage') || findAttr(n, 'id')?.value === 'slides-stage';

function styleSheets(doc: SourceDoc): { node: SourceNode; css: string }[] {
  return doc.nodes
    .filter((n) => n.tag === 'style' && n.endTagStart !== null)
    .map((node) => ({ node, css: doc.text.slice(node.startTagEnd, node.endTagStart as number) }));
}

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const unquote = (s: string) => s.trim().replace(/^(['"])(.*)\1$/, '$2');

function parseWeights(v: string | undefined): number[] {
  if (!v) return [400];
  const words = v.trim().split(/\s+/).map((w) => (w === 'normal' ? 400 : w === 'bold' ? 700 : Number(w)));
  if (words.some((w) => !Number.isFinite(w))) return [400];
  if (words.length === 2) {
    const out: number[] = [];
    for (let w = Math.ceil(words[0] / 100) * 100; w <= words[1]; w += 100) out.push(w);
    return out;
  }
  return [words[0]];
}

function fontFaces(doc: SourceDoc): DeckInfo['fonts'] {
  const byFamily = new Map<string, { weights: Set<number>; src: string[] }>();
  for (const { css } of styleSheets(doc)) {
    for (const m of stripComments(css).matchAll(/@font-face\s*\{([^}]*)\}/g)) {
      const body = m[1];
      const fam = /font-family\s*:\s*([^;]+)/.exec(body);
      if (!fam) continue;
      const family = unquote(fam[1]);
      const weights = parseWeights(/font-weight\s*:\s*([^;]+)/.exec(body)?.[1]);
      const src = [...(/(?:^|;)\s*src\s*:\s*([^;]+)/.exec(body)?.[1] ?? '').matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/g)].map((u) => u[2]);
      const entry = byFamily.get(family) ?? byFamily.set(family, { weights: new Set(), src: [] }).get(family)!;
      weights.forEach((w) => entry.weights.add(w));
      for (const s of src) if (!entry.src.includes(s)) entry.src.push(s);
    }
  }
  return [...byFamily].map(([family, e]) => ({ family, weights: [...e.weights].sort((a, b) => a - b), src: e.src }));
}

function slideOf(doc: SourceDoc, id: number, slides: number[]): number {
  return slides.find((s) => isWithin(doc, id, s)) ?? -1;
}

function inlineVariables(value: string): Record<string, string> {
  const variables: Record<string, string> = {};
  for (const declaration of value.split(';')) {
    const colon = declaration.indexOf(':');
    if (colon < 0) continue;
    const name = declaration.slice(0, colon).trim();
    const variable = declaration.slice(colon + 1).trim();
    if (/^--anatomy-[\w-]+$/i.test(name) && variable) variables[name] = variable;
  }
  return variables;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function inspectDeck(doc: SourceDoc): DeckInfo {
  const slideNodes = doc.nodes.filter(isSlide);
  const slideIds = slideNodes.map((n) => n.id);
  const fonts = fontFaces(doc);
  const morph: Record<string, number[]> = {};
  const zoomSteps: DeckInfo['zoomSteps'] = [];
  const entrances: DeckInfo['entrances'] = [];
  const anatomy: DeckInfo['anatomy'] = [];
  for (const n of doc.nodes) {
    const m = findAttr(n, 'data-morph');
    if (m && m.value) (morph[m.value] ??= []).push(n.id);
    const z = findAttr(n, 'data-zoom-step');
    if (z) {
      zoomSteps.push({ slideId: slideOf(doc, n.id, slideIds), id: n.id, step: Number(z.value), label: findAttr(n, 'data-zoom-label')?.value ?? null });
    }
    const entrance = findAttr(n, 'data-entrance');
    const legacyDelay = classList(n).map((name) => /^d(\d+)$/.exec(name)).find(Boolean);
    if (entrance?.value || classList(n).includes('reveal')) {
      entrances.push({
        slideId: slideOf(doc, n.id, slideIds), id: n.id,
        kind: entrance?.value || 'reveal',
        order: Number(findAttr(n, 'data-entrance-order')?.value ?? legacyDelay?.[1] ?? 1),
        delay: Number(findAttr(n, 'data-entrance-delay')?.value ?? 0),
        legacy: !entrance,
      });
    }
    if (n.tag === 'svg' || n.tag === 'iframe') {
      const anatomyName = findAttr(n, 'data-anatomy')?.value;
      const src = findAttr(n, 'src')?.value ?? '';
      const marked = anatomyName !== undefined || classList(n).some((name) => /(?:^|-)anatomy(?:-|$)/i.test(name)) || /(?:^|\/)anatomy(?:\/|-)/i.test(src);
      const variables = inlineVariables(findAttr(n, 'style')?.value ?? '');
      if (marked || Object.keys(variables).length) anatomy.push({
        slideId: slideOf(doc, n.id, slideIds), id: n.id, kind: n.tag,
        name: anatomyName || src.split('/').pop()?.split(/[?#]/)[0] || n.tag,
        variables,
      });
    }
  }
  const tokenValues = readTokens(doc).values;
  const theme = objectValue(tokenValues.theme);
  const extend = objectValue(theme.extend);
  const colours = Object.fromEntries([...flattenColors(theme.colors), ...flattenColors(extend.colors)]);
  const identityFonts = { ...objectValue(theme.fontFamily), ...objectValue(extend.fontFamily) };
  const runtimeMeta = doc.nodes.find((n) => n.tag === 'meta' && findAttr(n, 'name')?.value === 'nm-runtime');
  const runtimeVersion = runtimeMeta ? Number(findAttr(runtimeMeta, 'content')?.value) : null;
  const scripts = doc.nodes.filter((n) => n.tag === 'script' && /tailwind/i.test(findAttr(n, 'src')?.value ?? ''));
  const tailwind = scripts.some((n) => /^(https?:)?\/\//i.test(findAttr(n, 'src')!.value)) ? 'cdn' : scripts.length ? 'local' : 'none';
  const markers = Object.keys(morph).length > 0 || zoomSteps.length > 0 ||
    doc.nodes.some((n) => classList(n).includes('camera-rig') || findAttr(n, 'data-slide') !== undefined) ||
    fonts.some((f) => /thmanyah|komission/i.test(f.family));
  const kind = slideNodes.length === 0 ? 'generic' : markers ? 'nevermind' : 'frontend-slides';
  const titleOf = (s: SourceNode): string | null => {
    const h = doc.nodes.find((n) => /^h[1-3]$/.test(n.tag) && isWithin(doc, n.id, s.id));
    if (!h) return null;
    try {
      return visibleText(doc, h.id).replace(/\n/g, ' ') || null;
    } catch {
      return null;
    }
  };
  return {
    kind,
    slides: slideNodes.map((s, index) => ({ id: s.id, index, title: titleOf(s) })),
    tokens: readTokens(doc).ctx,
    fonts,
    morph,
    zoomSteps,
    entrances,
    anatomy,
    identity: { colours, fonts: identityFonts },
    runtime: { version: runtimeVersion !== null && Number.isFinite(runtimeVersion) ? runtimeVersion : null, native: runtimeMeta !== undefined },
    tailwind,
    legacyEditor: doc.nodes.some((n) => findAttr(n, 'data-edit') !== undefined),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Lint

const EMOJI = /[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
const ARABIC_LETTER = /[ء-يٱ-ۓۺ-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const ARABIC_DIGIT = /[٠-٩۰-۹]/;
const WESTERN_DIGIT = /[0-9]/;
const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;
const ALPHA_COLOR = /^(text|bg|border(?:-[trblxyse])?|ring|ring-offset|fill|stroke|from|via|to|outline|decoration|divide|placeholder|caret|accent|shadow)-(.+)\/(\d+|\[[^\]]+\])$/;

function hiddenText(doc: SourceDoc, id: number): boolean {
  for (let p: number | null = id; p !== null; p = doc.nodes[p].parent) {
    const t = doc.nodes[p].tag;
    if (RAW_TEXT_TAGS.has(t) || t === 'template') return true;
  }
  return false;
}

function assetRefs(doc: SourceDoc): { nodeId: number; ref: string }[] {
  const refs: { nodeId: number; ref: string }[] = [];
  const cssUrls = (css: string) => [...stripComments(css).matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/g)].map((m) => m[2]);
  for (const n of doc.nodes) {
    if (!n.patchable && n.start < 0) continue;
    const add = (ref: string | undefined) => { if (ref && ref.trim()) refs.push({ nodeId: n.id, ref: ref.trim() }); };
    if (['img', 'script', 'iframe', 'source', 'video', 'audio', 'embed', 'track', 'input'].includes(n.tag)) add(findAttr(n, 'src')?.value);
    if (n.tag === 'video') add(findAttr(n, 'poster')?.value);
    if (n.tag === 'link' && /\b(stylesheet|icon|preload|manifest)\b/i.test(findAttr(n, 'rel')?.value ?? '')) add(findAttr(n, 'href')?.value);
    if (n.ns === 'svg' && (n.tag === 'image' || n.tag === 'use')) {
      add(findAttr(n, 'href')?.value);
      add(findAttr(n, 'xlink:href')?.value);
    }
    const srcset = findAttr(n, 'srcset')?.value;
    if (srcset) for (const part of srcset.split(',')) add(part.trim().split(/\s+/)[0]);
    const style = findAttr(n, 'style')?.value;
    if (style) cssUrls(style).forEach(add);
    if (n.tag === 'style' && n.endTagStart !== null) cssUrls(doc.text.slice(n.startTagEnd, n.endTagStart)).forEach(add);
  }
  return refs.filter((r) => !EXTERNAL.test(r.ref));
}

function cssVariables(doc: SourceDoc): Map<string, string> {
  const vars = new Map<string, string>();
  for (const { css } of styleSheets(doc)) {
    for (const m of stripComments(css).matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)) if (!vars.has(m[1])) vars.set(m[1], m[2].trim());
  }
  return vars;
}

/** The first family name a Tailwind font-family token resolves to, following var(--x) through the deck's CSS. */
function familyOf(token: string, values: Record<string, unknown>, vars: Map<string, string>): string | null {
  const theme = (values.theme ?? {}) as Record<string, Record<string, unknown> | undefined>;
  const raw = (theme.extend?.fontFamily as Record<string, unknown> | undefined)?.[token] ?? (theme.fontFamily as Record<string, unknown> | undefined)?.[token];
  let v = Array.isArray(raw) ? raw.join(', ') : typeof raw === 'string' ? raw : null;
  for (let i = 0; v && i < 5; i++) {
    const m = /^\s*var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)\s*$/.exec(v);
    if (!m) break;
    v = vars.get(m[1]) ?? m[2] ?? null;
  }
  if (!v) return null;
  return unquote(v.split(',')[0]);
}

export function lintDeck(doc: SourceDoc, info: DeckInfo, deckDir: string): LintIssue[] {
  const issues: LintIssue[] = [];
  const ctx = info.tokens;
  const push = (code: string, severity: 'error' | 'warn', nodeId: number | null, message: string) => issues.push({ code, severity, nodeId, message });
  const body = doc.nodes.find((n) => n.tag === 'body');

  // emoji: in visible text
  if (body) {
    for (const s of doc.textSegments(body.id)) {
      if (hiddenText(doc, s.nodeId)) continue;
      const m = EMOJI.exec(s.decoded);
      if (m) push('emoji', 'error', s.nodeId, `emoji ${JSON.stringify(m[0])} in text of <${doc.nodes[s.nodeId].tag}> (node ${s.nodeId})`);
    }
  }

  // missing-asset
  const seen = new Set<string>();
  for (const r of assetRefs(doc)) {
    const clean = r.ref.replace(/[?#].*$/, '');
    let rel = clean;
    try { rel = decodeURIComponent(clean); } catch { /* keep raw */ }
    const key = `${r.nodeId}:${rel}`;
    if (seen.has(key) || rel === '') continue;
    seen.add(key);
    if (!existsSync(resolve(deckDir, rel))) push('missing-asset', 'error', r.nodeId, `asset not found: ${r.ref}`);
  }

  // slide-relative, no-stage
  for (const s of info.slides) {
    const n = doc.nodes[s.id];
    if (classList(n).includes('relative')) {
      push('slide-relative', 'error', s.id, `slide ${s.index + 1} has class "relative"; slides must stay absolutely positioned on the stage`);
    }
  }
  if (info.slides.length && !doc.nodes.some(isStage)) push('no-stage', 'error', null, 'slides exist but there is no 1920x1080 stage (.deck-stage or #slides-stage)');

  // alpha-on-var-color
  const values = readTokens(doc).values;
  const theme = (values.theme ?? {}) as Record<string, Record<string, unknown> | undefined>;
  const colorValues = new Map([...flattenColors(theme.colors), ...flattenColors(theme.extend?.colors)]);
  for (const n of doc.nodes) {
    for (const c of classList(n)) {
      const base = c.split(':').pop()!.replace(/^!|!$/g, '').replace(/^-/, '');
      const m = ALPHA_COLOR.exec(base);
      if (!m) continue;
      const v = colorValues.get(m[2]);
      if (typeof v === 'string' && /^\s*var\(/.test(v) && !v.includes('<alpha-value>')) {
        push('alpha-on-var-color', 'warn', n.id, `${c}: colour "${m[2]}" is ${v}, so Tailwind cannot apply the /${m[3]} opacity and emits no rule`);
      }
    }
  }

  // letter-spacing-arabic
  for (const n of doc.nodes) {
    const tr = classList(n).map((c) => parseToken(c, ctx)).find((t) => t.group === 'tracking' && t.variants.length === 0 && t.value !== 'normal');
    if (!tr) continue;
    let text = '';
    try { text = visibleText(doc, n.id); } catch { continue; }
    if (ARABIC_LETTER.test(text)) push('letter-spacing-arabic', 'warn', n.id, `${tr.raw} on Arabic text breaks the joining of letters`);
  }

  // mixed-digits
  for (const s of info.slides) {
    let text = '';
    try { text = visibleText(doc, s.id); } catch { continue; }
    if (ARABIC_DIGIT.test(text) && WESTERN_DIGIT.test(text)) {
      push('mixed-digits', 'warn', s.id, `slide ${s.index + 1} mixes Arabic-Indic and Western digits`);
    }
  }

  // missing-font-weight
  const vars = cssVariables(doc);
  const faces = new Map(info.fonts.map((f) => [f.family.toLowerCase(), f]));
  for (const n of doc.nodes) {
    const w = classList(n).map((c) => parseToken(c, ctx)).find((t) => t.group === 'font-weight' && t.variants.length === 0);
    if (!w || !w.value) continue;
    const weight = { thin: 100, extralight: 200, light: 300, normal: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800, black: 900 }[w.value]
      ?? Number(w.value.replace(/^\[|\]$/g, ''));
    let family: string | null = null;
    for (let p: number | null = n.id; p !== null && family === null; p = doc.nodes[p].parent) {
      const f = classList(doc.nodes[p]).map((c) => parseToken(c, ctx)).find((t) => t.group === 'font-family' && t.variants.length === 0);
      if (f && f.value) family = f.value.startsWith('[') ? unquote(f.value.slice(1, -1).replace(/_/g, ' ')) : familyOf(f.value, values, vars);
    }
    const face = family ? faces.get(family.toLowerCase()) : undefined;
    if (face && Number.isFinite(weight) && !face.weights.includes(weight)) {
      push('missing-font-weight', 'warn', n.id, `${w.raw} asks for weight ${weight} of "${face.family}", which only has ${face.weights.join(', ')}`);
    }
  }

  if (info.tailwind === 'cdn') {
    const s = doc.nodes.find((n) => n.tag === 'script' && /tailwind/i.test(findAttr(n, 'src')?.value ?? ''));
    push('tailwind-cdn', 'warn', s?.id ?? null, 'Tailwind is loaded from the CDN; the deck needs a network connection to render');
  }
  return issues;
}
