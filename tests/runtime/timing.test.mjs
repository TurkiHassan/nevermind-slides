// data-at (roadmap NM-14): when an element starts inside its step. Measured on the animation timeline (the scheduled
// start of each entrance: startTime + delay), which is exact; the roadmap asks for ±16ms.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const HERE = dirname(fileURLToPath(import.meta.url));
const URL = pathToFileURL(join(HERE, "fixtures", "timing", "deck.html")).href;
let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

async function starts(slide, ids, query = "") {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(URL + query + `#/${slide}`);
  await page.waitForFunction(() => document.body.classList.contains("nm-ready"));
  await page.evaluate(() => window.NM.test.settle());
  const r = await page.evaluate(async (ids) => {
    window.NM.deck.next();
    const out = {};
    for (const id of ids) {
      const a = document.getElementById(id).getAnimations()[0];
      out[id] = a ? { at: (a.startTime ?? document.timeline.currentTime) + a.effect.getTiming().delay, delay: a.effect.getTiming().delay, end: a.effect.getTiming().delay + a.effect.getTiming().duration } : null;
    }
    await window.NM.test.settle();
    out.visible = ids.every((id) => getComputedStyle(document.getElementById(id)).visibility === "visible");
    return out;
  }, ids);
  await page.close();
  return r;
}

describe("data-at inside a step", () => {
  it("a chain of three: with the step, 200ms after the first starts, when the second ends", async () => {
    const r = await starts(1, ["a", "b", "c"]);
    assert.ok(r.a && r.b && r.c, JSON.stringify(r));
    assert.ok(Math.abs(r.b.at - r.a.at - 200) <= 16, `b starts ${r.b.at - r.a.at}ms after a`);
    assert.ok(Math.abs(r.c.at - (r.b.at + (r.b.end - r.b.delay))) <= 16, `c starts ${r.c.at - r.b.at}ms after b starts`);
    assert.equal(r.visible, true);
  });

  it("absolute times, overlap with the previous end, labels, and no data-at", async () => {
    const r = await starts(2, ["d", "e", "f", "g"]);
    assert.equal(r.d.delay, 300);
    assert.equal(r.e.delay, r.d.end - 100, "+=-100 overlaps the end of d by 100ms");
    assert.equal(r.f.delay, 350, "@mid+=50");
    assert.equal(r.g.delay, 0, "an element without data-at starts with the step");
  });

  it("at nm-speed=0 the step ends in the same state with no animation", async () => {
    const r = await starts(1, ["a", "b", "c"], "?nm-speed=0");
    assert.deepEqual([r.a, r.b, r.c], [null, null, null]);
    assert.equal(r.visible, true);
  });
});
