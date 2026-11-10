// SourceDoc: a read-only view of the file text, built with parse5 source locations. Never serialised.
// Node ids are document-order indices (template content included) and are valid for one SourceDoc only.
import { parse } from 'parse5';
import type { DefaultTreeAdapterMap, Token } from 'parse5';

type P5Element = DefaultTreeAdapterMap['element'];
type P5Node = DefaultTreeAdapterMap['node'];
type P5Text = DefaultTreeAdapterMap['textNode'];

export interface SourceAttr { start: number; end: number; value: string; quote: '"' | "'" | '' }

export interface SourceNode {
  id: number;
  tag: string;
  start: number;
  end: number;
  startTagEnd: number;
  endTagStart: number | null;
  attrs: Record<string, SourceAttr>;
  patchable: boolean;
  parent: number | null;
  children: number[];
  ns: 'html' | 'svg' | 'math';
}

export interface TextSegment { nodeId: number /* parent element */; rawStart: number; rawEnd: number; decoded: string }

/** A text segment plus whether its source range lies inside its parent's content range (false when relocated). */
export interface LocatedSegment extends TextSegment { inPlace: boolean }

export interface SourceDoc {
  text: string;
  bom: boolean;
  nodes: SourceNode[];
  byId(id: number): SourceNode;
  /** Direct and descendant text runs of an element, document order. */
  textSegments(id: number): LocatedSegment[];
  query(selectorLike: { tag?: string; cls?: string; attr?: string }): SourceNode[];
}

const HTML_NS = 'http://www.w3.org/1999/xhtml';
const SVG_NS = 'http://www.w3.org/2000/svg';
const MATH_NS = 'http://www.w3.org/1998/Math/MathML';

export const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source',
  'track', 'wbr', 'basefont', 'bgsound', 'frame', 'keygen', 'param']);
export const RAW_TEXT_TAGS = new Set(['script', 'style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes',
  'noscript', 'plaintext']);

function isElement(n: P5Node): n is P5Element {
  return (n as P5Element).tagName !== undefined;
}
function isText(n: P5Node): n is P5Text {
  return n.nodeName === '#text';
}

function quoteOf(text: string, a: { start: number; end: number }): '"' | "'" | '' {
  const m = /^[^\s=]+\s*=\s*(["']?)/.exec(text.slice(a.start, a.end));
  return m ? (m[1] as '"' | "'" | '') : '';
}

/** Attribute lookup that falls back to a case-insensitive match (SVG attributes are keyed by their source case). */
export function findAttr(n: SourceNode, name: string): SourceAttr | undefined {
  if (n.attrs[name]) return n.attrs[name];
  const lower = name.toLowerCase();
  const key = Object.keys(n.attrs).find((k) => k.toLowerCase() === lower);
  return key ? n.attrs[key] : undefined;
}

export function classList(n: SourceNode): string[] {
  return (findAttr(n, 'class')?.value ?? '').split(/[ \t\n\r\f]+/).filter(Boolean);
}

export function parseSource(text: string): SourceDoc {
  // parse5 does not strip a leading BOM (browsers do, at decode time). With the BOM left in, parse5 treats it as
  // text, drops the doctype and invents html/head/body. So parse without it and shift every offset by one.
  const bom = text.charCodeAt(0) === 0xfeff;
  const shift = bom ? 1 : 0;
  const tree = parse(shift ? text.slice(1) : text, { sourceCodeLocationInfo: true });
  const nodes: SourceNode[] = [];
  const segments: LocatedSegment[] = [];
  const located: { node: SourceNode; foreign: boolean; selfClosing: boolean; domParentLocated: number | null }[] = [];

  const visitText = (t: P5Text, parent: number) => {
    const loc = t.sourceCodeLocation;
    if (!loc) return;
    segments.push({ nodeId: parent, rawStart: loc.startOffset + shift, rawEnd: loc.endOffset + shift, decoded: t.value, inPlace: false });
  };

  const visit = (el: P5Element, parent: number | null, nearestLocated: number | null) => {
    const id = nodes.length;
    const loc = el.sourceCodeLocation as Token.ElementLocation | null | undefined;
    const ns = el.namespaceURI === SVG_NS ? 'svg' : el.namespaceURI === MATH_NS ? 'math' : 'html';
    const node: SourceNode = {
      id, tag: el.tagName.toLowerCase(), start: -1, end: -1, startTagEnd: -1, endTagStart: null, attrs: {},
      patchable: false, parent, children: [], ns,
    };
    nodes.push(node);
    if (parent !== null) nodes[parent].children.push(id);

    let myLocated = nearestLocated;
    if (loc && loc.startTag) {
      node.start = loc.startOffset + shift;
      node.end = loc.endOffset + shift;
      node.startTagEnd = loc.startTag.endOffset + shift;
      node.endTagStart = loc.endTag ? loc.endTag.startOffset + shift : null;
      for (const a of el.attrs) {
        const key = a.prefix ? `${a.prefix}:${a.name}` : a.name;
        const l = loc.attrs?.[key] ?? loc.attrs?.[key.toLowerCase()];
        if (!l) continue;
        const range = { start: l.startOffset + shift, end: l.endOffset + shift };
        node.attrs[key] = { ...range, value: a.value, quote: quoteOf(text, range) };
      }
      const foreign = el.namespaceURI !== HTML_NS;
      const selfClosing = text.slice(node.startTagEnd - 2, node.startTagEnd) === '/>' &&
        !Object.values(node.attrs).some((a) => a.end > node.startTagEnd - 2);
      located.push({ node, foreign, selfClosing, domParentLocated: nearestLocated });
      myLocated = id;
    }
    const kids = [...((el.childNodes ?? []) as P5Node[])];
    const content = (el as { content?: DefaultTreeAdapterMap['documentFragment'] }).content;
    if (content) kids.push(...(content.childNodes as P5Node[]));
    for (const c of kids) {
      if (isElement(c)) visit(c, id, myLocated);
      else if (isText(c)) visitText(c, id);
    }
  };
  for (const c of tree.childNodes as P5Node[]) if (isElement(c)) visit(c, null, null);

  // Patchability. A node is patchable when its start tag is real text in the file, it has an end tag (or needs
  // none), and its place in the source nesting equals its place in the DOM. The last check catches what the
  // parser relocates: foster-parented table content, adoption-agency clones, content after </body>.
  const startCount = new Map<number, number>();
  for (const l of located) startCount.set(l.node.start, (startCount.get(l.node.start) ?? 0) + 1);

  const bySource = [...located].sort((a, b) => a.node.start - b.node.start || b.node.end - a.node.end);
  const sourceParent = new Map<number, number | null>();
  const stack: SourceNode[] = [];
  for (const l of bySource) {
    while (stack.length && stack[stack.length - 1].end <= l.node.start) stack.pop();
    sourceParent.set(l.node.id, stack.length ? stack[stack.length - 1].id : null);
    stack.push(l.node);
  }

  for (const l of located) {
    const n = l.node;
    const realStart = text.slice(n.start, n.start + 1 + n.tag.length).toLowerCase() === '<' + n.tag;
    const closed = n.endTagStart !== null || VOID_TAGS.has(n.tag) || (l.foreign && l.selfClosing);
    const unique = startCount.get(n.start) === 1;
    const inPlace = sourceParent.get(n.id) === l.domParentLocated;
    n.patchable = realStart && closed && unique && inPlace;
  }

  // A text run is in place when it lies inside its parent's content and inside no child element of that parent.
  for (const s of segments) {
    const p = nodes[s.nodeId];
    const contentEnd = p.endTagStart ?? p.end;
    s.inPlace = p.start >= 0 && s.rawStart >= p.startTagEnd && s.rawEnd <= contentEnd &&
      !p.children.some((c) => nodes[c].start >= 0 && nodes[c].start < s.rawEnd && s.rawStart < nodes[c].end);
  }

  // Descendant ids form the contiguous range (id, lastDesc[id]] because ids are pre-order.
  const lastDesc = new Array<number>(nodes.length);
  for (let i = nodes.length - 1; i >= 0; i--) {
    const kids = nodes[i].children;
    lastDesc[i] = kids.length ? lastDesc[kids[kids.length - 1]] : i;
  }

  return {
    text,
    bom,
    nodes,
    byId(id: number) {
      const n = Number.isInteger(id) ? nodes[id] : undefined;
      if (!n) throw new RangeError(`no source node with id ${id} (document has ${nodes.length} nodes)`);
      return n;
    },
    textSegments(id: number) {
      this.byId(id);
      const last = lastDesc[id];
      return segments.filter((s) => s.nodeId >= id && s.nodeId <= last);
    },
    query(q: { tag?: string; cls?: string; attr?: string }) {
      const [attrName, attrValue] = q.attr ? splitAttrQuery(q.attr) : [undefined, undefined];
      return nodes.filter((n) => {
        if (q.tag !== undefined && n.tag !== q.tag.toLowerCase()) return false;
        if (q.cls !== undefined && !classList(n).includes(q.cls)) return false;
        if (attrName !== undefined) {
          const a = findAttr(n, attrName);
          if (!a || (attrValue !== undefined && a.value !== attrValue)) return false;
        }
        return true;
      });
    },
  };
}

/** `name` or `name=value` (value optionally quoted). */
function splitAttrQuery(s: string): [string, string | undefined] {
  const i = s.indexOf('=');
  if (i < 0) return [s, undefined];
  return [s.slice(0, i), s.slice(i + 1).replace(/^(["'])(.*)\1$/, '$2')];
}

/** True when `id` is `ancestor` or lies inside it. */
export function isWithin(doc: SourceDoc, id: number, ancestor: number): boolean {
  for (let p: number | null = id; p !== null; p = doc.nodes[p].parent) if (p === ancestor) return true;
  return false;
}

/** Indentation of the line an offset is on, when only whitespace precedes it on that line; otherwise null. */
export function lineIndent(text: string, offset: number): string | null {
  let i = offset;
  while (i > 0 && (text[i - 1] === ' ' || text[i - 1] === '\t')) i--;
  if (i > 0 && text[i - 1] !== '\n') return null;
  return text.slice(i, offset);
}

/** The line break style of a document ("\r\n" when its first line break is CRLF). */
export function lineBreak(text: string): string {
  const i = text.indexOf('\n');
  return i > 0 && text[i - 1] === '\r' ? '\r\n' : '\n';
}
