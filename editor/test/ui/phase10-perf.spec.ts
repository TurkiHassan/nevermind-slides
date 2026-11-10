// Phase 10 performance budgets in a real browser on the real deck. Budgets are about three times the medians
// measured on a development laptop (docs/phase-10-report.md), so a regression fails and normal noise does not.
import { expect } from '@playwright/test';
import { test } from './helpers.ts';

// Idle budgets are about three times the medians measured alone (ready 0.46 s, switch 30 ms, edit 40 ms, save 130 ms,
// HTML export 1.35 s). The full suite runs many Chromium workers at once, and measured up to 3x slower there, so the
// default run allows 4x the idle budget; `NM_PERF_STRICT=1 npx playwright test test/ui/phase10-perf.spec.ts` runs the
// idle budgets themselves.
const LOAD = process.env.NM_PERF_STRICT ? 1 : 4;
const IDLE = { ready: 1500, slideSwitch: 120, editRoundTrip: 150, saveRoundTrip: 450, exportHtml: 4500 };
const BUDGET_MS = Object.fromEntries(Object.entries(IDLE).map(([k, v]) => [k, v * LOAD])) as typeof IDLE;

const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

test('the editor opens, switches slides, edits and saves within the performance budgets', async ({ page, srv }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const t0 = Date.now();
  await page.goto(srv.url);
  await page.waitForFunction(() => (window as any).nmShell?.state && (document.querySelector<HTMLIFrameElement>('#frame')?.contentWindow as any)?.__nm);
  await page.evaluate(() => (window as any).nmShell.ready);
  const ready = Date.now() - t0;

  const switches: number[] = [];
  for (let i = 1; i <= 5; i++) {
    const t = Date.now();
    await page.evaluate((n) => (window as any).nmShell.goTo(n), i);
    await page.waitForFunction((n) => (window as any).nmShell.current === n, i);
    await page.evaluate(() => (window as any).nmShell.settled?.());
    switches.push(Date.now() - t);
  }

  const edits: number[] = [];
  for (let i = 0; i < 5; i++) {
    const t = Date.now();
    const res = await page.evaluate(async (n) => {
      const shell = (window as any).nmShell;
      const heading = shell.signals.info.value.slides[0];
      const outline = await shell.api(`/api/outline?slide=1&depth=8`);
      const find = (node: any): any => (/^h[1-6]$/.test(node.tag) ? node : node.children.map(find).find(Boolean));
      return shell.postOps([{ kind: 'setText', id: find(outline.outline).key, text: `عنوان ${n}` }], { label: 'perf' }).then(() => !!heading);
    }, i);
    expect(res).toBe(true);
    edits.push(Date.now() - t);
  }

  const t = Date.now();
  await page.getByRole('button', { name: /حفظ|Save/ }).click();
  await expect.poll(() => page.evaluate(() => (window as any).nmShell.state.dirty)).toBe(false);
  const save = Date.now() - t;

  const exp = Date.now();
  const job = await page.evaluate(async () => { const s = (window as any).nmShell; return s.api('/api/exports', { format: 'html' }); });
  await expect.poll(async () => (await page.evaluate((id) => (window as any).nmShell.api(`/api/exports/${id}`), job.id)).status, { timeout: 20_000 }).toBe('ready');
  const exportMs = Date.now() - exp;

  console.log(`perf ready=${ready} switch=${median(switches)} edit=${median(edits)} save=${save} exportHtml=${exportMs}`);
  expect(ready).toBeLessThan(BUDGET_MS.ready);
  expect(median(switches)).toBeLessThan(BUDGET_MS.slideSwitch);
  expect(median(edits)).toBeLessThan(BUDGET_MS.editRoundTrip);
  expect(save).toBeLessThan(BUDGET_MS.saveRoundTrip);
  expect(exportMs).toBeLessThan(BUDGET_MS.exportHtml);
});
