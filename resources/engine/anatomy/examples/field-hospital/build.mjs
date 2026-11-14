// Field hospital: a static diorama of a deployable medical unit. Casualties arrive by
// helicopter and ambulance at triage, move to the ward tents, and are supported by power,
// water, communications and a supply point. Static figure (layout is the idea).
//   node build.mjs            writes field-hospital.html (dark)
//   node build.mjs --light    writes field-hospital-light.html
//   node build.mjs --svg      also writes field-hospital.svg (standalone, for slides)
//   node build.mjs --audit    proves the geometry (must end "audit passed")
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../kit/iso-kit.mjs";
import * as A from "../../kit/audit.mjs";
import * as S from "../../kit/scene.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv;
const theme = argv.includes("--light") ? "light" : "dark";
const WIDTH = 620;
const HEIGHT = 400;

const SITE = { x: -60, y: -45, w: 120, d: 90 };
const PAD = [-36, 22]; // helipad centre
const P = k.fitProjection([...k.boxCorners(SITE, -3, 0), [0, 0, 26]], WIDTH, HEIGHT, { pad: 20, azimuth: 45 });

const R = A.recorder(P);
const sc = S.scene(P, { recorder: R, settle: A.settle });

// ---- ground, with the helipad, the patient route and the ambulance lane painted on it
const helipad = () => {
  const [x, y] = PAD;
  const ring = k.ring(x, y, 11, 0, P, 48) + k.ring(x, y, 10, 0, P, 48);
  const h = k.onTop([[x - 3, y - 3.5], [x - 3, y + 3.5]], 0, P) + k.onTop([[x + 3, y - 3.5], [x + 3, y + 3.5]], 0, P) + k.onTop([[x - 3, y], [x + 3, y]], 0, P);
  return k.lineSvg(ring, { tone: "mid" }) + k.lineSvg(h, { tone: "hi" });
};
const lane = () => {
  let d = k.lineOnTop([SITE.x + 3, -30], [SITE.x + SITE.w - 3, -30], 0, P) + k.lineOnTop([SITE.x + 3, -18], [SITE.x + SITE.w - 3, -18], 0, P);
  for (let x = SITE.x + 6; x < SITE.x + SITE.w - 8; x += 9) d += k.onTop([[x, -24.2], [x + 4, -24.2], [x + 4, -23.8], [x, -23.8]], 0, P, true);
  return k.lineSvg(d, { tone: "lo" });
};
const walk = S.route([-20, 8, 0], [24, 8, 0], {});
sc.add(S.ground(P, { id: "stand.site", at: [0, 0], w: SITE.w, d: SITE.d, h: 3, grid: 0, decals: helipad() + lane() + S.routeSvg(walk, P, { tone: "lo", dashed: true }) + S.floorArrow(P, { at: [2, 8], len: 6 }) }));

// ---- arrivals: helicopter on the pad, ambulance at triage
sc.add(S.helicopter(P, { id: "medevac", at: PAD, rot: 0, lit: false, tone: "hi" }));
sc.add(S.van(P, { id: "ambulance", at: [-26, -24], rot: 0, mark: true, lit: true }));

// ---- triage tent and the wards
sc.add(S.tent(P, { id: "triage", at: [-12, -8], rot: 1, len: 14, w: 12, h: 6.5, mark: true }));
for (const [i, x] of [12, 30].entries()) sc.add(S.tent(P, { id: `ward${i}`, at: [x, -6], rot: 1, len: 22, w: 11, h: 6, mark: i === 0 }));
sc.add(S.tent(P, { id: "theatre", at: [30, 24], rot: 0, len: 18, w: 11, h: 6.5, mark: true }));

// ---- the casualty being carried, the team, the waiting
sc.add(S.person(P, { id: "medic1", at: [-15, 4] }), S.person(P, { id: "medic2", at: [-11, 4.6] }));
sc.add(S.pallet(P, { id: "stretcher", at: [-13, 8], w: 6, d: 2.2, load: 0.6, tone: "hi" }));
sc.add(S.seated(P, { id: "wait1", at: [-24, 2] }), S.seated(P, { id: "wait2", at: [-24, -2.5] }));
sc.add(S.person(P, { id: "doctor", at: [20, 14] }));

// ---- support: power, water, communications, supplies, command
sc.add(S.battery(P, { id: "generator", at: [50, -32], w: 8, d: 5, h: 4.4 }));
sc.add(S.tank(P, { id: "water", at: [48, 34], r: 4, h: 7, cone: 1.6 }));
sc.add(S.mast(P, { id: "radio", at: [-48, -36], h: 24, base: 3 }));
sc.add(S.desk(P, { id: "ops.desk", at: [-46, -10], w: 7, d: 3.6, h: 3.4 }));
sc.add(S.laptop(P, { id: "ops.laptop", at: [-46, -10, 3.4], rot: 0 }));
for (const [i, at] of [[44, -16], [48, -16], [44, -11.6]].entries()) sc.add(S.crate(P, { id: `supply${i}`, at, size: 3.2 }));
sc.add(S.pallet(P, { id: "supply.pallet", at: [52, -10] }));
sc.add(S.drum(P, { id: "fuel1", at: [52, -25] }), S.drum(P, { id: "fuel2", at: [52, -21.6] }));
sc.add(S.flag(P, { id: "flag", at: [-3, -36], h: 16, mark: true }));
sc.add(S.signpost(P, { id: "sign", at: [-30, -12], rot: 0 }));
for (const [i, x] of [-8, -2].entries()) sc.add(S.cone(P, { id: `cone${i}`, at: [x, -27] }));
sc.add(S.fence(P, { id: "fenceN", at: [10, -42], len: 92, pitch: 6 }));
sc.add(S.fence(P, { id: "fenceE", at: [57, 4], rot: 1, len: 70, pitch: 6 }));
for (const [i, [x, y, style]] of [[-54, 40, "round"], [-46, 41, "cone"], [8, 40, "round"], [16, 40.5, "cone"], [52, 14, "cone"]].entries()) sc.add(S.tree(P, { id: `tree${i}`, at: [x, y], h: 9, style, tone: "lo" }));
sc.add(S.shrub(P, { id: "shrub", at: [-4, 38] }), S.rock(P, { id: "rock", at: [-14, 40], size: 2 }));

const body = sc.build();
A.auditOrExit(R, P);
if (argv.includes("--audit")) process.exit(process.exitCode ?? 0);

const LABEL = "A field hospital on open ground. A medevac helicopter sits on a painted helipad and an ambulance waits at the triage tent; two medics carry a stretcher toward two ward tents and an operating tent, each marked with a cross. A generator, fuel drums, a water tank, a radio mast, a command desk with a laptop, supply crates and a flag support the site inside a perimeter fence.";
const svg = (standalone) => k.figureSvg({ width: WIDTH, height: HEIGHT, label: LABEL, body, standalone });
if (argv.includes("--svg")) {
  writeFileSync(join(HERE, theme === "light" ? "field-hospital-light.svg" : "field-hospital.svg"), svg(theme));
  console.log("wrote", theme === "light" ? "field-hospital-light.svg" : "field-hospital.svg");
}
const plate = k.plateHtml({
  fig: "Fig 2",
  title: "Role 2 field hospital",
  hint: "Static layout",
  readout: `pad to triage ${(Math.hypot(PAD[0] + 12, PAD[1] + 8) * 0.5).toFixed(0)} m · triage to ward ${(walk.length * 0.5).toFixed(0)} m`,
  keys: [
    { mark: "lit", label: "Ambulance at triage: where every patient enters" },
    { mark: "dashed", label: "Patient route from triage to the wards" },
  ],
  caption: "Arrivals land at the pad or the ambulance bay beside triage; the dashed route runs to the wards and the operating tent. Power, water, communications and supplies sit on the far side of the route so they never cross it. Distances at 1 unit = 0.5 m.",
  body: `<div class="iso-stage">${svg(false)}</div>`,
});
const name = theme === "light" ? "field-hospital-light.html" : "field-hospital.html";
writeFileSync(join(HERE, name), k.pageHtml({ title: "Field hospital", theme, body: plate, width: 720 }));
console.log("wrote", name);
