// Structural operations: insert, remove, move, duplicate (with id renaming) and wrap. Each resolves to splices
// on the current text; indentation follows the new siblings so the diff reads like a hand edit.
import { requirePatchable, setAttrSplices } from './attrs.ts';
import { OpError } from './errors.ts';
import { findAttr, isWithin, lineBreak, lineIndent, type SourceDoc, type SourceNode } from './source.ts';
import { applySplices, checkSplices, type Splice } from './splice.ts';

const ROOT_TAGS = new Set(['html', 'head', 'body']);
const PREFORMATTED = /<(pre|textarea|script|style)\b|whitespace-pre/i;

function requireMovable(doc: SourceDoc, id: number): SourceNode {
  const n = requirePatchable(doc, id);
  if (ROOT_TAGS.has(n.tag)) throw new OpError('invalid', `<${n.tag}> cannot be removed, moved, duplicated or wrapped`);
  return n;
}

function requireContainer(doc: SourceDoc, id: number): SourceNode {
  const p = requirePatchable(doc, id);
  if (p.endTagStart === null) throw new OpError('invalid', `node ${id} <${p.tag}> cannot have children`);
  return p;
}

/** Re-indent every line after the first: a line starting with `from` gets `to` instead. Preformatted text is left as is. */
function reindent(fragment: string, from: string | null, to: string | null): string {
  if (from === null || to === null || from === to || PREFORMATTED.test(fragment)) return fragment;
  const lines = fragment.split('\n');
  return lines
    .map((line, i) => {
      if (i === 0 || /^[ \t]*\r?$/.test(line)) return line;
      return line.startsWith(from) ? to + line.slice(from.length) : line;
    })
    .join('\n');
}

/**
 * The splice that inserts `fragment` as element child number `index` of `parent` (indices count element children,
 * excluding `exclude`). `fragmentIndent` is the indentation the fragment's later lines are written against.
 */
function insertAt(doc: SourceDoc, parent: SourceNode, index: number, fragment: string, fragmentIndent: string | null, exclude?: number): Splice {
  const text = doc.text;
  const nl = lineBreak(text);
  const siblings = parent.children.filter((c) => c !== exclude && doc.nodes[c].start >= 0).map((c) => doc.nodes[c]);
  if (!Number.isInteger(index) || index < 0 || index > siblings.length) {
    throw new OpError('invalid', `index ${index} is out of range for <${parent.tag}> (node ${parent.id}) with ${siblings.length} element children`);
  }
  if (index < siblings.length) {
    const sib = siblings[index];
    const ind = lineIndent(text, sib.start);
    if (ind === null) return { start: sib.start, end: sib.start, text: fragment };
    return { start: sib.start, end: sib.start, text: reindent(fragment, fragmentIndent, ind) + nl + ind };
  }
  if (siblings.length) {
    const last = siblings[siblings.length - 1];
    const ind = lineIndent(text, last.start);
    if (ind === null) return { start: last.end, end: last.end, text: fragment };
    return { start: last.end, end: last.end, text: nl + ind + reindent(fragment, fragmentIndent, ind) };
  }
  const close = parent.endTagStart as number;
  const ind = lineIndent(text, close);
  const content = text.slice(parent.startTagEnd, close);
  if (ind === null || content.trim() !== '') return { start: close, end: close, text: fragment };
  const inner = ind + '  ';
  const at = close - ind.length;
  return { start: at, end: at, text: inner + reindent(fragment, fragmentIndent, inner) + nl };
}

export function insertHtmlSplices(doc: SourceDoc, parentId: number, index: number, html: string): Splice[] {
  const parent = requireContainer(doc, parentId);
  if (typeof html !== 'string' || html.trim() === '') throw new OpError('invalid', 'insertHtml needs non-empty html');
  return [insertAt(doc, parent, index, html.replace(/\r\n?/g, lineBreak(doc.text)), '')];
}

/** The range removed with a node: the whole line when the node is alone on it, else one whitespace run at most. */
function removalRange(text: string, n: SourceNode): { start: number; end: number } {
  const ind = lineIndent(text, n.start);
  const after = /^[ \t]*/.exec(text.slice(n.end))![0];
  if (ind !== null) {
    const rest = /^[ \t]*(\r?\n|$)/.exec(text.slice(n.end));
    if (rest && n.start - ind.length > 0) {
      const start = n.start - ind.length;
      let end = n.end + rest[0].length;
      // Between two blank lines: take one of them too, so no double blank line is left.
      const blankBefore = /\n[ \t]*\r?\n$/.test(text.slice(Math.max(0, start - 200), start));
      const blankAfter = /^[ \t]*\r?\n/.exec(text.slice(end));
      if (blankBefore && blankAfter) end += blankAfter[0].length;
      return { start, end };
    }
    return { start: n.start, end: n.end + after.length };
  }
  let pre = 0;
  while (n.start - pre > 0 && (text[n.start - pre - 1] === ' ' || text[n.start - pre - 1] === '\t')) pre++;
  if (pre > 0 && after.length > 0) return { start: n.start - pre, end: n.end };
  return { start: n.start, end: n.end };
}

export function removeSplices(doc: SourceDoc, id: number): Splice[] {
  const n = requireMovable(doc, id);
  return [{ ...removalRange(doc.text, n), text: '' }];
}

export function moveSplices(doc: SourceDoc, id: number, parentId: number, index: number): Splice[] {
  const n = requireMovable(doc, id);
  const parent = requireContainer(doc, parentId);
  if (isWithin(doc, parentId, id)) throw new OpError('invalid', `cannot move node ${id} into itself or its descendant ${parentId}`);
  const current = n.parent === parentId ? parent.children.filter((c) => doc.nodes[c].start >= 0).indexOf(id) : -1;
  if (current === index) return [];
  const text = doc.text;
  const removal = { ...removalRange(text, n), text: '' };
  const fragment = text.slice(n.start, n.end);
  const insertion = insertAt(doc, parent, index, fragment, lineIndent(text, n.start), id);
  try {
    checkSplices(text.length, [removal, insertion]);
  } catch {
    throw new OpError('invalid', `cannot move node ${id} to index ${index} of node ${parentId}: the target lies inside the removed range`);
  }
  return [removal, insertion];
}

const ID_LIST_ATTRS = ['for', 'aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns', 'aria-activedescendant', 'aria-flowto', 'aria-details', 'aria-errormessage'];
const HREF_ATTRS = ['href', 'xlink:href'];

function uniqueName(base: string, taken: Set<string>): string {
  for (let i = 2; ; i++) {
    const c = `${base}-${i}`;
    if (!taken.has(c)) {
      taken.add(c);
      return c;
    }
  }
}

function subtree(doc: SourceDoc, n: SourceNode): SourceNode[] {
  const out: SourceNode[] = [];
  const stack = [n.id];
  while (stack.length) {
    const c = doc.nodes[stack.pop() as number];
    out.push(c);
    stack.push(...c.children);
  }
  return out;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The copy of a node's source with every id (and every reference to one inside the copy) renamed uniquely. */
export function renamedCopy(doc: SourceDoc, n: SourceNode): string {
  const text = doc.text;
  const nodes = subtree(doc, n);
  const allIds = new Set(doc.nodes.map((x) => findAttr(x, 'id')?.value).filter((v): v is string => !!v));
  const allMorph = new Set(doc.nodes.map((x) => findAttr(x, 'data-morph')?.value).filter((v): v is string => !!v));
  const ids = new Map<string, string>();
  const morphs = new Map<string, string>();
  for (const x of nodes) {
    const v = findAttr(x, 'id')?.value;
    if (v && !ids.has(v)) ids.set(v, uniqueName(v, allIds));
    const m = findAttr(x, 'data-morph')?.value;
    if (m && !morphs.has(m)) morphs.set(m, uniqueName(m, allMorph));
  }
  const urlRe = ids.size ? new RegExp(`url\\(\\s*(['"]?)#(${[...ids.keys()].map(escapeRe).join('|')})\\1\\s*\\)`, 'g') : null;
  const renameUrls = (s: string) => (urlRe ? s.replace(urlRe, (_m, q: string, id: string) => `url(${q}#${ids.get(id)}${q})`) : s);

  const splices: Splice[] = [];
  for (const x of nodes) {
    if (x.start < 0) continue;
    for (const [name, a] of Object.entries(x.attrs)) {
      const lname = name.toLowerCase();
      let next = a.value;
      if (lname === 'id') next = ids.get(a.value) ?? a.value;
      else if (lname === 'data-morph') next = morphs.get(a.value) ?? a.value;
      else if (ID_LIST_ATTRS.includes(lname)) next = a.value.split(/(\s+)/).map((t) => ids.get(t) ?? t).join('');
      else if (HREF_ATTRS.includes(lname) && a.value.startsWith('#') && ids.has(a.value.slice(1))) next = '#' + ids.get(a.value.slice(1));
      else next = renameUrls(a.value);
      if (next !== a.value) splices.push(...setAttrSplices(doc, x, name, next));
    }
    if (x.tag === 'style' && x.endTagStart !== null) {
      const css = text.slice(x.startTagEnd, x.endTagStart);
      const next = renameUrls(css);
      if (next !== css) splices.push({ start: x.startTagEnd, end: x.endTagStart, text: next });
    }
  }
  const shifted = splices.map((s) => ({ start: s.start - n.start, end: s.end - n.start, text: s.text }));
  return applySplices(text.slice(n.start, n.end), shifted);
}

export function duplicateSplices(doc: SourceDoc, id: number): Splice[] {
  const n = requireMovable(doc, id);
  const text = doc.text;
  const copy = renamedCopy(doc, n);
  const ind = lineIndent(text, n.start);
  return [{ start: n.end, end: n.end, text: ind === null ? copy : lineBreak(text) + ind + copy }];
}

const EMPTY_ELEMENT = /^\s*<([A-Za-z][\w:-]*)(\s[^<>]*)?>\s*<\/\1\s*>\s*$/;

export function wrapSplices(doc: SourceDoc, ids: number[], html: string): Splice[] {
  if (!Array.isArray(ids) || ids.length === 0) throw new OpError('invalid', 'wrap needs at least one node id');
  const m = typeof html === 'string' ? EMPTY_ELEMENT.exec(html) : null;
  if (!m) throw new OpError('invalid', `wrap html must be one empty element like '<div class="x"></div>', got ${JSON.stringify(html)}`);
  const tag = m[1].toLowerCase();
  if (['br', 'img', 'hr', 'input', 'meta', 'link'].includes(tag)) throw new OpError('invalid', `<${tag}> cannot wrap content`);
  const nodes = ids.map((id) => requireMovable(doc, id));
  const parent = nodes[0].parent;
  if (parent === null || nodes.some((x) => x.parent !== parent)) throw new OpError('invalid', 'wrap ids must be siblings');
  const kids = doc.nodes[parent].children;
  const order = nodes.map((x) => kids.indexOf(x.id)).sort((a, b) => a - b);
  if (new Set(order).size !== order.length || order.some((v, i) => i > 0 && v !== order[i - 1] + 1)) {
    throw new OpError('invalid', 'wrap ids must be contiguous siblings');
  }
  const sorted = order.map((i) => doc.nodes[kids[i]]);
  const text = doc.text;
  for (let i = 1; i < sorted.length; i++) {
    const between = text.slice(sorted[i - 1].end, sorted[i].start).replace(/<!--[\s\S]*?-->/g, '');
    if (between.trim() !== '') throw new OpError('invalid', 'wrap ids must be contiguous siblings with no text between them');
  }
  const open = html.trim().slice(0, html.trim().indexOf('>') + 1);
  const close = `</${m[1]}>`;
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const ind = lineIndent(text, first.start);
  const nl = lineBreak(text);
  if (ind === null) return [{ start: first.start, end: first.start, text: open }, { start: last.end, end: last.end, text: close }];
  return [{ start: first.start, end: first.start, text: open + nl + ind }, { start: last.end, end: last.end, text: nl + ind + close }];
}
