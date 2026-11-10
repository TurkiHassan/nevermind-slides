// Text splices: the only way the engine changes a file. Offsets are UTF-16 indices into the original string.

export interface Splice { start: number; end: number; text: string }

/** Splices in application order: by start, zero-length (inserts) before replacements at the same start, then input order. */
function ordered(splices: Splice[]): Splice[] {
  return splices
    .map((s, i) => ({ s, i }))
    .sort((a, b) => a.s.start - b.s.start || (a.s.end - a.s.start) - (b.s.end - b.s.start) || a.i - b.i)
    .map((x) => x.s);
}

/** Throws when a splice is out of range or overlaps another. Inserts at the same offset are allowed and keep input order. */
export function checkSplices(length: number, splices: Splice[]): Splice[] {
  const out = ordered(splices);
  let pos = 0;
  for (const s of out) {
    if (!Number.isInteger(s.start) || !Number.isInteger(s.end) || s.start < 0 || s.end < s.start || s.end > length) {
      throw new RangeError(`invalid splice [${s.start}, ${s.end}) for text of length ${length}`);
    }
    if (s.start < pos) throw new RangeError(`overlapping splice [${s.start}, ${s.end}) (previous splice ends at ${pos})`);
    pos = s.end;
  }
  return out;
}

export function applySplices(text: string, splices: Splice[]): string {
  if (splices.length === 0) return text;
  const out: string[] = [];
  let pos = 0;
  for (const s of checkSplices(text.length, splices)) {
    out.push(text.slice(pos, s.start), s.text);
    pos = s.end;
  }
  out.push(text.slice(pos));
  return out.join('');
}

/** The splices that turn `applySplices(before, splices)` back into `before`, in post-apply coordinates. */
export function invertSplices(before: string, splices: Splice[]): Splice[] {
  let delta = 0;
  const inverse: Splice[] = [];
  for (const s of checkSplices(before.length, splices)) {
    const start = s.start + delta;
    inverse.push({ start, end: start + s.text.length, text: before.slice(s.start, s.end) });
    delta += s.text.length - (s.end - s.start);
  }
  return inverse;
}
