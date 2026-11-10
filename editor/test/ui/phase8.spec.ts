import { readFileSync } from 'node:fs';
import { expect, test as base } from '@playwright/test';
import { ATTENTION } from '../helpers.ts';
import { startTest, type TestServer } from '../server/helpers.ts';
import { clickFrameElement, openShell } from './helpers.ts';

const test = base.extend<{ srv: TestServer }>({
  srv: async ({}, use) => {
    const server = await startTest(ATTENTION, undefined, {
      agentRunners: {
        text: async ({ selection }) => ({
          summary: 'اختصار العنوان',
          ops: [{ kind: 'setText', id: selection.id, text: 'عنوان من الوكيل' }],
        }),
      },
    });
    await use(server);
    await server.close();
  },
});

test('Phase 8 previews, rejects, accepts, and undoes a selected-element AI change', async ({ page, srv }) => {
  const before = readFileSync(srv.deckPath, 'utf8');
  const frame = await openShell(page, srv);
  await clickFrameElement(page, frame, '.slide[data-nm-current] h1');
  await page.getByRole('tab', { name: /للوكيل|For the agent/ }).click();

  await page.getByTestId('ai-prompt').fill('اختصر العنوان');
  await page.getByTestId('ai-submit').click();
  await expect(page.getByTestId('ai-diff')).toContainText('عنوان من الوكيل');
  expect(readFileSync(srv.deckPath, 'utf8')).toBe(before);
  await page.getByTestId('ai-reject').click();
  await expect(page.getByTestId('ai-status')).toContainText(/رُفض|Rejected/);
  expect(readFileSync(srv.deckPath, 'utf8')).toBe(before);
  expect(await page.evaluate(() => (window as any).nmShell.state.dirty)).toBe(false);

  await page.getByTestId('ai-prompt').fill('اختصر العنوان');
  await page.getByTestId('ai-submit').click();
  await expect(page.getByTestId('ai-diff')).toContainText('عنوان من الوكيل');
  await page.getByTestId('ai-accept').click();
  await expect(frame.locator('.slide[data-nm-current] h1')).toContainText('عنوان من الوكيل');
  expect(await page.evaluate(() => (window as any).nmShell.state.canUndo)).toBe(true);

  await page.getByRole('button', { name: /تراجع|Undo/ }).click();
  await expect(frame.locator('.slide[data-nm-current] h1')).not.toContainText('عنوان من الوكيل');
  await expect(page.getByRole('button', { name: /حفظ|Save/ })).toBeDisabled();
  await expect.poll(() => page.evaluate(() => (window as any).nmShell.state.dirty)).toBe(false);
  expect(readFileSync(srv.deckPath, 'utf8')).toBe(before);
});
