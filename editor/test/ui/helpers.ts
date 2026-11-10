import { test as base, type Frame, type Page } from '@playwright/test';
import { ATTENTION } from '../helpers.ts';
import { startTest, type TestServer } from '../server/helpers.ts';

export const test = base.extend<{ srv: TestServer }>({
  srv: async ({}, use) => {
    const server = await startTest(ATTENTION);
    await use(server);
    await server.close();
  },
});

export async function openShell(page: Page, srv: TestServer, viewport = { width: 1440, height: 900 }): Promise<Frame> {
  await page.setViewportSize(viewport);
  await page.goto(srv.url);
  await page.waitForFunction(() => {
    const frame = document.querySelector<HTMLIFrameElement>('#frame');
    return (window as any).nmShell?.state && (frame?.contentWindow as any)?.__nm;
  });
  await page.evaluate(() => (window as any).nmShell.ready);
  const frame = page.frame({ name: 'nm-preview' });
  if (!frame) throw new Error('main preview frame did not load');
  await frame.evaluate(() => document.fonts.ready);
  return frame;
}

export async function clickStagePoint(page: Page, x: number, y: number, count = 1): Promise<void> {
  const stage = await page.locator('.stage').boundingBox();
  if (!stage) throw new Error('stage is not visible');
  const zoom = await page.evaluate(() => (window as any).nmShell.zoom as number);
  await page.mouse.click(stage.x + x * zoom, stage.y + y * zoom, { clickCount: count });
}

export async function clickFrameElement(page: Page, frame: Frame, selector: string, count = 1): Promise<string> {
  const hit = await frame.locator(selector).first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { key: el.getAttribute('data-nm-key') ?? '', x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await clickStagePoint(page, hit.x, hit.y, count);
  return hit.key;
}

export async function shellSelection(page: Page): Promise<string | null> {
  return page.evaluate(() => (window as any).nmShell.signals.selection.value as string | null);
}
