import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from '@playwright/test';
import { parseSource } from '../../src/engine/source.ts';
import { visibleText } from '../../src/engine/text-diff.ts';
import { ROOT } from '../helpers.ts';
import { clickFrameElement, openShell, test } from './helpers.ts';

const CLI = join(ROOT, 'src', 'cli', 'nm-studio.ts');
const cli = (args: string[], input?: string) => spawnSync(process.execPath, [CLI, ...args], { input, encoding: 'utf8' });

test('element and area notes complete the live editor-to-agent loop', async ({ page, srv }) => {
  const frame = await openShell(page, srv);
  const key = await clickFrameElement(page, frame, '.slide[data-nm-current] h1');
  await page.getByRole('tab', { name: /للوكيل|For the agent/ }).click();

  await page.getByTestId('note-text').fill('اجعل العنوان أقصر');
  await page.getByTestId('add-note').click();
  await expect(page.getByTestId('note-row')).toHaveCount(1);
  await expect(page.getByTestId('note-pin')).toHaveCount(1);
  await expect(page.getByTestId('agent-count')).toHaveText(/١|1/);

  const listed = cli(['notes', 'list', srv.deckPath]);
  expect(listed.status).toBe(0);
  const elementNote = JSON.parse(listed.stdout).notes[0];
  expect(elementNote.target).toMatchObject({ kind: 'element', key, slide: 1, tag: 'h1' });

  await page.getByTestId('area-target').click();
  const stage = await page.locator('.stage').boundingBox();
  const zoom = await page.evaluate(() => (window as any).nmShell.zoom as number);
  if (!stage) throw new Error('stage missing');
  await page.mouse.move(stage.x + 120 * zoom, stage.y + 180 * zoom);
  await page.mouse.down();
  await page.mouse.move(stage.x + 480 * zoom, stage.y + 360 * zoom);
  await page.mouse.up();
  await page.getByTestId('note-text').fill('راجع الرسم في هذه المنطقة');
  await page.getByTestId('add-note').click();
  await expect(page.getByTestId('note-row')).toHaveCount(2);
  await expect(page.getByTestId('note-area')).toHaveCount(1);

  await expect.poll(() => {
    const current = JSON.parse(readFileSync(join(srv.dir, '.nevermind', 'current.json'), 'utf8'));
    return current.selection?.key;
  }).toBe(key);

  const source = readFileSync(srv.deckPath, 'utf8');
  const paragraph = parseSource(source).query({ attr: 'data-edit=s1-lede' })[0];
  const applied = cli(['apply', srv.deckPath, '-'], JSON.stringify([{ kind: 'setText', id: paragraph.id, text: 'نفّذ الوكيل التعديل' }]));
  expect(applied.status).toBe(0);
  const appliedSource = readFileSync(srv.deckPath, 'utf8');
  const appliedDoc = parseSource(appliedSource);
  const appliedParagraph = appliedDoc.query({ attr: 'data-edit=s1-lede' })[0];
  expect(visibleText(appliedDoc, appliedParagraph.id)).toBe('نفّذ الوكيل التعديل');
  await expect(frame.locator('[data-edit="s1-lede"]')).toHaveText('نفّذ الوكيل التعديل');

  await frame.evaluate(() => { (window as any).__notesFrameMarker = 'kept'; });
  const done = cli(['notes', 'done', srv.deckPath, elementNote.id]);
  expect(done.status).toBe(0);
  await expect(page.getByTestId('note-row')).toHaveCount(1);
  await expect(page.getByTestId('note-pin')).toHaveCount(1);
  expect(await frame.evaluate(() => (window as any).__notesFrameMarker)).toBe('kept');
});
