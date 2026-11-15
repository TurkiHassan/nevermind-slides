// Visual baseline (roadmap NM-07) and motion metrics (NM-08) in deck_check: an unchanged deck matches its baseline
// exactly, one changed word is caught with a diff image, and the full-speed pass reports each arrival.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
let tmp, deck;
const check = (...args) => {
  const r = spawnSync(process.execPath, [join(ROOT, "scripts", "deck_check.mjs"), deck, ...args], { encoding: "utf8" });
  assert.notEqual(r.status, 2, `Chrome missing: ${r.stderr}`);
  return r;
};
const report = (dir) => JSON.parse(readFileSync(join(dir, "report.json"), "utf8"));

before(() => {
  tmp = mkdtempSync(join(tmpdir(), "nm-baseline-"));
  execFileSync("python3", [join(ROOT, "tests", "corpus", "build.py"), "--out", tmp], { stdio: "ignore" });
  deck = join(tmp, "ar-example", "deck.html");
});
after(() => { if (tmp) rmSync(tmp, { recursive: true, force: true }); });

describe("visual baseline (NM-07)", () => {
  it("an unchanged deck matches its baseline exactly; one changed word is caught with a diff image", () => {
    const base = join(tmp, "base");
    check("--slides", "1-2", "--shots", join(tmp, "a"), "--save-baseline", base);
    assert.ok(existsSync(join(base, "s01.png")) && existsSync(join(base, "s02.png")));
    check("--slides", "1-2", "--shots", join(tmp, "b"), "--baseline", base);
    const same = report(join(tmp, "b"));
    for (const s of same.slides) {
      assert.deepEqual(s.baseline.map((b) => b.ratio), [0], `slide ${s.slide}`);
      assert.equal(s.issues.filter((i) => i.code === "C-BASELINE").length, 0);
    }
    writeFileSync(deck, readFileSync(deck, "utf8").replace("كيف يتعلّم الدماغ</h1>", "كيف يتعلّم العقل</h1>"));
    const r = check("--slides", "1-2", "--shots", join(tmp, "c"), "--baseline", base, "--baseline-strict");
    const changed = report(join(tmp, "c"));
    const hit = changed.slides[0].issues.find((i) => i.code === "C-BASELINE");
    assert.ok(hit && hit.severity === "error", JSON.stringify(changed.slides[0].issues));
    assert.ok(existsSync(join(tmp, "c", "diff", "s01.png")), "diff image written");
    assert.deepEqual(changed.slides[1].issues.filter((i) => i.code === "C-BASELINE"), [], "the untouched slide stays clean");
    assert.equal(r.status, 1, "strict mode fails the check");
  });
});

describe("motion metrics (NM-08)", () => {
  it("every checked slide gets its full-speed arrival measured", () => {
    check("--slides", "1-3", "--shots", join(tmp, "m"), "--motion");
    for (const s of report(join(tmp, "m")).slides) {
      assert.ok(s.motion, `slide ${s.slide}`);
      assert.ok(s.motion.settle_ms > 0 && s.motion.settle_ms < 5000, `slide ${s.slide}: ${s.motion.settle_ms}ms`);
      assert.ok(s.motion.max_running >= 0);
      assert.equal(s.motion.observer, true, "long animation frames observed");
    }
  });
});
