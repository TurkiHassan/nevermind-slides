import { mkdirSync } from 'node:fs';
import { expect } from '@playwright/test';
import { test, openShell } from './helpers.ts';

test.describe('Phase 2b shell composition', () => {
  test('matches the approved Halo fihris composition at 1440x900', async ({ page, srv }) => {
    await openShell(page, srv);
    await expect(page.locator('.masthead')).toBeVisible();
    await expect(page.locator('.well')).toBeVisible();
    await expect(page.locator('.panel')).toBeVisible();
    await expect(page.locator('.fihris')).toBeVisible();
    await expect(page.locator('.fihris')).not.toHaveClass(/compact/);

    mkdirSync('test-results/ui', { recursive: true });
    await page.screenshot({ path: 'test-results/ui/shell-1440.png', fullPage: true });
  });

  test('keeps a 760px slide and separates every region at 1280x800', async ({ page, srv }) => {
    await openShell(page, srv, { width: 1280, height: 800 });
    await expect(page.locator('.fihris')).toHaveClass(/compact/);

    const boxes = await page.evaluate(() => {
      const box = (selector: string) => {
        const r = document.querySelector(selector)!.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
      };
      return { head: box('.masthead'), well: box('.well'), panel: box('.panel'), fihris: box('.fihris'), stage: box('.stage') };
    });
    expect(boxes.stage.width).toBeGreaterThanOrEqual(760);
    expect(boxes.well.right).toBeLessThanOrEqual(boxes.panel.left);
    expect(boxes.well.bottom).toBeLessThanOrEqual(boxes.fihris.top);
    expect(boxes.panel.bottom).toBeLessThanOrEqual(boxes.fihris.top);
    expect(boxes.head.bottom).toBeLessThanOrEqual(Math.min(boxes.well.top, boxes.panel.top));

    mkdirSync('test-results/ui', { recursive: true });
    await page.screenshot({ path: 'test-results/ui/shell-1280.png', fullPage: true });
  });

  test('every keyboard-focusable control has the visible 2px focus ring', async ({ page, srv }) => {
    await openShell(page, srv);
    const count = await page.locator('button:not(:disabled):not([tabindex="-1"])').count();
    await page.evaluate(() => { document.body.tabIndex = -1; document.body.focus(); });
    const visited = new Set<string>();

    for (let i = 0; i < count + 2; i++) {
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        const all = Array.from(document.querySelectorAll('button:not(:disabled):not([tabindex="-1"])'));
        const cs = getComputedStyle(el);
        return { tag: el.tagName, index: all.indexOf(el as HTMLButtonElement), outline: cs.outlineWidth, style: cs.outlineStyle };
      });
      if (focused.tag !== 'BUTTON') continue;
      expect(focused.outline).toBe('2px');
      expect(focused.style).not.toBe('none');
      visited.add(String(focused.index));
    }
    expect(visited.size).toBe(count);
  });

  test('loads visible fihris thumbnails lazily and records their cost', async ({ page, srv }, testInfo) => {
    const heapBefore = await page.evaluate(() => (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null);
    await openShell(page, srv);
    const visible = page.locator('.tile .thumb');
    await expect.poll(async () => visible.evaluateAll((nodes) => nodes.filter((n) => n.getBoundingClientRect().right > 0 && n.getBoundingClientRect().left < innerWidth && n.classList.contains('ready')).length)).toBeGreaterThan(0);
    const stats = await page.evaluate(() => (window as any).nmShell.thumbStats as { firstRequest: number; lastReady: number; loads: number });
    const heapAfter = await page.evaluate(() => (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null);
    expect(stats.loads).toBeGreaterThan(0);
    expect(stats.lastReady - stats.firstRequest).toBeLessThan(1500);
    await testInfo.attach('fihris-metrics.json', {
      body: Buffer.from(JSON.stringify({
        visibleLoadMs: stats.lastReady - stats.firstRequest,
        loads: stats.loads,
        heapBefore,
        heapAfter,
        heapDelta: heapBefore === null || heapAfter === null ? null : heapAfter - heapBefore,
      }, null, 2)),
      contentType: 'application/json',
    });
  });
});
