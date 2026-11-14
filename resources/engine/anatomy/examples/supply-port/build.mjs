// Supply port: one berth of a container terminal. A quay crane takes boxes off the ship,
// sets them on a two-slot buffer stack, and loads each waiting truck, which drives out
// through the gate. Motion and readout come from port-model.mjs.
//   node build.mjs            writes supply-port.html (dark)
//   node build.mjs --light    writes supply-port-light.html
//   node build.mjs --svg      also writes supply-port.svg (static, standalone, for slides)
//   node build.mjs --audit    proves the geometry (must end "audit passed")
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../kit/iso-kit.mjs";
import * as A from "../../kit/audit.mjs";
import * as S from "../../kit/scene.mjs";
import { kitScript } from "../../scripts/inline-kit.mjs";
import { GEOM, RATES, CYCLES, PERIOD, stateAt } from "./port-model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv;
const theme = argv.includes("--light") ? "light" : "dark";
const WIDTH = 640;
const HEIGHT = 420;

// ---------------------------------------------------------------- world layout (1 unit = 0.5 m)
const QUAY = { x: -12, y: -82, w: 134, d: 168 };
const SEA = { x: -66, y: -82, w: 54, d: 168 };
const SEA_Z = -3;
const SHIP = { at: [-30, -12, SEA_Z], len: 136, beam: 22, h: 10 };
const Y = GEOM.craneY;
const CRANE = { ly: 15, back: 56 };
const C = S.craneGeometry(CRANE);
const LANE2 = 17;

const P = k.fitProjection([...k.boxCorners(QUAY, -4, 0), ...k.boxCorners(SEA, -5, 0), [C.xw, Y, C.apex + 3], [C.xw, -37.5, C.apex + 3]], WIDTH, HEIGHT, { pad: 18, azimuth: 40 });

const R = A.recorder(P);
const sc = S.scene(P, { recorder: R, settle: A.settle });

// ---------------------------------------------------------------- the quay and the water
const lanes = () => {
  let d = "";
  let marks = "";
  for (const x of [GEOM.lane, LANE2]) {
    d += k.lineOnTop([x - 4, QUAY.y + 3], [x - 4, QUAY.y + QUAY.d - 3], 0, P) + k.lineOnTop([x + 4, QUAY.y + 3], [x + 4, QUAY.y + QUAY.d - 3], 0, P);
    for (let y = QUAY.y + 6; y < QUAY.y + QUAY.d - 8; y += 9) marks += k.onTop([[x - 0.25, y], [x + 0.25, y], [x + 0.25, y + 4], [x - 0.25, y + 4]], 0, P, true);
  }
  const rail = [-6, 22].map((x) => k.lineOnTop([x, QUAY.y + 3], [x, QUAY.y + QUAY.d - 3], 0, P)).join("");
  const arrows = [S.floorArrow(P, { at: [GEOM.lane, -70], rot: 1, len: 7 }), S.floorArrow(P, { at: [LANE2, 50], rot: 3, len: 7 })].join("");
  const edge = k.lineOnTop([QUAY.x + 1.2, QUAY.y + 3], [QUAY.x + 1.2, QUAY.y + QUAY.d - 3], 0, P);
  return k.lineSvg(d, { tone: "lo" }) + k.lineSvg(marks, { tone: "mid" }) + k.lineSvg(rail, { tone: "mid" }) + k.lineSvg(edge, { tone: "mid" }) + arrows;
};
sc.add(S.ground(P, { id: "stand.quay", at: [QUAY.x + QUAY.w / 2, 0, 0], w: QUAY.w, d: QUAY.d, h: 4, r: 2, grid: 0, inset: 3, decals: lanes() }));
sc.add(S.water(P, { id: "stand.sea", at: [SEA.x + SEA.w / 2, 0, SEA_Z], w: SEA.w, d: SEA.d, h: 2, ripples: 40 }));

// ---------------------------------------------------------------- the ship and its load
const ship = S.ship(P, { id: "ship", at: SHIP.at, len: SHIP.len, beam: SHIP.beam, h: SHIP.h });
sc.add(ship);
const bayAt = ship.anchors.bayAt;
const box = (id, at, o = {}) => S.container(P, { id, at, rot: 1, detail: 2, ...o });
const tones = ["mid", "lo", "hi", "mid", "lo", "mid"];
const shipLoad = [];
[[3, 3, 3], [2, 3, 1]].forEach((heights, b) => heights.forEach((n, row) => {
  for (let t = 0; t < n; t++) shipLoad.push(box(`ship.b${b}r${row}t${t}`, bayAt(b, row, 3, t), { tone: tones[(b * 3 + row + t) % 6] }));
}));
for (let row = 0; row < 3; row++) shipLoad.push(box(`ship.b2r${row}t0`, bayAt(2, row, 3, 0), { tone: tones[row + 2] }));
sc.add(shipLoad);
// the six boxes this loop unloads: rows 0-2 on tier 2, then rows 0-2 on tier 1
const shipBoxAt = (c) => bayAt(2, c % 3, 3, c < 3 ? 2 : 1);
for (let c = 0; c < CYCLES; c++) sc.mover(`shipBox${c}`, [shipBoxAt(c)], (at) => box(`sb${c}`, at, { tone: c % 2 ? "mid" : "lo" }));

// ---------------------------------------------------------------- cranes
sc.add(S.quayCrane(P, { id: "crane", at: [0, Y], ...CRANE }));
sc.add(S.quayCrane(P, { id: "crane2", at: [0, -37.5], ...CRANE, trolley: -30, hook: 26.4 }));

// ---------------------------------------------------------------- buffer stack and yard
const SLOT_Z = 5.2;
GEOM.slots.forEach((x, i) => sc.add(box(`stack.base${i}`, [x, Y, 0], { tone: i ? "lo" : "mid" })));
GEOM.slots.forEach((x, i) => sc.mover(`slot${i}`, [[x, Y, SLOT_Z]], (at) => box(`slotbox${i}`, at, { tone: i ? "mid" : "hi" })));
sc.add(S.containerStack(P, { id: "yardA", at: [64, -6], rot: 1, rows: 4, cols: 2, heights: (r, c) => [3, 2, 3, 1, 2, 3, 2, 1][r * 2 + c] }));
sc.add(S.containerStack(P, { id: "yardB", at: [64, 50], rot: 1, rows: 4, cols: 1, heights: (r) => [2, 3, 1, 2][r] }));
sc.add(S.gantryCrane(P, { id: "rtg", at: [64, -6], span: 30, d: 10, h: 20, rot: 0, trolley: 4 }));

// ---------------------------------------------------------------- landside
sc.add(S.warehouse(P, { id: "shed", at: [98, -62], w: 40, d: 22, h: 9, doors: 4 }));
sc.add(S.truck(P, { id: "truck.dock", at: [92, -31], rot: 1, load: "box", detail: 1 }));
sc.add(S.forklift(P, { id: "forklift", at: [106, -42], rot: 3 }));
sc.add(S.pallet(P, { id: "pallet1", at: [113, -44] }), S.pallet(P, { id: "pallet2", at: [113, -38.5], load: 2 }));
sc.add(S.building(P, { id: "office", at: [100, 66], w: 22, d: 14, floors: 3, floorH: 5.6, bay: 3.6 }));
sc.add(S.gate(P, { id: "gate", at: [11.5, 74], rot: 1, w: 22, d: 8, h: 10, open: [1] }));
sc.add(S.truck(P, { id: "truck.queue", at: [LANE2, -56], rot: 1, load: "flat", cabTone: "mid" }));
sc.add(S.container(P, { id: "truck.queue.box", at: [LANE2, -61, 2.8], rot: 1, tone: "mid" }));
sc.add(S.person(P, { id: "checker", at: [21, 79] }), S.person(P, { id: "lasher", at: [-6, -12] }), S.person(P, { id: "foreman", at: [-4, -9.4], h: 3.4 }));
for (const [i, y] of [-74, -60, -14, 36, 58, 76].entries()) sc.add(S.bollard(P, { id: `bollard${i}`, at: [-10.2, y] }));
for (const [i, at] of [[40, -24], [40, 46], [86, 24]].entries()) sc.add(S.lightMast(P, { id: `mast${i}`, at, h: 34 }));
for (const [i, y] of [-74, -68].entries()) sc.add(S.cone(P, { id: `cone${i}`, at: [LANE2 + 4.6, y] }));

// ---------------------------------------------------------------- movers (the live parts)
const xs = [...new Set([...Array.from({ length: 25 }, (_, i) => -36 + i * 3), ...GEOM.rows, GEOM.lane, ...GEOM.slots].map((v) => Math.round(v * 10) / 10))].sort((a, b) => a - b);
const hoistStations = [];
for (const x of xs) hoistStations.push([x, Y, GEOM.safe]);
const drop = (x, low) => {
  for (let z = GEOM.safe - 2.5; z > low + 0.01; z -= 2.5) hoistStations.push([x, Y, Math.round(z * 10) / 10]);
  hoistStations.push([x, Y, low]);
};
GEOM.rows.forEach((x) => drop(x, GEOM.pickHooks[1]));
GEOM.slots.forEach((x) => drop(x, GEOM.slotHook));
drop(GEOM.lane, GEOM.truckHook);
const parts = (at, o = {}) => S.craneParts(P, { id: "live", crane: C, at: [0, Y], x: at[0], hook: at[2], lit: true, ...o });
sc.mover("trolley", xs.map((x) => [x, Y, 0]), (at) => parts([at[0], 0, GEOM.safe]).trolley);
sc.mover("hoist", hoistStations, (at) => parts(at).hoist);
const cargoStations = hoistStations.filter(([x, , z]) => !(GEOM.rows.includes(x) && z < GEOM.pickHooks[0] - 0.01 && z > GEOM.pickHooks[1] + 0.01));
sc.mover("cargo", cargoStations, (at) => box("cargo", [at[0], at[1], at[2] - 5.2], { tone: "hi", lit: true }));
const truckStations = [];
for (let y = GEOM.truckIn; y < GEOM.truckOut; y += 6) truckStations.push([GEOM.lane, y, 0]);
truckStations.push([GEOM.lane, GEOM.truckStop, 0], [GEOM.lane, GEOM.truckOut, 0]);
truckStations.sort((a, b) => a[1] - b[1]);
const truckAt = (at) => S.truck(P, { id: "rig", at, rot: 1, load: "flat", cabTone: "hi" });
sc.mover("truck", truckStations, truckAt);
const BED = 2.8;
sc.mover("truckBox", truckStations, (at) => box("tbox", [at[0], at[1] - 5, BED], { tone: "hi", lit: true }));

// ---------------------------------------------------------------- settle, audit, write
const STILL_T = 112;
const still = stateAt(STILL_T);
const nearestIndex = (list, p) => list.reduce((best, s, i) => ((s[0] - p[0]) ** 2 + (s[1] - p[1]) ** 2 + (s[2] - p[2]) ** 2 < (list[best][0] - p[0]) ** 2 + (list[best][1] - p[1]) ** 2 + (list[best][2] - p[2]) ** 2 ? i : best), 0);
const start = {
  trolley: nearestIndex(xs.map((x) => [x, Y, 0]), [still.x, Y, 0]),
  hoist: nearestIndex(hoistStations, [still.x, Y, still.hook]),
  cargo: nearestIndex(cargoStations, [still.x, Y, still.hook]),
  truck: nearestIndex(truckStations, [GEOM.lane, still.truck.y, 0]),
  truckBox: nearestIndex(truckStations, [GEOM.lane, still.truck.y, 0]),
};
const t0 = Date.now();
const body = sc.build({ start });
if (!argv.includes("--quiet")) console.log(`settled ${R.items.length} items in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
A.auditOrExit(R, P);
if (argv.includes("--audit")) process.exit(process.exitCode ?? 0);

const LABEL = "A container quay seen from the land side. A ship lies alongside with three bays of containers. A ship-to-shore crane lifts a box from the ship, carries it along its boom and sets it on a two-slot buffer stack, then lifts the other box from the stack onto a waiting truck, which drives out through the gate. A second crane, a yard gantry over the container yard, a warehouse with roller doors and an office stand behind.";
const data = sc.moverData();

// the static picture: everything drawn at the still moment, for slides
function stillBody() {
  const keep = { ...start };
  const visible = {
    cargo: Boolean(still.carry),
    truck: still.truck.show,
    truckBox: still.truck.show && still.truck.loaded,
    slot0: still.slotFull[0],
    slot1: still.slotFull[1],
  };
  for (let c = 0; c < CYCLES; c++) visible[`shipBox${c}`] = still.shipBoxes[c];
  return body.map((svg) => {
    const m = svg.match(/^<g data-slot="([^:]+):(\d+):(\d+)">/);
    if (!m) return svg;
    const [, name, station] = m;
    if (Number(station) !== (keep[name] ?? 0) || visible[name] === false) return "";
    const mover = data[name];
    const at = name === "trolley" ? [still.x, Y, 0] : name === "hoist" || name === "cargo" ? [still.x, Y, still.hook] : name.startsWith("truck") ? [GEOM.lane, still.truck.y, 0] : mover.ref;
    const shift = k.translateAlong(P, [at[0] - mover.ref[0], at[1] - mover.ref[1], at[2] - mover.ref[2]]);
    return svg.replace(/<g data-mover="[^"]*" data-item="\d+">/, `<g transform="${shift}">`).replace(/^<g data-slot="[^"]*">/, "<g>");
  });
}

if (argv.includes("--svg")) {
  writeFileSync(join(HERE, theme === "light" ? "supply-port-light.svg" : "supply-port.svg"), k.figureSvg({ width: WIDTH, height: HEIGHT, label: LABEL, body: stillBody(), standalone: theme }));
  console.log("wrote", theme === "light" ? "supply-port-light.svg" : "supply-port.svg");
}

const model = readFileSync(join(HERE, "port-model.mjs"), "utf8").replace(/^export /gm, "");
const live = `
${S.SCENE_LIVE}
${model}
const P = ${JSON.stringify(P)};
const DATA = ${JSON.stringify(data)};
const Y = ${Y}, LANE = ${GEOM.lane}, BED = ${BED}, SPEED = 6, STILL_T = ${STILL_T};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const M = moverRuntime(svg, P, DATA);
const ropeTop = ${C.girderZ + C.girderH};
let sim = STILL_T, last = 0, frame = 0, visible = false, paused = still.matches;
function draw() {
  const s = stateAt(sim);
  M.move("trolley", [s.x, Y, 0]);
  M.move("hoist", [s.x, Y, s.hook]);
  M.move("cargo", [s.x, Y, s.hook], { show: Boolean(s.carry) });
  for (let c = 0; c < CYCLES; c++) M.move("shipBox" + c, DATA["shipBox" + c].ref, { show: s.shipBoxes[c] });
  M.move("slot0", DATA.slot0.ref, { show: s.slotFull[0] });
  M.move("slot1", DATA.slot1.ref, { show: s.slotFull[1] });
  M.move("truck", [LANE, s.truck.y, 0], { show: s.truck.show, opacity: s.truck.opacity });
  M.move("truckBox", [LANE, s.truck.y, 0], { show: s.truck.show && s.truck.loaded, opacity: s.truck.opacity });
  const done = s.moves;
  const text = "move " + Math.min(2 * CYCLES, done + 1) + "/" + 2 * CYCLES + " · " + s.label + " · " + RATES.boxesPerHour.toFixed(0) + " boxes/h";
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuetext", text);
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
  last = now;
  if (!paused) sim += dt * SPEED;
  draw();
  frame = visible && !paused ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible && !paused) { last = 0; frame = requestAnimationFrame(tick); } };
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; run(); }, { rootMargin: "120px 0px" }).observe(stage);
const toggle = () => { paused = !paused; stage.setAttribute("aria-pressed", String(paused)); run(); draw(); };
stage.addEventListener("click", toggle);
stage.addEventListener("keydown", (event) => {
  if (event.key !== " " && event.key !== "Enter") return;
  event.preventDefault();
  toggle();
});
still.addEventListener?.("change", () => { paused = still.matches; run(); });
draw();
`;

const plate = k.plateHtml({
  fig: "Fig 1",
  title: "One berth, ship to road",
  hint: "Click or space to pause",
  readout: `move 1/${2 * CYCLES} · ${still.label} · ${RATES.boxesPerHour.toFixed(0)} boxes/h`,
  keys: [
    { mark: "lit", label: "The box being moved, the trolley and the spreader" },
    { mark: "raised", label: "Buffer stack: two slots under the backreach" },
    { mark: "flat", label: "Truck lane under the crane, out through the gate" },
  ],
  caption: `Each cycle the crane makes two moves: ship to stack, then stack to the waiting truck. With trolley 4 m/s, hoist 1.5 m/s loaded and 3 m/s empty, 12 s to land and lock and 6 s to unlock, one cycle takes ${RATES.cycleSeconds.toFixed(0)} s: ${RATES.boxesPerHour.toFixed(0)} boxes an hour reach the road. Shown at 6x speed; after six boxes the crane moves to the next bay.`,
  body: `<div class="iso-stage" tabindex="0" role="button" aria-pressed="false" aria-label="Container berth animation: space or enter pauses">${k.figureSvg({ width: WIDTH, height: HEIGHT, label: LABEL, body })}</div>`,
});
const name = theme === "light" ? "supply-port-light.html" : "supply-port.html";
writeFileSync(join(HERE, name), k.pageHtml({ title: "Supply port", theme, body: plate, script: kitScript() + live, width: 760 }));
console.log("wrote", name, `· period ${PERIOD.toFixed(0)} s · ${RATES.boxesPerHour.toFixed(1)} boxes/h`);
