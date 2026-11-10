// A small line-based unified diff (for `nm-studio apply --dry-run`).

type Edit = { op: ' ' | '-' | '+'; line: string };

function lcsEdits(a: string[], b: string[]): Edit[] {
  const n = a.length;
  const m = b.length;
  if (n * m > 4_000_000) return [...a.map((line) => ({ op: '-' as const, line })), ...b.map((line) => ({ op: '+' as const, line }))];
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: Edit[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ op: ' ', line: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ op: '-', line: a[i++] });
    else out.push({ op: '+', line: b[j++] });
  }
  while (i < n) out.push({ op: '-', line: a[i++] });
  while (j < m) out.push({ op: '+', line: b[j++] });
  return out;
}

export function unifiedDiff(before: string, after: string, name: string, context = 3): string {
  if (before === after) return '';
  const a = before.split('\n');
  const b = after.split('\n');
  let pre = 0;
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
  let suf = 0;
  while (suf < a.length - pre && suf < b.length - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
  const edits: Edit[] = [
    ...a.slice(0, pre).map((line) => ({ op: ' ' as const, line })),
    ...lcsEdits(a.slice(pre, a.length - suf), b.slice(pre, b.length - suf)),
    ...a.slice(a.length - suf).map((line) => ({ op: ' ' as const, line })),
  ];
  // Group into hunks with `context` lines around changes.
  const changed = edits.map((e, i) => (e.op !== ' ' ? i : -1)).filter((i) => i >= 0);
  const hunks: [number, number][] = [];
  for (const i of changed) {
    const s = Math.max(0, i - context);
    const e = Math.min(edits.length, i + context + 1);
    const last = hunks[hunks.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else hunks.push([s, e]);
  }
  const lines = [`--- a/${name}`, `+++ b/${name}`];
  for (const [s, e] of hunks) {
    let aStart = 1;
    let bStart = 1;
    for (let k = 0; k < s; k++) { if (edits[k].op !== '+') aStart++; if (edits[k].op !== '-') bStart++; }
    const slice = edits.slice(s, e);
    const aLen = slice.filter((x) => x.op !== '+').length;
    const bLen = slice.filter((x) => x.op !== '-').length;
    lines.push(`@@ -${aLen ? aStart : aStart - 1},${aLen} +${bLen ? bStart : bStart - 1},${bLen} @@`);
    for (const x of slice) lines.push(x.op + x.line);
  }
  return lines.join('\n') + '\n';
}
