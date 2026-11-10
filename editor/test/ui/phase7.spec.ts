import { readFileSync } from 'node:fs';
import { expect } from '@playwright/test';
import { openShell, test } from './helpers.ts';

test('Phase 7 edits and previews motion while a legacy deck receives the runtime contract', async ({ page, srv }) => {
  const frame = await openShell(page, srv, { width: 1600, height: 1000 });
  expect(await page.evaluate(() => (window as any).nmShell.state.info.runtime)).toEqual({ version: null, native: false });
  expect(await frame.evaluate(() => ({
    goTo: typeof (window as any).deck?.goTo,
    setEditMode: typeof (window as any).deck?.setEditMode,
    version: (window as any).deck?.runtimeVersion,
  }))).toEqual({ goTo: 'function', setEditMode: 'function', version: 1 });

  const titleKey = await frame.locator('.slide[data-nm-current] h1[data-nm-key]').first().getAttribute('data-nm-key');
  expect(titleKey).toBeTruthy();
  await page.evaluate((key) => (window as any).nmShell.select(key), titleKey);
  await page.getByRole('button', { name: /الحركة|Motion/ }).click();
  await expect(page.getByTestId('motion-panel')).toBeVisible();
  await page.getByLabel(/نوع الدخول|Entrance type/).selectOption('scale');
  await page.getByLabel(/الترتيب|Order/).fill('2');
  await page.getByLabel(/التأخير|Delay/).fill('250');
  await page.getByRole('button', { name: /معاينة الدخول|Preview entrance/ }).click();
  await expect.poll(() => frame.evaluate(() => document.getAnimations().length)).toBeGreaterThan(0);

  await page.getByLabel(/العنصر المقابل|Matching element/).selectOption({ index: 1 });
  await page.getByRole('button', { name: /إنشاء الربط|Create link/ }).click();
  await page.getByRole('button', { name: /إضافة المحدد كخطوة|Add selection as step/ }).click();
  await expect(page.locator('.motion-list li')).toHaveCount(1);
  await page.locator('.motion-list li').getByRole('button', { name: /معاينة|Preview/ }).click();
  await expect(frame.locator('.slide[data-nm-current][data-nm-motion-preview="zoom"]')).toHaveCount(1);

  await page.getByRole('button', { name: /حفظ|Save/ }).click();
  await expect.poll(() => page.evaluate(() => (window as any).nmShell.state.dirty)).toBe(false);
  const source = readFileSync(srv.deckPath, 'utf8');
  expect(source).toContain('data-entrance="scale"');
  expect(source).toContain('data-entrance-order="2"');
  expect(source).toContain('data-entrance-delay="250"');
  expect(source).toMatch(/data-morph="morph-1-\d+"/);
  expect(source).toContain('data-zoom-step="1"');
});

test('Phase 7 edits identity and treats iframe anatomy as one recolourable smart object', async ({ page, srv }) => {
  const frame = await openShell(page, srv, { width: 1600, height: 1000 });
  await page.getByRole('button', { name: /الهوية|Identity/ }).click();
  const colour = page.getByTestId('identity-panel').locator('input[type="color"]').first();
  await expect(colour).toBeVisible();
  await colour.evaluate((input: HTMLInputElement) => {
    input.value = '#123456';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const bodyFont = page.getByLabel(/خط النص|Body font/);
  if (await bodyFont.locator('option').count() > 1) await bodyFont.selectOption({ index: 1 });
  // Identity edits touch <head> and reload the preview; query the frame only after those reloads have finished.
  await page.evaluate(() => (window as any).nmShell.settled());

  const anatomyFrame = frame.locator('iframe[src*="anatomy"][data-nm-key]');
  await expect(anatomyFrame).toHaveCount(2);
  const anatomy = await anatomyFrame.first().evaluate((iframe) => {
    const slides = Array.from(document.querySelectorAll('.slide'));
    return { key: iframe.getAttribute('data-nm-key'), slide: slides.findIndex((item) => item.contains(iframe)) };
  });
  expect(anatomy?.key).toBeTruthy();
  await page.evaluate((value) => {
    (window as any).nmShell.goTo(value.slide);
    (window as any).nmShell.select(value.key);
  }, anatomy!);
  await page.getByRole('button', { name: /الحركة|Motion/ }).click();
  const anatomyColour = page.getByTestId('anatomy-controls').locator('input[type="color"]').first();
  await expect(anatomyColour).toBeVisible();
  const variable = await anatomyColour.evaluate((input) => input.parentElement?.textContent?.trim() ?? '');
  await anatomyColour.evaluate((input: HTMLInputElement) => {
    input.value = '#654321';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect.poll(() => frame.evaluate(({ key, variable }) => {
    const host = document.querySelector<HTMLElement>(`[data-nm-key="${key}"]`);
    return host?.style.getPropertyValue(variable).trim();
  }, { key: anatomy!.key, variable })).toBe('#654321');

  await page.getByRole('button', { name: /حفظ|Save/ }).click();
  await expect.poll(() => page.evaluate(() => (window as any).nmShell.state.dirty)).toBe(false);
  const source = readFileSync(srv.deckPath, 'utf8');
  expect(source).toContain('#123456');
  expect(source).toContain(`${variable}: #654321`);
});

test('Phase 7 keeps a value being typed when inspected state refreshes underneath it', async ({ page, srv }) => {
  const frame = await openShell(page, srv, { width: 1600, height: 1000 });
  const titleKey = await frame.locator('.slide[data-nm-current] h1[data-nm-key]').first().getAttribute('data-nm-key');
  expect(titleKey).toBeTruthy();
  await page.evaluate((key) => (window as any).nmShell.select(key), titleKey);
  await page.getByRole('button', { name: /الحركة|Motion/ }).click();
  const delay = page.getByLabel(/التأخير|Delay/);
  await delay.fill('250');
  // Any earlier edit, another tab, or the agent can land a state refresh while the field still has focus.
  await page.evaluate(() => (window as any).nmShell.refresh());
  await expect(delay).toHaveValue('250');
  await delay.blur();
  await page.evaluate(() => (window as any).nmShell.settled());
  const state = await page.evaluate(() => (window as any).nmShell.serverState());
  expect(state.info.entrances.find((item: { key: string }) => item.key === titleKey)).toMatchObject({ delay: 250 });
  await expect(delay).toHaveValue('250');
});
