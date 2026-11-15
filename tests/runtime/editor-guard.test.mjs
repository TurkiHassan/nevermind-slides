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
