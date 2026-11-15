// The bundled editor (resources/nm-studio/nm-studio.mjs) against a runtime v2 deck in Chromium: the edit layer
// must refuse to type into runtime-generated content, the server must refuse to write it, a no-op save must leave
// the file byte-identical, and a supported edit must change only its line.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const STUDIO = join(ROOT, "resources", "nm-studio", "nm-studio.mjs");

let tmp, deck, original, child, origin, token, browser, page;

async function api(path, body) {
  const r = await fetch(`${origin}${path}${body ? "" : `?t=${token}`}`, body ? {
    method: "POST", body: JSON.stringify(body),
    headers: { "content-type": "application/json", origin, "x-nm-token": token },
  } : undefined);
  return { status: r.status, json: await r.json().catch(() => null) };
}
const changedLines = (a, b) => {
  const x = a.split("\n"), y = b.split("\n");
  assert.equal(y.length, x.length, "line count changed");
  return x.map((l, i) => (l === y[i] ? -1 : i)).filter((i) => i >= 0);
};

before(async () => {
  tmp = mkdtempSync(join(tmpdir(), "nm-guard-"));
  const project = join(tmp, "showcase");
  cpSync(join(ROOT, "examples", "showcase"), project, { recursive: true });
  for (const cmd of ["stage-fonts", "stage-runtime"]) execFileSync("python3", [join(ROOT, "scripts", "deck_helper.py"), cmd, "--target-dir", project], { stdio: "ignore" });
  deck = join(project, "deck.html");
  original = readFileSync(deck, "utf8");
  child = spawn(process.execPath, [STUDIO, "edit", deck, "--no-open", "--port", "0"], { stdio: ["ignore", "pipe", "pipe"] });
  const info = await new Promise((ok, fail) => {
    let out = "";
    const t = setTimeout(() => fail(new Error("nm-studio did not start")), 20_000);
    child.stdout.on("data", (c) => { out += c; const m = /\{[\s\S]*\}\n/.exec(out); if (m) { clearTimeout(t); ok(JSON.parse(m[0])); } });
  });
  const url = new URL(info.url);
  origin = url.origin; token = url.searchParams.get("t");
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(`${origin}/preview?t=${token}`);
  await page.waitForFunction(() => window.__nm && window.NM && document.body.classList.contains("nm-ready"));
  await page.evaluate(() => window.__nm.goTo(5)); // slide 6: the flow diagram
  await page.waitForFunction(() => document.querySelector(".slide[data-nm-current] .nm-dg-canvas .nm-dg-node"));
  await page.waitForTimeout(400);
});

after(async () => {
  await browser?.close();
  child?.kill("SIGINT");
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

describe("editor guard for runtime-generated content", () => {
  it("the runtime marks what it generates", async () => {
    const kinds = await page.evaluate(() => [...document.querySelectorAll("[data-nm-generated]")].map((e) => e.getAttribute("data-nm-generated")));
    assert.ok(kinds.includes("diagram"), "diagram canvas marked");
    const keyed = await page.evaluate(() => document.querySelectorAll("[data-nm-generated] [data-nm-key], [data-nm-generated][data-nm-key]").length);
    assert.equal(keyed, 0, "generated markup has no source keys");
  });

  it("a click on a diagram label resolves to the figure, which is read-only for text", async () => {
    const r = await page.evaluate(() => {
      const node = document.querySelector(".slide[data-nm-current] .nm-dg-canvas .nm-dg-node");
      const b = node.getBoundingClientRect();
      const hit = window.__nm.hitLocal(b.left + b.width / 2, b.top + b.height / 2);
      const el = hit && document.querySelector(`[data-nm-key="${hit.key}"]`);
      return { tag: hit && hit.tag, isFigure: !!el && el.matches("figure.nm-diagram"), begin: hit && window.__nm.beginText(hit.key) };
    });
    assert.equal(r.isFigure, true, `hit resolved to <${r.tag}>`);
    assert.equal(r.begin.readOnly, "diagram");
    assert.equal(await page.evaluate(() => !!document.querySelector("[data-nm-text-session]")), false, "no text session opened");
  });

  it("an ordinary heading on the same slide still opens a text session", async () => {
    const r = await page.evaluate(() => {
      const h = document.querySelector(".slide[data-nm-current] h2[data-nm-key]");
      const begin = window.__nm.beginText(h.getAttribute("data-nm-key"));
      window.__nm.endText(false);
      return begin;
    });
    assert.equal(typeof r.text, "string");
    assert.equal(r.readOnly, undefined);
  });

  it("the server refuses a text edit on the diagram and the file does not change", async () => {
    const figKey = await page.evaluate(() => document.querySelector(".slide[data-nm-current] figure.nm-diagram").getAttribute("data-nm-key"));
    const st = await api("/api/state");
    const r = await api("/api/ops", { ops: [{ kind: "setText", id: figKey, text: "نص فوق المخطط" }], baseVersion: st.json.version });
    assert.ok(r.status >= 400 && r.status < 500, `status ${r.status}`);
    assert.equal((await api("/api/save", {})).status, 200);
    assert.equal(readFileSync(deck, "utf8"), original);
  });

  it("opening and saving the v2 deck without edits leaves it byte-identical", async () => {
    assert.equal((await api("/api/save", {})).status, 200);
    assert.equal(readFileSync(deck, "utf8"), original);
  });

  it("a supported edit changes only the intended line", async () => {
    const key = await page.evaluate(() => document.querySelector(".slide[data-nm-current] h2[data-nm-key]").getAttribute("data-nm-key"));
    const st = await api("/api/state");
    const r = await api("/api/ops", { ops: [{ kind: "setText", id: key, text: "رحلة الحاوية المعدّلة" }], baseVersion: st.json.version });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal((await api("/api/save", {})).status, 200);
    const now = readFileSync(deck, "utf8");
    const changed = changedLines(original, now);
    assert.equal(changed.length, 1);
    assert.match(now.split("\n")[changed[0]], /رحلة الحاوية المعدّلة/);
  });
});

describe("diagram source editing (NM-23)", () => {
  it("the editor knows each diagram's DSL source", async () => {
    const st = await api("/api/state");
    const diagrams = st.json.info.diagrams;
    assert.ok(diagrams.length >= 3, `found ${diagrams.length} diagrams`);
    assert.ok(diagrams.every((d) => d.sourceKey), "every diagram has a source key");
    assert.equal(st.json.info.steps.length, (original.match(/\sdata-step="\d+"/g) ?? []).length, "every data-step reported");
  });

  it("editing the DSL changes one line of the file and the runtime redraws the diagram", async () => {
    const before = readFileSync(deck, "utf8");
    const figKey = await page.evaluate(() => document.querySelector(".slide[data-nm-current] figure.nm-diagram").getAttribute("data-nm-key"));
    const st = await api("/api/state");
    const diagram = st.json.info.diagrams.find((d) => d.key === figKey);
    const dsl = await page.evaluate((k) => document.querySelector(`[data-nm-key="${k}"]`).textContent, diagram.sourceKey);
    const line = dsl.split("\n").find((l) => /\[[^\]|]+/.test(l));
    const label = /\[([^\]|]+)/.exec(line)[1].trim();
    const next = dsl.replace(line, line.replace(label, "مرسى جديد"));
    const r = await api("/api/ops", { ops: [{ kind: "setText", id: diagram.sourceKey, text: next }], baseVersion: st.json.version });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal((await api("/api/save", {})).status, 200);
    const now = readFileSync(deck, "utf8");
    assert.equal(changedLines(before, now).length, 1);
    await page.goto(`${origin}/preview?t=${token}`); // the editor reloads its frame by URL (the deck rewrites location.hash)
    await page.waitForFunction(() => window.__nm && window.NM && document.body.classList.contains("nm-ready"));
    await page.evaluate(() => window.__nm.goTo(5));
    await page.waitForFunction(() => document.querySelector(".slide[data-nm-current] .nm-dg-canvas .nm-dg-node"));
    const labels = await page.evaluate(() => document.querySelector(".slide[data-nm-current] .nm-dg-canvas").textContent);
    assert.match(labels, /مرسى جديد/);
  });
});


describe("tables and formulas in the editor (NM-23 for NM-10, NM-11)", () => {
  // a second editor on the Arabic science deck of the golden corpus: native MathML, data-tex hosts, two tables
  let sDeck, sOriginal, sChild, sOrigin, sToken, sPage;
  const sApi = async (path, body) => {
    const r = await fetch(`${sOrigin}${path}${body ? "" : `?t=${sToken}`}`, body ? {
      method: "POST", body: JSON.stringify(body),
      headers: { "content-type": "application/json", origin: sOrigin, "x-nm-token": sToken },
    } : undefined);
    return { status: r.status, json: await r.json().catch(() => null) };
  };
  before(async () => {
    execFileSync("python3", [join(ROOT, "tests", "corpus", "build.py"), "--out", join(tmp, "corpus")], { stdio: "ignore" });
    sDeck = join(tmp, "corpus", "ar-science", "deck.html");
    sOriginal = readFileSync(sDeck, "utf8");
    sChild = spawn(process.execPath, [STUDIO, "edit", sDeck, "--no-open", "--port", "0"], { stdio: ["ignore", "pipe", "pipe"] });
    const info = await new Promise((ok, fail) => {
      let out = "";
      const t = setTimeout(() => fail(new Error("nm-studio did not start")), 20_000);
      sChild.stdout.on("data", (c) => { out += c; const m = /\{[\s\S]*\}\n/.exec(out); if (m) { clearTimeout(t); ok(JSON.parse(m[0])); } });
    });
    const url = new URL(info.url);
    sOrigin = url.origin; sToken = url.searchParams.get("t");
    sPage = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await sPage.goto(`${sOrigin}/preview?t=${sToken}`);
    await sPage.waitForFunction(() => window.__nm && window.NM && document.body.classList.contains("nm-ready"));
  });
  after(() => { sChild?.kill("SIGINT"); });

  it("the editor reports the tables and every formula with its source", async () => {
    const st = await sApi("/api/state");
    assert.deepEqual(st.json.info.tables.map((t) => [t.dataId, t.rows, t.columns, t.steps]), [["drops", 8, 5, "row"], ["air", 3, 4, "col"]]);
    const eq = st.json.info.equations;
    assert.equal(eq.filter((e) => e.kind === "mathml").length, 4);
    assert.equal(eq.filter((e) => e.kind === "tex").length, 3);
    assert.ok(eq.every((e) => e.key && e.source.length > 0));
  });

  it("formulas and sentences holding one are read-only for typing; a table cell is not", async () => {
    await sPage.evaluate(() => window.__nm.goTo(1));
    await sPage.waitForTimeout(300);
    const r = await sPage.evaluate(() => {
      const slide = document.querySelector(".slide[data-nm-current]");
      const mi = slide.querySelector("math mi[data-nm-key]");
      const li = slide.querySelector("li[data-nm-key]");
      const out = { mi: window.__nm.beginText(mi.getAttribute("data-nm-key")), li: window.__nm.beginText(li.getAttribute("data-nm-key")) };
      window.__nm.endText(false);
      return out;
    });
    assert.equal(r.mi.readOnly, "math");
    assert.equal(r.li.readOnly, "contains-math");
    assert.equal(await sPage.evaluate(() => !!document.querySelector("[data-nm-text-session]")), false);
    await sPage.evaluate(() => window.__nm.goTo(4));
    await sPage.waitForTimeout(300);
    const cell = await sPage.evaluate(() => {
      const td = document.querySelector(".slide[data-nm-current] td[data-nm-key]");
      const begin = window.__nm.beginText(td.getAttribute("data-nm-key"));
      window.__nm.endText(false);
      return begin;
    });
    assert.equal(typeof cell.text, "string");
  });

  it("the runtime's table steps, numeric classes and term morphs never reach the file; a no-op save is byte-identical", async () => {
    const live = await sPage.evaluate(() => ({
      steps: document.querySelectorAll("[data-nm-tb-step]").length,
      num: document.querySelectorAll(".nm-tb-num").length,
      terms: document.querySelectorAll("[data-nm-term-morph]").length,
      generated: document.querySelectorAll('[data-nm-generated="math"]').length,
    }));
    assert.ok(live.steps > 0 && live.num > 0 && live.terms > 0 && live.generated >= 3, JSON.stringify(live));
    assert.equal((await sApi("/api/save", {})).status, 200);
    assert.equal(readFileSync(sDeck, "utf8"), sOriginal);
  });

  it("a MathML edit, a TeX edit and a cell edit each change one line; retyping a formula is refused", async () => {
    let st = await sApi("/api/state");
    const eq = st.json.info.equations;
    const mathml = eq.find((e) => e.kind === "mathml");
    const tex = eq.find((e) => e.kind === "tex" && e.display);
    const refused = await sApi("/api/ops", { ops: [{ kind: "setText", id: eq.find((e) => e.kind === "tex").key, text: "x" }], baseVersion: st.json.version });
    assert.ok(refused.status >= 400 && refused.status < 500, `status ${refused.status}`);
    const steps = [
      { kind: "setText", id: mathml.key, text: mathml.source.replace('<mi data-term="t">t</mi>', '<mi data-term="t">T</mi>') },
      { kind: "setAttr", id: tex.key, name: "data-tex", value: tex.source.replace("{g}", "{g_0}") },
    ];
    for (const op of steps) {
      st = await sApi("/api/state");
      const r = await sApi("/api/ops", { ops: [op], baseVersion: st.json.version });
      assert.equal(r.status, 200, JSON.stringify(r.json));
    }
    assert.equal((await sApi("/api/save", {})).status, 200);
    const now = readFileSync(sDeck, "utf8");
    const changed = changedLines(sOriginal, now);
    assert.equal(changed.length, 2, "one line for the MathML, one for the TeX");
    assert.ok(changed.some((i) => now.split("\n")[i].includes('<mi data-term="t">T</mi>')));
    assert.ok(changed.some((i) => now.split("\n")[i].includes("{g_0}")));
    // the runtime renders the edited TeX again
    await sPage.goto(`${sOrigin}/preview?t=${sToken}`);
    await sPage.waitForFunction(() => window.__nm && window.NM && document.body.classList.contains("nm-ready"));
    const rendered = await sPage.evaluate(() => [...document.querySelectorAll("[data-tex]")].every((h) => h.querySelector(':scope > math[data-nm-generated="math"]')));
    assert.equal(rendered, true);
  });
});
