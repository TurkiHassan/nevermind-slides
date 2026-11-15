// The A/B evaluation harness (roadmap NM-27) on decks of the golden corpus: identical runs tie, a run that breaks a
// gate loses, the comparison is deterministic, blind packets hide which side is which, verdicts are counted.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SCORE = join(ROOT, "eval", "score.mjs");
let tmp;
const score = (...a) => spawnSync(process.execPath, [SCORE, ...a], { encoding: "utf8" });
const json = (p) => JSON.parse(readFileSync(p, "utf8"));

before(() => {
  tmp = mkdtempSync(join(tmpdir(), "nm-eval-"));
  const corpus = join(tmp, "corpus");
  execFileSync("python3", [join(ROOT, "tests", "corpus", "build.py"), "--out", corpus], { stdio: "ignore" });
  for (const side of ["A", "B"]) {
    for (const [id, deck] of [["ar-ops", "ar-advisor"], ["en-paper", "en-science"]]) {
      cpSync(join(corpus, deck), join(tmp, side, id), { recursive: true });
      cpSync(join(ROOT, "tests", "corpus", "plans", `${deck}.plan.json`), join(tmp, side, id, "deck.plan.json"));
    }
  }
  writeFileSync(join(tmp, "A", "ar-ops", "usage.json"), JSON.stringify({ input_tokens: 1000, output_tokens: 200 }));
});
after(() => { if (tmp) rmSync(tmp, { recursive: true, force: true }); });

describe("eval/score.mjs", () => {
  it("identical runs tie on every prompt, and the comparison is the same twice", () => {
    const r1 = score(join(tmp, "A"), join(tmp, "A"), "--out", join(tmp, "same1"), "--packets");
    assert.equal(r1.status, 0, r1.stderr);
    score(join(tmp, "A"), join(tmp, "A"), "--out", join(tmp, "same2"), "--no-check");
    const c = json(join(tmp, "same1", "comparison.json"));
    assert.deepEqual(c.summary, { prompts: 2, B_wins: 0, ties: 2, A_wins: 0 });
    const row = c.rows.find((r) => r.id === "ar-ops");
    assert.equal(row.A.tokens, 1200);
    assert.ok(row.A.check.score > 90 && row.A.audit.passed && row.A.plan_lint.passed);
    assert.ok(row.A.advice && row.A.advice.fitting === 1, "the advisor deck fits");
    assert.ok(row.A.density.figures_per_100_words > 0);
    const again = score(join(tmp, "A"), join(tmp, "A"), "--out", join(tmp, "same1"), "--no-check");
    assert.equal(again.status, 0);
    assert.deepEqual(json(join(tmp, "same1", "comparison.json")).rows, c.rows, "deterministic for the same inputs");
    for (const id of ["ar-ops", "en-paper"]) {
      assert.ok(existsSync(join(tmp, "same1", "packets", id, "X.png")) && existsSync(join(tmp, "same1", "packets", id, "Y.png")));
    }
  });

  it("a side that breaks a gate loses the quick read, and the judges' verdicts are counted with the key", () => {
    const broken = join(tmp, "B", "ar-ops", "deck.html");
    writeFileSync(broken, readFileSync(broken, "utf8").replace("assets/nm/nm-deck.js", "assets/nm/missing.js"));
    const r = score(join(tmp, "A"), join(tmp, "B"), "--out", join(tmp, "ab"), "--no-check", "--packets");
    assert.equal(r.status, 0, r.stderr);
    const c = json(join(tmp, "ab", "comparison.json"));
    assert.equal(c.rows.find((x) => x.id === "ar-ops").lead, "A");
    assert.equal(c.rows.find((x) => x.id === "ar-ops").B.audit.passed, false);
    const key = json(join(tmp, "ab", "key.json"));
    const vdir = join(tmp, "verdicts");
    mkdirSync(vdir);
    // the judge prefers B on en-paper and finds B wrong on ar-ops
    const xOf = (id, side) => (key[id].X === side ? "X" : "Y");
    writeFileSync(join(vdir, "en-paper.json"), JSON.stringify({ X: { correct: true }, Y: { correct: true }, verdict: xOf("en-paper", "B") }));
    writeFileSync(join(vdir, "ar-ops.json"), JSON.stringify({ [xOf("ar-ops", "A")]: { correct: true }, [xOf("ar-ops", "B")]: { correct: false }, verdict: xOf("ar-ops", "A") }));
    score(join(tmp, "A"), join(tmp, "B"), "--out", join(tmp, "ab"), "--no-check", "--verdicts", vdir);
    const v = json(join(tmp, "ab", "comparison.json")).verdicts;
    assert.deepEqual([v.judged, v.B_wins, v.A_wins, v.ties], [2, 1, 1, 0]);
    assert.deepEqual(v.B_incorrect_where_A_correct, ["ar-ops"]);
    assert.equal(v.win_or_tie, 0.5);
    assert.equal(v.accepted, false);
  });
});
