// The deck's `tailwind.config = {...}` object literal: read theme names, and edit one value in place via acorn
// locations, so the rest of the script is untouched byte for byte.
import { parse as parseJs } from 'acorn';
import type { Expression, Node as JsNode, ObjectExpression, Property, SpreadElement } from 'acorn';
import type { TokenContext } from './class-algebra.ts';
import { OpError } from './errors.ts';
import { findAttr, lineIndent, type SourceDoc } from './source.ts';
import type { Splice } from './splice.ts';

interface ConfigLocation { object: ObjectExpression; offset: number /* file offset of script content */ }

function isTailwindConfigTarget(n: JsNode): boolean {
  // tailwind.config or window.tailwind.config
  const m = n as unknown as { type: string; object?: JsNode & { type: string; name?: string; property?: { name?: string } }; property?: { type: string; name?: string } };
  if (m.type !== 'MemberExpression' || m.property?.type !== 'Identifier' || m.property.name !== 'config' || !m.object) return false;
  const o = m.object;
  return (o.type === 'Identifier' && o.name === 'tailwind') || (o.type === 'MemberExpression' && o.property?.name === 'tailwind');
}

function locateConfig(doc: SourceDoc): ConfigLocation | null {
  for (const n of doc.nodes) {
    if (n.tag !== 'script' || !n.patchable || n.endTagStart === null || findAttr(n, 'src')) continue;
    const code = doc.text.slice(n.startTagEnd, n.endTagStart);
    if (!code.includes('tailwind')) continue;
    let program;
    try {
      program = parseJs(code, { ecmaVersion: 'latest', sourceType: 'script', allowHashBang: true });
    } catch {
      continue;
    }
    for (const st of program.body) {
      if (st.type !== 'ExpressionStatement') continue;
      const e = st.expression;
      if (e.type === 'AssignmentExpression' && e.operator === '=' && isTailwindConfigTarget(e.left) && e.right.type === 'ObjectExpression') {
        return { object: e.right, offset: n.startTagEnd };
      }
    }
  }
  return null;
}

function keyName(p: Property | SpreadElement): string | null {
  if (p.type !== 'Property' || p.computed) return null;
  if (p.key.type === 'Identifier') return p.key.name;
  if (p.key.type === 'Literal' && (typeof p.key.value === 'string' || typeof p.key.value === 'number')) return String(p.key.value);
  return null;
}

function findProp(o: ObjectExpression, name: string): Property | null {
  for (const p of o.properties) if (keyName(p) === name) return p as Property;
  return null;
}

/** Plain value of a literal expression; undefined for anything not statically known. */
function evaluate(e: Expression): unknown {
  switch (e.type) {
    case 'Literal':
      return e.value instanceof RegExp ? undefined : e.value;
    case 'TemplateLiteral':
      return e.expressions.length === 0 ? e.quasis.map((q) => q.value.cooked).join('') : undefined;
    case 'ArrayExpression':
      return e.elements.map((x) => (x && x.type !== 'SpreadElement' ? evaluate(x) : undefined));
    case 'ObjectExpression': {
      const out: Record<string, unknown> = {};
      for (const p of e.properties) {
        const k = keyName(p);
        if (k !== null) out[k] = evaluate((p as Property).value as Expression);
      }
      return out;
    }
    case 'UnaryExpression':
      if (e.operator === '-' && e.argument.type === 'Literal' && typeof e.argument.value === 'number') return -e.argument.value;
      return undefined;
    default:
      return undefined;
  }
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Flatten a Tailwind colour object: nested keys join with '-', DEFAULT names the parent. */
export function flattenColors(o: unknown, prefix = '', out = new Map<string, unknown>()): Map<string, unknown> {
  if (!isObj(o)) return out;
  for (const [k, v] of Object.entries(o)) {
    const name = k === 'DEFAULT' ? prefix : prefix ? `${prefix}-${k}` : k;
    if (isObj(v)) flattenColors(v, name, out);
    else if (name) out.set(name, v);
  }
  return out;
}

export function readTokens(doc: SourceDoc): { ctx: TokenContext; configRange: { start: number; end: number } | null; values: Record<string, unknown> } {
  const loc = locateConfig(doc);
  if (!loc) return { ctx: { colors: new Set(), fontSizes: new Set(), fontFamilies: new Set() }, configRange: null, values: {} };
  const values = (evaluate(loc.object) ?? {}) as Obj;
  const theme = isObj(values.theme) ? values.theme : {};
  const extend = isObj(theme.extend) ? theme.extend : {};
  const keys = (field: string) => [
    ...(isObj(theme[field]) ? Object.keys(theme[field] as Obj) : []),
    ...(isObj(extend[field]) ? Object.keys(extend[field] as Obj) : []),
  ];
  const colors = new Set([...flattenColors(theme.colors).keys(), ...flattenColors(extend.colors).keys()]);
  return {
    ctx: { colors, fontSizes: new Set(keys('fontSize')), fontFamilies: new Set(keys('fontFamily')) },
    configRange: { start: loc.offset + loc.object.start, end: loc.offset + loc.object.end },
    values,
  };
}

const IDENT = /^[A-Za-z_$][\w$]*$/;
const keyText = (k: string) => (IDENT.test(k) ? k : `'${k.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`);

function stringLiteral(value: string, quote: string): string {
  const esc = value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
  return quote + (quote === '"' ? esc.replace(/"/g, '\\"') : esc.replace(/'/g, "\\'")) + quote;
}

/** The quote character used by the first string literal value in an object (or its descendants), default "'". */
function quoteStyle(text: string, o: ObjectExpression, offset: number): string {
  for (const p of o.properties) {
    if (p.type !== 'Property') continue;
    if (p.value.type === 'Literal' && typeof p.value.value === 'string') return text[offset + p.value.start];
    if (p.value.type === 'ObjectExpression') {
      const q = quoteStyle(text, p.value, offset);
      if (q) return q;
    }
  }
  return "'";
}

/** Indentation for a new property in `o`, and the line break to use. */
function propIndent(text: string, o: ObjectExpression, offset: number): string | null {
  const props = o.properties;
  if (props.length) return lineIndent(text, offset + props[props.length - 1].start);
  const open = lineIndentOfLine(text, offset + o.start);
  return open === null ? null : open + '  ';
}

function lineIndentOfLine(text: string, at: number): string | null {
  let i = at;
  while (i > 0 && text[i - 1] !== '\n') i--;
  return /^[ \t]*/.exec(text.slice(i, at))![0];
}

function nestedLiteral(keys: string[], value: string, quote: string): string {
  if (keys.length === 1) return `${keyText(keys[0])}: ${stringLiteral(value, quote)}`;
  return `${keyText(keys[0])}: { ${nestedLiteral(keys.slice(1), value, quote)} }`;
}

function addProp(text: string, o: ObjectExpression, offset: number, literal: string): Splice {
  const props = o.properties;
  const nl = text.includes('\r\n') ? '\r\n' : '\n';
  const indent = propIndent(text, o, offset);
  if (props.length === 0) {
    const inner = { start: offset + o.start + 1, end: offset + o.end - 1 };
    if (indent === null || !/[\r\n]/.test(text.slice(inner.start, inner.end))) {
      return { start: inner.start, end: inner.end, text: ` ${literal} ` };
    }
    return { start: inner.start, end: inner.start, text: `${nl}${indent}${literal},` };
  }
  const last = props[props.length - 1];
  const after = offset + last.end;
  const m = /^\s*,/.exec(text.slice(after, offset + o.end));
  if (indent === null) {
    // properties share a line with other code: add inline
    return m ? { start: after + m[0].length, end: after + m[0].length, text: ` ${literal},` } : { start: after, end: after, text: `, ${literal}` };
  }
  if (m) return { start: after + m[0].length, end: after + m[0].length, text: `${nl}${indent}${literal},` };
  return { start: after, end: after, text: `,${nl}${indent}${literal}` };
}

function removeProp(text: string, o: ObjectExpression, p: Property, offset: number): Splice {
  const s = offset + p.start;
  const e = offset + p.end;
  const tail = /^[ \t]*,/.exec(text.slice(e));
  const alone = lineIndent(text, s) !== null;
  if (tail) {
    let end = e + tail[0].length;
    const rest = /^[ \t]*(\r?\n)/.exec(text.slice(end));
    if (alone && rest) return { start: s - (lineIndent(text, s) as string).length, end: end + rest[0].length, text: '' };
    const sp = /^[ \t]*/.exec(text.slice(end))![0].length;
    end += sp;
    return { start: s, end, text: '' };
  }
  const idx = o.properties.indexOf(p);
  if (idx > 0) {
    const before = text.slice(offset + o.properties[idx - 1].end, s);
    const m = /,\s*$/.exec(before);
    if (m) return { start: s - m[0].length, end: e, text: '' };
  }
  return { start: s, end: e, text: '' };
}

/** Splices that set (or, for null, remove) `theme.extend.<path>` in the deck's tailwind.config object. */
export function setTokenSplices(doc: SourceDoc, path: string[], value: string | null): Splice[] {
  if (path.length === 0 || path.some((k) => typeof k !== 'string' || k === '')) throw new OpError('invalid', 'token path must be non-empty strings');
  const loc = locateConfig(doc);
  if (!loc) throw new OpError('unsupported', 'this deck has no `tailwind.config = {...}` object literal in an inline script');
  const text = doc.text;
  const full = ['theme', 'extend', ...path];
  let o = loc.object;
  const quote = quoteStyle(text, loc.object, loc.offset);
  for (let i = 0; i < full.length; i++) {
    const p = findProp(o, full[i]);
    const last = i === full.length - 1;
    if (!p) {
      if (value === null) return [];
      return [addProp(text, o, loc.offset, nestedLiteral(full.slice(i), value, quote))];
    }
    if (last) {
      if (value === null) return [removeProp(text, o, p, loc.offset)];
      const v = p.value;
      if (v.type === 'Literal' && typeof v.value === 'string') {
        if (v.value === value) return [];
        return [{ start: loc.offset + v.start, end: loc.offset + v.end, text: stringLiteral(value, text[loc.offset + v.start]) }];
      }
      if (v.type === 'ObjectExpression') throw new OpError('invalid', `token ${path.join('.')} is an object; set one of its keys instead`);
      return [{ start: loc.offset + v.start, end: loc.offset + v.end, text: stringLiteral(value, quote) }];
    }
    if (p.value.type !== 'ObjectExpression') throw new OpError('unsupported', `${full.slice(0, i + 1).join('.')} is not an object literal`);
    o = p.value;
  }
  return [];
}
