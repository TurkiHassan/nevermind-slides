// Visual parity where semantic state is not enough: the frame a viewer sees after full motion must equal the frame
// of the same position rendered instantly (?nm-speed=0). Thresholds are calibrated on every run, not fixed:
//   noise     = difference between two independent instant renders of the same slide (should be 0)
//   tolerance = max(4 x noise, FLOOR)
// and the run proves the tolerance can see a real change (one word of a heading) before trusting it.
// Live iframes (animated anatomy) are masked in every shot: their content moves on its own clock.
// Environment pinned: playwright 1.63.0 (its Chromium), 1920x1080, deviceScaleFactor 1, --font-render-hinting=none,
// bundled fonts only (the deck's own @font-face files). See README.md for local vs CI differences.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { diffRatio } from "./pixels.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const FLOOR = 0.0002; // 0.02% of 1920x1080 is about 415 pixels; a one-word heading change measured 0.2%
const CONTEXT = { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, reducedMotion: "no-preference" };

let tmp, url, browser, tool;
before(async () => {
  tmp = mkdtempSync(join(tmpdir(), "nm-visual-"));
  execFileSync("python3", [join(ROOT, "tests", "corpus", "build.py"), "--out", tmp], { stdio: "ignore" });
  url = pathToFileURL(join(tmp, "ar-showcase", "deck.html")).href;
  browser = await chromium.launch({ args: ["--font-render-hinting=none"] });
  tool = await browser.newPage();
});
after(async () => {
  await browser?.close();
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

const ready = (p) => p.waitForFunction(() => document.body.classList.contains("nm-ready")).then(() => p.evaluate(() => NM.test.settle()));
const shot = (p) => p.screenshot({ mask: [p.locator(".slide.active iframe")], animations: "allow" });
async function instant(slide, step = 0) {
  const p = await browser.newPage(CONTEXT);
  await p.goto(`${url}?nm-speed=0#/${slide}${step ? "/" + step : ""}`);
  await ready(p);
  const png = await shot(p);
  await p.close();
  return png;
}

describe("visual parity of full motion and instant rendering (showcase)", () => {
  const rows = [];

  it("the calibrated tolerance detects a one-word change", async () => {
    const p = await browser.newPage(CONTEXT);
    await p.goto(`${url}?nm-speed=0#/6`);
    await ready(p);
    const a = await shot(p);
    await p.evaluate(() => { const h = document.querySelector(".slide.active h2"); h.textContent = h.textContent.replace(/\S+$/, "تغيير"); });
    const b = await shot(p);
    await p.close();
    const d = await diffRatio(tool, a, b);
    assert.ok(d > FLOOR * 4, `a one-word change measured ${d}, too close to the floor ${FLOOR}`);
  });

  it("arrival on every slide after its transition and morphs looks like the instant render", async () => {
    const motion = await browser.newPage(CONTEXT);
    await motion.goto(`${url}#/1`);
    await ready(motion);
    const total = await motion.evaluate(() => NM.deck.slides.length);
    for (let i = 1; i <= total; i++) {
      if (i > 1) { await motion.keyboard.press("Shift+ArrowLeft"); await motion.evaluate(() => NM.test.settle()); }
      const m = await shot(motion);
      const a = await instant(i), a2 = await instant(i);
      const noise = await diffRatio(tool, a, a2);
      const tolerance = Math.max(4 * noise, FLOOR);
      const d = await diffRatio(tool, m, a);
      rows.push({ slide: i, noise, tolerance, diff: d });
    }
    await motion.close();
    console.log(rows.map((r) => `slide ${r.slide}: diff ${r.diff.toFixed(5)} noise ${r.noise.toFixed(5)} tolerance ${r.tolerance.toFixed(5)}`).join("\n"));
    for (const r of rows) assert.ok(r.diff <= r.tolerance, `slide ${r.slide}: motion differs from instant by ${r.diff} (tolerance ${r.tolerance})`);
  });
});
