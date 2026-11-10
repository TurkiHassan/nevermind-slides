import { expect, test } from '@playwright/test';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ATTENTION, MECHANISTIC, ROOT } from '../helpers.ts';
import { tempDeck } from '../server/helpers.ts';

const DIST = join(ROOT, 'dist', 'nm-studio.mjs');
let loneBundle = '';

test.beforeAll(() => {
  const built = spawnSync(process.execPath, [join(ROOT, 'scripts', 'build.mjs')], { cwd: ROOT, encoding: 'utf8' });
  expect(built.status, built.stderr).toBe(0);
  const empty = mkdtempSync(join(tmpdir(), 'nm-phase2b-bundle-'));
  loneBundle = join(empty, 'nm-studio.mjs');
  copyFileSync(DIST, loneBundle);
});

async function startBundle(deckPath: string): Promise<{ child: ChildProcess; url: string; close(): Promise<void> }> {
  const child = spawn(process.execPath, [loneBundle, 'edit', deckPath, '--no-open', '--port', '0'], {
    cwd: join(loneBundle, '..'), stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stderr!.on('data', (chunk) => { stderr += chunk; });
  const url = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`bundle did not start: ${stderr}`)), 15_000);
    child.stdout!.on('data', (chunk) => {
      stdout += chunk;
      const match = /"url"\s*:\s*"([^"]+)"/.exec(stdout);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
    child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`bundle exited ${code}: ${stderr}`)); });
  });
  return {
    child,
    url,
    close: async () => {
      if (child.exitCode !== null) return;
      child.kill('SIGINT');
      await new Promise<void>((resolve) => child.once('exit', () => resolve()));
    },
  };
}

function allNodes(root: any): any[] {
  const out: any[] = [];
  const walk = (node: any) => { out.push(node); for (const child of node.children ?? []) walk(child); };
  walk(root);
  return out;
}

for (const deck of [
  { name: 'attention', rel: ATTENTION },
  { name: 'mechanistic', rel: MECHANISTIC },
]) {
  test(`built bundle edits ${deck.name}, preserves selection across external CLI apply`, async ({ page }) => {
    const temp = tempDeck(deck.rel);
    const server = await startBundle(temp.deckPath);
    try {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(server.url);
      await page.waitForFunction(() => (window as any).nmShell?.state && ((document.querySelector('#frame') as HTMLIFrameElement)?.contentWindow as any)?.__nm);
      await page.evaluate(() => (window as any).nmShell.ready);
      await page.evaluate(() => (window as any).nmShell.goTo(2));
      const frame = page.frame({ name: 'nm-preview' })!;
      const selected = await frame.locator('.slide[data-nm-current] h1, .slide[data-nm-current] h2').first().getAttribute('data-nm-key');
      expect(selected).toBeTruthy();
      await page.evaluate((key) => (window as any).nmShell.select(key), selected);

      const inspected = spawnSync(process.execPath, [loneBundle, 'inspect', temp.deckPath, '--slide', '3', '--depth', '8'], { encoding: 'utf8' });
      expect(inspected.status, inspected.stderr).toBe(0);
      const nodes = allNodes(JSON.parse(inspected.stdout).outline);
      const target = nodes.find((node) => node.id && !['section', 'h1', 'h2'].includes(node.tag));
      expect(target).toBeTruthy();
      const opsPath = join(temp.dir, 'phase2b-gate-ops.json');
      writeFileSync(opsPath, JSON.stringify({ label: 'Phase 2b external gate', ops: [{ kind: 'setAttr', id: target.id, name: 'data-phase2b-gate', value: 'external' }] }));
      const applied = spawnSync(process.execPath, [loneBundle, 'apply', temp.deckPath, opsPath], { encoding: 'utf8' });
      expect(applied.status, applied.stderr).toBe(0);

      await expect.poll(() => frame.locator('[data-phase2b-gate="external"]').count()).toBe(1);
      await expect.poll(() => page.evaluate(() => (window as any).nmShell.signals.selection.value)).toBe(selected);

      mkdirSync('test-results/ui', { recursive: true });
      await page.screenshot({ path: `test-results/ui/gate-${deck.name}-ar-1440.png`, fullPage: true });
      await page.setViewportSize({ width: 1280, height: 800 });
      await expect(page.locator('.fihris')).toHaveClass(/compact/);
      await page.screenshot({ path: `test-results/ui/gate-${deck.name}-ar-1280.png`, fullPage: true });

      if (deck.name === 'attention') {
        await page.locator('[data-testid="lang"]').click();
        await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
        await page.screenshot({ path: 'test-results/ui/gate-attention-en-1280.png', fullPage: true });
      }
    } finally {
      await server.close();
    }
  });
}
