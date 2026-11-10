import { expect } from '@playwright/test';
import { clickFrameElement, openShell, shellSelection, test } from './helpers.ts';

test.describe('property readouts and layers', () => {
  test('shows computed values for five real elements', async ({ page, srv }) => {
    const frame = await openShell(page, srv);
    const samples = await frame.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('.slide[data-nm-current] [data-nm-key]'))
      .filter((el) => (el.textContent ?? '').trim() && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0)
      .slice(0, 5)
      .map((el) => {
        const cs = getComputedStyle(el);
        // Typography is read from what carries the visible text: the element if it has its own text node,
        // otherwise its first descendant (document order) that does.
        const ownText = (n: Element) => Array.from(n.childNodes).some((c) => c.nodeType === 3 && (c.textContent ?? '').trim());
        const textHolder = ownText(el) ? el : Array.from(el.querySelectorAll('*')).find(ownText) ?? el;
        return {
          key: el.getAttribute('data-nm-key')!,
          fontSize: Math.round(parseFloat(getComputedStyle(textHolder).fontSize) * 10) / 10,
          opacity: Math.round(Number(cs.opacity) * 100),
          width: el.offsetWidth,
          height: el.offsetHeight,
        };
      }));
    expect(samples).toHaveLength(5);

    for (const sample of samples) {
      await page.evaluate((key) => (window as any).nmShell.select(key), sample.key);
      await expect(page.locator('[data-testid="props"]')).toHaveAttribute('data-key', sample.key);
      expect(Number(await page.locator('[data-testid="font-size"]').textContent())).toBeCloseTo(sample.fontSize, 1);
      expect(Number((await page.locator('[data-testid="opacity"]').textContent())!.replace(/[^0-9.]/g, ''))).toBe(sample.opacity);
      expect(Number(await page.locator('[data-testid="size-w"]').textContent())).toBe(sample.width);
      expect(Number(await page.locator('[data-testid="size-h"]').textContent())).toBe(sample.height);
    }
  });

  test('a layer row selects the same key as clicking the canvas', async ({ page, srv }) => {
    const frame = await openShell(page, srv);
    const key = await clickFrameElement(page, frame, '.slide[data-nm-current] h1, .slide[data-nm-current] h2');
    await expect.poll(() => shellSelection(page)).toBe(key);

    await page.getByRole('tab', { name: /الطبقات|Layers/ }).click();
    const row = page.locator(`[data-testid="layers"] button[data-key="${key}"]`);
    await expect(row).toBeVisible();
    await page.evaluate(() => (window as any).nmShell.select(null));
    await row.click();
    await expect.poll(() => shellSelection(page)).toBe(key);
    await expect(page.locator('[data-testid="selection-box"]')).toHaveAttribute('data-key', key);
  });
});

test('a title made of styled lines reads and edits the lines, not the wrapper', async ({ page, srv }) => {
  const frame = await openShell(page, srv);
  const title = frame.locator('.slide[data-nm-current] [data-edit="s1-title"]');
  const key = await title.getAttribute('data-nm-key');
  const spans = await title.evaluate((h) => Array.from(h.querySelectorAll(':scope > span')).map((s) => ({
    key: s.getAttribute('data-nm-key')!, size: Math.round(parseFloat(getComputedStyle(s).fontSize) * 10) / 10,
  })));
  expect(spans.length).toBe(2);
  await page.evaluate((k) => (window as any).nmShell.select(k), key);
  await expect(page.locator('[data-testid="props"]')).toHaveAttribute('data-key', key!);
  // The wrapper itself computes 16px; the readout must show the first line's real size (192 in this deck).
  expect(Number(await page.locator('[data-testid="font-size"]').textContent())).toBeCloseTo(spans[0].size, 1);
  await expect(page.getByTestId('typo-mixed')).toBeVisible();

  await page.getByRole('button', { name: /^(خفيف|Light)$/ }).click();
  await expect.poll(async () => title.evaluate((h) => Array.from(h.querySelectorAll(':scope > span')).map((s) => s.className))).toEqual(
    expect.arrayContaining([expect.stringContaining('font-light'), expect.stringContaining('font-light')]));
  expect(await title.getAttribute('class')).not.toContain('font-light');
});
