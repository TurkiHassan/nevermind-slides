// The operation union and its resolution to splices against one SourceDoc.
import { attrValueRange, rawEqualsDecoded, requirePatchable, setAttrSplices } from './attrs.ts';
import { setClassAttr, setUtility, GROUPS, type Group, type TokenContext } from './class-algebra.ts';
import { OpError } from './errors.ts';
import { escapeAttr, UNQUOTED_SAFE } from './html-text.ts';
import { duplicateSplices, insertHtmlSplices, moveSplices, removeSplices, wrapSplices } from './ops-structure.ts';
import { classList, findAttr, type SourceDoc } from './source.ts';
import type { Splice } from './splice.ts';
import { setText } from './text-diff.ts';
import { setTokenSplices } from './tokens.ts';

export { OpError } from './errors.ts';
export type { OpErrorCode } from './errors.ts';
export { readTokens, setTokenSplices } from './tokens.ts';

export type Op =
  | { kind: 'setText'; id: number; text: string }
  | { kind: 'setAttr'; id: number; name: string; value: string | null }
  | { kind: 'setUtility'; id: number; group: Group; value: string | null }
  | { kind: 'setClasses'; id: number; classes: string[] }
  | { kind: 'setStyle'; id: number; prop: string; value: string | null }
  | { kind: 'insertHtml'; parent: number; index: number; html: string }
  | { kind: 'remove'; id: number }
  | { kind: 'move'; id: number; parent: number; index: number }
  | { kind: 'duplicate'; id: number } // inserts the copy right after the original
  | { kind: 'wrap'; ids: number[]; html: string } // html is one empty element; ids must be contiguous siblings
  | { kind: 'setToken'; path: string[]; value: string | null }; // path inside tailwind.config.theme.extend

export const OP_KINDS = ['setText', 'setAttr', 'setUtility', 'setClasses', 'setStyle', 'insertHtml', 'remove', 'move',
  'duplicate', 'wrap', 'setToken'] as const;

interface Decl { start: number; end: number /* incl. ';' */; prop: string; vStart: number; vEnd: number }

/** Split a style value into declarations, honouring parentheses and quotes. Offsets are into `v`. */
function declarations(v: string): Decl[] {
  const out: Decl[] = [];
  let depth = 0;
  let quote = '';
  let start = 0;
  const flush = (end: number, withSemi: number) => {
    const piece = v.slice(start, end);
    const colon = piece.indexOf(':');
    if (colon > 0) {
      const prop = piece.slice(0, colon).trim();
      let vs = start + colon + 1;
      while (vs < end && /\s/.test(v[vs])) vs++;
      let ve = end;
      while (ve > vs && /\s/.test(v[ve - 1])) ve--;
      out.push({ start, end: end + withSemi, prop, vStart: vs, vEnd: ve });
    }
    start = end + withSemi;
  };
  for (let i = 0; i < v.length; i++) {
    const c = v[i];
    if (quote) { if (c === quote && v[i - 1] !== '\\') quote = ''; continue; }
    if (c === '"' || c === "'") quote = c;
    else if (c === '(') depth++;
    else if (c === ')' && depth > 0) depth--;
    else if (c === ';' && depth === 0) flush(i, 1);
  }
  if (start < v.length) flush(v.length, 0);
  return out;
}

const sameProp = (a: string, b: string) => (a.startsWith('--') || b.startsWith('--') ? a === b : a.toLowerCase() === b.toLowerCase());

/** Edit one declaration of the style attribute, keeping the others byte for byte. Returns the new value and splices. */
function setStyleSplices(doc: SourceDoc, id: number, prop: string, value: string | null): Splice[] {
  const n = requirePatchable(doc, id);
  if (!/^(--[\w-]+|-?[A-Za-z][\w-]*)$/.test(prop)) throw new OpError('invalid', `invalid CSS property name ${JSON.stringify(prop)}`);
  if (value !== null && (/[\r\n]/.test(value) || value.trim() === '')) throw new OpError('invalid', `invalid CSS value ${JSON.stringify(value)}`);
  const a = findAttr(n, 'style');
  if (!a) return value === null ? [] : setAttrSplices(doc, n, 'style', `${prop}: ${value.trim()}`);
  const v = a.value;
  const decls = declarations(v);
  const found = [...decls].reverse().find((d) => sameProp(d.prop, prop));
  // Compute the new value as a local edit [s, e) -> t on the decoded value.
  let s: number;
  let e: number;
  let t: string;
  if (found) {
    if (value === null) {
      s = found.start;
      e = found.end;
      while (s > 0 && /\s/.test(v[s - 1])) s--;
      if (s === 0) while (e < v.length && /\s/.test(v[e])) e++;
      t = '';
    } else {
      s = found.vStart;
      e = found.vEnd;
      t = value.trim();
    }
  } else {
    if (value === null) return [];
    let end = v.length;
    while (end > 0 && /\s/.test(v[end - 1])) end--;
    s = e = end;
    t = end === 0 ? `${prop}: ${value.trim()}` : v[end - 1] === ';' ? ` ${prop}: ${value.trim()};` : `; ${prop}: ${value.trim()}`;
  }
  const next = v.slice(0, s) + t + v.slice(e);
  if (next.trim() === '') return setAttrSplices(doc, n, 'style', null);
  const range = attrValueRange(doc.text, a);
  if (!range || !rawEqualsDecoded(doc.text, a) || (a.quote === '' && !UNQUOTED_SAFE.test(next))) {
    return setAttrSplices(doc, n, 'style', next);
  }
  return [{ start: range.vStart + s, end: range.vStart + e, text: a.quote ? escapeAttr(t, a.quote) : t }];
}

const isId = (x: unknown): x is number => Number.isInteger(x) && (x as number) >= 0;
const isStr = (x: unknown): x is string => typeof x === 'string';
const isStrOrNull = (x: unknown): x is string | null => x === null || typeof x === 'string';

/** Check the shape of an op (it may come from JSON). Throws OpError('invalid') with the offending field. */
export function validateOp(op: unknown): asserts op is Op {
  const o = op as Record<string, unknown>;
  const bad = (field: string) => { throw new OpError('invalid', `op ${JSON.stringify(o?.kind)}: invalid or missing field '${field}'`); };
  if (typeof o !== 'object' || o === null) throw new OpError('invalid', 'op must be an object');
  switch (o.kind) {
    case 'setText': if (!isId(o.id)) bad('id'); if (!isStr(o.text)) bad('text'); return;
    case 'setAttr': if (!isId(o.id)) bad('id'); if (!isStr(o.name) || o.name === '') bad('name'); if (!isStrOrNull(o.value)) bad('value'); return;
    case 'setUtility': if (!isId(o.id)) bad('id'); if (!GROUPS.includes(o.group as Group)) bad('group'); if (!isStrOrNull(o.value)) bad('value'); return;
    case 'setClasses': if (!isId(o.id)) bad('id'); if (!Array.isArray(o.classes) || !o.classes.every(isStr)) bad('classes'); return;
    case 'setStyle': if (!isId(o.id)) bad('id'); if (!isStr(o.prop)) bad('prop'); if (!isStrOrNull(o.value)) bad('value'); return;
    case 'insertHtml': if (!isId(o.parent)) bad('parent'); if (!Number.isInteger(o.index)) bad('index'); if (!isStr(o.html)) bad('html'); return;
    case 'remove': case 'duplicate': if (!isId(o.id)) bad('id'); return;
    case 'move': if (!isId(o.id)) bad('id'); if (!isId(o.parent)) bad('parent'); if (!Number.isInteger(o.index)) bad('index'); return;
    case 'wrap': if (!Array.isArray(o.ids) || !o.ids.every(isId)) bad('ids'); if (!isStr(o.html)) bad('html'); return;
    case 'setToken': if (!Array.isArray(o.path) || !o.path.every(isStr)) bad('path'); if (!isStrOrNull(o.value)) bad('value'); return;
    default: throw new OpError('invalid', `unknown op kind ${JSON.stringify(o.kind)}; expected one of ${OP_KINDS.join(', ')}`);
  }
}

/** Shrink a lone splice to the characters that actually change (e.g. `top-[132px]` -> `top-[148px]` becomes `132` -> `148`). */
function minimal(text: string, splices: Splice[]): Splice[] {
  if (splices.length !== 1) return splices;
  const s = splices[0];
  const old = text.slice(s.start, s.end);
  if (old === s.text) return [];
  let p = 0;
  while (p < old.length && p < s.text.length && old[p] === s.text[p]) p++;
  let q = 0;
  while (q < old.length - p && q < s.text.length - p && old[old.length - 1 - q] === s.text[s.text.length - 1 - q]) q++;
  if (p === 0 && q === 0) return splices;
  return [{ start: s.start + p, end: s.end - q, text: s.text.slice(p, s.text.length - q) }];
}

export function resolveOp(doc: SourceDoc, op: Op, ctx: TokenContext): Splice[] {
  validateOp(op);
  return minimal(doc.text, resolveRaw(doc, op, ctx));
}

function resolveRaw(doc: SourceDoc, op: Op, ctx: TokenContext): Splice[] {
  switch (op.kind) {
    case 'setText':
      return setText(doc, op.id, op.text);
    case 'setAttr':
      return setAttrSplices(doc, requirePatchable(doc, op.id), op.name, op.value);
    case 'setUtility': {
      const n = requirePatchable(doc, op.id);
      return setClassAttr(doc, op.id, setUtility(classList(n), op.group, op.value, ctx));
    }
    case 'setClasses':
      return setClassAttr(doc, op.id, op.classes);
    case 'setStyle':
      return setStyleSplices(doc, op.id, op.prop, op.value);
    case 'insertHtml':
      return insertHtmlSplices(doc, op.parent, op.index, op.html);
    case 'remove':
      return removeSplices(doc, op.id);
    case 'move':
      return moveSplices(doc, op.id, op.parent, op.index);
    case 'duplicate':
      return duplicateSplices(doc, op.id);
    case 'wrap':
      return wrapSplices(doc, op.ids, op.html);
    case 'setToken':
      return setTokenSplices(doc, op.path, op.value);
  }
}
