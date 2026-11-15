// Golden corpus, runtime half: every position (slide, step) of every corpus deck, read as semantic state at
// ?nm-speed=0, must match tests/corpus/golden/<deck>.semantic.json and hold the invariants below.
//   UPDATE_GOLDEN=1 npm test   rewrites the golden files (review the diff and say why in the commit; see README).
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { walk } from "./semantic.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const GOLDEN = join(ROOT, "tests", "corpus", "golden");
const DECKS = JSON.parse(readFileSync(join(ROOT, "tests", "corpus", "corpus.json"), "utf8")).decks;
const UPDATE = process.env.UPDATE_GOLDEN === "1";

let tmp, browser;
before(async () => {
  tmp = mkdtempSync(join(tmpdir(), "nm-corpus-"));
  execFileSync("python3", [join(ROOT, "tests", "corpus", "build.py"), "--out", tmp], { stdio: "ignore" });
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

for (const deck of DECKS) {
  describe(`corpus: ${deck.name}`, () => {
    let states, total;
    before(async () => {
      const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.goto(pathToFileURL(join(tmp, deck.name, "deck.html")).href + "?nm-speed=0");
      await page.waitForFunction(() => document.body.classList.contains("nm-ready"));
      // "next" follows the reading direction: the left arrow in RTL decks, the right arrow in LTR decks
      const next = await page.evaluate(() => (getComputedStyle(document.body).direction === "ltr" ? "ArrowRight" : "ArrowLeft"));
      total = await page.evaluate(() => window.NM.deck.slides.length);
      states = await walk(page, next);
      await page.close();
      assert.deepEqual(errors, [], "page errors");
    });

    it("visits every slide in order and ends on the last one", () => {
      const slides = [...new Set(states.map((s) => s.slide))];
      assert.deepEqual(slides, slides.slice().sort((a, b) => a - b));
      assert.deepEqual(slides, Array.from({ length: total }, (_, i) => i + 1), "every slide of the deck is visited");
    });

    it("invariants hold at every position", () => {
      for (const s of states) {
        const at = `slide ${s.slide} step ${s.step}`;
        assert.deepEqual(s.active, [s.slide], `${at}: exactly one active slide`);
        assert.equal(s.ghosts, 0, `${at}: morph ghosts left`);
        assert.equal(s.running, 0, `${at}: finite animations still running after settle`);
        if (!s.transient) assert.deepEqual(s.hiddenLasting, [], `${at}: revealed elements that are not shown`);
        else assert.ok(s.current.length > 0, `${at}: transient act without a current element`);
        if (s.step === 0) {
          assert.deepEqual(s.body, [], `${at}: an isolation act is still open on arrival`);
          assert.deepEqual(s.overlay, [], `${at}: overlay layer not empty on arrival`);
          assert.equal(s.camera, "rest", `${at}: camera not at rest on arrival`);
        }
        for (const f of s.figures) assert.equal(f.play, true, `${at}: diagram ${f.id} not armed on the active slide`);
      }
      // the release step closes every transient act: the last position of a slide never has one open
      const lastOf = new Map(states.map((s) => [s.slide, s]));
      for (const s of lastOf.values()) {
        assert.equal(s.transient, false, `slide ${s.slide}: last position still has a transient act open`);
        assert.deepEqual(s.overlay, [], `slide ${s.slide}: overlay not empty at the last position`);
        assert.deepEqual(s.hiddenLasting, [], `slide ${s.slide}: revealed elements hidden at the last position`);
      }
      // at the last position of each slide every diagram node is shown
      const last = new Map(states.map((s) => [s.slide, s]));
      for (const s of last.values()) for (const f of s.figures) assert.equal(f.shownNodes, f.nodes, `slide ${s.slide}: diagram ${f.id} ends with hidden nodes`);
    });

    it("matches the golden semantic snapshot", () => {
      const file = join(GOLDEN, `${deck.name}.semantic.json`);
      const lean = states.map(({ running, ...rest }) => rest);
      if (UPDATE || !existsSync(file)) {
        if (!UPDATE) assert.fail(`missing ${file}; create it with UPDATE_GOLDEN=1 and review it`);
        writeFileSync(file, JSON.stringify(lean, null, 1) + "\n");
        return;
      }
      const golden = JSON.parse(readFileSync(file, "utf8"));
      assert.equal(lean.length, golden.length, "number of positions changed");
      lean.forEach((s, i) => assert.deepEqual(s, golden[i], `position ${i + 1} (slide ${s.slide} step ${s.step}) differs from the golden`));
    });
  });
}
