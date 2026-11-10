// The preview document and its patches. The deck text is instrumented by inserting data-nm-key into the start tag
// of every patchable element under <body> (a text splice, never a serialisation), with the edit layer first in <head>.
import type { RefDiff, RefMap, NodeKey } from '../engine/refs.ts';
import { applySplices, classList, type SourceDoc, type SourceNode, type Splice } from '../engine/index.ts';

export type PreviewPatch = 'reload' | { key: NodeKey; outerHTML: string; attrsOnly: boolean }[];

function bodyOf(doc: SourceDoc): SourceNode | undefined {
  return doc.nodes.find((n) => n.tag === 'body' && n.start >= 0) ?? doc.nodes.find((n) => n.tag === 'body');
}

function inBody(doc: SourceDoc, n: SourceNode, bodyId: number | undefined): boolean {
  if (bodyId === undefined) return false;
  for (let p: number | null = n.id; p !== null; p = doc.nodes[p].parent) if (p === bodyId) return true;
  return false;
}

/** Splices (in doc.text coordinates) that add data-nm-key to the start tag of each patchable body element in [from, to). */
function keySplices(doc: SourceDoc, refs: RefMap, from: number, to: number): Splice[] {
  const bodyId = bodyOf(doc)?.id;
  const out: Splice[] = [];
  for (const n of doc.nodes) {
    if (!n.patchable || n.start < from || n.start >= to || !inBody(doc, n, bodyId)) continue;
    const at = n.start + 1 + n.tag.length;
    out.push({ start: at, end: at, text: ` data-nm-key="${refs.keyOf(n.id)}"` });
  }
  return out;
}

/** The first position inside <head> (or after <html>, or after the doctype) where the injected block can go. */
function headInsertion(doc: SourceDoc): number {
  const head = doc.nodes.find((n) => n.tag === 'head' && n.start >= 0);
  if (head) return head.startTagEnd;
  const html = doc.nodes.find((n) => n.tag === 'html' && n.start >= 0);
  if (html) return html.startTagEnd;
  const m = /^﻿?\s*<!doctype[^>]*>/i.exec(doc.text);
  return m ? m[0].length : doc.bom ? 1 : 0;
}

export interface EditLayer { css: string; js: string }

/** The full preview HTML for one document version. `<base href="/deck/">` makes relative assets resolve under /deck/. */
export function buildPreview(doc: SourceDoc, refs: RefMap, layer: EditLayer, version: number): string {
  const at = headInsertion(doc);
  const body = bodyOf(doc);
  const firstBodyChild = body && body.children.length ? doc.byId(body.children[0]).start : Infinity;
  if (firstBodyChild >= 0 && at > firstBodyChild) throw new Error('head insertion point is after body content');
  // Never let a literal "</script" in the layer close its own tag.
  const js = layer.js.replace(/<\/script/gi, '<\\/script');
  const css = layer.css.replace(/<\/style/gi, '<\\/style');
  const inject =
    `<style id="nm-edit-mode-css">${css}</style>` +
    `<script id="nm-edit-mode-js">${js}</script>` +
    '<meta name="nm-runtime" content="1" data-nm-injected>' +
    `<meta name="nm-version" content="${version}">` +
    '<base href="/deck/">';
  const splices = keySplices(doc, refs, 0, Infinity);
  splices.push({ start: at, end: at, text: inject });
  return applySplices(doc.text, splices);
}

/** Instrumented outerHTML of one element. */
export function outerHtml(doc: SourceDoc, refs: RefMap, id: number): string {
  const n = doc.byId(id);
  const splices = keySplices(doc, refs, n.start, n.end).map((s) => ({ ...s, start: s.start - n.start, end: s.end - n.start }));
  return applySplices(doc.text.slice(n.start, n.end), splices);
}

const RELOAD_IF_INSIDE = new Set(['iframe', 'script', 'video', 'audio', 'object', 'embed']);

function subtreeHas(doc: SourceDoc, id: number, tags: Set<string>): boolean {
  const stack = [id];
  while (stack.length) {
    const n = doc.nodes[stack.pop() as number];
    if (tags.has(n.tag)) return true;
    stack.push(...n.children);
  }
  return false;
}

function hasAncestorIn(doc: SourceDoc, id: number, set: Set<number>): boolean {
  for (let p = doc.nodes[id].parent; p !== null; p = doc.nodes[p].parent) if (set.has(p)) return true;
  return false;
}

/**
 * What the browser does to bring the live preview in step with a change. Attribute and text changes of existing
 * elements patch in place; anything structural, anything touching the head, scripts, slides, or a subtree with
 * frames, reloads (replacing those would restart their state or drop what the edit layer keeps on slides).
 */
export function previewPatch(doc: SourceDoc, refs: RefMap, diff: RefDiff, structuralTextKeys: readonly NodeKey[] = []): PreviewPatch {
  // A setText can legitimately add/remove <br> nodes. That is structural to the parser, but replacing the stable
  // text target is still the exact in-place preview operation. Other structural edits retain the reload contract.
  if (diff.structural && structuralTextKeys.length === 0) return 'reload';
  const bodyId = bodyOf(doc)?.id;
  const items: { id: number; key: NodeKey; attrsOnly: boolean }[] = [];
  const changes = diff.structural
    ? [[structuralTextKeys, false] as const]
    : [[diff.content, false] as const, [diff.attrs, true] as const];
  for (const [keys, attrsOnly] of changes) {
    for (const key of keys) {
      const id = refs.idOf(key);
      if (id === null) return 'reload';
      const n = doc.nodes[id];
      if (!n.patchable || n.tag === 'html' || n.tag === 'head' || !inBody(doc, n, bodyId)) return 'reload';
      if (!attrsOnly) {
        if (n.tag === 'body' || classList(n).includes('slide') || subtreeHas(doc, id, RELOAD_IF_INSIDE)) return 'reload';
      }
      items.push({ id, key, attrsOnly });
    }
  }
  if (items.length === 0) return 'reload';
  const unique = [...new Map(items.map((i) => [i.key, i])).values()];
  const replaced = new Set(unique.filter((i) => !i.attrsOnly).map((i) => i.id));
  return unique
    .filter((i) => !hasAncestorIn(doc, i.id, replaced))
    .sort((a, b) => a.id - b.id)
    .map((i) => ({ key: i.key, outerHTML: outerHtml(doc, refs, i.id), attrsOnly: i.attrsOnly }));
}
