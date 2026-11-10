import { existsSync, readFileSync, readdirSync, rmSync, mkdtempSync, cpSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test as base } from '@playwright/test';
import { ATTENTION } from '../helpers.ts';
import { startTest, type TestServer } from '../server/helpers.ts';
import { clickFrameElement, openShell } from './helpers.ts';

const test = base.extend<{ srv: TestServer }>({
  srv: async ({}, use) => {
    const server = await startTest(ATTENTION);
    await use(server);
    await server.close();
  },
});

test('the export dialog is a labelled modal, marks the editable PPTX experimental, and returns focus on Escape', async ({ page, srv }) => {
  await openShell(page, srv);
  const opener = page.getByTestId('export-open');
  await opener.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: /تصدير العرض|Export deck/ });
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId('export-experimental')).toBeVisible();
  await expect(page.getByRole('radiogroup').or(page.locator('fieldset.export-formats'))).toBeVisible();
  // focus stays inside the dialog while tabbing around it
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

test('exporting portable HTML from the dialog downloads one file that opens offline with no assets folder', async ({ page, srv, browser }) => {
  const before = readFileSync(srv.deckPath);
  await openShell(page, srv);
  await page.getByTestId('export-open').click();
  await page.getByTestId('export-format-html').check();
  await page.getByTestId('export-run').click();
  await expect(page.getByTestId('export-download')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('export-warnings')).toContainText(/ترخيص|licence/i);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-download').click()]);
  const out = join(mkdtempSync(join(tmpdir(), 'nm-export-spec-')), 'portable.html');
  await download.saveAs(out);
  expect(readFileSync(srv.deckPath).equals(before)).toBe(true);

  // Open the file from a directory that has no assets/ folder, with every non-file request refused.
  const context = await browser.newContext({ offline: true, viewport: { width: 1920, height: 1080 } });
  const offline = await context.newPage();
  const requests: string[] = [];
  offline.on('request', (r) => { if (!r.url().startsWith('data:') && !r.url().startsWith('blob:')) requests.push(r.url()); });
  await offline.goto(`file://${out}`);
  await offline.evaluate(() => document.fonts.ready);
  await offline.waitForTimeout(500);
  expect(requests).toEqual([`file://${out}`]);
  const fonts = await offline.evaluate(() => [...document.fonts].map((f) => `${f.family}:${f.status}`));
  expect(fonts.some((f) => f.startsWith('Thmanyah Sans') && f.endsWith(':loaded'))).toBe(true);
  expect(await offline.locator('.slide').count()).toBe(7);
  expect(await offline.evaluate(() => [...document.images].every((img) => img.complete && img.naturalWidth > 0))).toBe(true);
  const framed = await offline.locator('iframe').evaluateAll((frames) => frames.map((f) => !!(f as HTMLIFrameElement).srcdoc));
  expect(framed).toEqual([true, true]);
  await context.close();
});

test('editor shortcuts do not act on the deck while the export dialog is open', async ({ page, srv }) => {
  const frame = await openShell(page, srv);
  const key = await clickFrameElement(page, frame, '.slide[data-nm-current] h1');
  expect(key).not.toBe('');
  const source = () => readFileSync(srv.deckPath, 'utf8');
  const before = source();
  const state = () => page.evaluate(() => { const s = (window as any).nmShell; return { dirty: s.state.dirty, canUndo: s.state.canUndo, version: s.version, slide: s.current, selected: s.signals.selection.value }; });
  const start = await state();
  await page.getByTestId('export-open').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  for (const press of ['Delete', 'ArrowRight', 'ArrowDown', 'ControlOrMeta+d', 'ControlOrMeta+z', 'PageDown']) await page.keyboard.press(press);
  expect(await state()).toEqual(start);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  expect((await state()).selected).toBe(start.selected);
  expect(source()).toBe(before);
});
