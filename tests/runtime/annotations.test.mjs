// Scientific annotations in nm-diagram (roadmap NM-12), on resources/engine/nm-runtime/lab/diagram-lab.html: error bars
// on bars (value ± err), the scatter type (numeric axes with units, labelled points, trend line), labels 18px or
// more, bars still measured from zero, and the series steps reaching every point.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const LAB = pathToFileURL(join(ROOT, "resources/engine/nm-runtime/lab/diagram-lab.html")).href;
let browser, page;

before(async () => {
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(LAB + "?nm-speed=0");
  // the diagram lab runs nm-diagram.js alone (no deck core): every slide is laid out, nothing is stepped
  await page.waitForFunction(() => document.querySelector('figure[data-id="scatter"] [data-nm-generated] .nm-dg-point'));
  assert.deepEqual(errors, []);
});
after(async () => { await browser?.close(); });

const show = async (id) => { await page.locator(`figure[data-id="${id}"]`).scrollIntoViewIfNeeded(); await page.waitForTimeout(200); };

describe("error bars (value ± err)", () => {
  it("draws one whisker with two caps per value, past the bar, inside the figure", async () => {
    await show("errbars");
    const r = await page.evaluate(() => {
      const fig = document.querySelector('figure[data-id="errbars"]');
      const box = fig.getBoundingClientRect();
      const bars = [...fig.querySelectorAll(".nm-dg-bar")].map((b) => b.getBoundingClientRect());
      const errs = [...fig.querySelectorAll(".nm-dg-errbar")].map((e) => e.getBoundingClientRect());
      const base = fig.querySelector(".nm-dg-baseline").getBoundingClientRect();
      return { bars: bars.length, errs: errs.length, inside: errs.every((e) => e.top >= box.top - 1 && e.bottom <= box.bottom + 1),
        fromZero: bars.every((b) => Math.abs(b.bottom - base.top) < 3),
        labels: [...fig.querySelectorAll(".nm-dg-bvalue")].map((l) => l.textContent),
        ltr: [...fig.querySelectorAll(".nm-dg-bvalue")].every((l) => l.getAttribute("dir") === "ltr"), small: [...fig.querySelectorAll("[data-nm-generated] *")].filter((e) => e.childElementCount === 0 && e.textContent.trim() && parseFloat(getComputedStyle(e).fontSize) * (e.getBoundingClientRect().width / (e.offsetWidth || e.getBoundingClientRect().width)) < 17.5).length };
    });
    assert.equal(r.bars, 3);
    assert.equal(r.errs, 9, "three whiskers, each with two caps");
    assert.ok(r.inside, "whiskers stay inside the figure");
    assert.ok(r.fromZero, "bars still start at zero");
    assert.ok(r.labels.some((t) => /±/.test(t)), JSON.stringify(r.labels));
    assert.ok(r.ltr, "a Latin value with its error reads left to right inside the Arabic slide");
    assert.equal(r.small, 0, "every label at 18px or more");
  });
});

describe("scatter", () => {
  it("places every point, labels it, draws the trend and the axis titles with units", async () => {
    await show("scatter");
    const r = await page.evaluate(() => {
      const fig = document.querySelector('figure[data-id="scatter"]');
      const pts = [...fig.querySelectorAll(".nm-dg-point")].map((p) => p.getBoundingClientRect());
      const box = fig.getBoundingClientRect();
      return {
        points: pts.length,
        accent: fig.querySelectorAll(".nm-dg-point.is-accent").length,
        labels: fig.querySelectorAll(".nm-dg-plabel").length,
        trend: !!fig.querySelector(".nm-dg-trend"),
        titles: [...fig.querySelectorAll(".nm-dg-axtitle")].map((t) => t.textContent),
        inside: pts.every((p) => p.left >= box.left && p.right <= box.right && p.top >= box.top && p.bottom <= box.bottom),
        steps: new Set([...fig.querySelectorAll(".nm-dg-point")].map((p) => p.getAttribute("data-step"))).size,
        // the big model (304M) sits further along the reading direction than the small ones: right to left here
        rtlOrder: pts[2].left < pts[0].left,
      };
    });
    assert.equal(r.points, 5);
    assert.equal(r.accent, 1);
    assert.equal(r.labels, 5);
    assert.ok(r.trend);
    assert.deepEqual(r.titles.map((t) => t.replace(/\s+/g, " ").trim()), ["الدقة (٪)", "عدد المعاملات (مليون)"]);
    assert.ok(r.inside, "points inside the figure");
    assert.equal(r.steps, 5, "one step per point with data-steps=series"); // numbered even without the deck core
    assert.ok(r.rtlOrder, "x grows from right to left in an RTL deck");
  });
});
