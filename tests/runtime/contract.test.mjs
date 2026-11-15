// Contract tests for the Nevermind runtime v2 (references/runtime-contract.md), run against the showcase deck
// staged into a temporary folder, exactly as a user would open it. Node >= 20, playwright (see package.json).
//   cd tests/runtime && npm install && npx playwright install chromium && npm test
// Inside the Claude Code cloud container playwright is preinstalled globally: NODE_PATH=$(npm root -g) npm test
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readState, walk } from "./semantic.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const HELPER = join(ROOT, "scripts", "deck_helper.py");
const LAB = join(ROOT, "resources", "engine", "nm-runtime", "lab");
const NEXT = "ArrowLeft"; // dir="rtl": forward is the left arrow
const PREV = "ArrowRight";

let tmp, deckUrl, browser;

before(async () => {
  tmp = mkdtempSync(join(tmpdir(), "nm-runtime-"));
  const project = join(tmp, "showcase");
  cpSync(join(ROOT, "examples", "showcase"), project, { recursive: true });
  for (const cmd of ["stage-fonts", "stage-runtime"]) {
    execFileSync("python3", [HELPER, cmd, "--target-dir", project], { stdio: "ignore" });
  }
  deckUrl = pathToFileURL(join(project, "deck.html")).href;
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

async function open(query = "", hash = "", { reducedMotion = "no-preference" } = {}) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, reducedMotion });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(deckUrl + query + hash);
  await page.waitForFunction(() => document.body.classList.contains("nm-ready"));
  await settle(page);
  return { page, errors };
}

const settle = (page) => page.evaluate(() => window.NM.test.settle());
const state = (page) => page.evaluate(() => ({ slide: NM.deck.index, step: NM.deck.stepIndex }));
async function press(page, key, times = 1) {
  for (let i = 0; i < times; i++) await page.keyboard.press(key);
  await settle(page);
}
// Author markup of one slide with runtime-owned layers removed: what must round-trip byte for byte.
const slideMarkup = (page, i) => page.evaluate((i) => document.querySelectorAll(".deck-stage > section.slide")[i].outerHTML, i);

describe("global API (contract section 3)", () => {
  it("exposes NM with version 2, deck, geometry, easings and durations", async () => {
    const { page, errors } = await open("?nm-speed=0");
    const api = await page.evaluate(() => ({
      version: NM.version, slides: NM.deck.slides.length, scale: typeof NM.geom.stageScale(),
      ease: Object.keys(NM.ease), dur: Object.keys(NM.dur), use: typeof NM.use, act: typeof NM.registerAct,
    }));
    assert.equal(api.version, 2);
    assert.equal(api.slides, 14);
    assert.equal(api.scale, "number");
    for (const k of ["standard", "emphasized", "enter", "exit", "spring"]) assert.ok(api.ease.includes(k), k);
    for (const k of ["fast", "base", "slow", "morph", "camera"]) assert.ok(api.dur.includes(k), k);
    assert.equal(api.use, "function");
    assert.equal(api.act, "function");
    assert.deepEqual(errors, []);
    await page.close();
  });

  it("injects the chrome and layers named in the contract (legacy names, section 7)", async () => {
    const { page } = await open("?nm-speed=0");
    for (const sel of [".deck-viewport", ".deck-stage#deckStage", "#deckControls", "#controlsHotzone", "#nmGhostLayer", "#nmOverlayLayer"]) {
      assert.ok(await page.$(sel), sel);
    }
    assert.equal(await page.evaluate(() => document.querySelector("section.slide.active") === NM.deck.slides[0]), true);
    assert.equal(await page.evaluate(() => [...document.querySelectorAll("section.slide")].every((s) => getComputedStyle(s).display !== "none")), true);
    await page.close();
  });
});

describe("navigation (sections 4 and 6)", () => {
  it("arrows run every step before changing slide, Shift skips steps", async () => {
    const { page, errors } = await open("?nm-speed=0", "#/2");
    const steps = await page.evaluate(() => new Set([...NM.deck.slides[1].querySelectorAll("[data-step]")].map((e) => e.dataset.step)).size);
    assert.ok(steps > 0);
    await press(page, NEXT, steps);
    assert.equal((await state(page)).slide, 1, "still on slide 2 after its steps");
    await press(page, NEXT);
    assert.equal((await state(page)).slide, 2, "next arrow leaves the slide");
    await page.keyboard.press(`Shift+${NEXT}`); await settle(page);
    assert.equal((await state(page)).slide, 3, "Shift+arrow skips the steps of slide 3");
    assert.deepEqual(errors, []);
    await page.close();
  });

  it("deep links open the slide and step (#/n/s) and Home/End jump", async () => {
    const { page } = await open("?nm-speed=0", "#/4/2");
    assert.deepEqual(await state(page), { slide: 3, step: 2 });
    await press(page, "End");
    assert.equal((await state(page)).slide, 13);
    await press(page, "Home");
    assert.equal((await state(page)).slide, 0);
    await page.close();
  });
});

describe("byte-identical round trip (section 3)", () => {
  it("stepping forward through every step and back restores each slide's markup exactly", async () => {
    const { page, errors } = await open("?nm-speed=0");
    const total = await page.evaluate(() => NM.deck.slides.length);
    let checked = 0;
    for (let i = 0; i < total; i++) {
      await page.evaluate((i) => NM.deck.go(i), i); await settle(page);
      assert.deepEqual(await state(page), { slide: i, step: 0 });
      const before = await slideMarkup(page, i);
      for (let guard = 0; ; guard++) { // forward until the next press leaves the slide (or the deck ends)
        const prev = await state(page);
        await press(page, NEXT);
        const s = await state(page);
        if (s.slide !== i) { await press(page, PREV); break; }
        if (s.step === prev.step) break;
        if (guard > 12) throw new Error(`slide ${i + 1}: runaway steps`);
      }
      const end = await state(page);
      assert.equal(end.slide, i, `slide ${i + 1}: back arrow returns to the slide`);
      await press(page, PREV, end.step);
      assert.deepEqual(await state(page), { slide: i, step: 0 }, `slide ${i + 1}: back at step 0`);
      if (end.step === 0) continue;
      assert.equal(await slideMarkup(page, i), before, `slide ${i + 1}: markup after ${end.step} steps forward and back`);
      checked++;
    }
    assert.ok(checked >= 8, `only ${checked} slides with steps were checked`);
    assert.deepEqual(errors, []);
    await page.close();
  });
});

describe("instant mode (section 0)", () => {
  it("?nm-speed=0 and prefers-reduced-motion end in the same layout as full motion", async () => {
    const rects = async (page) => page.evaluate(() => [...NM.deck.slides[NM.deck.index].querySelectorAll("[data-step], h1, h2")]
      .map((e) => { const r = NM.geom.rectInStage(e); return [Math.round(r.x), Math.round(r.y), Math.round(r.w), Math.round(r.h), getComputedStyle(e).opacity]; }));
    const results = [];
    for (const [query, opts] of [["", {}], ["?nm-speed=0", {}], ["", { reducedMotion: "reduce" }]]) {
      const { page } = await open(query, "#/6", opts);
      await press(page, NEXT, 3);
      results.push({ instant: await page.evaluate(() => document.body.classList.contains("nm-instant")), rects: await rects(page) });
      await page.close();
    }
    assert.equal(results[0].instant, false);
    assert.equal(results[1].instant, true);
    assert.equal(results[2].instant, true, "reduced motion behaves like speed 0");
    assert.deepEqual(results[1].rects, results[0].rects);
    assert.deepEqual(results[2].rects, results[0].rects);
  });
});

describe("interruption (roadmap NM-16)", () => {
  it("mashing the arrows ends in the same state as a direct jump, with no ghosts left", async () => {
    const { page, errors } = await open("", "#/1");
    for (let i = 0; i < 20; i++) await page.keyboard.press(NEXT, { delay: 15 });
    for (let i = 0; i < 7; i++) await page.keyboard.press(PREV, { delay: 15 });
    await settle(page);
    const mashed = await state(page);
    const ghosts = await page.evaluate(() => document.getElementById("nmGhostLayer").childElementCount);
    assert.equal(ghosts, 0, "morph ghosts left behind");
    const { page: direct } = await open("?nm-speed=0", `#/${mashed.slide + 1}/${mashed.step}`);
    assert.deepEqual(await state(direct), mashed);
    assert.deepEqual(errors, []);
    await Promise.all([page.close(), direct.close()]);
  });
});

describe("lab pages", () => {
  for (const name of ["core-lab.html", "diagram-lab.html", "focus-lab.html", "media-lab.html"]) {
    it(`${name} loads without errors`, async () => {
      const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
      await page.goto(pathToFileURL(join(LAB, name)).href);
      await page.waitForFunction(() => document.body.classList.contains("nm-ready") || document.readyState === "complete");
      await page.waitForTimeout(300);
      assert.deepEqual(errors, []);
      await page.close();
    });
  }
});

describe("semantic state (roadmap NM-03)", () => {
  it("stepping forward and back restores each slide's semantic state", async () => {
    const { page, errors } = await open("?nm-speed=0");
    const total = await page.evaluate(() => NM.deck.slides.length);
    for (let i = 0; i < total; i++) {
      await page.evaluate((i) => NM.deck.go(i), i); await settle(page);
      const before = await page.evaluate(readState);
      let n = 0;
      for (;;) {
        const prev = await state(page);
        await press(page, NEXT);
        const s = await state(page);
        if (s.slide !== i) { await press(page, PREV); break; }
        if (s.step === prev.step) break;
        n++;
      }
      await press(page, PREV, (await state(page)).step);
      const back = await page.evaluate(readState);
      const { running: r1, ...a } = before, { running: r2, ...b } = back;
      assert.deepEqual(b, a, `slide ${i + 1} after ${n} steps forward and back`);
    }
    assert.deepEqual(errors, []);
    await page.close();
  });

  it("full motion and ?nm-speed=0 reach the same semantic state at every position", async () => {
    const fast = await open("?nm-speed=0");
    const slow = await open("");
    const a = await walk(fast.page, NEXT);
    const b = await walk(slow.page, NEXT);
    assert.equal(b.length, a.length, "number of positions");
    a.forEach((s, i) => {
      const { running: r1, ...x } = s, { running: r2, ...y } = b[i];
      assert.deepEqual(y, x, `slide ${s.slide} step ${s.step}`);
      assert.equal(r2, 0, `slide ${s.slide} step ${s.step}: animations still running after settle`);
    });
    assert.deepEqual(slow.errors, []);
    await Promise.all([fast.page.close(), slow.page.close()]);
  });

  it("morph targets end exactly where the instant render puts them", async () => {
    const rects = (page) => page.evaluate(() => [...NM.deck.slides[NM.deck.index].querySelectorAll("[data-morph]")]
      .map((e) => { const r = NM.geom.rectInStage(e); return [e.getAttribute("data-morph"), Math.round(r.x), Math.round(r.y), Math.round(r.w), Math.round(r.h), getComputedStyle(e).opacity]; }));
    const motion = await open("");
    const total = await motion.page.evaluate(() => NM.deck.slides.length);
    let checked = 0;
    for (let i = 2; i <= total; i++) {
      await motion.page.keyboard.press(`Shift+${NEXT}`); await settle(motion.page);
      const m = await rects(motion.page);
      if (!m.length) continue;
      const direct = await open("?nm-speed=0", `#/${i}`);
      assert.deepEqual(m, await rects(direct.page), `slide ${i}`);
      await direct.page.close();
      checked++;
    }
    assert.ok(checked >= 5, `only ${checked} slides with morph targets`);
    assert.equal(await motion.page.evaluate(() => document.getElementById("nmGhostLayer").childElementCount), 0);
    await motion.page.close();
  });
});
