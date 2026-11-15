#!/usr/bin/env node
// A/B evaluation of the skill (roadmap NM-27). Node >= 20, no npm dependencies; Python 3 and Chrome for the gates.
//
//   node eval/score.mjs <runsA> <runsB> [--out DIR] [--no-check] [--packets] [--verdicts DIR]
//
// <runsA>/<id>/ and <runsB>/<id>/ are the project folders the two versions of the skill produced for prompt <id>
// (eval/prompts.md). For each prompt and side it runs the gates (plan-lint, audit-deck, check) and reads:
//   gates      plan-lint passed, audit passed, check errors
//   quality    the check quality score (quality.json), HOLD / FIX / NOTE counts
//   density    visible words per slide, figures (svg, img, figure, table, math) per 100 words
//   motion     plan-lint motion average
//   advice     share of described slides whose representation fits (plan-advise), when the plan describes them
//   tokens     usage.json, when present
// It writes DIR/comparison.json and DIR/comparison.md (deterministic for the same inputs). --packets writes blind
// judging packets (eval/judge.md); --verdicts DIR reads the judges' answers and reports wins, ties and losses.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HELPER = join(ROOT, "scripts", "deck_helper.py");

function args(argv) {
  const o = { runs: [], check: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") o.out = argv[++i];
    else if (a === "--no-check") o.check = false;
    else if (a === "--packets") o.packets = true;
    else if (a === "--verdicts") o.verdicts = argv[++i];
    else o.runs.push(a);
  }
  return o;
}

const py = (...a) => spawnSync("python3", [HELPER, ...a], { encoding: "utf8", env: { ...process.env, NM_FONTS_BUNDLED_ONLY: process.env.NM_FONTS_BUNDLED_ONLY ?? "" } });
const readJson = (p) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; } };

function deckOf(dir) {
  if (existsSync(join(dir, "deck.html"))) return join(dir, "deck.html");
  const html = readdirSync(dir).filter((f) => f.endsWith(".html")).sort();
  return html.length ? join(dir, html[0]) : null;
}

/** Words and figures of the deck's visible slide text, with the same rules as audit-deck (formulas and tables apart). */
function density(html) {
  const body = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<template[\s\S]*?<\/template>|<aside[\s\S]*?<\/aside>|<math[\s\S]*?<\/math>|<table[\s\S]*?<\/table>/g, " ");
  const slides = (html.match(/<section[^>]*class="[^"]*\bslide\b/g) || []).length || 1;
  const words = body.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  const figures = (html.match(/<(svg|img|figure|table|math|iframe)\b/g) || []).length;
  return { slides, words_per_slide: Math.round((words / slides) * 10) / 10, figures_per_100_words: words ? Math.round((figures / words) * 1000) / 10 : 0 };
}

function measure(dir, check, outDir) {
  const r = { dir, deck: null };
  const deck = deckOf(dir);
  if (!deck) return { ...r, missing: true };
  r.deck = deck;
  const plan = join(dir, "deck.plan.json");
  if (existsSync(plan)) {
    const lint = py("plan-lint", "--plan", plan, "--output", join(outDir, "lint.json"));
    const rep = readJson(join(outDir, "lint.json")) || {};
    r.plan_lint = { passed: lint.status === 0, errors: (rep.errors || []).length, warnings: (rep.warnings || []).length, motion_average: rep.motion_summary?.average ?? null };
    const adv = py("plan-advise", "--plan", plan, "--output", join(outDir, "advice.json"));
    const advice = adv.status === 0 ? readJson(join(outDir, "advice.json")) : null;
    const described = (advice?.slides || []).filter((s) => s.fit !== "unknown");
    r.advice = described.length ? { described: described.length, fitting: Math.round((described.filter((s) => s.fit === "good" || s.fit === "fair").length / described.length) * 100) / 100 } : null;
  }
  const audit = py("audit-deck", "--html-path", deck, "--output", join(outDir, "audit.json"));
  const ar = readJson(join(outDir, "audit.json")) || {};
  r.audit = { passed: audit.status === 0, errors: (ar.errors || []).length, warnings: (ar.warnings || []).length };
  const shots = join(outDir, "shots");
  if (check) spawnSync(process.execPath, [join(ROOT, "scripts", "deck_check.mjs"), deck, "--shots", shots], { encoding: "utf8" });
  const q = readJson(join(shots, "quality.json"));
  r.check = q ? { errors: q.summary.HOLD, score: q.score, HOLD: q.summary.HOLD, FIX: q.summary.FIX, NOTE: q.summary.NOTE, sheet: existsSync(join(shots, "contact-sheet.png")) ? join(shots, "contact-sheet.png") : null } : null;
  r.density = density(readFileSync(deck, "utf8"));
  const usage = readJson(join(dir, "usage.json"));
  r.tokens = usage ? (usage.input_tokens || 0) + (usage.output_tokens || 0) : null;
  return r;
}

/** One number per side for a quick read; the gates come first, then quality. Not a replacement for the judges. */
function points(m) {
  if (!m || m.missing) return 0;
  let p = 0;
  if (m.plan_lint?.passed !== false) p += 20;
  if (m.audit?.passed) p += 20;
  if (m.check) p += 20 * (m.check.HOLD === 0 ? 1 : 0) + 30 * (m.check.score / 100);
  if (m.advice) p += 10 * m.advice.fitting;
  return Math.round(p * 10) / 10;
}

/** Fixed but unguessable order of A and B for prompt `id`: X is A when the first byte of sha256(id) is even. */
const xIsA = (id) => createHash("sha256").update(id).digest()[0] % 2 === 0;

function main() {
  const o = args(process.argv.slice(2));
  if (o.runs.length !== 2) {
    console.error("usage: node eval/score.mjs <runsA> <runsB> [--out DIR] [--no-check] [--packets] [--verdicts DIR]");
    process.exit(1);
  }
  const [A, B] = o.runs.map((p) => resolve(p));
  const out = resolve(o.out ?? join(dirname(A), "eval-out"));
  mkdirSync(out, { recursive: true });
  const ids = [...new Set([...readdirSync(A), ...readdirSync(B)])].filter((id) => existsSync(join(A, id)) || existsSync(join(B, id))).sort();
  const rows = [];
  for (const id of ids) {
    const sides = {};
    for (const [label, root] of [["A", A], ["B", B]]) {
      const dir = join(root, id);
      const work = join(out, "work", label, id);
      mkdirSync(work, { recursive: true });
      sides[label] = existsSync(dir) ? measure(dir, o.check, work) : { missing: true };
    }
    const pa = points(sides.A), pb = points(sides.B);
    rows.push({ id, A: sides.A, B: sides.B, points: { A: pa, B: pb }, lead: pa === pb ? "tie" : pa > pb ? "A" : "B" });
  }
  const summary = { prompts: rows.length, B_wins: rows.filter((r) => r.lead === "B").length, ties: rows.filter((r) => r.lead === "tie").length, A_wins: rows.filter((r) => r.lead === "A").length };
  const result = { schema: "nevermind-eval/1", A: basename(A), B: basename(B), summary, rows: rows.map((r) => ({ ...r, A: strip(r.A), B: strip(r.B) })) };

  if (o.packets) {
    const pk = join(out, "packets");
    const key = {};
    for (const r of rows) {
      const dir = join(pk, r.id);
      mkdirSync(dir, { recursive: true });
      const order = xIsA(r.id) ? ["A", "B"] : ["B", "A"];
      key[r.id] = { X: order[0], Y: order[1] };
      order.forEach((side, k) => { const sheet = r[side]?.check?.sheet; if (sheet) copyFileSync(sheet, join(dir, `${"XY"[k]}.png`)); });
    }
    writeFileSync(join(out, "key.json"), JSON.stringify(key, null, 1) + "\n");
  }
  if (o.verdicts) {
    const key = readJson(join(out, "key.json")) || {};
    const v = { judged: 0, B_wins: 0, ties: 0, A_wins: 0, B_incorrect_where_A_correct: [] };
    for (const r of rows) {
      const ans = readJson(join(resolve(o.verdicts), `${r.id}.json`));
      const k = key[r.id];
      if (!ans || !k) continue;
      v.judged++;
      const winner = ans.verdict === "tie" ? "tie" : k[ans.verdict];
      if (winner === "B") v.B_wins++; else if (winner === "A") v.A_wins++; else v.ties++;
      const side = (s) => ans[k.X === s ? "X" : "Y"] || {};
      if (side("A").correct !== false && side("B").correct === false) v.B_incorrect_where_A_correct.push(r.id);
    }
    v.win_or_tie = v.judged ? Math.round(((v.B_wins + v.ties) / v.judged) * 100) / 100 : null;
    v.accepted = v.judged > 0 && v.win_or_tie >= 0.7 && v.B_incorrect_where_A_correct.length === 0;
    result.verdicts = v;
  }
  writeFileSync(join(out, "comparison.json"), JSON.stringify(result, null, 1) + "\n");
  const md = ["| prompt | A points | B points | lead | A check | B check | A words/slide | B words/slide |", "|---|---|---|---|---|---|---|---|"];
  for (const r of rows) {
    const c = (m) => (m?.check ? `${m.check.score} (H${m.check.HOLD} F${m.check.FIX})` : "-");
    md.push(`| ${r.id} | ${r.points.A} | ${r.points.B} | ${r.lead} | ${c(r.A)} | ${c(r.B)} | ${r.A?.density?.words_per_slide ?? "-"} | ${r.B?.density?.words_per_slide ?? "-"} |`);
  }
  md.push("", `B leads ${summary.B_wins}, ties ${summary.ties}, A leads ${summary.A_wins} (gates and quality only; the judges decide).`);
  if (result.verdicts) md.push(`Judges: B wins or ties on ${Math.round((result.verdicts.win_or_tie ?? 0) * 100)}% of ${result.verdicts.judged}; ${result.verdicts.accepted ? "accepted" : "not accepted"}.`);
  writeFileSync(join(out, "comparison.md"), md.join("\n") + "\n");
  console.log(md.join("\n"));
  console.log(`\nWritten: ${join(out, "comparison.json")}`);
}

/** Paths that differ between machines are kept out of the comparison so it reads the same everywhere. */
function strip(m) {
  if (!m) return m;
  const { dir, deck, ...rest } = m;
  if (rest.check) rest.check = { ...rest.check, sheet: rest.check.sheet ? basename(rest.check.sheet) : null };
  return rest;
}

main();
