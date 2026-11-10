import { readFileSync } from 'node:fs';
import { expect } from '@playwright/test';
import { openShell, test } from './helpers.ts';

test('Phase 6 full properties, layers, and image replacement write through to source', async ({ page, srv }) => {
  const frame = await openShell(page, srv, { width: 1600, height: 1000 });
  const imageKey = await frame.locator('.slide[data-nm-current] img[data-nm-key]').first().getAttribute('data-nm-key');
  expect(imageKey).toBeTruthy();
  await page.evaluate((key) => (window as any).nmShell.select(key), imageKey);

  await page.getByLabel(/الحشو|Padding/).fill('24');
  await page.getByLabel(/استدارة الحواف|Corner radius/).fill('18');
  await page.getByLabel(/سُمك الحد|Border width/).fill('3');
  await page.getByLabel(/الظل|Shadow/).selectOption('lg');
  await page.getByRole('button', { name: /ملء الإطار|Fill frame/ }).click();
  await page.getByRole('slider', { name: /نقطة التركيز الأفقية|Horizontal focal point/ }).fill('70');
  await page.getByRole('slider', { name: /نقطة التركيز الرأسية|Vertical focal point/ }).fill('20');
  await page.getByLabel(/استبدال الصورة|Replace image/).setInputFiles({
    name: 'phase6.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
  });

  await expect.poll(() => frame.locator(`[data-nm-key="${imageKey}"]`).getAttribute('src')).toBe('assets/phase6.png');
  await page.getByRole('tab', { name: /الطبقات|Layers/ }).click();
  const row = page.locator(`.layer-row:has([data-key="${imageKey}"])`);
  await row.getByRole('button', { name: /أخفِ الطبقة|Hide layer/ }).click();
  await expect.poll(() => frame.locator(`[data-nm-key="${imageKey}"]`).getAttribute('class')).toContain('hidden');
  await row.getByRole('button', { name: /أظهر الطبقة|Show layer/ }).click();
  await expect.poll(() => frame.locator(`[data-nm-key="${imageKey}"]`).getAttribute('class')).not.toContain('hidden');
  const reorderKey = await frame.evaluate(() => {
    const slide = document.querySelector('.slide[data-nm-current]')!;
    return Array.from(slide.querySelectorAll<HTMLElement>('[data-nm-key]')).find((node) => {
      if (!node.parentElement) return false;
      const siblings = Array.from(node.parentElement.children).filter((child) => child.hasAttribute('data-nm-key'));
      return siblings.length > 1 && siblings.indexOf(node) < siblings.length - 1;
    })?.getAttribute('data-nm-key') ?? null;
  });
  expect(reorderKey).toBeTruthy();
  await page.evaluate((key) => (window as any).nmShell.select(key), reorderKey);
  const beforeReorder = await page.evaluate(() => (window as any).nmShell.version);
  await page.locator(`.layer-row:has([data-key="${reorderKey}"])`).getByRole('button', { name: /ارفع الطبقة|Move layer up/ }).click();
  await expect.poll(() => page.evaluate(() => (window as any).nmShell.version)).toBeGreaterThan(beforeReorder);

  await page.getByRole('button', { name: /حفظ|Save/ }).click();
  await expect.poll(() => page.evaluate(() => (window as any).nmShell.state.dirty)).toBe(false);
  const source = readFileSync(srv.deckPath, 'utf8');
  expect(source).toContain('p-[24px]');
  expect(source).toContain('rounded-[18px]');
  expect(source).toContain('border-[3px]');
  expect(source).toContain('shadow-lg');
  expect(source).toContain('object-[70%_20%]');
  expect(source).toContain('src="assets/phase6.png"');
});

test('Phase 6 fihris adds, duplicates, reorders, and deletes slides', async ({ page, srv }) => {
  await openShell(page, srv, { width: 1600, height: 1000 });
  const count = () => page.evaluate(() => (window as any).nmShell.state.info.slides.length as number);
  const initial = await count();

  await page.getByTestId('add-slide').click();
  await expect(page.getByTestId('layout-picker').locator('[data-preset]')).toHaveCount(23);
  await page.getByTestId('layout-picker').locator('[data-preset="opening/offset-marquee"]').click();
  await expect.poll(count).toBe(initial + 1);

  await page.getByRole('button', { name: /نسخ الشريحة|Duplicate slide/ }).click();
  await expect.poll(count).toBe(initial + 2);
  await page.getByRole('button', { name: /حرّك الشريحة إلى السابق|Move slide earlier/ }).click();
  await expect.poll(() => page.evaluate(() => (window as any).nmShell.current)).toBe(initial);
  await page.getByRole('button', { name: /حذف الشريحة|Delete slide/ }).click();
  await expect.poll(count).toBe(initial + 1);

  await page.getByRole('button', { name: /حفظ|Save/ }).click();
  await expect.poll(() => page.evaluate(() => (window as any).nmShell.state.dirty)).toBe(false);
  expect(readFileSync(srv.deckPath, 'utf8').match(/<section\b[^>]*\bslide\b/g)).toHaveLength(initial + 1);
});
