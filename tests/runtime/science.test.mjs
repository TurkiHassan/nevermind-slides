// Tables and equations (roadmap NM-10, NM-11) on the science decks of the golden corpus, opened from file:// as a
// user would: native MathML in an Arabic deck, TeX through the staged converter, inline formulas inside Arabic
// sentences, data-term morphs, row and column steps, numeric alignment, the 20px floor and markup round trips.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

let tmp, browser;
before(async () => {
  tmp = mkdtempSync(join(tmpdir(), "nm-science-"));
  execFileSync("python3", [join(ROOT, "tests", "corpus", "build.py"), "--out", tmp], { stdio: "ignore" });
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

async function open(name, { speed0 = true, file = "deck.html", hash = "" } = {}) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [], warnings = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "warning") warnings.push(m.text()); });
  await page.goto(pathToFileURL(join(tmp, name, file)).href + (speed0 ? "?nm-speed=0" : "") + hash);
  await page.waitForFunction(() => document.body.classList.contains("nm-ready"));
  await page.evaluate(() => window.NM.test.settle());
  return { page, errors, warnings };
}
const stageHTML = (page) => page.evaluate(() => document.getElementById("deckStage").innerHTML);

describe("equations: native MathML and TeX (ar-science, en-science)", () => {
  it("every data-tex formula is converted by the staged Temml, nothing is shown raw, nothing is fetched", async () => {
    for (const name of ["ar-science", "en-science"]) {
      const { page, errors } = await open(name);
      const r = await page.evaluate(() => ({
        converter: window.NM.math && window.NM.math.converter,
        hosts: document.querySelectorAll("[data-tex]").length,
        rendered: [...document.querySelectorAll("[data-tex]")].filter((h) => h.querySelector(':scope > math[data-nm-generated="math"]')).length,
        raw: document.querySelectorAll(".nm-math-raw").length,
        remote: performance.getEntriesByType("resource").filter((e) => !e.name.startsWith("file:")).map((e) => e.name),
      }));
      assert.equal(r.converter, "temml", name);
      assert.ok(r.hosts >= 3, `${name}: ${r.hosts} TeX hosts`);
      assert.equal(r.rendered, r.hosts, `${name}: every TeX host holds its generated MathML`);
      assert.equal(r.raw, 0, name);
      assert.deepEqual(r.remote, [], `${name}: works offline`);
      assert.deepEqual(errors, [], name);
      await page.close();
    }
  });

  it("formulas read left to right inside the Arabic deck, and an inline formula sits between its Arabic neighbours", async () => {
    const { page } = await open("ar-science", { hash: "#/4" });
    const r = await page.evaluate(() => {
      const maths = [...document.querySelectorAll(".slide math")];
      const lead = document.querySelectorAll(".slide")[3].querySelector(".nm-t-lead");
      const host = lead.querySelector(".nm-math");
      const words = (re) => {
        const tw = document.createTreeWalker(lead, NodeFilter.SHOW_TEXT);
        for (let n; (n = tw.nextNode());) {
          const i = n.data.search(re);
          if (i >= 0 && !n.parentElement.closest(".nm-math")) { const rg = document.createRange(); rg.setStart(n, i); rg.setEnd(n, i + 2); return rg.getBoundingClientRect(); }
        }
        return null;
      };
      const before = words(/العلاقة/), after = words(/فنحصل/), m = host.getBoundingClientRect();
      // in the formula d = 1/2 g t^2 the "d" is left of the "="
      const tokens = [...host.querySelectorAll("mi, mo")].map((t) => ({ t: t.textContent, x: t.getBoundingClientRect().x }));
      const d = tokens.find((t) => t.t === "d"), eq = tokens.find((t) => t.t === "=");
      return { dirs: [...new Set(maths.map((x) => getComputedStyle(x).direction))], before: before && before.x, after: after && after.right, mLeft: m.left, mRight: m.right, dLeftOfEq: d.x < eq.x, sameLine: Math.abs(before.top - m.top) < m.height };
    });
    assert.deepEqual(r.dirs, ["ltr"]);
    assert.ok(r.dLeftOfEq, "formula tokens run left to right");
    assert.ok(r.before >= r.mRight - 1, "the word before the formula is to its right (RTL reading order)");
    assert.ok(r.after <= r.mLeft + 1, "the word after the formula is to its left");
    assert.ok(r.sameLine, "the formula stays on the line of its sentence");
    await page.close();
  });

  it("a derivation keeps its first line on screen and reveals the next ones; data-term parts fly from the previous slide", async () => {
    const { page } = await open("ar-science", { speed0: false, hash: "#/2" });
    const s3 = await page.evaluate(() => {
      const lines = [...document.querySelectorAll(".slide")[2].querySelectorAll(".nm-eq-line")];
      return lines.map((l) => l.getAttribute("data-step"));
    });
    assert.deepEqual(s3, [null, "1", "2"]);
    // finish slide 2's steps, then move to slide 3 and sample the ghost layer while the morph flies
    await page.evaluate(() => { window.NM.deck.go(1, { step: "end" }); });
    await page.evaluate(() => window.NM.test.settle());
    const terms = await page.evaluate(() => [...document.querySelectorAll(".slide")[2].querySelectorAll("[data-term]")].map((e) => e.getAttribute("data-morph")));
    assert.ok(terms.includes("term-v") && terms.includes("term-g") && terms.includes("term-t"), JSON.stringify(terms));
    const ghosts = await page.evaluate(() => new Promise((res) => {
      const layer = document.getElementById("nmGhostLayer");
      const seen = new Set();
      const obs = new MutationObserver(() => { for (const c of layer.children) seen.add(c.textContent.replace(/\s+/g, "")); });
      obs.observe(layer, { childList: true, subtree: true });
      window.NM.deck.next({ skipSteps: true });
      setTimeout(() => { obs.disconnect(); res([...seen]); }, 400);
    }));
    for (const t of ["v", "g", "t"]) assert.ok(ghosts.includes(t), `term ${t} flies as a ghost (${JSON.stringify(ghosts)})`);
    await page.evaluate(() => window.NM.test.settle());
    assert.equal(await page.evaluate(() => document.getElementById("nmGhostLayer").childElementCount), 0, "no ghost left");
    await page.close();
  });

  it("an equation figure sets a formula smaller when it is wider than its figure, never below 36px", async () => {
    const { page } = await open("en-science", { hash: "#/3" });
    const r = await page.evaluate(() => {
      const fig = document.querySelectorAll(".slide")[2].querySelector(".nm-equation");
      const m = fig.querySelector("math");
      const k = fig.getBoundingClientRect().width / fig.offsetWidth;
      return { size: parseFloat(getComputedStyle(fig).fontSize), mathW: m.getBoundingClientRect().width / k, figW: fig.clientWidth };
    });
    assert.ok(r.size >= 36 && r.size <= 88, `font ${r.size}`);
    assert.ok(r.mathW <= r.figW, `formula ${Math.round(r.mathW)}px fits ${r.figW}px`);
    await page.close();
  });

  it("without the converter a data-tex formula falls back to raw TeX in a dashed box, generated and never source", async () => {
    const html = readFileSync(join(tmp, "en-science", "deck.html"), "utf8").replace('<script src="assets/nm/vendor/temml.min.js"></script>\n', "");
    writeFileSync(join(tmp, "en-science", "no-temml.html"), html);
    const { page, errors, warnings } = await open("en-science", { file: "no-temml.html" });
    const r = await page.evaluate(() => ({
      raw: [...document.querySelectorAll(".nm-math-raw")].map((e) => [e.getAttribute("data-nm-generated"), e.closest("[data-tex]").getAttribute("data-nm-math-error")]),
      math: document.querySelectorAll('[data-tex] > math').length,
    }));
    assert.ok(r.raw.length >= 3);
    for (const [gen, why] of r.raw) { assert.equal(gen, "math"); assert.equal(why, "no-converter"); }
    assert.equal(r.math, 0);
    assert.deepEqual(errors, []);
    assert.ok(warnings.some((w) => /stage-runtime --math/.test(w)), "the console names the fix");
    await page.close();
  });
});

describe("tables: steps, alignment, highlight, fit (ar-science, en-science)", () => {
  it("numeric columns align right in both directions; the row-header column does not", async () => {
    for (const name of ["ar-science", "en-science"]) {
      const { page } = await open(name);
      const r = await page.evaluate(() => {
        const t = document.querySelector('.nm-table[data-id="drops"], .nm-table[data-id="results"]');
        const row = t.querySelector("tbody tr");
        return [...row.cells].map((c) => [c.classList.contains("nm-tb-num"), getComputedStyle(c).textAlign]);
      });
      assert.deepEqual(r[0], [false, "start"], `${name}: row header`);
      for (const c of r.slice(1)) assert.deepEqual(c, [true, "right"], `${name}: numeric cell`);
      await page.close();
    }
  });

  it("row steps reveal one body row each; column highlight steps take the header cell; static highlight marks its row", async () => {
    const { page } = await open("ar-science");
    const r = await page.evaluate(() => {
      const [drops, air] = document.querySelectorAll(".nm-table");
      return {
        rows: [...drops.querySelectorAll("tbody tr")].map((tr) => tr.getAttribute("data-step") + ":" + tr.getAttribute("data-act")),
        headerSteps: drops.querySelectorAll("thead [data-step]").length,
        hl: [...drops.querySelectorAll("tbody tr")].findIndex((tr) => tr.classList.contains("nm-tb-hl")) + 1,
        cols: [...air.querySelectorAll("tr")].map((tr) => [...tr.cells].map((c) => c.getAttribute("data-step") || "-").join(" ")),
        font: [parseFloat(getComputedStyle(drops).fontSize), parseFloat(getComputedStyle(air).fontSize)],
      };
    });
    assert.deepEqual(r.rows, ["1:reveal", "2:reveal", "3:reveal", "4:reveal", "5:reveal", "6:reveal", "7:reveal", "8:reveal"]);
    assert.equal(r.headerSteps, 0, "the header row stays visible");
    assert.equal(r.hl, 8);
    assert.deepEqual(r.cols, ["- 1 2 3", "- 1 2 3", "- 1 2 3", "- 1 2 3"]);
    assert.ok(r.font[0] >= 20, "8 x 5 table at 20px or more");
    assert.ok(r.font[1] > 28 && r.font[1] <= 36, `a short table grows into its figure (${r.font[1]}px)`);
    await page.close();
  });

  it("stepping through the tables and back restores the markup byte for byte", async () => {
    const { page } = await open("ar-science", { hash: "#/5" });
    const start = await stageHTML(page);
    for (let i = 0; i < 9; i++) { await page.keyboard.press("ArrowLeft"); await page.evaluate(() => window.NM.test.settle()); }
    for (let i = 0; i < 9; i++) { await page.keyboard.press("ArrowRight"); await page.evaluate(() => window.NM.test.settle()); }
    await page.evaluate(() => { window.NM.deck.go(4); });
    await page.evaluate(() => window.NM.test.settle());
    assert.equal(await stageHTML(page), start);
    await page.close();
  });

  it("full motion and ?nm-speed=0 end every table step in the same state", async () => {
    const read = (page) => page.evaluate(() => [...document.querySelectorAll(".slide.active [data-step]")].map((e) => e.className + "|" + getComputedStyle(e).visibility));
    const fast = await open("en-science", { hash: "#/5" });
    const slow = await open("en-science", { speed0: false, hash: "#/5" });
    for (let i = 0; i < 7; i++) {
      for (const p of [fast.page, slow.page]) { await p.keyboard.press("ArrowRight"); await p.evaluate(() => window.NM.test.settle()); }
      assert.deepEqual(await read(slow.page), await read(fast.page), `step ${i + 1}`);
    }
    await fast.page.close();
    await slow.page.close();
  });
});
