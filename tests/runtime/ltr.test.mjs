// English, left-to-right decks (NM-09): the runtime takes its keys and its own words from the deck's direction and
// language. Built from the corpus plan tests/corpus/plans/en-general.plan.json.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const ARABIC = /[؀-ۿ]/;
let tmp, browser, page, url;

before(async () => {
  tmp = mkdtempSync(join(tmpdir(), "nm-ltr-"));
  execFileSync("python3", [join(ROOT, "tests", "corpus", "build.py"), "--out", tmp], { stdio: "ignore" });
  url = pathToFileURL(join(tmp, "en-general", "deck.html")).href;
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(url + "?nm-speed=0");
  await page.waitForFunction(() => document.body.classList.contains("nm-ready"));
});
after(async () => {
  await browser?.close();
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});
const state = () => page.evaluate(() => ({ slide: NM.deck.index + 1, step: NM.deck.stepIndex }));
const press = async (k) => { await page.keyboard.press(k); await page.evaluate(() => NM.test.settle()); };

describe("English deck, left to right", () => {
  it("is written left to right in English", () => {
    const html = readFileSync(join(tmp, "en-general", "deck.html"), "utf8");
    assert.match(html, /<html lang="en" dir="ltr">/);
    assert.match(html, /<body dir="ltr"/);
    const visible = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<script[\s\S]*?<\/script>/g, "");
    assert.equal(ARABIC.test(visible), false, "no Arabic left in the scaffold");
  });
  it("the right arrow goes forward and the left arrow back", async () => {
    await press("ArrowRight");
    assert.deepEqual(await state(), { slide: 2, step: 0 });
    await press("ArrowRight");
    assert.deepEqual(await state(), { slide: 2, step: 1 });
    await press("ArrowLeft");
    await press("ArrowLeft");
    assert.deepEqual(await state(), { slide: 1, step: 0 });
  });
  it("the runtime speaks English: controls, help and camera labels", async () => {
    const ui = await page.evaluate(() => ({
      nav: document.querySelector("#deckControls nav, #deckControls [aria-label]")?.getAttribute("aria-label") ?? "",
      controls: document.getElementById("deckControls")?.textContent ?? "",
      help: document.querySelector(".nm-help-card")?.textContent ?? "",
      firstKey: document.querySelector(".nm-help-card dt")?.textContent ?? "",
    }));
    assert.equal(ARABIC.test(ui.controls + ui.help + ui.nav), false, `Arabic in the chrome: ${ui.controls} ${ui.help}`);
    assert.match(ui.help, /Keyboard shortcuts/);
    assert.match(ui.firstKey, /→/, "the forward key in the help is the right arrow");
  });
});
