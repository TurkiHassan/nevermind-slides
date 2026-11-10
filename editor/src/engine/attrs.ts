// Attribute-level splices on a SourceDoc.
import { OpError } from './errors.ts';
import { escapeAttr, UNQUOTED_SAFE } from './html-text.ts';
import { findAttr, type SourceAttr, type SourceDoc, type SourceNode } from './source.ts';
import type { Splice } from './splice.ts';

export function requireNode(doc: SourceDoc, id: number): SourceNode {
  if (!Number.isInteger(id) || id < 0 || id >= doc.nodes.length) {
    throw new OpError('not-found', `no node with id ${id} (document has ${doc.nodes.length} nodes)`);
  }
  return doc.nodes[id];
}

export function requirePatchable(doc: SourceDoc, id: number): SourceNode {
  const n = requireNode(doc, id);
  if (!n.patchable) throw new OpError('unpatchable', `node ${id} <${n.tag}> is not patchable (its source is not where the DOM puts it)`);
  return n;
}

/** Raw value range of an attribute: [vStart, vEnd) excludes quotes. Null for a bare attribute (no '='). */
export function attrValueRange(text: string, a: SourceAttr): { vStart: number; vEnd: number } | null {
  const m = /^[^\s=]+\s*=\s*(["']?)/.exec(text.slice(a.start, a.end));
  if (!m) return null;
  const vStart = a.start + m[0].length;
  return { vStart, vEnd: a.quote ? a.end - 1 : a.end };
}

/** True when the raw attribute value is byte-identical to its decoded value, so offsets map one to one. */
export function rawEqualsDecoded(text: string, a: SourceAttr): boolean {
  const r = attrValueRange(text, a);
  return r !== null && text.slice(r.vStart, r.vEnd) === a.value;
}

function isSelfClosing(text: string, n: SourceNode): boolean {
  return text.slice(n.startTagEnd - 2, n.startTagEnd) === '/>' && !Object.values(n.attrs).some((x) => x.end > n.startTagEnd - 2);
}

/** Set, add or remove one attribute. Keeps the quote style; a new attribute is added as ` name="value"` before `>`/`/>`. */
export function setAttrSplices(doc: SourceDoc, n: SourceNode, name: string, value: string | null): Splice[] {
  const text = doc.text;
  const a = findAttr(n, name);
  if (value === null) {
    if (!a) return [];
    let s = a.start;
    while (s > n.start && /\s/.test(text[s - 1])) s--;
    return [{ start: s, end: a.end, text: '' }];
  }
  if (!/^[^\s"'>/=\0]+$/.test(name)) throw new OpError('invalid', `invalid attribute name ${JSON.stringify(name)}`);
  if (!a) {
    const at = isSelfClosing(text, n) ? n.startTagEnd - 2 : n.startTagEnd - 1;
    return [{ start: at, end: at, text: ` ${name}="${escapeAttr(value, '"')}"` }];
  }
  // Unchanged decoded value: leave the bytes alone (they may spell it with references). A bare attribute is ''.
  if (a.value === value) return [];
  const raw = text.slice(a.start, a.end);
  const m = /^([^\s=]+\s*=\s*)(["']?)/.exec(raw);
  if (!m) return [{ start: a.start, end: a.end, text: `${raw}="${escapeAttr(value, '"')}"` }];
  const head = m[1];
  const q = m[2] as '"' | "'" | '';
  let out: string;
  if (q) out = head + q + escapeAttr(value, q) + q;
  else if (UNQUOTED_SAFE.test(value)) out = head + value.replace(/&(?=[#A-Za-z0-9])/g, '&amp;');
  else out = head + '"' + escapeAttr(value, '"') + '"';
  return out === raw ? [] : [{ start: a.start, end: a.end, text: out }];
}
