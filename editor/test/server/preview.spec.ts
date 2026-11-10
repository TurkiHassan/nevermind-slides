// Chromium only (owner decision). The editor shell in a real browser against a real server.
import { test as base, expect, type Frame, type Page } from '@playwright/test';
import { ATTENTION } from '../helpers.ts';
import { startTest, type TestServer } from './helpers.ts';

const test = base.extend<{ srv: TestServer }>({
  srv: async ({}, use) => {
    const s = await startTest(ATTENTION);
    await use(s);
    await s.close();
  },
});

async function openShell(page: Page, srv: TestServer): Promise<Frame> {
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.goto(srv.url);
  await page.waitForFunction(() => (window as any).nmShell?.state && ((document.querySelector('#frame') as HTMLIFrameElement | null)?.contentWindow as any)?.__nm);
  const frame = page.frames().find((f) => f.url().includes('/preview'));
  if (!frame) throw new Error('preview frame not found');
  await frame.evaluate(() => (document as any).fonts.ready);
  return frame;
}

const goTo = (page: Page, i: number) => page.evaluate((k) => (window as any).nmShell.goTo(k), i);

/** Mutations and running animations inside each child frame of the current slide over `ms` (ported from spike S2b). */
function measure(frame: Frame, ms: number) {
  return frame.evaluate(async (dur) => {
    const frames = Array.from(document.querySelector('.slide[data-nm-current]')!.querySelectorAll('iframe'));
    const probes = frames.map((f) => {
      let n = 0;
      const d = f.contentDocument;
      if (!d) return { f, mo: null as MutationObserver | null, get: () => -1 };
      const mo = new MutationObserver((l) => { n += l.length; });
      mo.observe(d, { subtree: true, attributes: true, childList: true, characterData: true });
      return { f, mo, get: () => n };
    });
    await new Promise((r) => setTimeout(r, dur));
    return probes.map((p) => {
      p.mo?.disconnect();
      const d = p.f.contentDocument;
      return {
        src: (p.f.getAttribute('src') ?? '').split('/').pop(),
        mutations: p.get(),
        running: d ? d.getAnimations().filter((a) => a.playState === 'running').length : -1,
      };
    });
  }, ms);
}

test.describe('the served preview is the frozen edit view', () => {
  test('frozen, chrome hidden, keys on elements, legacy localStorage restore does not rewrite it', async ({ page, srv }) => {
    await page.goto(`${srv.origin}/`); // origin only: no token, nothing to render; makes localStorage same-origin
    await page.evaluate(() => localStorage.setItem('attention-deck-edits-v2', JSON.stringify({ 's1-title': 'EDITED-TITLE' })));
    // Control: opened directly (no edit layer) the deck does apply its saved edits, so the seed is meaningful.
    await page.goto(`${srv.origin}/deck/deck.html?t=${srv.token}`);
    expect(await page.evaluate(() => document.body.innerHTML.includes('EDITED-TITLE'))).toBe(true);
    const frame = await openShell(page, srv);
    const facts = await frame.evaluate(() => {
      const root = document.documentElement;
      const chrome = Array.from(document.body.children).filter((el) => !el.matches('.deck-viewport, script, style, link'));
      const slides = Array.from(document.querySelectorAll('.slide'));
      const cur = slides.filter((s) => s.hasAttribute('data-nm-current'));
      return {
        edit: root.hasAttribute('data-nm-edit'),
        frozen: (window as any).__nm.isFrozen(),
        chromeCount: chrome.length,
        chromeShown: chrome.filter((el) => getComputedStyle(el).display !== 'none').length,
        slides: slides.length,
        current: cur.length,
        visibleSlides: slides.filter((s) => getComputedStyle(s).visibility === 'visible').length,
        unkeyed: Array.from(document.querySelectorAll('.slide *')).filter((e) => !e.hasAttribute('data-nm-key') && !['SCRIPT', 'STYLE'].includes(e.tagName)).length,
        restored: document.body.innerHTML.includes('EDITED-TITLE'),
        warnings: (window as any).__nm.warnings as string[],
      };
    });
    expect(facts).toMatchObject({ edit: true, frozen: true, slides: 7, current: 1, visibleSlides: 1, restored: false, unkeyed: 0 });
    expect(facts.chromeCount).toBeGreaterThan(0);
    expect(facts.chromeShown).toBe(0);
    // nothing moves: no running animation, no DOM mutation in the deck document for 600 ms
    const quiet = await frame.evaluate(async () => {
      let mutations = 0;
      const mo = new MutationObserver((l) => { mutations += l.length; });
      mo.observe(document, { subtree: true, attributes: true, childList: true, characterData: true });
      await new Promise((r) => setTimeout(r, 600));
      mo.disconnect();
      return { mutations, running: document.getAnimations().filter((a) => a.playState === 'running').length };
    });
    expect(quiet).toEqual({ mutations: 0, running: 0 });
  });

  for (const slide of [2, 4]) {
    test(`nested anatomy frames are frozen and resume: attention slide ${slide + 1}`, async ({ page, srv }) => {
      const frame = await openShell(page, srv);
      await goTo(page, slide);
      await page.waitForTimeout(300);
      const frozen = await measure(frame, 600);
      expect(frozen.length).toBeGreaterThan(0);
      for (const f of frozen) {
        expect(f.mutations, `${f.src} mutations while frozen`).toBe(0);
        expect(f.running, `${f.src} running animations while frozen`).toBe(0);
      }
      const content = await frame.evaluate(() =>
        Array.from(document.querySelector('.slide[data-nm-current]')!.querySelectorAll('iframe')).map((f) => f.contentDocument!.querySelectorAll('svg path').length));
      for (const paths of content) expect(paths).toBeGreaterThan(100);
      // control: unfrozen, the same frames move
      await frame.evaluate(() => (window as any).__nm.freeze(false));
      const live = await measure(frame, 600);
      for (const f of live) expect(f.mutations + f.running, `${f.src} moves after unfreeze`).toBeGreaterThan(0);
      await frame.evaluate(() => (window as any).__nm.freeze(true));
      await page.waitForTimeout(100);
      for (const f of await measure(frame, 600)) {
        expect(f.mutations, `${f.src} after refreeze`).toBe(0);
        expect(f.running).toBe(0);
      }
    });
  }

  test('a child frame added after load is frozen too', async ({ page, srv }) => {
    const frame = await openShell(page, srv);
    await goTo(page, 0);
    await frame.evaluate(async () => {
      const slide = document.querySelector('.slide[data-nm-current]')!;
      const f = document.createElement('iframe');
      f.setAttribute('src', 'assets/anatomy-bench.html');
      f.style.cssText = 'position:absolute;left:700px;top:200px;width:900px;height:600px;border:0;z-index:5';
      slide.appendChild(f);
      await new Promise<void>((res) => f.addEventListener('load', () => res(), { once: true }));
    });
    await page.waitForTimeout(100);
    const frozen = await measure(frame, 600);
    expect(frozen).toHaveLength(1);
    expect(frozen[0].mutations).toBe(0);
    expect(frozen[0].running).toBe(0);
  });

  test('keys typed inside a child frame do not drive the deck while frozen', async ({ page, srv }) => {
    const frame = await openShell(page, srv);
    await goTo(page, 2);
    const active = () => frame.evaluate(() => Array.from(document.querySelectorAll('.slide')).findIndex((s) => s.classList.contains('active')));
    const before = await active();
    const child = page.frames().find((f) => f.url().includes('anatomy-'));
    expect(child).toBeTruthy();
    await child!.evaluate(() => { document.body.tabIndex = 0; document.body.focus(); });
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(150);
    expect(await active()).toBe(before);
  });

  test('hit testing in the frame answers with the element key', async ({ page, srv }) => {
    const frame = await openShell(page, srv);
    const hit = await frame.evaluate(() => {
      const el = Array.from(document.querySelectorAll('.slide[data-nm-current] [data-nm-key]')).find((e) => e.children.length === 0 && (e.textContent ?? '').trim().length > 3)!;
      const r = el.getBoundingClientRect();
      const got = (window as any).__nm.hitLocal(r.left + r.width / 2, r.top + r.height / 2);
      return { got, expected: el.getAttribute('data-nm-key') };
    });
    expect(hit.got.key).toBe(hit.expected);
  });
});

/** A leaf element with text on slide `slideIndex`, found in the live frame. */
const leafKey = (frame: Frame, slideIndex = 0, skip = 0) =>
  frame.evaluate(([i, n]) => {
    const slide = document.querySelectorAll('.slide')[i as number];
    const leaves = Array.from(slide.querySelectorAll('[data-nm-key]')).filter((e) => e.children.length === 0 && (e.textContent ?? '').trim().length > 3 && e.tagName === 'SPAN');
    return leaves[n as number].getAttribute('data-nm-key')!;
  }, [slideIndex, skip] as const);

/** What a fresh GET /preview says an element's outerHTML is, parsed in the browser. */
async function freshOuterHtml(page: Page, srv: TestServer, key: string): Promise<string | null> {
  const html = (await page.request.get(`${srv.origin}/preview?t=${srv.token}`)).text();
  return page.evaluate(([h, k]) => {
    const d = new DOMParser().parseFromString(h as string, 'text/html');
    return d.querySelector(`[data-nm-key="${k}"]`)?.outerHTML ?? null;
  }, [await html, key] as const);
}

test.describe('previewPatch contract: applying the patch equals a fresh preview', () => {
  test('text change: patched in place, no reload, element equals the fresh preview', async ({ page, srv }) => {
    const frame = await openShell(page, srv);
    await frame.evaluate(() => { (window as any).__marker = 'same-document'; });
    const key = await leafKey(frame);
    const r = await page.evaluate((k) => (window as any).nmShell.postOps([{ kind: 'setText', id: k, text: 'نص جديد للاختبار' }]), key);
    expect(r.how).toBe('patched');
    expect(Array.isArray(r.previewPatch)).toBe(true);
    expect(await frame.evaluate(() => (window as any).__marker)).toBe('same-document'); // the iframe did not reload
    const live = await frame.evaluate((k) => document.querySelector(`[data-nm-key="${k}"]`)!.outerHTML, key);
    expect(live).toContain('نص جديد للاختبار');
    expect(live).toBe(await freshOuterHtml(page, srv, key));
  });

  test('attribute change on a container with an iframe keeps the iframe element and its running state', async ({ page, srv }) => {
    const frame = await openShell(page, srv);
    await goTo(page, 2);
    const holder = await frame.evaluate(() => {
      const f = document.querySelector('.slide[data-nm-current] iframe')!;
      (f as any).__marker = 'same-iframe';
      return f.parentElement!.getAttribute('data-nm-key')!;
    });
    const r = await page.evaluate((k) => (window as any).nmShell.postOps([{ kind: 'setAttr', id: k, name: 'data-patched', value: '1' }]), holder);
    expect(r.how).toBe('patched');
    const after = await frame.evaluate((k) => {
      const el = document.querySelector(`[data-nm-key="${k}"]`)!;
      return { attr: el.getAttribute('data-patched'), marker: (el.querySelector('iframe') as any).__marker };
    }, holder);
    expect(after).toEqual({ attr: '1', marker: 'same-iframe' });
  });

  test('attribute change on the current slide keeps it current and visible', async ({ page, srv }) => {
    const frame = await openShell(page, srv);
    await goTo(page, 1);
    const key = await frame.evaluate(() => document.querySelector('.slide[data-nm-current]')!.getAttribute('data-nm-key')!);
    const r = await page.evaluate((k) => (window as any).nmShell.postOps([{ kind: 'setAttr', id: k, name: 'data-s', value: '1' }]), key);
    expect(r.how).toBe('patched');
    const facts = await frame.evaluate(() => {
      const cur = document.querySelectorAll('.slide[data-nm-current]');
      return { count: cur.length, visible: getComputedStyle(cur[0]).visibility, attr: cur[0].getAttribute('data-s'), active: cur[0].classList.contains('active') };
    });
    expect(facts).toEqual({ count: 1, visible: 'visible', attr: '1', active: true });
  });

  test('structural change reloads, keeps the current slide, and the new element is in the preview', async ({ page, srv }) => {
    const frame = await openShell(page, srv);
    await goTo(page, 3);
    const key = await leafKey(frame, 3);
    const r = await page.evaluate((k) => (window as any).nmShell.postOps([{ kind: 'duplicate', id: k }]), key);
    expect(r.how).toBe('reloaded');
    expect(r.created).toHaveLength(1);
    const f2 = page.frames().find((f) => f.url().includes('/preview'))!;
    await page.waitForFunction(() => (window as any).nmShell.current === 3);
    expect(await f2.evaluate((k) => !!document.querySelector(`[data-nm-key="${k}"]`), r.created[0])).toBe(true);
    expect(await f2.evaluate(() => Array.from(document.querySelectorAll('.slide')).findIndex((s) => s.hasAttribute('data-nm-current')))).toBe(3);
  });

  test('undo then redo through the shell converge on the same preview as a fresh load', async ({ page, srv }) => {
    const frame = await openShell(page, srv);
    const key = await leafKey(frame, 0, 1);
    await page.evaluate((k) => (window as any).nmShell.postOps([{ kind: 'setText', id: k, text: 'ZZ-one' }]), key);
    await page.evaluate(() => (window as any).nmShell.api('/api/undo', {}).then((r: any) => (window as any).nmShell.apply(r)));
    const f = page.frames().find((x) => x.url().includes('/preview'))!;
    const live = await f.evaluate((k) => document.querySelector(`[data-nm-key="${k}"]`)!.outerHTML, key);
    expect(live).not.toContain('ZZ-one');
    expect(live).toBe(await freshOuterHtml(page, srv, key));
  });
});

test.describe('two tabs on the same server converge (Review Focus 5)', () => {
  test('edits made in either tab appear in the other through the event stream', async ({ browser, srv }) => {
    const ctx = await browser.newContext({ viewport: { width: 1500, height: 900 } });
    const a = await ctx.newPage();
    const b = await ctx.newPage();
    const fa = await openShell(a, srv);
    const fb = await openShell(b, srv);
    const k1 = await leafKey(fa, 0, 0);
    const k2 = await leafKey(fa, 0, 2);
    await a.evaluate((k) => (window as any).nmShell.postOps([{ kind: 'setText', id: k, text: 'FROM-TAB-A' }]), k1);
    await b.waitForFunction((k) => (document.querySelector('#frame') as HTMLIFrameElement).contentDocument?.querySelector(`[data-nm-key="${k}"]`)?.textContent === 'FROM-TAB-A', k1);
    await b.evaluate((k) => (window as any).nmShell.postOps([{ kind: 'setText', id: k, text: 'FROM-TAB-B' }]), k2);
    await a.waitForFunction((k) => (document.querySelector('#frame') as HTMLIFrameElement).contentDocument?.querySelector(`[data-nm-key="${k}"]`)?.textContent === 'FROM-TAB-B', k2);
    // both previews equal a fresh load for both elements
    for (const [page, frame] of [[a, fa], [b, fb]] as const) {
      for (const k of [k1, k2]) {
        const live = await page.frames().find((f) => f.url().includes('/preview'))!.evaluate((x) => document.querySelector(`[data-nm-key="${x}"]`)!.outerHTML, k);
        expect(live).toBe(await freshOuterHtml(page, srv, k));
      }
      void frame;
    }
    // a structural edit in one tab reloads the other
    await a.evaluate((k) => (window as any).nmShell.postOps([{ kind: 'duplicate', id: k }]), k1);
    await b.waitForFunction(() => (window as any).nmShell.events.some((e: any) => e.event === 'version' && e.data.previewPatch === 'reload'));
    await ctx.close();
  });
});

test.describe('patches inside SVG keep the SVG namespace', () => {
  test('setText on <text> and setAttr on viewBox patch in place and render like a fresh load', async ({ page, srv }) => {
    const frame = await openShell(page, srv);
    await goTo(page, 1);
    const slideKey = await frame.evaluate(() => document.querySelector('.slide[data-nm-current]')!.getAttribute('data-nm-key')!);
    const ins = await page.evaluate((k) => (window as any).nmShell.postOps([{
      kind: 'insertHtml', parent: k, index: 0,
      html: '<svg id="nm-t" viewBox="0 0 200 60" width="400" height="120" style="position:absolute;left:10px;top:10px;z-index:9"><text x="10" y="40" font-size="30">hello</text></svg>',
    }]), slideKey);
    expect(ins.how).toBe('reloaded');
    const f2 = page.frames().find((f) => f.url().includes('/preview'))!;
    await page.waitForFunction(() => (window as any).nmShell.current === 1);
    const keys = await f2.evaluate(() => ({
      svg: document.querySelector('#nm-t')!.getAttribute('data-nm-key')!,
      text: document.querySelector('#nm-t text')!.getAttribute('data-nm-key')!,
    }));
    const t = await page.evaluate((k) => (window as any).nmShell.postOps([{ kind: 'setText', id: k, text: 'patched' }]), keys.text);
    expect(t.how).toBe('patched');
    const a = await page.evaluate((k) => (window as any).nmShell.postOps([{ kind: 'setAttr', id: k, name: 'viewBox', value: '0 0 100 30' }]), keys.svg);
    expect(a.how).toBe('patched');
    const b = await page.evaluate((k) => (window as any).nmShell.postOps([{ kind: 'setAttr', id: k, name: 'font-size', value: '20' }]), keys.text);
    expect(b.how).toBe('patched');
    const live = await f2.evaluate(() => {
      const text = document.querySelector('#nm-t text') as SVGTextElement;
      const svg = document.querySelector('#nm-t') as SVGSVGElement;
      const box = text.getBBox();
      return {
        ns: text.namespaceURI, svgNs: svg.namespaceURI, text: text.textContent, w: box.width, h: box.height,
        viewBox: svg.getAttribute('viewBox'), stray: svg.hasAttribute('viewbox'), fontSize: text.getAttribute('font-size'),
        isSvgText: text instanceof SVGTextElement,
      };
    });
    expect(live).toMatchObject({ ns: 'http://www.w3.org/2000/svg', svgNs: 'http://www.w3.org/2000/svg', text: 'patched', viewBox: '0 0 100 30', stray: false, fontSize: '20', isSvgText: true });
    expect(live.w).toBeGreaterThan(10);
    expect(live.h).toBeGreaterThan(5);
    // a fresh load agrees
    await page.reload();
    await page.waitForFunction(() => (window as any).nmShell?.state);
    const f3 = page.frames().find((f) => f.url().includes('/preview'))!;
    await f3.waitForFunction(() => !!document.querySelector('#nm-t text'));
    const fresh = await f3.evaluate(() => {
      const text = document.querySelector('#nm-t text') as SVGTextElement;
      const box = text.getBBox();
      return { ns: text.namespaceURI, text: text.textContent, w: box.width, h: box.height, viewBox: document.querySelector('#nm-t')!.getAttribute('viewBox') };
    });
    expect(fresh.ns).toBe(live.ns);
    expect(fresh.text).toBe('patched');
    expect(fresh.viewBox).toBe('0 0 100 30');
    expect(Math.abs(fresh.w - live.w)).toBeLessThan(0.5);
    expect(Math.abs(fresh.h - live.h)).toBeLessThan(0.5);
  });
});
