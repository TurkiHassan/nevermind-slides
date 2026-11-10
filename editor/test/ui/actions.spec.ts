import { readFileSync, writeFileSync } from 'node:fs';
import { expect } from '@playwright/test';
import { EditorDocument } from '../../src/engine/document.ts';
import { openShell, test } from './helpers.ts';

test.describe('save, history, dirty count, conflict and language', () => {
  test('one-line op enables undo; undo reverts; save clears dirty', async ({ page, srv }) => {
    const frame = await openShell(page, srv);
    const key = await frame.locator('.slide[data-nm-current] h1, .slide[data-nm-current] h2').first().getAttribute('data-nm-key');
    expect(key).toBeTruthy();

    await page.evaluate((id) => (window as any).nmShell.postOps([{ kind: 'setAttr', id, name: 'data-phase-2b', value: 'one' }], { label: 'one line' }), key);
    await expect(page.locator('[data-testid="dirty-pill"]')).toHaveClass(/is-dirty/);
    await expect(page.locator('[data-testid="dirty-count"]')).toHaveText(/[١1]/);
    await expect(page.locator('[data-testid="undo"]')).toBeEnabled();

    await page.locator('[data-testid="undo"]').click();
    await expect.poll(() => frame.locator(`[data-nm-key="${key}"]`).getAttribute('data-phase-2b')).toBeNull();
    await expect(page.locator('[data-testid="dirty-pill"]')).not.toHaveClass(/is-dirty/);

    await page.evaluate((id) => (window as any).nmShell.postOps([{ kind: 'setAttr', id, name: 'data-phase-2b', value: 'saved' }], { label: 'save check' }), key);
    await page.locator('[data-testid="save"]').click();
    await expect(page.locator('[data-testid="dirty-pill"]')).not.toHaveClass(/is-dirty/);
    expect(readFileSync(srv.deckPath, 'utf8')).toContain('data-phase-2b="saved"');
  });

  test('refuses save during a disk conflict and can reapply local edits', async ({ page, srv }) => {
    const frame = await openShell(page, srv);
    const key = await frame.locator('.slide[data-nm-current] h1, .slide[data-nm-current] h2').first().getAttribute('data-nm-key');
    await page.evaluate((id) => (window as any).nmShell.postOps([{ kind: 'setAttr', id, name: 'data-local', value: 'kept' }], { label: 'local marker' }), key);

    const before = readFileSync(srv.deckPath, 'utf8');
    writeFileSync(srv.deckPath, before.replace('ورقة تأسيسية · NeurIPS ٢٠١٧', 'ورقة عدّلها الوكيل · NeurIPS ٢٠١٧'));
    await expect(page.locator('[data-testid="conflict-banner"]')).toBeVisible();

    await page.locator('[data-testid="save"]').click();
    await expect(page.locator('[data-testid="conflict-banner"]')).toHaveAttribute('data-refused', '');
    await page.locator('[data-testid="resolve-reapply"]').click();
    await expect(page.locator('[data-testid="conflict-banner"]')).toHaveCount(0);
    await expect.poll(() => frame.locator(`[data-nm-key="${key}"]`).getAttribute('data-local')).toBe('kept');
    expect(readFileSync(srv.deckPath, 'utf8')).toContain('ورقة عدّلها الوكيل');
  });

  test('switching language preserves slide, selection and zoom', async ({ page, srv }) => {
    const frame = await openShell(page, srv);
    await page.evaluate(() => {
      (window as any).nmShell.goTo(2);
      (window as any).nmShell.signals.zoomMode.value = 0.67;
    });
    const key = await frame.locator('.slide[data-nm-current] h1, .slide[data-nm-current] h2').first().getAttribute('data-nm-key');
    await page.evaluate((id) => (window as any).nmShell.select(id), key);
    const before = await page.evaluate(() => ({ current: (window as any).nmShell.current, selection: (window as any).nmShell.signals.selection.value, zoom: (window as any).nmShell.zoom }));

    await page.locator('[data-testid="lang"]').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    const after = await page.evaluate(() => ({ current: (window as any).nmShell.current, selection: (window as any).nmShell.signals.selection.value, zoom: (window as any).nmShell.zoom }));
    expect(after).toEqual(before);
  });

  test('reports a labelled local operation that cannot be replayed', async ({ page, srv }) => {
    const frame = await openShell(page, srv);
    const key = await frame.locator('[data-edit="s1-title"]').getAttribute('data-nm-key');
    await page.evaluate((id) => (window as any).nmShell.postOps(
      [{ kind: 'setAttr', id, name: 'data-local', value: 'lost' }],
      { label: 'تعديل العنوان المحذوف' },
    ), key);

    const external = EditorDocument.fromText(readFileSync(srv.deckPath, 'utf8'));
    const title = external.doc.query({ attr: 'data-edit=s1-title' })[0];
    external.apply([{ kind: 'remove', id: title.id }], { label: 'agent removal' });
    writeFileSync(srv.deckPath, external.text);
    await expect(page.locator('[data-testid="conflict-banner"]')).toBeVisible();
    await page.locator('[data-testid="resolve-reapply"]').click();

    await expect(page.locator('[data-testid="banner"][data-kind="resolved"]')).toContainText('تعديل العنوان المحذوف');
  });
});
