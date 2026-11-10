import { readFileSync } from 'node:fs';
import { expect, test as base } from '@playwright/test';
import { MECHANISTIC } from '../helpers.ts';
import { startTest, type TestServer } from '../server/helpers.ts';
import { test, openShell, clickFrameElement } from './helpers.ts';

const mechanisticTest = base.extend<{ srv: TestServer }>({
  srv: async ({}, use) => {
    const server = await startTest(MECHANISTIC);
    await use(server);
    await server.close();
  },
});

test.describe('Phase 3 text editing', () => {
  test('Arabic plaintext session commits one source edit and preserves frozen keyboard isolation', async ({ page, srv }) => {
    const frame = await openShell(page, srv);
    await clickFrameElement(page, frame, '.slide[data-nm-current] h1, .slide[data-nm-current] h2', 2);
    await expect.poll(() => frame.evaluate(() => (window as any).__nm.activeText()?.key ?? null)).not.toBeNull();
    const key = await frame.evaluate(() => (window as any).__nm.activeText().key as string);
    const facts = await frame.evaluate((k) => {
      const el = document.querySelector(`[data-nm-key="${k}"]`)!;
      return { mode: el.getAttribute('contenteditable'), whiteSpace: getComputedStyle(el).whiteSpace };
    }, key);
    expect(facts).toEqual({ mode: 'plaintext-only', whiteSpace: 'pre-wrap' });

    await frame.locator(`[data-nm-key="${key}"]`).press('ControlOrMeta+A');
    await frame.locator(`[data-nm-key="${key}"]`).fill('عنوان عربي\nبسطر ثان');
    await frame.locator(`[data-nm-key="${key}"]`).press('ControlOrMeta+Enter');

    await expect.poll(() => frame.evaluate(() => (window as any).__nm.activeText())).toBeNull();
    await expect.poll(() => page.evaluate(() => (window as any).nmShell.state.dirty)).toBe(true);
    expect(await frame.locator(`[data-nm-key="${key}"]`).innerText()).toBe('عنوان عربي\nبسطر ثان');

    await page.getByRole('button', { name: /حفظ|Save/ }).click();
    await expect.poll(() => page.evaluate(() => (window as any).nmShell.state.dirty)).toBe(false);
    expect(readFileSync(srv.deckPath, 'utf8')).toMatch(/عنوان عربي<br\s*\/?>بسطر ثان/);
  });

  test('Escape cancels and rich paste is inserted as plain text', async ({ page, srv }) => {
    const frame = await openShell(page, srv);
    const selector = '.slide[data-nm-current] h1, .slide[data-nm-current] h2';
    const original = await frame.locator(selector).first().textContent();
    await clickFrameElement(page, frame, selector, 2);
    const active = frame.locator('[contenteditable="plaintext-only"]');
    await active.press('ControlOrMeta+A');
    await active.evaluate((el) => {
      const dt = new DataTransfer();
      dt.setData('text/plain', 'نص ملصوق');
      dt.setData('text/html', '<b style="color:red">نص ملصوق</b>');
      el.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }));
    });
    expect(await active.innerHTML()).toBe('نص ملصوق');
    await active.press('Escape');
    expect(await frame.locator(selector).first().textContent()).toBe(original);
    expect(await page.evaluate(() => (window as any).nmShell.state.dirty)).toBe(false);
  });
});

mechanisticTest('a deck with no data-edit attributes is fully text editable with a minimal saved diff', async ({ page, srv }) => {
  const before = readFileSync(srv.deckPath, 'utf8');
  expect(before).not.toContain('data-edit=');
  const frame = await openShell(page, srv);
  const target = '.slide[data-nm-current] h1, .slide[data-nm-current] h2, .slide[data-nm-current] p';
  await clickFrameElement(page, frame, target, 2);
  await expect.poll(() => frame.evaluate(() => (window as any).__nm.activeText()?.key ?? null)).not.toBeNull();
  const key = await frame.evaluate(() => (window as any).__nm.activeText().key as string);
  const active = frame.locator(`[data-nm-key="${key}"][contenteditable="plaintext-only"]`);
  await expect(active).toHaveCount(1);
  await active.press('ControlOrMeta+A');
  await active.fill('نص ميكانيكي محرر');
  await active.press('ControlOrMeta+Enter');
  await expect.poll(() => page.evaluate(() => (window as any).nmShell.state.dirty)).toBe(true);
  await page.getByRole('button', { name: /حفظ|Save/ }).click();
  await expect.poll(() => page.evaluate(() => (window as any).nmShell.state.dirty)).toBe(false);
  const after = readFileSync(srv.deckPath, 'utf8');
  expect(after).toContain('نص ميكانيكي محرر');
  const changed = before.split('\n').filter((line, i) => line !== after.split('\n')[i]);
  expect(changed.length).toBeLessThanOrEqual(2);
});
