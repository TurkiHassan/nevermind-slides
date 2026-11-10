// How many source lines differ between the file on disk and the document: the number the editor's
// unsaved-changes pill shows. Each contiguous block of changes counts max(deleted, inserted) lines, so
// rewriting one line counts 1, inserting three lines counts 3, and the count is 0 exactly when the texts match.

const LCS_CELL_LIMIT = 4_000_000;

/** Changed-line count of the middle region (common prefix and suffix already removed). */
function middleCount(a: string[], b: string[]): number {
  const n = a.length;
  const m = b.length;
  if (n === 0 || m === 0) return Math.max(n, m);
  if (n * m > LCS_CELL_LIMIT) return Math.max(n, m); // far-apart edits on a huge region: an upper bound is honest enough
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  let total = 0;
  let del = 0;
  let ins = 0;
  const flush = () => { total += Math.max(del, ins); del = 0; ins = 0; };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { flush(); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { del++; i++; }
    else { ins++; j++; }
  }
  del += n - i;
  ins += m - j;
  flush();
  return total;
}

export function changedLines(before: string, after: string): number {
  if (before === after) return 0;
  const a = before.split('\n');
  const b = after.split('\n');
  let pre = 0;
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
  let suf = 0;
  while (suf < a.length - pre && suf < b.length - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
  return middleCount(a.slice(pre, a.length - suf), b.slice(pre, b.length - suf));
}

/** Memoised on the two strings' identity, so repeated reads of an unchanged session cost nothing. */
export function changedLinesCache(): (before: string, after: string) => number {
  let lastA: string | null = null;
  let lastB: string | null = null;
  let last = 0;
  return (a, b) => {
    if (a !== lastA || b !== lastB) {
      last = changedLines(a, b);
      lastA = a;
      lastB = b;
    }
    return last;
  };
}
