// The scripted "non-technical user" flow: change a title, move an image, save. It uses only what is on screen: real
// mouse and keyboard input and role/name locators, no test ids, no nmShell, no instructions. Arabic UI, real deck.
import { readFileSync } from 'node:fs';
import { expect, test as base } from '@playwright/test';
import { ATTENTION } from '../helpers.ts';
import { startTest, type TestServer } from '../server/helpers.ts';

const test = base.extend<{ srv: TestServer }>({
  srv: async ({}, use) => {
    const server = await startTest(ATTENTION);
    await use(server);
    await server.close();
  },
});

test('a first-time user changes a title, moves an image and saves, and only those two things change in the file', async ({ page, srv }) => {
  const before = readFileSync(srv.deckPath, 'utf8');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(srv.url);

  const save = page.getByRole('button', { name: 'حفظ', exact: true });
  const stage = page.frameLocator('iframe').first();
  await expect(stage.locator('.slide.active h1').first()).toBeVisible();
  await expect(save).toHaveAttribute('aria-disabled', 'true');

  // 1. Change the title: double-click it, select everything, type, click away.
  const title = stage.locator('.slide.active h1').first();
  const t = await title.boundingBox();
  await page.mouse.dblclick(t!.x + t!.width / 2, t!.y + t!.height / 2);
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('عنوان جديد للعرض');
  await page.mouse.click(30, 450); // empty margin of the canvas well
  // The cover title is two independently styled lines; double-clicking edits the line under the pointer.
  await expect(title.locator('span').first()).toHaveText('عنوان جديد للعرض');
  await expect(title.locator('span').nth(1)).toHaveText('هو كل ما تحتاجه');
  await expect(page.getByText('غير محفوظ')).toBeVisible();

  // 2. Go to the second slide from the thumbnails, then move its image: click it, then drag it.
  // (On the cover the image sits under a decorative gradient layer, so a click selects the layer, not the picture.)
  await page.getByRole('button', { name: /طابور لا ينتهي/ }).click();
  const image = stage.locator('.slide.active img').first();
  await expect(image).toBeVisible();
  const box0 = await image.boundingBox();
  await page.mouse.click(box0!.x + box0!.width / 2, box0!.y + box0!.height / 2);
  const moved0 = await image.boundingBox();
  await page.mouse.move(moved0!.x + moved0!.width / 2, moved0!.y + moved0!.height / 2);
  await page.mouse.down();
  await page.mouse.move(moved0!.x + moved0!.width / 2 + 60, moved0!.y + moved0!.height / 2 + 24, { steps: 10 });
  await page.mouse.up();
  await expect.poll(async () => Math.round((await image.boundingBox())!.x - box0!.x)).toBeGreaterThan(20);

  // 3. Save.
  await expect(save).not.toHaveAttribute('aria-disabled', 'true');
  await save.click();
  await expect(page.getByText('محفوظ', { exact: true })).toBeVisible();

  const after = readFileSync(srv.deckPath, 'utf8');
  expect(after).toContain('عنوان جديد للعرض');
  const oldLines = before.split('\n');
  const newLines = after.split('\n');
  const changed = newLines.filter((line, i) => line !== oldLines[i]);
  // The saved diff is small and touches only the title text and the image's position.
  expect(newLines.length).toBe(oldLines.length);
  expect(changed.length).toBeGreaterThanOrEqual(2);
  expect(changed.length).toBeLessThanOrEqual(4);
  expect(changed.some((line) => line.includes('عنوان جديد للعرض'))).toBe(true);
  expect(changed.filter((line) => !line.includes('عنوان جديد للعرض')).every((line) => /translate|left-\[|top-\[|right-\[|bottom-\[|<img|visual-frame/.test(line))).toBe(true);
});
