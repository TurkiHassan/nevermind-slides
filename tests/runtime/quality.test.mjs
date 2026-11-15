// Visual quality checks (NM-05) and quality.json (NM-06): every code fires on the slide built to break it, stays
// silent on clean slides, and stays silent on the finished showcase except for its known diagram fill notes.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const HELPER = join(ROOT, "scripts", "deck_helper.py");
const NEW_CODES = ["C-FRAME", "C-ARABIC", "C-EMPTY", "C-FILL", "C-DRIFT", "C-BIDI", "C-WIDOW", "C-DENSITY"];
let tmp;

function stage(src, name) {
  const project = join(tmp, name);
  cpSync(src, project, { recursive: true });
  for (const cmd of ["stage-fonts", "stage-runtime"]) execFileSync("python3", [HELPER, cmd, "--target-dir", project], { stdio: "ignore" });
  return project;
}
function check(project) {
  const shots = join(project, "shots");
  const r = spawnSync(process.execPath, [join(ROOT, "scripts", "deck_check.mjs"), join(project, "deck.html"), "--shots", shots], { encoding: "utf8" });
  assert.notEqual(r.status, 2, `Chrome missing: ${r.stderr}`);
  return { status: r.status, report: JSON.parse(readFileSync(join(shots, "report.json"), "utf8")), quality: JSON.parse(readFileSync(join(shots, "quality.json"), "utf8")) };
}
const codesOn = (report, slide) => report.slides.find((s) => s.slide === slide).issues.filter((i) => NEW_CODES.includes(i.code));

before(() => { tmp = mkdtempSync(join(tmpdir(), "nm-quality-")); });
after(() => { if (tmp) rmSync(tmp, { recursive: true, force: true }); });

describe("quality codes on the violations fixture", () => {
  let res;
  before(() => { res = check(stage(join(ROOT, "tests", "quality", "violations"), "violations")); });

  const expect = (slide, code, severity) => {
    const hit = codesOn(res.report, slide).filter((i) => i.code === code && (!severity || i.severity === severity));
    assert.ok(hit.length > 0, `slide ${slide}: expected ${code}${severity ? " " + severity : ""}, got ${JSON.stringify(codesOn(res.report, slide).map((i) => i.code))}`);
    return hit;
  };
  it("C-FRAME: an empty frame is an error", () => expect(2, "C-FRAME", "error"));
  it("C-ARABIC: letter-spacing and a split word are errors", () => {
    const hits = expect(3, "C-ARABIC", "error");
    assert.ok(hits.some((h) => /letter-spacing/.test(h.message)));
    assert.ok(hits.some((h) => /split/.test(h.message)));
  });
  it("C-ARABIC digits and C-BIDI are warnings; the isolated run is not flagged", () => {
    expect(4, "C-ARABIC", "warn");
    const bidi = expect(4, "C-BIDI", "warn");
    assert.equal(bidi.length, 1, "only the unisolated paragraph");
  });
  it("C-WIDOW", () => expect(5, "C-WIDOW"));
  it("C-DENSITY", () => expect(6, "C-DENSITY"));
  it("C-EMPTY", () => expect(7, "C-EMPTY"));
  it("C-FILL", () => expect(8, "C-FILL"));
  it("C-DRIFT marks only the slide whose title moved", () => {
    expect(11, "C-DRIFT");
    for (const s of [9, 10, 12]) assert.deepEqual(codesOn(res.report, s).filter((i) => i.code === "C-DRIFT"), [], `slide ${s}`);
  });
  it("clean slides raise none of the new codes", () => {
    for (const s of [1, 13]) assert.deepEqual(codesOn(res.report, s), [], `slide ${s}`);
  });
  it("errors fail the check; quality.json classifies every finding", () => {
    assert.equal(res.status, 1);
    const q = res.quality;
    assert.equal(q.schema, "nevermind-quality/1");
    const findings = [...q.deck, ...q.slides.flatMap((s) => s.findings)];
    assert.ok(findings.length > 0);
    for (const f of findings) {
      assert.ok(["HOLD", "FIX", "NOTE"].includes(f.tier), f.code);
      assert.ok(["confident", "likely", "possible"].includes(f.confidence), f.code);
      assert.ok(f.fix.length > 0, `${f.code} has a fix hint`);
    }
    assert.ok(q.summary.HOLD >= 3, "frame and Arabic errors are HOLD");
    assert.equal(q.slides.find((s) => s.slide === 13).score, 100);
    assert.ok(q.slides.find((s) => s.slide === 3).score <= 50);
  });
});

describe("quality codes on the finished showcase (false-positive guard)", () => {
  it("passes, with only the known diagram-fill notes", () => {
    const res = check(stage(join(ROOT, "examples", "showcase"), "showcase"));
    assert.equal(res.status, 0, JSON.stringify(res.report.slides.flatMap((s) => s.issues.filter((i) => i.severity === "error"))));
    const found = res.report.slides.flatMap((s) => codesOn(res.report, s.slide).map((i) => `${s.slide}:${i.code}`));
    assert.deepEqual(found.sort(), ["13:C-FILL", "6:C-FILL", "9:C-FILL"]);
    assert.ok(res.quality.score >= 99, `score ${res.quality.score}`);
  });
});
