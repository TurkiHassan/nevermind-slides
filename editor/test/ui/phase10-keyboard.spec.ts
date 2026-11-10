// Phase 10 keyboard accessibility audit on the real deck: every control is named, the whole editor is reachable and
// escapable by keyboard, tabs and slides work without a mouse, and nothing traps focus.
import { readFileSync } from 'node:fs';
import { expect } from '@playwright/test';
import { clickFrameElement, openShell, test } from './helpers.ts';

async function unnamedControls(page: import('@playwright/test').Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const nameOf = (el: HTMLElement) => {
      const labelledby = el.getAttribute('aria-labelledby');
      const byId = labelledby ? labelledby.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ') : '';
      const labels = (el as HTMLInputElement).labels ? Array.from((el as HTMLInputElement).labels ?? []).map((l) => l.textContent ?? '').join(' ') : '';
      return (el.getAttribute('aria-label') ?? byId ?? '').trim() || labels.trim() || (el.getAttribute('title') ?? '').trim() || (el.textContent ?? '').trim();
    };
    document.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href],[role=tab],[role=slider],[role=button]').forEach((el) => {
      if (el.closest('[hidden],dialog:not([open])') || el.getAttribute('aria-hidden') === 'true') return;
      if (!nameOf(el)) out.push(`${el.tagName.toLowerCase()}.${el.className}`);
    });
    return out;
  });
}

test.describe('Phase 10 keyboard and screen-reader basics', () => {
  test('every control has an accessible name, with and without a selection', async ({ page, srv }) => {
    const frame = await openShell(page, srv);
    expect(await unnamedControls(page)).toEqual([]);
    await clickFrameElement(page, frame, '.slide[data-nm-current] h1');
    expect(await unnamedControls(page)).toEqual([]);
    for (const tab of [/الطبقات|Layers/, /للوكيل|For the agent/]) {
      await page.getByRole('tab', { name: tab }).click();
      expect(await unnamedControls(page)).toEqual([]);
    }
  });

  test('Tab walks the whole editor and comes back to the start: no keyboard trap', async ({ page, srv }) => {
    await openShell(page, srv);
    await page.evaluate(() => { document.body.tabIndex = -1; document.body.focus(); });
    const seen: string[] = [];
    for (let i = 0; i < 120; i++) {
      await page.keyboard.press('Tab');
      seen.push(await page.evaluate(() => { const e = document.activeElement as HTMLElement; return `${e.tagName}|${e.getAttribute('aria-label') ?? e.textContent?.trim().slice(0, 20) ?? ''}`; }));
      if (i > 5 && seen[i] === seen[0]) break;
    }
    expect(seen.slice(1).includes(seen[0])).toBe(true);
    expect(seen).toContain('BUTTON|تصدير العرض');
    expect(seen.some((s) => s.startsWith('BUTTON|حفظ'))).toBe(true);
  });

  test('a keyboard-only user can switch panel tabs and slides', async ({ page, srv }) => {
    await openShell(page, srv);
    const layers = page.getByRole('tab', { name: /الطبقات|Layers/ });
    await layers.focus();
    await page.keyboard.press('Enter');
    await expect(layers).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('tab', { name: /الخصائص|Properties/ }).focus();
    await page.keyboard.press('Space');
    await expect(page.getByRole('tab', { name: /الخصائص|Properties/ })).toHaveAttribute('aria-selected', 'true');
    const before = await page.evaluate(() => (window as any).nmShell.current);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('PageDown');
    expect(await page.evaluate(() => (window as any).nmShell.current)).toBe(before + 1);
    await page.keyboard.press('PageUp');
    expect(await page.evaluate(() => (window as any).nmShell.current)).toBe(before);
  });

  test('Ctrl+S saves a keyboard edit', async ({ page, srv }) => {
    const frame = await openShell(page, srv);
    const key = await clickFrameElement(page, frame, '.slide[data-nm-current] h1');
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => page.evaluate(() => (window as any).nmShell.state.dirty)).toBe(true);
    await page.keyboard.press('ControlOrMeta+s');
    await expect.poll(() => page.evaluate(() => (window as any).nmShell.state.dirty)).toBe(false);
    expect(readFileSync(srv.deckPath, 'utf8')).toContain('translate-x-[1px]');
    expect(key).not.toBe('');
  });
});
