#!/usr/bin/env node
// Validates a figure brief (references/subject-first.md, step 5).
//   node brief-check.mjs path/to/figure.brief.json [--build path/to/build.mjs]
// Prints "brief ok" and exits 0, or prints one line per problem and exits 1.
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const briefPath = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--build");
const buildPath = args.includes("--build") ? args[args.indexOf("--build") + 1] : null;

if (!briefPath) {
  console.log("usage: node brief-check.mjs path/to/figure.brief.json [--build path/to/build.mjs]");
  process.exit(1);
}

// Objects a figure may not be built around unless the topic itself names them.
export const BANNED = [
  { name: "dial indicator", match: /\bdial\b|\bdial[- ]?(gauge|indicator)\b/i, topic: /\bdial/i, instead: "draw the place where the number is produced and put the number in the readout" },
  { name: "gauge", match: /\bgauges?\b|\bmeter needle\b|\bneedle\b/i, topic: /\bgauge|\bmeter\b|\bneedle/i, instead: "draw the domain's control room or the working site itself" },
  { name: "test rig", match: /\btest[- ]?rig\b|\brig\b|\btest bench\b|\bbench\b/i, topic: /\brig\b|\btest bench|\bbench/i, instead: "draw the real workplace of the field" },
  { name: "lock", match: /\block\b|\bpadlock\b|\bpin[- ]?tumbler\b|\btumbler\b|\bkeyhole\b/i, topic: /\block\b|\bpadlock|\btumbler|\bkeyhole/i, instead: "draw the guarded thing: a gate with barrier and booth, a fenced server hall" },
  { name: "gauge panel", match: /\b(gauge|instrument) (panel|cluster)\b|\bdashboard\b/i, topic: /\bpanel\b|\bcluster\b|\bdashboard/i, instead: "draw the control room: desks, monitors, the people at them" },
  { name: "machine with knobs", match: /\bknobs?\b|\blevers?\b|\bmachine\b|\bcontraption\b|\bdevice\b/i, topic: /\bknob|\blever|\bmachine|\bdevice/i, instead: "draw the domain's own equipment (crane, conveyor, ambulance, turbine ...)" },
  { name: "plotter", match: /\bplotter\b|\bprint head\b/i, topic: /\bplotter|\bprint/i, instead: "draw the real shared resource (one crane serving many bays, one runway serving many aircraft)" },
  { name: "chest of drawers", match: /\bdrawers?\b|\bchest\b/i, topic: /\bdrawer|\bchest/i, instead: "draw a warehouse with racks, a container yard, or archive shelves" },
];

const errors = [];
const fail = (field, message) => errors.push(`brief-check: ${field}: ${message}`);

let brief;
try {
  brief = JSON.parse(readFileSync(briefPath, "utf8"));
} catch (error) {
  console.log(`brief-check: file: cannot read ${briefPath} as JSON (${error.message.split("\n")[0]}). Fix the JSON syntax.`);
  process.exit(1);
}

const isText = (v) => typeof v === "string" && v.trim().length > 0;
const words = (text) => String(text).toLowerCase().replace(/^scene\./, "").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1);
const stem = (w) => w.replace(/(ies)$/, "y").replace(/(es|s)$/, "");

// ---- types and counts
if (!isText(brief.topic)) fail("topic", "must be a non-empty string naming what the deck is about.");
const textList = (field, least) => {
  const value = brief[field];
  if (!Array.isArray(value)) return fail(field, `must be an array of strings (at least ${least}).`);
  const bad = value.filter((v) => !isText(v));
  if (bad.length) fail(field, `every entry must be a non-empty string; ${bad.length} are not.`);
  const unique = new Set(value.filter(isText).map((v) => v.trim().toLowerCase()));
  if (unique.size < least) fail(field, `has ${unique.size} distinct entries; needs at least ${least}. Add more from the source text.`);
};
textList("source_nouns", 12);
textList("verbs", 5);

if (!Array.isArray(brief.quantities) || brief.quantities.length < 3 || brief.quantities.length > 5) fail("quantities", `must list 3 to 5 quantities; found ${Array.isArray(brief.quantities) ? brief.quantities.length : "none"}.`);
(Array.isArray(brief.quantities) ? brief.quantities : []).forEach((q, i) => {
  if (!q || typeof q !== "object") return fail(`quantities[${i}]`, "must be an object { name, value, unit, source }.");
  if (!isText(q.name)) fail(`quantities[${i}].name`, "must be a non-empty string.");
  if (typeof q.value !== "number" || !Number.isFinite(q.value)) fail(`quantities[${i}].value`, `must be a number, not ${JSON.stringify(q.value)}.`);
  if (!isText(q.unit)) fail(`quantities[${i}].unit`, "must be a non-empty string (use \"count\" for plain counts).");
  if (!isText(q.source)) fail(`quantities[${i}].source`, "must say where the number comes from.");
});

const rung = brief.rung;
if (!Number.isInteger(rung) || rung < 1 || rung > 5) fail("rung", `must be an integer 1-5, not ${JSON.stringify(rung)}.`);
const rejected = Array.isArray(brief.rejected_rungs) ? brief.rejected_rungs : [];
if (!Array.isArray(brief.rejected_rungs)) fail("rejected_rungs", "must be an array of { rung, reason } (empty when rung is 1).");
rejected.forEach((r, i) => {
  if (!r || !Number.isInteger(r.rung) || r.rung < 1 || r.rung > 4) fail(`rejected_rungs[${i}].rung`, "must be an integer 1-4.");
  else if (Number.isInteger(rung) && r.rung >= rung) fail(`rejected_rungs[${i}].rung`, `rung ${r.rung} is not below the chosen rung ${rung}; only list rungs you skipped.`);
  if (!r || !isText(r.reason) || r.reason.trim().length < 10) fail(`rejected_rungs[${i}].reason`, "must give a real reason (10+ characters).");
});
if (Number.isInteger(rung)) {
  const have = new Set(rejected.filter((r) => r && isText(r.reason) && r.reason.trim().length >= 10).map((r) => r.rung));
  const missing = [];
  for (let r = 1; r < rung; r++) if (!have.has(r)) missing.push(r);
  if (rung === 5 && missing.length) fail("rung", `5 (metaphor machine) is the last resort: rejected_rungs must give reasons for rungs 1, 2, 3 and 4; missing ${missing.join(", ")}.`);
  else if (missing.length) fail("rejected_rungs", `chosen rung ${rung} skips rung${missing.length > 1 ? "s" : ""} ${missing.join(", ")} without a reason; add { "rung": ${missing[0]}, "reason": "..." }.`);
}

if (!isText(brief.subject)) fail("subject", "must be a non-empty string.");
if (!isText(brief.setting)) fail("setting", "must be a non-empty string.");
if (!isText(brief.moves)) fail("moves", "must be one sentence saying what moves and what it means.");
else if (brief.moves.split(/[.!?](\s|$)/).filter((s) => s && s.trim().length > 2).length > 2) fail("moves", "must be one sentence.");
if (!["static", "animated"].includes(brief.mode)) fail("mode", `must be "static" or "animated", not ${JSON.stringify(brief.mode)}.`);

const mapping = Array.isArray(brief.mapping) ? brief.mapping : [];
if (!Array.isArray(brief.mapping) || mapping.length < 6) fail("mapping", `needs at least 6 rows { part, meaning }; found ${mapping.length}.`);
mapping.forEach((m, i) => {
  if (!m || !isText(m.part)) fail(`mapping[${i}].part`, "must be a non-empty string.");
  if (!m || !isText(m.meaning)) fail(`mapping[${i}].meaning`, "must be a non-empty string.");
});

// ---- props exist
let propNames = [];
try {
  const scene = await import(join(HERE, "..", "kit", "scene.mjs"));
  propNames = Object.keys(scene.PROPS);
} catch {
  propNames = [];
}
const props = Array.isArray(brief.props) ? brief.props : [];
if (!Array.isArray(brief.props)) fail("props", "must be an array like [\"scene.truck\", \"scene.warehouse\"] (empty only with a custom subject).");
props.forEach((p, i) => {
  if (!isText(p) || !/^scene\.[A-Za-z]+$/.test(p)) return fail(`props[${i}]`, `must look like "scene.truck", not ${JSON.stringify(p)}.`);
  const name = p.slice(6);
  if (propNames.length && !propNames.includes(name)) fail(`props[${i}]`, `"${name}" is not a prop in kit/scene.mjs. Known: ${propNames.join(", ")}.`);
});

// ---- banned subjects
const topic = String(brief.topic ?? "");
for (const ban of BANNED) {
  if (topic && ban.topic.test(topic)) continue;
  if (isText(brief.subject) && ban.match.test(brief.subject)) fail("subject", `"${brief.subject}" is a ${ban.name}, which the topic does not mention. Instead: ${ban.instead}.`);
  const hits = mapping.filter((m) => m && isText(m.part) && ban.match.test(m.part)).map((m) => m.part);
  if (hits.length > 1) fail("mapping", `${hits.length} parts are ${ban.name} parts (${hits.join(", ")}) but the topic does not mention one. Instead: ${ban.instead}.`);
}

// ---- mapping parts come from the source or the props
const vocabulary = new Set([...(Array.isArray(brief.source_nouns) ? brief.source_nouns : []), ...props].flatMap(words).map(stem));
mapping.forEach((m, i) => {
  if (!m || !isText(m.part)) return;
  const own = words(m.part).map(stem);
  if (!own.some((w) => vocabulary.has(w))) fail(`mapping[${i}].part`, `"${m.part}" is not in source_nouns or props. Use a real noun from the source text or a prop you draw.`);
});
if (isText(brief.subject)) {
  const own = words(brief.subject).map(stem);
  if (!own.some((w) => vocabulary.has(w))) fail("subject", `"${brief.subject}" does not use any word from source_nouns or props.`);
}

// ---- the build script
if (buildPath) {
  if (!existsSync(buildPath)) fail("--build", `${buildPath} does not exist.`);
  else {
    const code = readFileSync(buildPath, "utf8");
    const usesScene = /from\s+["'][^"']*kit\/scene\.mjs["']/.test(code) || /import\(\s*["'][^"']*kit\/scene\.mjs["']\s*\)/.test(code);
    const custom = code.match(/\/\/\s*custom-subject:\s*(.*)/);
    if (!usesScene && !(custom && custom[1].trim().length >= 10)) fail("--build", "the build neither imports kit/scene.mjs nor declares \"// custom-subject: <reason>\" (10+ characters). Import the subject kit or say why the subject is custom.");
    props.forEach((p) => {
      if (!isText(p) || !p.startsWith("scene.")) return;
      const name = p.slice(6);
      if (!new RegExp(`\\b${name}\\s*\\(`).test(code)) fail("props", `"${p}" is listed but ${name}(...) is never called in ${buildPath}. Draw it or remove it from props.`);
    });
  }
}

if (errors.length) {
  for (const line of errors) console.log(line);
  console.log(`brief failed: ${errors.length} problem${errors.length === 1 ? "" : "s"}`);
  process.exit(1);
}
console.log("brief ok");
