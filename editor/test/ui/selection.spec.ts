import { expect } from '@playwright/test';
import { clickFrameElement, clickStagePoint, openShell, shellSelection, test } from './helpers.ts';

test.describe('canvas selection and external refreshes', () => {
  test('a script-created unkeyed element selects its nearest keyed ancestor', async ({ page, srv }) => {
    const frame = await openShell(page, srv);
    const target = await frame.evaluate(() => {
      const heading = document.querySelector<HTMLElement>('.slide[data-nm-current] h1, .slide[data-nm-current] h2')!;
      const child = document.createElement('span');
      child.textContent = 'dynamic';
      child.style.cssText = 'display:inline-block;width:48px;height:48px;color:transparent;background:transparent';
      heading.appendChild(child);
      const r = child.getBoundingClientRect();
      return { key: heading.getAttribute('data-nm-key'), x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });

    await clickStagePoint(page, target.x, target.y);
    await expect.poll(() => shellSelection(page)).toBe(target.key);
  });

  test('double click descends one keyed level and Escape returns to the parent', async ({ page, srv }) => {
    const frame = await openShell(page, srv);
    const path = await frame.locator('.slide[data-nm-current] h1, .slide[data-nm-current] h2').first().evaluate((heading) => ({
      child: heading.getAttribute('data-nm-key'),
      parent: heading.parentElement?.getAttribute('data-nm-key'),
    }));
    expect(path.parent).toBeTruthy();
    await page.evaluate((key) => (window as any).nmShell.select(key), path.parent);
    await clickFrameElement(page, frame, '.slide[data-nm-current] h1, .slide[data-nm-current] h2', 2);
    await expect.poll(() => shellSelection(page)).toBe(path.child);
    await page.keyboard.press('Escape');
    await expect.poll(() => shellSelection(page)).toBe(path.parent);
  });

  test('selection survives an external change elsewhere and clears when its element is removed', async ({ page, srv }) => {
    const frame = await openShell(page, srv);
    const keys = await frame.evaluate(() => {
      const slide = document.querySelector('.slide[data-nm-current]')!;
      const selected = slide.querySelector('h1, h2')!;
      const other = Array.from(slide.querySelectorAll('[data-nm-key]')).find((el) => el !== selected && !el.contains(selected) && !selected.contains(el))!;
      return { selected: selected.getAttribute('data-nm-key')!, other: other.getAttribute('data-nm-key')! };
    });
    await page.evaluate((key) => (window as any).nmShell.select(key), keys.selected);

    expect((await srv.ops([{ kind: 'setAttr', id: keys.other, name: 'data-phase-2b', value: 'external' }])).status).toBe(200);
    await expect.poll(() => frame.locator(`[data-nm-key="${keys.other}"]`).getAttribute('data-phase-2b')).toBe('external');
    await expect.poll(() => shellSelection(page)).toBe(keys.selected);

    expect((await srv.ops([{ kind: 'remove', id: keys.selected }])).status).toBe(200);
    await expect.poll(() => shellSelection(page)).toBeNull();
    await expect(page.locator('[data-testid="selection-box"]')).toHaveCount(0);
  });
});
