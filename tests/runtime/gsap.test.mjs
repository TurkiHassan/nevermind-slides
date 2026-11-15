// The optional GSAP adapter (roadmap NM-17), with a recording stand-in for window.gsap (GSAP itself is not bundled
// or downloaded): one timeline per step, data-at positions on it, only the tweened properties cleared on the way
// back, nothing at nm-speed=0, and a plain fade (with one console warning) when GSAP is absent.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const URL = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), "fixtures", "timing", "deck.html")).href;
const STUB = `window.__tls = []; window.__sets = [];
window.gsap = {
  timeline() { const tl = { calls: [], killed: false, from(el, vars, pos) { this.calls.push({ id: el.id, vars, pos }); return this; }, kill() { this.killed = true; } }; window.__tls.push(tl); return tl; },
  set(el, vars) { window.__sets.push({ id: el.id, vars }); },
};`;
let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

async function open({ stub = true, query = "" } = {}) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const warnings = [];
  page.on("console", (m) => { if (m.type() === "warning") warnings.push(m.text()); });
  if (stub) await page.addInitScript(STUB);
  await page.goto(URL + query + "#/3");
  await page.waitForFunction(() => document.body.classList.contains("nm-ready"));
  await page.evaluate(() => window.NM.test.settle());
  return { page, warnings };
}
const press = (page) => page.evaluate(async () => { window.NM.deck.next(); await window.NM.test.settle(); await new Promise((r) => requestAnimationFrame(() => r())); });

describe("nm-gsap.js", () => {
  it("one timeline per step, data-at as the position, the tween's own settings", async () => {
    const { page } = await open();
    await press(page);
    await press(page);
    const r = await page.evaluate(() => ({ tls: window.__tls.map((t) => ({ calls: t.calls, killed: t.killed })), available: window.NM.gsap.available }));
    assert.equal(r.available, true);
    assert.equal(r.tls.length, 2, "steps 1 and 2 each get a timeline");
    assert.deepEqual(r.tls[0].calls.map((c) => [c.id, c.pos]), [["g1", 0], ["g2", 0.25]]);
    assert.deepEqual(r.tls[0].calls[0].vars, { x: 80, opacity: 0, duration: 0.6, ease: "power2.out", immediateRender: true });
    assert.deepEqual(r.tls[1].calls[0].vars, { opacity: 0, y: 24, duration: 0.6, ease: "power2.out", immediateRender: true }, "defaults");
    await page.close();
  });

  it("stepping back kills the timeline and clears only the tweened properties", async () => {
    const { page } = await open();
    await press(page);
    await page.evaluate(async () => { window.NM.deck.prev(); await window.NM.test.settle(); });
    const r = await page.evaluate(() => ({ killed: window.__tls[0].killed, sets: window.__sets, hidden: getComputedStyle(document.getElementById("g1")).visibility }));
    assert.equal(r.killed, true);
    assert.deepEqual(r.sets.find((s) => s.id === "g1").vars, { clearProps: "x,opacity" });
    assert.equal(r.hidden, "hidden", "the element is hidden again before its step");
    await page.close();
  });

  it("nm-speed=0 never calls GSAP and shows the end state", async () => {
    const { page } = await open({ query: "?nm-speed=0" });
    await press(page);
    const r = await page.evaluate(() => ({ tls: window.__tls.length, visible: getComputedStyle(document.getElementById("g1")).visibility }));
    assert.deepEqual(r, { tls: 0, visible: "visible" });
    await page.close();
  });

  it("without GSAP the elements fade in and the console says so once", async () => {
    const { page, warnings } = await open({ stub: false });
    await press(page);
    await press(page);
    const r = await page.evaluate(() => ({ available: window.NM.gsap.available, visible: ["g1", "g2", "g3"].every((id) => getComputedStyle(document.getElementById(id)).visibility === "visible") }));
    assert.deepEqual(r, { available: false, visible: true });
    assert.equal(warnings.filter((w) => /window\.gsap is not loaded/.test(w)).length, 1);
    await page.close();
  });
});
