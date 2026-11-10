import { readFileSync } from 'node:fs';
import { expect } from '@playwright/test';
import { test, openShell } from './helpers.ts';

test('Phase 3 property controls write the expected Tailwind utilities', async ({ page, srv }) => {
  const frame = await openShell(page, srv);
  const selected = await frame.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('.slide[data-nm-current] [data-nm-key]'));
    const el = nodes.find((node) => {
      const cs = getComputedStyle(node);
      return (node.textContent ?? '').trim().length > 3 && cs.position === 'absolute' && parseFloat(cs.fontSize) >= 12;
    })!;
    return { key: el.getAttribute('data-nm-key')!, size: parseFloat(getComputedStyle(el).fontSize) };
  });
  await page.evaluate((key) => (window as any).nmShell.select(key), selected.key);
  await expect(page.getByTestId('props')).toHaveAttribute('data-key', selected.key);

  const startVersion = await page.evaluate(() => (window as any).nmShell.version);
  const family = page.getByTestId('font-family');
  const currentFamily = await family.inputValue();
  const familyValues = await family.locator('option').evaluateAll((options) => options.map((o) => (o as HTMLOptionElement).value));
  const chosenFamily = familyValues.find((value) => value !== currentFamily) ?? familyValues[0];
  await family.selectOption(chosenFamily);
  await expect.poll(() => page.evaluate(() => (window as any).nmShell.version)).toBeGreaterThan(startVersion);

  await page.getByRole('button', { name: /عريض|Bold/ }).click();
  await page.getByRole('slider', { name: /ارتفاع السطر|Line height/ }).fill('1.35');
  await page.getByRole('slider', { name: /الشفافية|Opacity/ }).fill('0.65');

  const colour = page.getByTestId('swatches').locator('button:not([aria-pressed="true"])').first();
  const colourToken = await colour.getAttribute('data-token');
  await colour.click();

  const x = page.getByTestId('pos-x');
  const side = await x.getAttribute('data-side');
  const nextX = Number(await x.inputValue()) + 7;
  await x.fill(String(nextX));
  await x.press('Enter');

  const dial = page.getByTestId('dial');
  await dial.press('ArrowUp');
  const expectedSize = Math.min(240, selected.size + 1);

  await expect.poll(() => page.evaluate(() => (window as any).nmShell.state.dirty)).toBe(true);
  await page.getByRole('button', { name: /حفظ|Save/ }).click();
  await expect.poll(() => page.evaluate(() => (window as any).nmShell.state.dirty)).toBe(false);

  const source = readFileSync(srv.deckPath, 'utf8');
  expect(source).toContain(`font-['${chosenFamily.replaceAll(' ', '_')}']`);
  expect(source).toContain('font-bold');
  expect(source).toContain('leading-[1.35]');
  expect(source).toContain('opacity-[0.65]');
  expect(source).toContain(`text-${colourToken}`);
  expect(source).toContain(`${side}-[${nextX}px]`);
  expect(source).toContain(`text-[${expectedSize}px]`);
});
