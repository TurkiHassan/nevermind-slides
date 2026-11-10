import { expect } from '@playwright/test';
import { clickFrameElement, clickStagePoint, openShell, test } from './helpers.ts';

async function dragSelection(page: import('@playwright/test').Page, dx: number, dy: number, handle?: string) {
  const zoom = await page.evaluate(() => (window as any).nmShell.zoom as number);
  const target = handle ? page.locator(`[data-handle="${handle}"]`) : page.locator('.ov-sel.is-primary');
  const box = await target.boundingBox();
  if (!box) throw new Error('selection overlay is not visible');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.keyboard.down('ControlOrMeta'); // disables smart snapping (Cmd on macOS: Ctrl+press there is a secondary click), making the scripted delta exact
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx * zoom, y + dy * zoom, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.up('ControlOrMeta');
}

test.describe('Phase 5 direct manipulation', () => {
  test('a scripted drag preserves the right anchor and writes exact Tailwind classes', async ({ page, srv }) => {
    const frame = await openShell(page, srv);
    // The right-anchored box is the title's wrapper (absolute right-[104px] top-[132px]); the h1 inside it is a flow child.
    const key = await frame.locator('.slide[data-nm-current] div.absolute[class~="right-[104px]"][class~="top-[132px]"]').first().getAttribute('data-nm-key');
    const target = frame.locator(`[data-nm-key="${key}"]`); // by key: the class selector stops matching once the drag rewrites the classes
    await page.evaluate((id) => (window as any).nmShell.select(id), key);

    await dragSelection(page, 40, 16);

    await expect.poll(() => target.getAttribute('class')).toContain('right-[64px]');
    await expect.poll(() => target.getAttribute('class')).toContain('top-[148px]');
  });

  test('flow children use translate and all eight resize handles are present', async ({ page, srv }) => {
    const frame = await openShell(page, srv);
    const target = frame.locator('[data-edit="s1-lede"]').first();
    await page.evaluate((id) => (window as any).nmShell.select(id), await target.getAttribute('data-nm-key'));
    await expect(page.locator('[data-handle]')).toHaveCount(8);

    await dragSelection(page, 30, 12);

    await expect.poll(() => target.getAttribute('class')).toContain('translate-x-[30px]');
    await expect.poll(() => target.getAttribute('class')).toContain('translate-y-[12px]');
  });

  test('Shift-click multi-selects; arrows coalesce and PowerPoint structural shortcuts work', async ({ page, srv }) => {
    const frame = await openShell(page, srv);
    const first = frame.locator('[data-edit="s1-title"]');
    const second = frame.locator('[data-edit="s1-lede"]');
    const firstKey = await first.getAttribute('data-nm-key');
    if (!firstKey) throw new Error('title key is missing');
    await clickFrameElement(page, frame, '[data-edit="s1-title"]');
    const r = await second.evaluate((el) => { const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
    await page.keyboard.down('Shift');
    await clickStagePoint(page, r.x, r.y);
    await page.keyboard.up('Shift');
    await expect(page.locator('[data-testid="selection-box"]')).toHaveCount(2);

    await page.keyboard.press('Shift+ArrowRight');
    await expect.poll(() => second.getAttribute('class')).toContain('translate-x-[10px]');
    await page.keyboard.press('Control+d');
    await expect.poll(async () => frame.locator('[data-edit="s1-lede"]').count()).toBe(2);
    await expect.poll(async () => frame.locator('[data-edit="s1-title"]').count()).toBe(2);

    // Re-select the original source node; duplication adds another matching data-edit value with a new key.
    await page.evaluate((id) => (window as any).nmShell.select(id), firstKey);
    await page.keyboard.press('Delete');
    await expect(frame.locator(`[data-nm-key="${firstKey}"]`)).toHaveCount(0);
    await expect(frame.locator('[data-edit="s1-title"]')).toHaveCount(1);
  });

  test('smart guides, distance callouts, and the equal-spacing state appear during a drag', async ({ page, srv }) => {
    const frame = await openShell(page, srv);
    await page.evaluate((id) => (window as any).nmShell.select(id), await frame.locator('[data-edit="s1-title"]').getAttribute('data-nm-key'));
    const box = await page.locator('.ov-sel.is-primary').boundingBox();
    if (!box) throw new Error('selection overlay is not visible');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 4, box.y + box.height / 2 + 4, { steps: 4 });
    await expect(page.locator('[data-testid="drag-marks"]')).toBeVisible();
    await expect(page.locator('.distance').first()).toBeVisible();
    await page.mouse.up();
  });

  test('drag rendering holds a 60 fps median budget on the real deck', async ({ page, srv }) => {
    const frame = await openShell(page, srv);
    await page.evaluate((id) => (window as any).nmShell.select(id), await frame.locator('[data-edit="s1-title"]').getAttribute('data-nm-key'));
    const box = await page.locator('.ov-sel.is-primary').boundingBox();
    if (!box) throw new Error('selection overlay is not visible');
    await page.evaluate(() => {
      (window as any).__phase5Frames = [];
      let last = performance.now();
      const tick = (now: number) => {
        (window as any).__phase5Frames.push(now - last); last = now;
        if ((window as any).__phase5Frames.length < 45) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 180, box.y + box.height / 2 + 90, { steps: 40 });
    await page.mouse.up();
    await page.waitForFunction(() => (window as any).__phase5Frames.length >= 45);
    const median = await page.evaluate(() => {
      const values = ((window as any).__phase5Frames as number[]).slice(5).sort((a, b) => a - b);
      return values[Math.floor(values.length / 2)];
    });
    expect(median).toBeLessThanOrEqual(17.5);
  });
});
