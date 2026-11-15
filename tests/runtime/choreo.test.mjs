// Motion roles (roadmap NM-13): <body data-nm-choreo="2">, written by scaffold, gives every automatic entrance a
// role (lead, support, deco, static), gaps that shrink, one entrance per container and a 1200ms budget; slides marked
// data-nm-still fade in together. Decks without the attribute (the hand-finished showcase) keep the old stagger.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

let tmp, browser;
before(async () => {
  tmp = mkdtempSync(join(tmpdir(), "nm-choreo-"));
  execFileSync("python3", [join(ROOT, "tests", "corpus", "build.py"), "--out", tmp], { stdio: "ignore" });
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

/** Arrival entrances of every slide: go to it with full motion and record the animations on its own elements. */
async function arrivals(name) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(join(tmp, name, "deck.html")).href);
  await page.waitForFunction(() => document.body.classList.contains("nm-ready"));
  const total = await page.evaluate(() => window.NM.deck.slides.length);
  const out = [];
  for (let i = 0; i < total; i++) {
    await page.evaluate((n) => window.NM.deck.go(n), i);
    const seen = await page.evaluate(() => new Promise((res) => {
      const slide = window.NM.deck.slides[window.NM.deck.index];
      const found = new Map();
      const sample = () => {
        for (const a of document.getAnimations()) {
          const t = a.effect && a.effect.target;
          // diagram nodes play their own build inside the figure (nm-diagram, generated): not slide entrances
          if (!t || !slide.contains(t) || t.closest(".nm-layer, [data-nm-generated]") || !(a.effect.getTiming().fill === "backwards")) continue;
          const kf = a.effect.getKeyframes();
          if (!kf.some((k) => "opacity" in k)) continue;
          const tm = a.effect.getTiming();
          if (!found.has(t)) found.set(t, { delay: tm.delay, end: tm.delay + tm.duration, moves: kf.some((k) => k.translate && k.translate !== "0px 0px" && k.translate !== "none"), cls: t.className || t.tagName, tag: t.tagName });
        }
      };
      let n = 0;
      const tick = () => { sample(); if (++n < 12) setTimeout(tick, 25); else {
        const els = [...found.keys()];
        res({
          still: slide.hasAttribute("data-nm-still"),
          items: [...found.values()],
          nested: els.some((a) => els.some((b) => a !== b && a.contains(b))),
          leadFirst: (() => { const h = els.filter((e) => e.matches("h1,h2,h3,blockquote")); return h.length ? Math.min(...h.map((e) => found.get(e).delay)) <= Math.min(...[...found.values()].map((v) => v.delay)) : true; })(),
          heads: els.filter((e) => e.matches("h1,h2,h3,blockquote")).length,
          decoMoves: els.filter((e) => e.matches(".nm-kicker,hr,.nm-section-num")).some((e) => found.get(e).moves),
        });
      } };
      tick();
    }));
    out.push({ slide: i + 1, ...seen });
    await page.evaluate(() => window.NM.test.settle());
  }
  await page.close();
  return out;
}

describe("motion roles (choreo 2) on scaffolded decks", () => {
  for (const name of ["ar-example", "en-general", "ar-advisor"]) {
    it(`${name}: settles within 1200ms, lead first, decoration fades, never a parent and a child at once`, async () => {
      const slides = await arrivals(name);
      assert.ok(slides.some((s) => s.items.length >= 3), "some slides have several entrances");
      assert.ok(slides.filter((s) => s.heads > 0).length >= 3, "headers are opened: the heading enters on its own (the old stagger moved the whole header)");
      for (const s of slides) {
        if (!s.items.length) continue;
        const start = Math.min(...s.items.map((i) => i.delay));
        const end = Math.max(...s.items.map((i) => i.end));
        assert.ok(end - start <= 1200, `slide ${s.slide}: arrival takes ${end - start}ms`);
        assert.equal(s.nested, false, `slide ${s.slide}: a parent and its child both enter`);
        assert.equal(s.leadFirst, true, `slide ${s.slide}: the heading is not first`);
        assert.equal(s.decoMoves, false, `slide ${s.slide}: a decoration travels`);
        const supports = [...new Set(s.items.filter((i) => i.moves).map((i) => i.delay))].sort((a, b) => a - b);
        const gaps = supports.slice(1).map((d, k) => d - supports[k]);
        for (let k = 1; k < gaps.length; k++) assert.ok(gaps[k] <= gaps[k - 1], `slide ${s.slide}: gaps do not shrink (${gaps})`);
      }
    });
  }

  it("a still slide fades its parts in together", async () => {
    const slides = await arrivals("ar-advisor");
    const still = slides.filter((s) => s.still);
    assert.deepEqual(still.map((s) => s.slide), [2, 3]);
    for (const s of still) {
      assert.ok(s.items.length >= 2, `slide ${s.slide}: ${s.items.length} entrances`);
      assert.equal(new Set(s.items.map((i) => i.delay)).size, 1, `slide ${s.slide}: different delays`);
      assert.ok(s.items.every((i) => !i.moves), `slide ${s.slide}: something travels`);
    }
  });
});

describe("decks without data-nm-choreo keep the old stagger", () => {
  it("showcase: automatic entrances step by 75ms as before", async () => {
    const slides = await arrivals("ar-showcase");
    let checked = 0;
    for (const s of slides) {
      if (s.items.length < 2) continue;
      const start = Math.min(...s.items.map((i) => i.delay));
      const rel = s.items.map((i) => i.delay - start);
      if (rel.every((d) => d % 75 === 0 || d % 120 === 0)) checked++;
    }
    assert.ok(checked >= 3, `only ${checked} slides with the 75ms stagger`);
  });
});
