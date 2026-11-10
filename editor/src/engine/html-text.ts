// Escaping and the mapping between a raw text run in the source and its decoded value.
import { parseFragment } from 'parse5';

/** Minimal escape for text content: '&', '<' and '>'. */
export function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Escape for an attribute value inside the given quote. '&' is escaped only where it could start a character
 * reference, so typical values round-trip byte for byte.
 */
export function escapeAttr(value: string, quote: '"' | "'"): string {
  const v = value.replace(/&(?=[#A-Za-z0-9])/g, '&amp;');
  return quote === '"' ? v.replace(/"/g, '&quot;') : v.replace(/'/g, '&#39;');
}

export const UNQUOTED_SAFE = /^[^\s"'=<>`]+$/;

/** One indivisible piece of a raw text run: a character, a CRLF pair, or a character reference. */
export interface TextUnit { rawStart: number; rawEnd: number; decoded: string }

const decodeCache = new Map<string, string>();

/** Decode one character reference the way parse5 does in text content. */
function decodeReference(raw: string): string {
  let v = decodeCache.get(raw);
  if (v === undefined) {
    const frag = parseFragment(`<b>${raw}</b>`);
    const b = frag.childNodes[0] as { childNodes?: { value?: string }[] };
    v = (b.childNodes ?? []).map((c) => c.value ?? '').join('');
    decodeCache.set(raw, v);
  }
  return v;
}

const REF = /&(?:#[0-9]+;?|#[xX][0-9a-fA-F]+;?|[A-Za-z][A-Za-z0-9]*;?)/y;

/**
 * Split raw source text (offsets relative to the whole file: `rawStart` is where `raw` starts) into units whose
 * decoded values concatenate to `expected` (parse5's value for the text node). If they do not (an input the
 * unitiser does not model), the whole run becomes one unit, so an edit replaces it entirely but never corrupts it.
 */
export function textUnits(raw: string, rawStart: number, expected: string): TextUnit[] {
  const units: TextUnit[] = [];
  let i = 0;
  while (i < raw.length) {
    const c = raw.charCodeAt(i);
    if (c === 0x26 /* & */) {
      REF.lastIndex = i;
      const m = REF.exec(raw);
      if (m) {
        units.push({ rawStart: rawStart + i, rawEnd: rawStart + i + m[0].length, decoded: decodeReference(m[0]) });
        i += m[0].length;
        continue;
      }
    }
    if (c === 0x0d /* \r */) {
      const n = raw.charCodeAt(i + 1) === 0x0a ? 2 : 1;
      units.push({ rawStart: rawStart + i, rawEnd: rawStart + i + n, decoded: '\n' });
      i += n;
      continue;
    }
    const n = c >= 0xd800 && c <= 0xdbff && i + 1 < raw.length ? 2 : 1;
    units.push({ rawStart: rawStart + i, rawEnd: rawStart + i + n, decoded: raw.slice(i, i + n) });
    i += n;
  }
  if (units.map((u) => u.decoded).join('') !== expected) {
    return raw.length ? [{ rawStart, rawEnd: rawStart + raw.length, decoded: expected }] : [];
  }
  return units;
}

/** Whitespace that collapses under `white-space: normal` (HTML ASCII whitespace). */
export function isCollapsible(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f';
}

/**
 * What `visibleText` returns for text typed as `s`: '\n' is a hard line break (a <br>), every other whitespace run
 * collapses to one space as under `white-space: normal`, and each line is trimmed.
 */
export function normaliseVisible(s: string): string {
  return s
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t\f\r]+/g, ' ').replace(/^ | $/g, ''))
    .join('\n');
}
