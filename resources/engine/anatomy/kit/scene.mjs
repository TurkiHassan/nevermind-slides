// scene.mjs: the subject kit. Parametric, topic-native props (buildings, vehicles,
// people, machines, paper, terrain) built from the kit's own solids, so a figure can
// show the thing a deck is about instead of a generic instrument.
//
// Convention, used by every prop:
//   prop(P, opts) -> { id, kind, items, anchors, bounds }
//   items   : [{ name, at, bias, svg, shapes }]  one convex solid (or a few disjoint ones)
//             per item, each with its surface detail inside its own svg and its true
//             shape for kit/audit.mjs, ready for R.put. Hand them to scene().add().
//   anchors : { name: [x, y, z] } world points for routes, wires, labels and placing
//             one prop on another (truck.bed, ship.bay, building.door ...).
//   bounds  : { x, y, w, d, z0, z1 } world footprint, for layout.
// Common opts: at [x, y, z?] (footprint centre on the floor), rot (0-3, quarter turns
// about z), tone ("lo" | "mid" | "hi"), lit (the one accent), detail (0, 1, 2), id,
// airborne (flying props hold themselves up for the support check).
import * as k from "./iso-kit.mjs";
import * as G from "./lathe.mjs";
import { tubePieces, tubeSvg } from "./tube.mjs";

const TAU = Math.PI * 2;
const FLOOR = { o: [0, 0, 0], a: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] };

// ---------------------------------------------------------------- shape records
// Plain objects in the format kit/audit.mjs reads (same as A.slab, A.prism, A.disc ...).
export const shapes = {
  prism: (F, poly, s0, s1, meta = {}) => ({ kind: "prism", F, poly: poly.map(([x, y]) => [x, y]), s0: Math.min(s0, s1), s1: Math.max(s0, s1), ...meta }),
  extruded: (ring, z, h, meta = {}) => shapes.prism(FLOOR, ring, z, z + h, meta),
  slab: (plan, z, h, meta = {}, steps = 8) => shapes.extruded(k.roundedPlan(plan, steps), z, h, meta),
  body: (F, poly, meta = {}) => ({ kind: "body", F, poly: poly.map(([s, r]) => [s, Math.max(0, r)]), ...meta }),
  disc: (F, s0, s1, r, meta = {}) => shapes.body(F, [[s0, 0], [s0, r], [s1, r], [s1, 0]], meta),
  cylinder: (cx, cy, r, z, h, meta = {}) => shapes.disc({ o: [cx, cy, 0], a: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] }, z, z + h, r, meta),
  ball: (at, r, meta = {}) => ({ kind: "ball", o: at, r, ...meta }),
};

// ---------------------------------------------------------------- face helpers
const counters = new Map();
const autoId = (kind) => {
  const n = (counters.get(kind) ?? 0) + 1;
  counters.set(kind, n);
  return `${kind}${n}`;
};
export const resetIds = () => counters.clear();

const faceOf = (wp, [nx, ny]) => {
  if (nx > 0.5) return { n: [1, 0], o: [wp.x + wp.w, wp.y], u: [0, 1], len: wp.d };
  if (nx < -0.5) return { n: [-1, 0], o: [wp.x, wp.y + wp.d], u: [0, -1], len: wp.d };
  if (ny > 0.5) return { n: [0, 1], o: [wp.x + wp.w, wp.y + wp.d], u: [-1, 0], len: wp.w };
  return { n: [0, -1], o: [wp.x, wp.y], u: [1, 0], len: wp.w };
};
/** The side faces of a world plan that face the viewer: [{ n, o, u, len }]. */
export function facesOf(wp, P) {
  const [vx, vy] = k.towardViewer(P);
  return [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([nx, ny]) => nx * vx + ny * vy > 1e-6).map((n) => faceOf(wp, n));
}
export const facePoint = (f, s, z) => [f.o[0] + f.u[0] * s, f.o[1] + f.u[1] * s, z];
const fRect = (f, s0, s1, z0, z1, P) => k.pathOf([facePoint(f, s0, z0), facePoint(f, s1, z0), facePoint(f, s1, z1), facePoint(f, s0, z1)].map((p) => k.iso(p, P)), true);
const fV = (f, s, z0, z1, P) => k.segment(facePoint(f, s, z0), facePoint(f, s, z1), P);
const fH = (f, s0, s1, z, P) => k.segment(facePoint(f, s0, z), facePoint(f, s1, z), P);
const Ln = (d, tone = "lo", extra = {}) => k.lineSvg(d, { tone, ...extra });
const Dt = (pts, P, size = 0.45, tone = "mid") => (pts.length ? k.dotsSvg(pts.map((p) => k.iso(p, P)), { size, tone }) : "");
const ladder = (n) => Array.from({ length: n }, (_, i) => i);

/** Window grid on one face: closed frames, a mullion each at detail 2, a sill line. */
export function windowGrid(f, P, { z0, z1, cols, rows, margin = 1.2, gapS = 1, gapZ = 1.2, detail = 2, tone = "lo", skip = () => false }) {
  const span = f.len - margin * 2;
  const w = (span - gapS * (cols - 1)) / cols;
  const h = (z1 - z0 - gapZ * (rows - 1)) / rows;
  if (w <= 0.2 || h <= 0.2) return "";
  let frames = "";
  let bars = "";
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < rows; r++) {
      if (skip(c, r)) continue;
      const s0 = margin + c * (w + gapS);
      const za = z0 + r * (h + gapZ);
      frames += fRect(f, s0, s0 + w, za, za + h, P);
      if (detail >= 2 && w > 1.4) bars += fV(f, s0 + w / 2, za, za + h, P);
      if (detail >= 2 && h > 2.4) bars += fH(f, s0, s0 + w, za + h * 0.62, P);
    }
  return Ln(frames, tone) + (bars ? Ln(bars, "faint") : "");
}

// ---------------------------------------------------------------- the prop maker
function maker(P, kind, o = {}) {
  const id = o.id ?? autoId(kind);
  const [ax, ay, az = 0] = o.at ?? [0, 0, 0];
  const rot = (((o.rot ?? 0) % 4) + 4) % 4;
  const cs = [1, 0, -1, 0][rot];
  const sn = [0, 1, 0, -1][rot];
  const V = G.viewOf(P);
  const meta = o.airborne ? { ground: true } : {};
  const M = { id, kind, P, rot, detail: o.detail ?? 2, tone: o.tone ?? "mid", lit: Boolean(o.lit), items: [], anchors: {}, z0: az };
  const xy = (x, y) => [ax + x * cs - y * sn, ay + x * sn + y * cs];
  M.p = ([x, y, z = 0]) => [...xy(x, y), az + z];
  M.d = ([x, y, z = 0]) => [x * cs - y * sn, x * sn + y * cs, z];
  M.plan = ({ x, y, w, d, r = 0 }) => {
    const a = xy(x, y);
    const b = xy(x + w, y + d);
    return { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(b[0] - a[0]), d: Math.abs(b[1] - a[1]), r };
  };
  M.ring = (points) => points.map(([x, y]) => xy(x, y));
  M.sees = (n) => G.dot3(M.d(n), V) > 1e-6;
  /** The world face of world plan wp whose local normal is n, or null when hidden. */
  M.face = (wp, n) => (M.sees([n[0], n[1], 0]) ? faceOf(wp, M.d(n)) : null);
  M.at = (name, local) => (M.anchors[name] = M.p(local));
  const part = (svg, shape, at, op = {}) => ({ svg, shapes: [{ ...meta, ...(op.ground ? { ground: true } : {}), ...shape }], at, bias: op.bias ?? 0 });
  const style = (op) => ({ tone: op.tone ?? M.tone, crease: op.crease ?? "faint", lit: op.lit ?? false });
  const wrap = (op, ctx, solid) => (op.halo ?? "") + solid + (op.after ? op.after(ctx) : "");
  const innerOf = (op, ctx) => (typeof op.inner === "function" ? op.inner(ctx) : op.inner ?? "");

  M.slab = (plan, z, h, op = {}) => {
    const wp = M.plan(plan);
    const steps = op.steps ?? 3;
    const zz = az + z;
    const ctx = { wp, z: zz, h, top: zz + h };
    const halo = op.halo ? `<path class="iso-halo" d="${k.haloOf(wp, zz, h, P)}"/>` : "";
    const svg = wrap({ ...op, halo }, ctx, k.solidSvg(k.slabOf(wp, zz, h, P, steps, op.bevel ?? 0), { ...style(op), inner: innerOf(op, ctx) }));
    return part(svg, shapes.slab(wp, zz, h, {}, steps), [wp.x + wp.w / 2, wp.y + wp.d / 2, zz + h / 2], op);
  };
  M.extrude = (ringLocal, z, h, op = {}) => {
    const ring = M.ring(ringLocal);
    const zz = az + z;
    const ctx = { ring, z: zz, h, top: zz + h };
    const svg = wrap(op, ctx, k.solidSvg(k.extrude(ring, zz, h, P, { bevel: op.bevel ?? 0 }), { ...style(op), inner: innerOf(op, ctx) }));
    const c = ring.reduce((s, p) => [s[0] + p[0] / ring.length, s[1] + p[1] / ring.length], [0, 0]);
    return part(svg, shapes.extruded(ring, zz, h), [c[0], c[1], zz + h / 2], op);
  };
  M.cyl = ([x, y], r, z, h, op = {}) => {
    const [cx, cy] = xy(x, y);
    const zz = az + z;
    const steps = op.steps ?? G.stepsFor(r, 16, 72, G.scaleOf(P));
    const ctx = { cx, cy, r, z: zz, h, top: zz + h };
    const svg = wrap(op, ctx, k.solidSvg(k.cylinder(cx, cy, r, zz, h, P, steps, op.bevel ?? 0), { ...style(op), inner: innerOf(op, ctx) }));
    return part(svg, shapes.cylinder(cx, cy, r, zz, h), [cx, cy, zz + h / 2], op);
  };
  /** A round part lying on any local axis: wheels, drums, pipes, rollers. */
  M.disc = (centre, axis, half, r, op = {}) => {
    const F = G.frameAlong(M.p(centre), M.d(axis));
    const ctx = { F, half, r };
    const svg = wrap(op, ctx, k.solidSvg(G.disc(-half, half, r, F, P), { ...style(op), inner: innerOf(op, ctx) }));
    return part(svg, shapes.disc(F, -half, half, r), F.o, op);
  };
  /** A solid of revolution from a [s, r] profile along a local axis from base. */
  M.turn = (base, axis, profile, op = {}) => {
    const F = G.frameAlong(M.p(base), M.d(axis));
    const ctx = { F };
    const svg = wrap(op, ctx, k.solidSvg(G.solidOf(profile, F, P), { ...style(op), inner: innerOf(op, ctx) }));
    const first = profile[0];
    const last = profile[profile.length - 1];
    return part(svg, shapes.body(F, [[first[0], 0], ...profile.map(([s, r]) => [s, r]), [last[0], 0]]), G.add3(F.o, G.mul3(F.a, (first[0] + last[0]) / 2)), op);
  };
  M.ball = (centre, r, op = {}) => {
    const c = M.p(centre);
    const svg = wrap(op, { c, r }, k.solidSvg(G.sphereOf(c, r, P), { ...style(op), crease: "none", inner: innerOf(op, { c, r }) }));
    return part(svg, shapes.ball(c, r), c, op);
  };
  /** A prism of a convex polygon (in the local u, v plane) extruded along a local axis. */
  M.prism = (origin, axis, u, poly, len, op = {}) => {
    const a = G.unit3(M.d(axis));
    const uu = G.unit3(M.d(u));
    const F = { o: M.p(origin), a, u: uu, v: G.cross3(a, uu) };
    const ctx = { F, poly, len };
    const svg = wrap(op, ctx, k.solidSvg(G.prismOf(F, poly, 0, len, P), { ...style(op), inner: innerOf(op, ctx) }));
    const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
    const cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
    return part(svg, shapes.prism(F, poly, 0, len), G.add3(G.add3(F.o, G.mul3(a, len / 2)), G.add3(G.mul3(F.u, cx), G.mul3(F.v, cy))), op);
  };
  /** A square bar from local point a to local point b (struts, stays, arms, legs). */
  M.rod = (a, b, w, op = {}) => {
    const A = M.p(a);
    const B = M.p(b);
    const dir = G.sub3(B, A);
    const F = G.frameAlong(A, dir);
    const h = w / 2;
    const poly = [[-h, -h], [h, -h], [h, h], [-h, h]];
    const svg = wrap(op, { F }, k.solidSvg(G.prismOf(F, poly, 0, G.len3(dir), P), { ...style(op), inner: innerOf(op, { F }) }));
    return part(svg, shapes.prism(F, poly, 0, G.len3(dir)), G.lerp3(A, B, 0.5), op);
  };
  /** One drawn item from one or more parts (parts in one item are painted far to near). */
  M.put = (name, ...parts) => {
    const list = parts.flat().filter(Boolean);
    if (!list.length) return null;
    const sorted = list.length > 1 ? [...list].sort((p, q) => G.dot3(p.at, V) - G.dot3(q.at, V)) : list;
    const full = `${id}.${name}`;
    const item = {
      name: full,
      at: list.length === 1 ? list[0].at : list.reduce((s, p) => G.add3(s, G.mul3(p.at, 1 / list.length)), [0, 0, 0]),
      bias: Math.max(...list.map((p) => p.bias)),
      svg: sorted.map((p) => p.svg).join(""),
      shapes: list.flatMap((p) => p.shapes).map((s, i) => ({ ...s, name: i ? `${full}#${i + 1}` : full })),
    };
    M.items.push(item);
    return item;
  };
  M.done = (local) => {
    const a = M.p([local.x, local.y, local.z0 ?? 0]);
    const b = M.p([local.x + local.w, local.y + local.d, local.z1 ?? 0]);
    const bounds = { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(b[0] - a[0]), d: Math.abs(b[1] - a[1]), z0: a[2], z1: b[2] };
    M.anchors.centre ??= M.p([local.x + local.w / 2, local.y + local.d / 2, 0]);
    M.anchors.top ??= M.p([local.x + local.w / 2, local.y + local.d / 2, local.z1 ?? 0]);
    return { id, kind, items: M.items, anchors: M.anchors, bounds };
  };
  return M;
}

/** Several props as one (a stack, a row, a compound). */
export function merge(id, kind, props, anchors = {}) {
  const items = props.flatMap((p) => p.items);
  const bs = props.map((p) => p.bounds);
  const x = Math.min(...bs.map((b) => b.x));
  const y = Math.min(...bs.map((b) => b.y));
  const bounds = { x, y, w: Math.max(...bs.map((b) => b.x + b.w)) - x, d: Math.max(...bs.map((b) => b.y + b.d)) - y, z0: Math.min(...bs.map((b) => b.z0)), z1: Math.max(...bs.map((b) => b.z1)) };
  return { id, kind, items, anchors: Object.assign({}, ...props.map((p) => p.anchors && { [p.id]: p.anchors.top }), anchors), bounds, parts: props };
}

// ================================================================ GROUND AND TERRAIN

/** A plinth the scene stands on: soft halo, inset groove, paving grid. It is the ground. */
export function ground(P, o = {}) {
  const M = maker(P, "ground", { tone: "lo", ...o });
  const W = o.w ?? 200;
  const D = o.d ?? 140;
  const H = o.h ?? 4;
  const plan = { x: -W / 2, y: -D / 2, w: W, d: D, r: o.r ?? 3 };
  const grid = o.grid ?? (M.detail >= 2 ? 10 : 0);
  M.put("plinth", M.slab(plan, -H, H, {
    ground: true,
    bevel: 0.8,
    steps: 6,
    halo: true,
    inner: ({ wp }) => Ln(k.sideSeam(wp, M.z0 - H * 0.45, P, 6), "faint"),
    after: ({ wp }) => {
      let out = Ln(k.planOutline(k.insetPlan(wp, o.inset ?? 3), M.z0, P, 6), "faint");
      if (grid) {
        const inner = k.insetPlan(wp, o.inset ?? 3);
        let d = "";
        for (let x = inner.x + grid; x < inner.x + inner.w - 0.5; x += grid) d += k.lineOnTop([x, inner.y], [x, inner.y + inner.d], M.z0, P);
        for (let y = inner.y + grid; y < inner.y + inner.d - 0.5; y += grid) d += k.lineOnTop([inner.x, y], [inner.x + inner.w, y], M.z0, P);
        out = Ln(d, "faint") + out;
      }
      return out + (o.decals ?? "");
    },
  }));
  M.at("nw", [-W / 2, -D / 2, 0]);
  M.at("se", [W / 2, D / 2, 0]);
  return M.done({ ...plan, z0: -H, z1: 0 });
}

/** A strip laid on the ground: road, lane, taxiway or runway (style). Long axis is local x. */
export function road(P, o = {}) {
  const M = maker(P, "road", { tone: "lo", ...o });
  const L = o.len ?? 80;
  const W = o.w ?? 12;
  const H = o.h ?? 0.4;
  const lanes = o.lanes ?? 2;
  const plan = { x: -L / 2, y: -W / 2, w: L, d: W, r: 0 };
  M.put("strip", M.slab(plan, 0, H, {
    crease: "faint",
    after: ({ top }) => {
      const T = top;
      let edge = "";
      let marks = "";
      const along = (x0, x1, y) => k.lineOnTop(M.p([x0, y]).slice(0, 2), M.p([x1, y]).slice(0, 2), T, P);
      const box = (x0, x1, y0, y1) => k.onTop(M.ring([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]), T, P, true);
      edge += along(-L / 2, L / 2, -W / 2 + 0.8) + along(-L / 2, L / 2, W / 2 - 0.8);
      if (o.style === "runway") {
        for (let i = 0; i < 6; i++) {
          const y = -W / 2 + 2 + ((W - 4) * (i + 0.5)) / 6;
          marks += box(-L / 2 + 2, -L / 2 + 8, y - 0.35, y + 0.35) + box(L / 2 - 8, L / 2 - 2, y - 0.35, y + 0.35);
        }
        for (let x = -L / 2 + 14; x < L / 2 - 16; x += 8) marks += box(x, x + 4.5, -0.25, 0.25);
        const lights = [];
        for (let x = -L / 2 + 2; x <= L / 2 - 2; x += 6) lights.push(M.p([x, -W / 2 + 0.3, H]), M.p([x, W / 2 - 0.3, H]));
        return Ln(edge, "mid") + Ln(marks, "mid") + Dt(lights, P, 0.35, "hi");
      }
      for (let lane = 1; lane < lanes; lane++) {
        const y = -W / 2 + (W * lane) / lanes;
        for (let x = -L / 2 + 1.5; x < L / 2 - 3; x += 6) marks += box(x, x + 3, y - 0.18, y + 0.18);
      }
      if (o.stop) marks += box(o.stop - 0.4, o.stop + 0.4, -W / 2 + 0.8, W / 2 - 0.8);
      return Ln(edge, "faint") + Ln(marks, "mid");
    },
  }));
  M.at("start", [-L / 2, 0, H]);
  M.at("end", [L / 2, 0, H]);
  return M.done({ ...plan, z0: 0, z1: H });
}
export const runway = (P, o = {}) => road(P, { len: 160, w: 18, style: "runway", ...o });

/** A water basin: a low slab of water with fading ripple marks (harbour, reservoir, river). */
export function water(P, o = {}) {
  const M = maker(P, "water", { tone: "lo", ...o });
  const W = o.w ?? 60;
  const D = o.d ?? 60;
  const H = o.h ?? 2;
  const plan = { x: -W / 2, y: -D / 2, w: W, d: D, r: o.r ?? 0 };
  M.put("basin", M.slab(plan, -H, H, {
    ground: true,
    crease: "none",
    halo: o.halo,
    after: () => {
      let out = "";
      let seed = 7;
      const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const count = o.ripples ?? Math.round((W * D) / 260);
      for (let i = 0; i < count; i++) {
        const x = -W / 2 + 4 + rand() * (W - 12);
        const y = -D / 2 + 3 + rand() * (D - 6);
        const len = 4 + rand() * 6;
        const pts = ladder(9).map((j) => k.iso(M.p([x + (len * j) / 8, y + 0.35 * Math.sin((j / 8) * TAU * 1.5), 0]), P));
        out += k.fadeLineSvg(pts, { fade: [len * 0.35, len * 0.35], tone: o.rippleTone ?? "lo" });
      }
      return out;
    },
  }));
  M.at("level", [0, 0, 0]);
  return M.done({ ...plan, z0: -H, z1: 0 });
}

/** Hill as contour terraces: stacked slabs, each a contour, shrinking upward. */
export function terraces(P, o = {}) {
  const M = maker(P, "terraces", { tone: "lo", ...o });
  const W = o.w ?? 50;
  const D = o.d ?? 40;
  const steps = o.steps ?? 4;
  const rise = o.rise ?? 3;
  for (let i = 0; i < steps; i++) {
    const inset = (i * Math.min(W, D)) / (2.6 * steps);
    const plan = { x: -W / 2 + inset, y: -D / 2 + inset * 0.8, w: W - inset * 2, d: D - inset * 1.6, r: Math.min(W, D) / 4 };
    M.put(`step${i}`, M.slab(plan, i * rise, rise, { steps: 8, tone: i === steps - 1 ? "mid" : "lo", halo: i === 0 ? true : undefined, bevel: 0.6 }));
  }
  return M.done({ x: -W / 2, y: -D / 2, w: W, d: D, z0: 0, z1: steps * rise });
}

/** Post-and-rail fence along local x. */
export function fence(P, o = {}) {
  const M = maker(P, "fence", { tone: "mid", ...o });
  const L = o.len ?? 40;
  const H = o.h ?? 3.4;
  const n = Math.max(2, Math.round(L / (o.pitch ?? 5)) + 1);
  const posts = ladder(n).map((i) => M.slab({ x: -L / 2 + (L * i) / (n - 1) - 0.25, y: -0.25, w: 0.5, d: 0.5, r: 0 }, 0, H, { tone: "mid" }));
  M.put("posts", posts);
  const side = M.sees([0, 1, 0]) ? 1 : -1;
  for (const z of [H * 0.35, H * 0.8]) M.put(`rail${z.toFixed(1)}`, M.slab({ x: -L / 2 - 0.25, y: side > 0 ? 0.25 : -0.5, w: L + 0.5, d: 0.25, r: 0 }, z, 0.35, { tone: "lo" }));
  return M.done({ x: -L / 2, y: -0.5, w: L, d: 1, z0: 0, z1: H });
}

/** A block wall with coursing and a coping. */
export function wall(P, o = {}) {
  const M = maker(P, "wall", { tone: "mid", ...o });
  const L = o.len ?? 30;
  const H = o.h ?? 5;
  const T = o.t ?? 1.2;
  const course = o.course ?? 1;
  M.put("body", M.slab({ x: -L / 2, y: -T / 2, w: L, d: T, r: 0 }, 0, H - 0.5, {
    inner: ({ wp, z }) => {
      let d = "";
      for (const f of facesOf(wp, P)) {
        for (let c = 1; c * course < H - 0.5; c++) d += fH(f, 0, f.len, z + c * course, P);
        if (M.detail >= 2)
          for (let c = 0; c * course < H - 0.5 - 1e-6; c++) {
            const off = c % 2 ? 1.5 : 0;
            for (let s = off + 3; s < f.len - 0.5; s += 3) d += fV(f, s, z + c * course, Math.min(z + (c + 1) * course, z + H - 0.5), P);
          }
      }
      return Ln(d, "faint");
    },
  }));
  M.put("coping", M.slab({ x: -L / 2 - 0.3, y: -T / 2 - 0.3, w: L + 0.6, d: T + 0.6, r: 0 }, H - 0.5, 0.5, { tone: "mid", bevel: 0.2 }));
  return M.done({ x: -L / 2, y: -T / 2, w: L, d: T, z0: 0, z1: H });
}

/** A bridge deck on two piers, with railings drawn on the deck edge. Local x along the span. */
export function bridge(P, o = {}) {
  const M = maker(P, "bridge", { tone: "mid", ...o });
  const L = o.len ?? 50;
  const W = o.w ?? 10;
  const H = o.h ?? 8;
  for (const x of [-L / 2 + 6, L / 2 - 6]) M.put(`pier${x > 0 ? "B" : "A"}`, M.slab({ x: x - 2, y: -W / 2 + 1, w: 4, d: W - 2, r: 0.4 }, 0, H - 1.4, { tone: "lo", bevel: 0.3 }));
  M.put("deck", M.slab({ x: -L / 2, y: -W / 2, w: L, d: W, r: 0 }, H - 1.4, 1.4, {
    inner: ({ wp, z }) => Ln(facesOf(wp, P).map((f) => fH(f, 0, f.len, z + 0.5, P)).join(""), "faint"),
    after: ({ top }) => {
      let d = "";
      const posts = [];
      for (const y of [-W / 2 + 0.5, W / 2 - 0.5]) {
        d += k.lineOnTop(M.p([-L / 2, y]).slice(0, 2), M.p([L / 2, y]).slice(0, 2), top, P);
        for (let x = -L / 2 + 2; x <= L / 2 - 2; x += 4) posts.push(M.p([x, y, 0]).slice(0, 2).concat(top));
      }
      return Ln(d, "lo") + Dt(posts, P, 0.4, "mid");
    },
  }));
  M.at("deck", [0, 0, H]);
  return M.done({ x: -L / 2, y: -W / 2, w: L, d: W, z0: 0, z1: H });
}

// ================================================================ BUILDINGS

/** An office or barracks block: window grid, floor bands, door, roof plant. */
export function building(P, o = {}) {
  const M = maker(P, "building", o);
  const W = o.w ?? 24;
  const D = o.d ?? 16;
  const floors = o.floors ?? 4;
  const fh = o.floorH ?? 6;
  const H = floors * fh;
  const plan = { x: -W / 2, y: -D / 2, w: W, d: D, r: 0.3 };
  M.put("block", M.slab(plan, 0, H, {
    bevel: 0.5,
    halo: true,
    inner: ({ wp, z }) => {
      let out = "";
      for (const f of facesOf(wp, P)) {
        const front = M.face(wp, [0, 1]);
        const isFront = front && front.n[0] === f.n[0] && front.n[1] === f.n[1];
        out += Ln(ladder(floors - 1).map((i) => fH(f, 0, f.len, z + (i + 1) * fh, P)).join(""), "faint");
        for (let i = 0; i < floors; i++) {
          const cols = Math.max(2, Math.round(f.len / (o.bay ?? 4)));
          out += windowGrid(f, P, { z0: z + i * fh + 1.6, z1: z + (i + 1) * fh - 1.2, cols, rows: 1, margin: 1.4, gapS: 1.1, detail: M.detail, skip: (c) => isFront && i === 0 && Math.abs(c - (cols - 1) / 2) < 0.6 });
        }
        if (isFront) out += Ln(fRect(f, f.len / 2 - 1.6, f.len / 2 + 1.6, z, z + 4.2, P) + fV(f, f.len / 2, z, z + 4.2, P), "mid");
      }
      return out;
    },
  }));
  if (M.detail >= 1) {
    M.put("plant", M.slab({ x: -W / 4, y: -D / 4, w: W / 3, d: D / 3, r: 0.3 }, H, 2.4, { tone: "lo", bevel: 0.3, inner: ({ wp, z }) => Ln(facesOf(wp, P).map((f) => ladder(5).map((i) => fV(f, (f.len * (i + 1)) / 6, z + 0.4, z + 2, P)).join("")).join(""), "faint") }));
    M.put("hatch", M.slab({ x: W / 4 - 2, y: D / 4 - 2, w: 3, d: 2.4, r: 0.2 }, H, 1, { tone: "lo" }));
  }
  M.at("door", [0, D / 2, 0]);
  M.at("roof", [0, 0, H]);
  return M.done({ ...plan, z0: 0, z1: H });
}

/** A low warehouse with a gable roof, standing seams and roller doors on its long front. */
export function warehouse(P, o = {}) {
  const M = maker(P, "warehouse", o);
  const W = o.w ?? 40;
  const D = o.d ?? 24;
  const H = o.h ?? 9;
  const rise = o.rise ?? 4;
  const doors = o.doors ?? 3;
  const plan = { x: -W / 2, y: -D / 2, w: W, d: D, r: 0 };
  M.put("walls", M.slab(plan, 0, H, {
    halo: true,
    inner: ({ wp, z }) => {
      let out = "";
      const front = M.face(wp, [0, 1]);
      for (const f of facesOf(wp, P)) {
        out += Ln(fH(f, 0, f.len, z + H - 1, P), "faint");
        if (front && f.n[0] === front.n[0] && f.n[1] === front.n[1]) {
          const dw = Math.min(6, f.len / (doors * 1.6));
          let doorD = "";
          let slats = "";
          for (let i = 0; i < doors; i++) {
            const s = (f.len * (i + 0.5)) / doors;
            doorD += fRect(f, s - dw / 2, s + dw / 2, z, z + H * 0.66, P);
            for (let zz = z + 0.8; zz < z + H * 0.66 - 0.2; zz += 0.8) slats += fH(f, s - dw / 2, s + dw / 2, zz, P);
          }
          out += Ln(doorD, "mid") + Ln(slats, "faint");
        } else if (M.detail >= 1) out += windowGrid(f, P, { z0: z + H - 3.2, z1: z + H - 1.6, cols: Math.max(2, Math.round(f.len / 6)), rows: 1, margin: 2, gapS: 2, detail: 1 });
      }
      return out;
    },
  }));
  const poly = [[-D / 2 - 0.6, 0], [D / 2 + 0.6, 0], [0, rise]];
  M.put("roof", M.prism([-W / 2 - 0.6, 0, H], [1, 0, 0], [0, 1, 0], poly, W + 1.2, {
    crease: "lo",
    inner: ({ F, len }) => {
      let d = "";
      const pt = (s, [x, y]) => G.add3(G.add3(F.o, G.mul3(F.a, s)), G.add3(G.mul3(F.u, x), G.mul3(F.v, y)));
      for (const [A, B] of [[poly[0], poly[2]], [poly[2], poly[1]]]) {
        const edge = [B[0] - A[0], B[1] - A[1]];
        const normal = G.add3(G.mul3(F.u, edge[1]), G.mul3(F.v, -edge[0]));
        if (G.dot3(normal, G.viewOf(P)) <= 0) continue;
        for (let s = 2; s < len - 1; s += 2) d += k.segment(pt(s, A), pt(s, B), P);
      }
      return Ln(d, "faint");
    },
  }));
  M.at("door", [0, D / 2, 0]);
  M.at("dock", [0, D / 2 + 2, 0]);
  return M.done({ ...plan, z0: 0, z1: H + rise });
}

/** A control tower: shaft, glazed cab with mullions, roof and mast. */
export function controlTower(P, o = {}) {
  const M = maker(P, "tower", o);
  const H = o.h ?? 34;
  const r = o.r ?? 3;
  M.put("base", M.slab({ x: -6, y: -6, w: 12, d: 12, r: 0.5 }, 0, 5, { halo: true, tone: "lo", bevel: 0.4, inner: ({ wp, z }) => facesOf(wp, P).map((f) => windowGrid(f, P, { z0: z + 1.2, z1: z + 3.8, cols: 3, rows: 1, detail: 1 })).join("") }));
  M.put("shaft", M.cyl([0, 0], r, 5, H - 5, { inner: ({ cx, cy, r: rr, z, h }) => Ln(ladder(Math.floor(h / 6)).map((i) => k.sideArc(cx, cy, rr, z + (i + 1) * 6, P, 24)).join(""), "faint") }));
  M.put("deck", M.cyl([0, 0], r * 2, H, 1.2, { tone: "lo" }));
  M.put("cab", M.cyl([0, 0], r * 1.8, H + 1.2, 4.4, {
    tone: "hi",
    lit: o.lit,
    inner: ({ cx, cy, r: rr, z, h }) => Ln(k.knurl(cx, cy, rr, z + 0.5, z + h - 0.5, 16, P, 0) + k.sideArc(cx, cy, rr, z + 0.5, P) + k.sideArc(cx, cy, rr, z + h - 0.5, P), "mid"),
  }));
  M.put("roof", M.cyl([0, 0], r * 2.1, H + 5.6, 0.8, { tone: "lo" }));
  M.put("mast", M.cyl([0, 0], 0.25, H + 6.4, 5, { tone: "mid", after: ({ cx, cy, top }) => Dt([[cx, cy, top]], P, 0.7, "hi") }));
  M.at("cab", [0, 0, H + 3.4]);
  return M.done({ x: -6, y: -6, w: 12, d: 12, z0: 0, z1: H + 11.4 });
}

/** A hangar: barrel-vault roof with ribs, door panels on the open end. Local x along the hangar. */
export function hangar(P, o = {}) {
  const M = maker(P, "hangar", o);
  const L = o.len ?? 40;
  const W = o.w ?? 30;
  const R = W / 2;
  const n = 18;
  const poly = ladder(n + 1).map((i) => [-R * Math.cos((Math.PI * i) / n), R * Math.sin((Math.PI * i) / n)]);
  M.put("vault", M.prism([-L / 2, 0, 0], [1, 0, 0], [0, 1, 0], poly, L, {
    halo: `<path class="iso-halo" d="${k.haloOf(M.plan({ x: -L / 2, y: -R, w: L, d: W, r: 0 }), M.z0, 0.1, P)}"/>`,
    crease: "none",
    inner: ({ F, len }) => {
      const V = G.viewOf(P);
      const pt = (s, [x, y]) => G.add3(G.add3(F.o, G.mul3(F.a, s)), G.add3(G.mul3(F.u, x), G.mul3(F.v, y)));
      let ribs = "";
      for (let s = 4; s < len - 1; s += 4) {
        const seen = [];
        for (let i = 0; i < n; i++) {
          const [x0, y0] = poly[i];
          const [x1, y1] = poly[i + 1];
          const normal = G.add3(G.mul3(F.u, -(y1 - y0)), G.mul3(F.v, x1 - x0));
          if (G.dot3(normal, V) > 1e-6) seen.push(i);
        }
        if (seen.length) ribs += k.pathOf([...seen.map((i) => pt(s, poly[i])), pt(s, poly[seen[seen.length - 1] + 1])].map((p) => k.iso(p, P)));
      }
      const capEnd = G.dot3(F.a, V) > 0 ? len : G.dot3(F.a, V) < 0 ? 0 : null;
      let doors = "";
      if (capEnd !== null) for (let i = 1; i < 6; i++) {
        const x = -R + (W * i) / 6;
        const top = Math.sqrt(Math.max(0, R * R - x * x)) * 0.92;
        doors += k.segment(pt(capEnd, [x, 0]), pt(capEnd, [x, top]), P);
      }
      return Ln(ribs, "faint") + Ln(doors, "lo");
    },
  }));
  M.at("door", [L / 2, 0, 0]);
  return M.done({ x: -L / 2, y: -R, w: L, d: W, z0: 0, z1: R });
}

/** A house: walls, gable roof with tile courses, door and windows, chimney on the gable end. */
export function house(P, o = {}) {
  const M = maker(P, "house", o);
  const W = o.w ?? 14;
  const D = o.d ?? 10;
  const H = o.h ?? 6;
  const plan = { x: -W / 2, y: -D / 2, w: W, d: D, r: 0 };
  M.put("walls", M.slab(plan, 0, H, {
    halo: true,
    inner: ({ wp, z }) => {
      let out = "";
      const front = M.face(wp, [0, 1]);
      for (const f of facesOf(wp, P)) {
        const isFront = front && f.n[0] === front.n[0] && f.n[1] === front.n[1];
        out += windowGrid(f, P, { z0: z + 2, z1: z + 4.4, cols: 2, rows: 1, margin: 1.4, gapS: f.len - 2.8 - 2 * 2.4, detail: M.detail });
        if (isFront) out += Ln(fRect(f, f.len / 2 - 1, f.len / 2 + 1, z, z + 4, P), "mid") + Dt([facePoint(f, f.len / 2 + 0.6, z + 2)], P, 0.3);
      }
      return out;
    },
  }));
  const rise = o.rise ?? 4;
  const poly = [[-D / 2 - 0.5, 0], [D / 2 + 0.5, 0], [0, rise]];
  M.put("roof", M.prism([-W / 2 - 0.5, 0, H], [1, 0, 0], [0, 1, 0], poly, W + 1, {
    crease: "lo",
    inner: ({ F, len }) => {
      let d = "";
      const V = G.viewOf(P);
      const pt = (s, [x, y]) => G.add3(G.add3(F.o, G.mul3(F.a, s)), G.add3(G.mul3(F.u, x), G.mul3(F.v, y)));
      for (const [A, B] of [[poly[0], poly[2]], [poly[2], poly[1]]]) {
        const normal = G.add3(G.mul3(F.u, B[1] - A[1]), G.mul3(F.v, -(B[0] - A[0])));
        if (G.dot3(normal, V) <= 0) continue;
        for (let t = 0.25; t < 0.99; t += 0.25) d += k.segment(pt(0, [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]), pt(len, [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]), P);
      }
      return Ln(d, "faint");
    },
  }));
  if (M.detail >= 1) M.put("chimney", M.slab({ x: -W / 2 - 2.1, y: -1, w: 1.5, d: 2, r: 0 }, 0, H + rise + 1, { tone: "lo", bevel: 0.2 }));
  M.at("door", [0, D / 2, 0]);
  return M.done({ ...plan, z0: 0, z1: H + rise });
}

/** A ridge tent with a door on its +x end and pegged guy lines. Local x along the ridge. */
export function tent(P, o = {}) {
  const M = maker(P, "tent", o);
  const L = o.len ?? 16;
  const W = o.w ?? 10;
  const H = o.h ?? 6;
  const wall = o.wall ?? 1.6;
  const poly = [[-W / 2, 0], [W / 2, 0], [W / 2, wall], [0, H], [-W / 2, wall]];
  M.put("canvas", M.prism([-L / 2, 0, 0], [1, 0, 0], [0, 1, 0], poly, L, {
    halo: `<path class="iso-halo" d="${k.haloOf(M.plan({ x: -L / 2, y: -W / 2, w: L, d: W, r: 0 }), M.z0, 0.1, P)}"/>`,
    crease: "lo",
    inner: ({ F, len }) => {
      const V = G.viewOf(P);
      const pt = (s, [x, y]) => G.add3(G.add3(F.o, G.mul3(F.a, s)), G.add3(G.mul3(F.u, x), G.mul3(F.v, y)));
      let seams = "";
      for (let i = 0; i < poly.length; i++) {
        const A = poly[i];
        const B = poly[(i + 1) % poly.length];
        const normal = G.add3(G.mul3(F.u, B[1] - A[1]), G.mul3(F.v, -(B[0] - A[0])));
        if (G.dot3(normal, V) <= 0 || (A[1] === 0 && B[1] === 0)) continue;
        for (let s = len / 4; s < len - 0.1; s += len / 4) seams += k.segment(pt(s, A), pt(s, B), P);
      }
      let door = "";
      const end = G.dot3(F.a, V) > 0 ? len : G.dot3(F.a, V) < 0 ? 0 : null;
      if (end !== null) {
        door += k.pathOf([pt(end, [-W * 0.18, 0]), pt(end, [0, H * 0.78]), pt(end, [W * 0.18, 0])].map((p) => k.iso(p, P)));
        door += k.segment(pt(end, [0, 0]), pt(end, [0, H * 0.78]), P);
        if (o.mark) door += k.segment(pt(end, [-1.1, H * 0.52]), pt(end, [1.1, H * 0.52]), P) + k.segment(pt(end, [0, H * 0.4]), pt(end, [0, H * 0.64]), P);
      }
      return Ln(seams, "faint") + Ln(door, o.mark ? "hi" : "mid");
    },
    after: () => {
      if (M.detail < 2) return "";
      let d = "";
      const pegs = [];
      for (const x of [-L / 2, L / 2]) {
        const from = M.p([x + (x > 0 ? 0 : 0), 0, H]);
        const peg = M.p([x + (x > 0 ? 3 : -3), 0, 0]);
        d += k.segment(from, peg, P);
        pegs.push(peg);
      }
      return Ln(d, "lo") + Dt(pegs, P, 0.45, "mid");
    },
  }));
  M.at("door", [L / 2, 0, 0]);
  return M.done({ x: -L / 2, y: -W / 2, w: L, d: W, z0: 0, z1: H });
}

/** A storage tank or silo: cylinder, seams, cone roof, ladder, vent. */
export function tank(P, o = {}) {
  const M = maker(P, "tank", o);
  const r = o.r ?? 6;
  const H = o.h ?? 14;
  const cone = o.cone ?? r * 0.5;
  M.put("shell", M.cyl([0, 0], r, 0, H, {
    halo: `<path class="iso-halo" d="${k.haloOf(M.plan({ x: -r, y: -r, w: 2 * r, d: 2 * r, r }), M.z0, 0.1, P)}"/>`,
    inner: ({ cx, cy, r: rr, z, h }) => {
      let d = ladder(Math.floor(h / 3.5)).map((i) => k.sideArc(cx, cy, rr, z + (i + 1) * 3.5, P, 40)).join("");
      if (M.detail >= 2) {
        const [vx, vy] = k.towardViewer(P);
        const a = Math.atan2(vy, vx) + 0.5;
        const rail = (da) => k.segment([cx + rr * Math.cos(a + da), cy + rr * Math.sin(a + da), z], [cx + rr * Math.cos(a + da), cy + rr * Math.sin(a + da), z + h], P);
        let rungs = "";
        for (let zz = z + 1; zz < z + h; zz += 1.2) rungs += k.segment([cx + rr * Math.cos(a - 0.06), cy + rr * Math.sin(a - 0.06), zz], [cx + rr * Math.cos(a + 0.06), cy + rr * Math.sin(a + 0.06), zz], P);
        return Ln(d, "faint") + Ln(rail(-0.06) + rail(0.06), "mid") + Ln(rungs, "lo");
      }
      return Ln(d, "faint");
    },
  }));
  M.put("roof", M.turn([0, 0, H], [0, 0, 1], [[0, r + 0.3], [0.5, r + 0.3], [cone, 1]], { tone: "mid" }));
  M.put("vent", M.cyl([0, 0], 0.7, H + cone, 1.4, { tone: "lo", after: ({ cx, cy, top }) => Dt([[cx, cy, top]], P, 0.4) }));
  M.at("inlet", [0, 0, H + cone + 1.4]);
  return M.done({ x: -r, y: -r, w: 2 * r, d: 2 * r, z0: 0, z1: H + cone + 1.4 });
}
export const silo = (P, o = {}) => tank(P, { r: 4, h: 22, cone: 3, ...o });

/** A factory hall with a sawtooth roof (glazed north lights) and a banded chimney. */
export function factory(P, o = {}) {
  const M = maker(P, "factory", o);
  const W = o.w ?? 36;
  const D = o.d ?? 22;
  const H = o.h ?? 8;
  const teeth = o.teeth ?? 4;
  const plan = { x: -W / 2, y: -D / 2, w: W, d: D, r: 0 };
  M.put("hall", M.slab(plan, 0, H, {
    halo: true,
    inner: ({ wp, z }) => facesOf(wp, P).map((f) => windowGrid(f, P, { z0: z + 2, z1: z + H - 2, cols: Math.max(2, Math.round(f.len / 5)), rows: 1, margin: 2, gapS: 1.6, detail: M.detail })).join(""),
  }));
  const tw = W / teeth;
  const th = o.toothH ?? 4;
  for (let i = 0; i < teeth; i++) {
    const poly = [[0, 0], [tw, 0], [0, th]];
    M.put(`tooth${i}`, M.prism([-W / 2 + (i + 1) * tw, -D / 2, H], [0, 1, 0], [-1, 0, 0], poly, D, {
      crease: "lo",
      inner: ({ F, len }) => {
        if (!M.sees([1, 0, 0])) return "";
        const pt = (s2, z) => G.add3(F.o, G.add3(G.mul3(F.a, s2), [0, 0, z]));
        let d = "";
        for (let s2 = 2; s2 < len - 1; s2 += 2) d += k.segment(pt(s2, 0), pt(s2, th), P);
        return Ln(d, "faint");
      },
    }));
  }
  M.put("chimney", M.cyl([W / 2 + 3, -D / 2 + 3], 1.8, 0, H + 18, {
    tone: "mid",
    inner: ({ cx, cy, r, z, h }) => Ln([0.55, 0.75, 0.92].map((t) => k.sideArc(cx, cy, r, z + h * t, P, 24)).join(""), "lo"),
  }));
  M.at("door", [0, D / 2, 0]);
  M.at("stack", [W / 2 + 3, -D / 2 + 3, H + 18]);
  return M.done({ ...plan, w: W + 5, z0: 0, z1: H + 18 });
}

// ================================================================ PEOPLE

/** An abstract standing figure (pawn): turned body, head. Dignified, no face. */
export function person(P, o = {}) {
  const M = maker(P, "person", { tone: "hi", ...o });
  const h = o.h ?? 3.6;
  const seat = o.seated ? (o.seatH ?? 1.8) : 0;
  const body = o.seated ? h * 0.38 : h * 0.72;
  const rr = h * 0.17;
  if (o.seated && o.stool !== false) M.put("stool", M.slab({ x: -rr * 1.1, y: -rr * 1.1, w: rr * 2.2, d: rr * 2.2, r: 0.2 }, 0, seat, { tone: "lo" }));
  M.put("body", M.turn([0, 0, seat], [0, 0, 1], [[0, rr * 0.95], [body * 0.12, rr], [body * 0.8, rr * 0.82], [body, rr * 0.5]], { lit: o.lit }));
  M.put("head", M.ball([0, 0, seat + body + h * 0.12], h * 0.12, { lit: o.lit }));
  M.at("head", [0, 0, seat + body + h * 0.24]);
  return M.done({ x: -rr, y: -rr, w: 2 * rr, d: 2 * rr, z0: 0, z1: seat + body + h * 0.24 });
}
export const seated = (P, o = {}) => person(P, { seated: true, ...o });

/** A group of people in a ring (a team, a crowd at a gate, a class). */
export function group(P, o = {}) {
  const n = o.count ?? 5;
  const R = o.radius ?? 3;
  const [x, y, z = 0] = o.at ?? [0, 0, 0];
  const id = o.id ?? autoId("group");
  const people = ladder(n).map((i) => {
    const a = (i / n) * TAU + (o.phase ?? 0.3);
    return person(P, { ...o, id: `${id}.p${i}`, at: [x + R * Math.cos(a), y + R * Math.sin(a), z], lit: o.lit && i === 0, h: (o.h ?? 3.6) * (0.92 + 0.08 * ((i * 7) % 3) / 2) });
  });
  return merge(id, "group", people);
}

// ================================================================ VEHICLES

const wheelRow = (M, xs, y, half, r, op = {}) => xs.map((x) => M.disc([x, y, r], [0, 1, 0], half, r, {
  tone: "lo",
  crease: "none",
  ...op,
  inner: ({ F, half: hh, r: rr }) => {
    const end = G.dot3(F.a, G.viewOf(M.P)) > 0 ? hh : -hh;
    return Ln(G.circleOf(F, end, rr * 0.55, M.P, 20), "mid") + Dt([G.pointOf(F, end, 0, 0)], M.P, 0.35, "mid");
  },
}));
const sideWheels = (M, name, xs, yIn, half, r, op) => {
  M.put(`${name}L`, wheelRow(M, xs, -yIn - half, half, r, op));
  M.put(`${name}R`, wheelRow(M, xs, yIn + half, half, r, op));
};

/** A tractor unit with a flatbed or box trailer. Local x along the truck, cab at +x. load: "flat" | "box" | "none". */
export function truck(P, o = {}) {
  const M = maker(P, "truck", o);
  const L = o.len ?? 32;
  const W = o.w ?? 5;
  const r = o.wheel ?? 1.1;
  const frameW = W - 2 * 0.6 - 0.2;
  const x0 = -L / 2;
  const cabX = L / 2 - 5.6;
  const trailerEnd = cabX - 4.4;
  M.put("frame", M.slab({ x: x0 + 0.5, y: -frameW / 2, w: L - 1, d: frameW, r: 0 }, 1.2, 1, { tone: "lo" }));
  sideWheels(M, "wheels", [x0 + 3, x0 + 5.5, cabX - 3.6, cabX - 1.2, L / 2 - 2.4], frameW / 2, 0.55, r);
  const load = o.load ?? "flat";
  const bedZ = 2.2;
  if (load !== "none") M.put("bed", M.slab({ x: x0, y: -W / 2, w: trailerEnd - x0, d: W, r: 0 }, bedZ, 0.6, {
    tone: "mid",
    inner: ({ wp, z }) => Ln(facesOf(wp, P).map((f) => fH(f, 0, f.len, z + 0.3, P)).join(""), "faint"),
    after: ({ wp, top }) => Dt(k.corners(wp, 0.5).map(([x, y]) => [x, y, top]), P, 0.45, "mid"),
  }));
  if (load === "box") M.put("box", M.slab({ x: x0 + 0.2, y: -W / 2 + 0.1, w: trailerEnd - x0 - 0.4, d: W - 0.2, r: 0.2 }, bedZ + 0.6, 5.2, {
    tone: o.boxTone ?? "mid",
    bevel: 0.3,
    inner: ({ wp, z, h }) => facesOf(wp, P).map((f) => Ln(ladder(Math.floor(f.len / 2.4)).map((i) => fV(f, (i + 1) * 2.4, z, z + h, P)).join(""), "faint")).join(""),
  }));
  M.put("fifth", M.cyl([trailerEnd + 2.2, 0], 1.2, bedZ, 0.4, { tone: "lo" }));
  M.put("cab", M.slab({ x: cabX, y: -W / 2, w: 5.6, d: W, r: 0.4 }, bedZ, 5, {
    tone: o.cabTone ?? "hi",
    lit: o.lit,
    bevel: 0.3,
    inner: ({ wp, z }) => {
      let out = "";
      const nose = M.face(wp, [1, 0]);
      if (nose) out += Ln(fRect(nose, 0.5, nose.len - 0.5, z + 2.6, z + 4.6, P), "mid") + Ln(ladder(4).map((i) => fH(nose, 1, nose.len - 1, z + 0.5 + i * 0.4, P)).join(""), "faint") + Dt([facePoint(nose, 0.8, z + 0.9), facePoint(nose, nose.len - 0.8, z + 0.9)], P, 0.45, "hi");
      for (const n of [[0, 1], [0, -1]]) {
        const f = M.face(wp, n);
        if (!f) continue;
        const fromNose = (s) => (G.dot3(M.d([1, 0, 0]), [f.u[0], f.u[1], 0]) > 0 ? f.len - s : s);
        const a = fromNose(0.6);
        const b = fromNose(3);
        out += Ln(fRect(f, Math.min(a, b), Math.max(a, b), z + 2.6, z + 4.6, P), "mid") + Ln(fV(f, fromNose(3.4), z + 0.2, z + 4.6, P), "faint");
      }
      return out;
    },
  }));
  M.put("fairing", M.slab({ x: cabX + 0.4, y: -W / 2 + 0.4, w: 3.2, d: W - 0.8, r: 0.6 }, bedZ + 5, 1, { tone: "mid" }));
  M.at("bed", [(x0 + trailerEnd) / 2, 0, load === "box" ? bedZ + 5.8 : bedZ + 0.6]);
  M.at("cab", [cabX + 2.8, 0, bedZ + 5]);
  M.at("front", [L / 2, 0, 0]);
  return M.done({ x: x0, y: -W / 2, w: L, d: W, z0: 0, z1: bedZ + 6 });
}
/** A van or ambulance: one body, cab windows, a light bar, an optional mark on the side. */
export function van(P, o = {}) {
  const M = maker(P, "van", o);
  const L = o.len ?? 12;
  const W = o.w ?? 4.6;
  const r = o.wheel ?? 0.9;
  const fw = W - 1.2;
  M.put("frame", M.slab({ x: -L / 2 + 0.6, y: -fw / 2, w: L - 1.2, d: fw, r: 0 }, 0.9, 0.8, { tone: "lo" }));
  sideWheels(M, "wheels", [-L / 2 + 2.2, L / 2 - 2.2], fw / 2, 0.6, r);
  M.put("body", M.slab({ x: -L / 2, y: -W / 2, w: L, d: W, r: 0.5 }, 1.7, 5, {
    tone: o.bodyTone ?? "hi",
    lit: o.lit,
    bevel: 0.4,
    inner: ({ wp, z }) => {
      let out = "";
      const nose = M.face(wp, [1, 0]);
      if (nose) out += Ln(fRect(nose, 0.5, nose.len - 0.5, z + 2.4, z + 4.3, P), "mid") + Dt([facePoint(nose, 0.7, z + 0.8), facePoint(nose, nose.len - 0.7, z + 0.8)], P, 0.42, "hi");
      for (const n of [[0, 1], [0, -1]]) {
        const f = M.face(wp, n);
        if (!f) continue;
        const toNose = G.dot3(M.d([1, 0, 0]), [f.u[0], f.u[1], 0]) > 0;
        const s = (v) => (toNose ? f.len - v : v);
        out += Ln(fRect(f, Math.min(s(0.6), s(2.6)), Math.max(s(0.6), s(2.6)), z + 2.4, z + 4.3, P) + fV(f, s(3), z + 0.2, z + 4.6, P), "mid");
        if (o.mark) {
          const c = s(L * 0.55);
          out += Ln(fH(f, c - 1.1, c + 1.1, z + 2.6, P) + fV(f, c, z + 1.5, z + 3.7, P), "hi");
        }
      }
      return out;
    },
  }));
  M.put("lights", M.slab({ x: L / 2 - 3, y: -1.2, w: 1.2, d: 2.4, r: 0.3 }, 6.7, 0.6, { tone: "mid", lit: o.lit, after: ({ wp, top }) => Dt([[wp.x + wp.w / 2, wp.y + 0.5, top], [wp.x + wp.w / 2, wp.y + wp.d - 0.5, top]], P, 0.4, "hi") }));
  M.at("rear", [-L / 2, 0, 0]);
  return M.done({ x: -L / 2, y: -W / 2, w: L, d: W, z0: 0, z1: 7.3 });
}
/** A car or 4x4: lower body, glasshouse, four wheels. */
export function car(P, o = {}) {
  const M = maker(P, "car", o);
  const L = o.len ?? 9;
  const W = o.w ?? 4;
  const r = o.wheel ?? 0.8;
  const fw = W - 1;
  M.put("floor", M.slab({ x: -L / 2 + 0.6, y: -fw / 2, w: L - 1.2, d: fw, r: 0 }, 0.6, 0.8, { tone: "lo" }));
  sideWheels(M, "wheels", [-L / 2 + 1.8, L / 2 - 1.8], fw / 2, 0.5, r);
  M.put("body", M.slab({ x: -L / 2, y: -W / 2, w: L, d: W, r: 0.6 }, 1.4, 1.6, { tone: o.bodyTone ?? "hi", lit: o.lit, bevel: 0.3, inner: ({ wp, z }) => Ln(facesOf(wp, P).map((f) => fH(f, 0, f.len, z + 0.8, P)).join(""), "faint") }));
  M.put("cabin", M.slab({ x: -L / 2 + 1.6, y: -W / 2 + 0.3, w: L * 0.55, d: W - 0.6, r: 0.6 }, 3, 1.6, {
    tone: "mid",
    inner: ({ wp, z, h }) => facesOf(wp, P).map((f) => windowGrid(f, P, { z0: z + 0.25, z1: z + h - 0.3, cols: f.len > 3.6 ? 2 : 1, rows: 1, margin: 0.4, gapS: 0.4, detail: 1 })).join(""),
  }));
  return M.done({ x: -L / 2, y: -W / 2, w: L, d: W, z0: 0, z1: 4.6 });
}

/** A forklift: body, counterweight, mast, forks, overhead guard. Forks at +x. */
export function forklift(P, o = {}) {
  const M = maker(P, "forklift", o);
  const W = 3.4;
  const fw = W - 1.2;
  M.put("chassis", M.slab({ x: -3, y: -fw / 2, w: 5.4, d: fw, r: 0 }, 0.8, 0.8, { tone: "lo" }));
  sideWheels(M, "wheels", [-1.9, 1.6], fw / 2, 0.6, 0.8);
  M.put("body", M.slab({ x: -3, y: -W / 2, w: 4.8, d: W, r: 0.4 }, 1.6, 1.8, { tone: o.bodyTone ?? "hi", lit: o.lit, bevel: 0.3 }));
  M.put("weight", M.slab({ x: -3.6, y: -W / 2 + 0.2, w: 0.6, d: W - 0.4, r: 0.2 }, 1.6, 1.8, { tone: "lo" }));
  M.put("seat", M.slab({ x: -1.8, y: -0.8, w: 1.4, d: 1.6, r: 0.3 }, 3.4, 0.8, { tone: "lo" }));
  for (const x of [-2.6, 0.9]) M.put(`guardPosts${x > 0 ? "F" : "B"}`, [-1.4, 1.4].map((y) => M.slab({ x: x - 0.15, y: y - 0.15, w: 0.3, d: 0.3, r: 0 }, 3.4, 3.4, { tone: "mid" })));
  M.put("guard", M.slab({ x: -2.8, y: -1.6, w: 3.9, d: 3.2, r: 0.2 }, 6.8, 0.3, { tone: "mid", after: ({ wp, top }) => Ln(ladder(4).map((i) => k.lineOnTop([wp.x + 0.6 + i * 0.8, wp.y], [wp.x + 0.6 + i * 0.8, wp.y + wp.d], top, P)).join(""), "faint") }));
  M.put("mast", [-1, 1].map((s) => M.slab({ x: 2.4, y: s * 1 - 0.2, w: 0.4, d: 0.4, r: 0 }, 0.8, 6.6, { tone: "mid" })));
  const lift = o.lift ?? 0;
  M.put("forks", [-1, 1].map((s) => M.slab({ x: 2.8, y: s * 0.8 - 0.25, w: 3.6, d: 0.5, r: 0 }, 0.4 + lift, 0.3, { tone: "hi" })));
  M.put("carriage", M.slab({ x: 2.8, y: -1.3, w: 0.3, d: 2.6, r: 0 }, 0.7 + lift, 2, { tone: "mid" }));
  M.at("forks", [4.6, 0, 0.7 + lift]);
  return M.done({ x: -3.6, y: -W / 2, w: 10, d: W, z0: 0, z1: 7.1 });
}

/** A cargo ship: hull with a pointed bow (+y local), hatch covers, bridge tower, funnel, mast.
 *  Local y along the ship. bays/rows/tiers describe the container load placed by the caller
 *  at anchors.bay(b, row, tier) with shipBox(). */
export function ship(P, o = {}) {
  const M = maker(P, "ship", o);
  const L = o.len ?? 140;
  const B = o.beam ?? 26;
  const H = o.h ?? 10;
  const bow = o.bow ?? 18;
  const ring = [[-B / 2, -L / 2 + 3], [-B / 2 + 3, -L / 2], [B / 2 - 3, -L / 2], [B / 2, -L / 2 + 3], [B / 2, L / 2 - bow], [B / 2 * 0.45, L / 2 - 2], [0, L / 2], [-B / 2 * 0.45, L / 2 - 2], [-B / 2, L / 2 - bow]];
  M.put("hull", M.extrude(ring, 0, H, {
    tone: "mid",
    bevel: 0.6,
    inner: ({ ring: wr, z }) => Ln(k.ringSeam(wr, z + 2.2, P), "lo") + Ln(k.ringSeam(wr, z + H - 1.2, P), "faint"),
  }));
  const deck = M.z0 + H;
  const bayLen = o.bayLen ?? 25;
  const firstBay = -L / 2 + 30;
  const bays = o.bays ?? Math.max(1, Math.floor((L / 2 - bow - 4 - firstBay) / (bayLen + 1)));
  const bayEnd = firstBay + bays * (bayLen + 1);
  const covers = [];
  for (let b = 0; b < bays; b++) covers.push(M.slab({ x: -B / 2 + 1.2, y: firstBay + b * (bayLen + 1), w: B - 2.4, d: bayLen, r: 0.3 }, H, 0.8, { tone: "lo", after: ({ wp, top }) => Ln(k.lineOnTop([wp.x, wp.y + wp.d / 2], [wp.x + wp.w, wp.y + wp.d / 2], top, P), "faint") }));
  covers.forEach((c, i) => M.put(`hatch${i}`, c));
  M.put("house", M.slab({ x: -B / 2 + 2, y: -L / 2 + 6, w: B - 4, d: 14, r: 0.4 }, H, 18, {
    tone: "hi",
    bevel: 0.4,
    inner: ({ wp, z }) => facesOf(wp, P).map((f) => windowGrid(f, P, { z0: z + 2, z1: z + 16, cols: Math.max(3, Math.round(f.len / 3)), rows: 5, margin: 1.2, gapS: 1, gapZ: 1.4, detail: 1 })).join(""),
  }));
  M.put("bridge", M.slab({ x: -B / 2 - 1, y: -L / 2 + 13, w: B + 2, d: 6, r: 0.4 }, H + 18, 3, { tone: "hi", lit: o.lit, bevel: 0.3, inner: ({ wp, z }) => facesOf(wp, P).map((f) => windowGrid(f, P, { z0: z + 0.9, z1: z + 2.4, cols: Math.max(4, Math.round(f.len / 2)), rows: 1, margin: 0.6, gapS: 0.4, detail: 1, tone: "mid" })).join("") }));
  M.put("funnel", M.slab({ x: -3, y: -L / 2 + 7, w: 6, d: 5, r: 1.5 }, H + 18, 7, { tone: "lo", bevel: 0.3, inner: ({ wp, z, h }) => Ln(k.sideSeam(wp, z + h - 1.6, P, 3), "mid") }));
  M.put("mast", M.cyl([0, Math.max(bayEnd + 2, L / 2 - 12)], 0.4, H, 14, { tone: "mid", after: ({ cx, cy, top }) => Dt([[cx, cy, top]], P, 0.6, "hi") }));
  const bits = [];
  for (const y of [bayEnd + 4, -L / 2 + 25]) for (const x of [-B / 2 + 4, B / 2 - 4]) bits.push(M.cyl([x, y], 0.6, H, 1, { tone: "lo" }));
  M.put("bitts", bits);
  M.ship = { L, B, H, bays, bayLen, firstBay };
  /** World point at the deck for bay b, row r (across the beam), tier t (0 = on the hatch). */
  M.anchors.bayAt = (b, row, rows, tier, boxH = 5.2, boxW = 5) => M.p([-((rows - 1) * (boxW + 0.4)) / 2 + row * (boxW + 0.4), firstBay + b * (bayLen + 1) + bayLen / 2, H + 0.8 + tier * boxH]);
  M.at("deck", [0, 0, H]);
  M.at("bow", [0, L / 2, H]);
  return M.done({ x: -B / 2, y: -L / 2, w: B, d: L, z0: 0, z1: H + 28 });
}

/** A shipping container: corrugated sides (ribs end on top and bottom rails), door end with
 *  lock bars, corner castings. Local x along the box. */
export function container(P, o = {}) {
  const M = maker(P, "container", o);
  const L = o.len ?? 24;
  const W = o.w ?? 5;
  const H = o.h ?? 5.2;
  const doorEnd = o.doors ?? 1;
  const plan = { x: -L / 2, y: -W / 2, w: L, d: W, r: 0 };
  M.put("box", M.slab(plan, 0, H, {
    bevel: 0.25,
    tone: o.tone ?? "mid",
    lit: o.lit,
    bias: o.bias,
    inner: ({ wp, z }) => {
      let rails = "";
      let ribs = "";
      let doors = "";
      for (const f of facesOf(wp, P)) {
        rails += fH(f, 0, f.len, z + 0.45, P) + fH(f, 0, f.len, z + H - 0.45, P);
        const isEnd = Math.abs(f.len - W) < 1e-6 && Math.abs(f.len - L) > 1e-6;
        if (isEnd) {
          const local = M.face(wp, [doorEnd, 0]);
          if (local && local.n[0] === f.n[0] && local.n[1] === f.n[1] && M.detail >= 1) {
            doors += fV(f, f.len / 2, z + 0.45, z + H - 0.45, P);
            if (M.detail >= 2) for (const t of [0.14, 0.36, 0.64, 0.86]) doors += fV(f, f.len * t, z + 0.45, z + H - 0.45, P);
          } else for (let s = 0.8; s < f.len - 0.4; s += 0.8) ribs += fV(f, s, z + 0.45, z + H - 0.45, P);
        } else if (M.detail >= 1) for (let s = 1.2; s < f.len - 0.6; s += o.pitch ?? 1.2) ribs += fV(f, s, z + 0.45, z + H - 0.45, P);
      }
      return Ln(rails, "lo") + Ln(ribs, "faint") + Ln(doors, "lo");
    },
    after: ({ wp, top }) => (M.detail >= 2 ? Dt(k.corners(wp, 0.4).map(([x, y]) => [x, y, top]), P, 0.38, "mid") : ""),
  }));
  M.at("top", [0, 0, H]);
  return M.done({ ...plan, z0: 0, z1: H });
}

/** Containers in a block: rows (local y) x cols (local x) x tiers. heights(r, c) sets each column's tier count. */
export function containerStack(P, o = {}) {
  const [x, y, z = 0] = o.at ?? [0, 0, 0];
  const id = o.id ?? autoId("stack");
  const L = o.len ?? 24;
  const W = o.w ?? 5;
  const H = o.h ?? 5.2;
  const gap = o.gap ?? 0.6;
  const rows = o.rows ?? 2;
  const cols = o.cols ?? 1;
  const tiers = o.tiers ?? 2;
  const rot = o.rot ?? 0;
  const tones = o.tones ?? ["mid", "lo", "hi", "mid", "lo"];
  const boxes = [];
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < rows; r++) {
      const count = o.heights ? o.heights(r, c) : tiers;
      for (let t = 0; t < count; t++) {
        const lx = -((cols - 1) * (L + gap)) / 2 + c * (L + gap);
        const ly = -((rows - 1) * (W + gap)) / 2 + r * (W + gap);
        const [wx, wy] = rot % 2 ? [-ly, lx] : [lx, ly];
        boxes.push(container(P, { ...o, id: `${id}.r${r}c${c}t${t}`, at: [x + (rot >= 2 ? -wx : wx), y + (rot >= 2 ? -wy : wy), z + t * H], tone: tones[(r * 3 + c * 5 + t * 2) % tones.length] }));
      }
    }
  return merge(id, "containerStack", boxes);
}

/** A quay (ship-to-shore) crane. Local x is the boom: -x reaches over the water, +x is the
 *  backreach over the land. Local y is along the quay rails. trolley: local x of the trolley,
 *  or null to leave it to a mover (craneTrolley / craneHoist). */
export function quayCrane(P, o = {}) {
  const M = maker(P, "crane", o);
  const C = craneGeometry(o);
  const { xw, xl, ly, legTop, girderZ, girderH, gy, gw, out, back, apex } = C;
  const bogies = [];
  for (const x of [xw, xl]) for (const y of [-ly, ly]) bogies.push([x, y]);
  M.put("bogiesFar", bogies.filter(([x, y]) => !M.sees([0, 1, 0]) ? y > 0 : y < 0).map(([x, y]) => M.slab({ x: x - 2.4, y: y - 1.6, w: 4.8, d: 3.2, r: 0.3 }, 0, 1.8, { tone: "lo", after: ({ wp, top }) => Dt(k.corners(wp, 0.6).map(([a, b]) => [a, b, top]), P, 0.35, "mid") })));
  M.put("bogiesNear", bogies.filter(([x, y]) => !M.sees([0, 1, 0]) ? y < 0 : y > 0).map(([x, y]) => M.slab({ x: x - 2.4, y: y - 1.6, w: 4.8, d: 3.2, r: 0.3 }, 0, 1.8, { tone: "lo", after: ({ wp, top }) => Dt(k.corners(wp, 0.6).map(([a, b]) => [a, b, top]), P, 0.35, "mid") })));
  for (const [x, y] of bogies) M.put(`leg${x > 0 ? "L" : "W"}${y > 0 ? "p" : "m"}`, M.slab({ x: x - 1.3, y: y - 1.3, w: 2.6, d: 2.6, r: 0.2 }, 1.8, legTop - 1.8, {
    tone: o.tone ?? "mid",
    inner: ({ wp, z, h }) => {
      let d = "";
      for (const f of facesOf(wp, P)) for (let zz = z + 6; zz < z + h - 2; zz += 8) d += fH(f, 0, f.len, zz, P);
      return Ln(d, "faint");
    },
  }));
  for (const y of [-ly, ly]) M.put(`portal${y > 0 ? "p" : "m"}`, M.slab({ x: xw - 1.6, y: y - 1.6, w: xl - xw + 3.2, d: 3.2, r: 0.2 }, legTop, 3, { tone: "mid", bevel: 0.3 }));
  // cross beams carry the girders but leave the gap between them open for the hoist ropes
  for (const x of [xw, xl]) for (const sg of [-1, 1]) M.put(`sill${x > 0 ? "L" : "W"}${sg > 0 ? "p" : "m"}`, M.slab(sg > 0 ? { x: x - 1.3, y: gy - gw / 2, w: 2.6, d: ly - 1.6 - gy + gw / 2, r: 0 } : { x: x - 1.3, y: -ly + 1.6, w: 2.6, d: ly - 1.6 - gy + gw / 2, r: 0 }, legTop + 0.6, 2.4, { tone: "lo" }));
  for (const y of [-gy, gy]) M.put(`girder${y > 0 ? "p" : "m"}`, M.slab({ x: out, y: y - gw / 2, w: back - out, d: gw, r: 0.2 }, girderZ, girderH, {
    tone: o.tone ?? "mid",
    bevel: 0.3,
    inner: ({ wp, z, h }) => {
      let d = "";
      for (const f of facesOf(wp, P)) {
        if (f.len < 10) continue;
        for (let s = 3; s < f.len - 1; s += 3) d += fV(f, s, z, z + h, P);
      }
      return Ln(d, "faint");
    },
    after: ({ wp, top }) => Ln(k.lineOnTop([wp.x, wp.y + gw / 2], [wp.x + wp.w, wp.y + gw / 2], top, P), "lo"),
  }));
  M.put("tip", M.slab({ x: out - 1.6, y: -gy - gw / 2, w: 1.6, d: 2 * gy + gw, r: 0.2 }, girderZ, girderH, { tone: "mid" }));
  M.put("tail", M.slab({ x: back, y: -gy - gw / 2, w: 1.6, d: 2 * gy + gw, r: 0.2 }, girderZ, girderH, { tone: "mid" }));
  M.put("house", M.slab({ x: back - 14, y: -gy - gw / 2, w: 14, d: 2 * gy + gw, r: 0.4 }, girderZ + girderH, 6, {
    tone: "hi",
    bevel: 0.4,
    inner: ({ wp, z, h }) => facesOf(wp, P).map((f) => Ln(ladder(Math.floor(f.len / 1.4) - 1).map((i) => fV(f, (i + 1) * 1.4, z + 1, z + h - 1, P)).join(""), "faint")).join(""),
  }));
  // the apex frame stands on the portal beams, outside the girders, so the trolley passes between its posts
  for (const y of [-ly, ly]) M.put(`post${y > 0 ? "p" : "m"}`, M.slab({ x: xw - 1, y: y - 1, w: 2, d: 2, r: 0.2 }, legTop + 3, apex - legTop - 3, { tone: o.tone ?? "mid", inner: ({ wp, z, h }) => Ln(facesOf(wp, P).map((f) => ladder(Math.floor(h / 6)).map((i) => fH(f, 0, f.len, z + (i + 1) * 6, P)).join("")).join(""), "faint") }));
  M.put("head", M.slab({ x: xw - 1.4, y: -ly - 1.4, w: 2.8, d: 2 * ly + 2.8, r: 0.3 }, apex, 2.4, { tone: "mid", bevel: 0.3, after: ({ wp, top }) => Dt([[wp.x + 1.4, wp.y + 1.4, top], [wp.x + 1.4, wp.y + wp.d - 1.4, top]], P, 0.6, "hi") }));
  for (const y of [-ly, ly]) {
    const g = Math.sign(y) * gy;
    M.put(`fore${y > 0 ? "p" : "m"}`, M.rod([xw - 1, y, apex + 0.3], [out + 1.2, g, girderZ + girderH + 0.3], 0.6, { tone: "lo" }));
    M.put(`back${y > 0 ? "p" : "m"}`, M.rod([xw + 1, y, apex + 0.3], [back - 14, g, girderZ + girderH + 6.3], 0.6, { tone: "lo" }));
  }
  M.put("cab", M.slab({ x: xl - 6, y: gy + gw / 2, w: 4, d: 3.4, r: 0.4 }, girderZ, girderH, { tone: "hi", inner: ({ wp, z, h }) => facesOf(wp, P).map((f) => windowGrid(f, P, { z0: z + 0.6, z1: z + h - 0.6, cols: 1, rows: 1, margin: 0.5, detail: 1, tone: "mid" })).join("") }));
  if (o.trolley !== null && o.trolley !== undefined) {
    const t = craneParts(P, { ...o, id: `${M.id}.t`, crane: C, x: o.trolley, hook: o.hook ?? girderZ - 10 });
    M.items.push(...t.trolley.items, ...t.hoist.items);
  }
  M.crane = C;
  M.at("waterside", [xw, 0, 0]);
  M.at("landside", [xl, 0, 0]);
  return M.done({ x: out - 1.6, y: -ly - 1.6, w: back - out + 3.2, d: 2 * ly + 3.2, z0: 0, z1: apex + 2.4 });
}
export function craneGeometry(o = {}) {
  const xw = o.xw ?? -6;
  const xl = o.xl ?? 22;
  const legTop = o.legTop ?? 40;
  const girderZ = legTop + 3;
  return { xw, xl, ly: o.ly ?? 15, legTop, girderZ, girderH: o.girderH ?? 3.4, gy: o.gy ?? 3.4, gw: o.gw ?? 2, out: o.out ?? -46, back: o.back ?? 56, apex: o.apex ?? legTop + 26 };
}
/** The crane's moving parts at a pose: trolley on the girders at local x, and the hoist
 *  (ropes through the girder gap, spreader, optional carried container) at height hook
 *  (spreader underside). Returns { trolley, hoist } props. */
export function craneParts(P, o = {}) {
  const C = o.crane ?? craneGeometry(o);
  const x = o.x ?? 0;
  const top = C.girderZ + C.girderH;
  const T = maker(P, "trolley", { ...o, id: `${o.id ?? "crane"}.trolley` });
  T.put("body", T.slab({ x: x - 3, y: -C.gy - C.gw / 2, w: 6, d: 2 * C.gy + C.gw, r: 0.3 }, top, 2.2, {
    tone: "hi",
    lit: o.lit,
    bevel: 0.3,
    inner: ({ wp, z, h }) => facesOf(wp, P).map((f) => Ln(fH(f, 0, f.len, z + h / 2, P), "faint")).join(""),
    after: ({ wp, top: tt }) => Dt(k.corners(wp, 0.7).map(([a, b]) => [a, b, tt]), P, 0.35, "mid"),
  }));
  T.at("ropes", [x, 0, top]);
  const H = maker(P, "hoist", { ...o, id: `${o.id ?? "crane"}.hoist` });
  const hook = o.hook ?? C.girderZ - 10;
  const sprH = 0.9;
  const ropeTop = top;
  const ropes = [-1.4, 1.4].map((dy) => H.slab({ x: x - 0.15, y: dy - 0.15, w: 0.3, d: 0.3, r: 0 }, hook + sprH, ropeTop - hook - sprH, { tone: "lo", crease: "none" }));
  H.put("ropes", ropes);
  const parts = [H.slab({ x: x - 2.4, y: -12.4, w: 4.8, d: 24.8, r: 0.2 }, hook, sprH, { tone: "mid", lit: o.lit, after: ({ wp, top: tt }) => Dt(k.corners(wp, 0.4).map(([a, b]) => [a, b, tt]), P, 0.35, "hi") })];
  H.put("spreader", parts);
  let cargo = null;
  if (o.carry) {
    cargo = container(P, { id: `${H.id}.box`, at: [...H.p([x, 0]).slice(0, 2), H.z0 + hook - 5.2], rot: (H.rot + 1) % 4, tone: "hi", lit: o.lit, detail: o.detail });
    H.items.push(...cargo.items);
  }
  H.at("spreader", [x, 0, hook]);
  return { trolley: T.done({ x: x - 3, y: -C.gy, w: 6, d: 2 * C.gy, z0: top, z1: top + 2.2 }), hoist: H.done({ x: x - 2.4, y: -12.4, w: 4.8, d: 24.8, z0: hook - (o.carry ? 5.2 : 0), z1: ropeTop }) };
}

/** A rubber-tyred gantry (yard) crane: four legs on wheel blocks, two top beams, trolley. Local x across the span. */
export function gantryCrane(P, o = {}) {
  const M = maker(P, "gantry", o);
  const S = o.span ?? 26;
  const D = o.d ?? 12;
  const H = o.h ?? 22;
  for (const x of [-S / 2, S / 2]) {
    M.put(`blocks${x > 0 ? "B" : "A"}`, [-D / 2, D / 2].map((y) => M.slab({ x: x - 1.6, y: y - 2, w: 3.2, d: 4, r: 0.4 }, 0, 2, { tone: "lo" })));
    M.put(`sill${x > 0 ? "B" : "A"}`, M.slab({ x: x - 1, y: -D / 2 - 1, w: 2, d: D + 2, r: 0.2 }, 2, 1.4, { tone: "mid" }));
    for (const y of [-D / 2, D / 2]) M.put(`leg${x > 0 ? "B" : "A"}${y > 0 ? "p" : "m"}`, M.slab({ x: x - 0.8, y: y - 0.8, w: 1.6, d: 1.6, r: 0.2 }, 3.4, H - 3.4, { tone: o.tone ?? "mid" }));
  }
  for (const y of [-D / 2, D / 2]) M.put(`beam${y > 0 ? "p" : "m"}`, M.slab({ x: -S / 2 - 1, y: y - 1, w: S + 2, d: 2, r: 0.2 }, H, 2.4, { tone: o.tone ?? "mid", bevel: 0.3, inner: ({ wp, z, h }) => facesOf(wp, P).map((f) => (f.len > 6 ? Ln(ladder(Math.floor(f.len / 2.6) - 1).map((i) => fV(f, (i + 1) * 2.6, z, z + h, P)).join(""), "faint") : "")).join("") }));
  const tx = o.trolley ?? 0;
  M.put("trolley", M.slab({ x: tx - 2.4, y: -D / 2 - 1, w: 4.8, d: D + 2, r: 0.3 }, H + 2.4, 2, { tone: "hi", lit: o.lit, bevel: 0.3 }));
  M.put("cabin", M.slab({ x: S / 2 - 4.5, y: -D / 2 + 1, w: 3, d: 3, r: 0.4 }, H - 3.4, 3.4, { tone: "hi" }));
  return M.done({ x: -S / 2 - 1.6, y: -D / 2 - 2, w: S + 3.2, d: D + 4, z0: 0, z1: H + 4.4 });
}

/** A high-wing transport aircraft on its gear. Local x along the fuselage, nose at +x. */
export function aircraft(P, o = {}) {
  const M = maker(P, "aircraft", o);
  const L = o.len ?? 36;
  const R = o.r ?? 2.4;
  const span = o.span ?? 40;
  const gear = o.gear ?? 1;
  const cz = gear * 2 + R;
  const prof = [[0, R * 0.35], [5, R * 0.8], [8, R], [L - 5, R], [L - 2, R * 0.8], [L, R * 0.35]];
  M.put("fuselage", M.turn([-L / 2, 0, cz], [1, 0, 0], prof, {
    tone: o.tone ?? "hi",
    lit: o.lit,
    inner: ({ F }) => {
      let d = G.arcOf(F, L - 4.2, R, P, { least: 0.3 }) + G.arcOf(F, 6.5, R, P, { least: 0.3 });
      const dots = [];
      for (let s = 9; s < L - 8; s += 1.8) dots.push(G.pointOf(F, s, R, G.angleToward(F, G.viewOf(P)) + 0.4));
      return Ln(d, "faint") + Dt(dots, P, 0.3, "mid");
    },
  }));
  const wx = 2;
  const wing = [[0, -span / 2], [5.4, -span / 2], [6.6, 0], [5.4, span / 2], [0, span / 2], [-1, 0]];
  M.put("wing", M.extrude(wing.map(([x, y]) => [x - wx, y]), cz + R, 0.8, { tone: "mid", bevel: 0.2, after: ({ ring, top }) => Ln(k.onTop([[ring[0][0], ring[0][1]], [ring[4][0], ring[4][1]]].map(([x, y]) => [x, y]), top, P), "faint") }));
  for (const y of [-span * 0.18, -span * 0.34, span * 0.18, span * 0.34]) M.put(`engine${y.toFixed(0)}`, M.turn([-wx - 1, y, cz + R - 1.1], [1, 0, 0], [[0, 0.8], [1, 1.1], [5.6, 1.1], [6.6, 0.6]], { tone: "lo", inner: ({ F }) => Ln(G.arcOf(F, 1, 1.1, P, { least: 0.2 }), "faint") }));
  M.put("tailfin", M.extrude([[-L / 2 + 0.6, -0.3], [-L / 2 + 6, -0.3], [-L / 2 + 6, 0.3], [-L / 2 + 0.6, 0.3]], cz + R * 0.75, 7, { tone: "mid", bevel: 0.2 }));
  M.put("stabilizer", M.extrude([[-L / 2 - 0.4, -6], [-L / 2 + 3.4, -6], [-L / 2 + 4.6, 0], [-L / 2 + 3.4, 6], [-L / 2 - 0.4, 6]], cz + R * 0.75 + 7, 0.5, { tone: "mid" }));
  const gearAt = [[L / 2 - 5, 0], [-2, -R * 0.7], [-2, R * 0.7]];
  M.put("gear", gearAt.map(([x, y]) => M.disc([x, y, gear], [0, 1, 0], 0.4, gear, { tone: "lo", crease: "none" })));
  M.at("nose", [L / 2, 0, cz]);
  M.at("door", [-L / 2 + 6, 0, cz - R]);
  return M.done({ x: -L / 2, y: -span / 2, w: L, d: span, z0: 0, z1: cz + R * 0.75 + 7.5 });
}

/** A light helicopter on skids. Local x along the body, nose at +x. Rotor blades stacked, not crossed. */
export function helicopter(P, o = {}) {
  const M = maker(P, "helicopter", o);
  const sk = 1.2;
  const cz = sk + 2.2;
  M.put("skids", [-1.4, 1.4].map((y) => M.rod([-3, y, 0.2], [3.6, y, 0.2], 0.4, { tone: "lo" })));
  M.put("struts", [-1.4, 1.4].flatMap((y) => [-1.6, 1.8].map((x) => M.slab({ x: x - 0.15, y: y - 0.15, w: 0.3, d: 0.3, r: 0 }, 0.4, sk, { tone: "lo" }))));
  M.put("body", M.slab({ x: -3, y: -1.6, w: 7, d: 3.2, r: 1.4 }, sk + 0.4, 3.4, {
    tone: o.tone ?? "hi",
    lit: o.lit,
    steps: 4,
    inner: ({ wp, z }) => facesOf(wp, P).map((f) => windowGrid(f, P, { z0: z + 1.4, z1: z + 3, cols: 2, rows: 1, margin: 1.4, gapS: 0.6, detail: 1, tone: "mid" })).join(""),
  }));
  M.put("boom", M.rod([-3, 0, cz + 0.8], [-9.2, 0, cz + 1.2], 0.8, { tone: "mid" }));
  M.put("fin", M.slab({ x: -10.6, y: -0.2, w: 1.4, d: 0.4, r: 0.1 }, cz + 0.6, 3.2, { tone: "mid" }));
  M.put("mast", M.cyl([0.4, 0], 0.5, sk + 3.8, 1, { tone: "lo" }));
  const bladeZ = sk + 4.8;
  const R = o.rotor ?? 8;
  M.put("bladeA", M.slab({ x: 0.4 - R, y: -0.3, w: 2 * R, d: 0.6, r: 0.2 }, bladeZ, 0.25, { tone: "mid" }));
  M.put("bladeB", M.slab({ x: 0.1, y: -R, w: 0.6, d: 2 * R, r: 0.2 }, bladeZ + 0.25, 0.25, { tone: "mid", after: ({ top }) => Dt([M.p([0.4, 0, top - M.z0])], P, 0.5, "hi") }));
  M.at("door", [0, 1.6, sk]);
  return M.done({ x: -10.6, y: -R, w: 11, d: 2 * R, z0: 0, z1: bladeZ + 0.5 });
}

/** A quadcopter drone. Set airborne for one in flight. */
export function drone(P, o = {}) {
  const M = maker(P, "drone", o);
  const s = o.size ?? 3;
  const legs = o.airborne ? 0 : 0.8;
  if (legs) M.put("legs", [[-1, -1], [1, 1], [-1, 1], [1, -1]].map(([x, y]) => M.slab({ x: x * s * 0.3 - 0.1, y: y * s * 0.3 - 0.1, w: 0.2, d: 0.2, r: 0 }, 0, legs, { tone: "lo" })));
  M.put("body", M.slab({ x: -s * 0.4, y: -s * 0.4, w: s * 0.8, d: s * 0.8, r: 0.3 }, legs, 0.7, { tone: "hi", lit: o.lit, after: ({ wp, top }) => Dt([[wp.x + wp.w / 2, wp.y + wp.d / 2, top]], P, 0.4, "hi") }));
  M.put("armA", M.rod([-s, -s, legs + 0.7 + 0.15], [s, s, legs + 0.7 + 0.15], 0.3, { tone: "mid" }));
  M.put("armB", M.rod([-s, s, legs + 0.7 + 0.45], [s, -s, legs + 0.7 + 0.45], 0.3, { tone: "mid" }));
  const z = legs + 1.3;
  [[-1, -1], [1, 1], [-1, 1], [1, -1]].forEach(([x, y], i) => M.put(`rotor${i}`, M.cyl([x * s, y * s], s * 0.42, x * y > 0 ? legs + 1.0 : legs + 1.3, 0.1, { tone: "faint", crease: "none" })));
  return M.done({ x: -s * 1.4, y: -s * 1.4, w: s * 2.8, d: s * 2.8, z0: 0, z1: z + 0.4 });
}

/** A satellite: bus, two solar wings with cell grids, a dish and an antenna. Airborne by default. */
export function satellite(P, o = {}) {
  const M = maker(P, "satellite", { airborne: true, ...o });
  const b = o.size ?? 4;
  M.put("bus", M.slab({ x: -b / 2, y: -b / 2, w: b, d: b, r: 0.2 }, 0, b * 1.2, { tone: "hi", lit: o.lit, bevel: 0.3, inner: ({ wp, z, h }) => facesOf(wp, P).map((f) => Ln(fH(f, 0, f.len, z + h * 0.3, P) + fH(f, 0, f.len, z + h * 0.7, P), "faint")).join("") }));
  const wing = o.wing ?? b * 3;
  for (const sgn of [-1, 1]) {
    M.put(`boom${sgn}`, M.slab({ x: -0.2, y: sgn > 0 ? b / 2 : -b / 2 - 1.2, w: 0.4, d: 1.2, r: 0 }, b * 0.55, 0.3, { tone: "lo" }));
    M.put(`panel${sgn}`, M.slab({ x: -b * 0.6, y: sgn > 0 ? b / 2 + 1.2 : -b / 2 - 1.2 - wing, w: b * 1.2, d: wing, r: 0 }, b * 0.55, 0.3, {
      tone: "mid",
      after: ({ wp, top }) => {
        let d = "";
        for (let x = wp.x + wp.w / 3; x < wp.x + wp.w - 0.1; x += wp.w / 3) d += k.lineOnTop([x, wp.y], [x, wp.y + wp.d], top, P);
        for (let y = wp.y + 1.2; y < wp.y + wp.d - 0.1; y += 1.2) d += k.lineOnTop([wp.x, y], [wp.x + wp.w, y], top, P);
        return Ln(d, "lo");
      },
    }));
  }
  M.put("dish", M.turn([0, 0, b * 1.2], [0, 0, 1], [[0, 0.5], [0.4, b * 0.45], [0.9, b * 0.5]], { tone: "mid" }));
  M.put("feed", M.cyl([0, 0], 0.15, b * 1.2 + 0.9, 1.6, { tone: "lo", after: ({ cx, cy, top }) => Dt([[cx, cy, top]], P, 0.45, "hi") }));
  return M.done({ x: -b * 0.6, y: -b / 2 - 1.2 - wing, w: b * 1.2, d: b + 2.4 + 2 * wing, z0: 0, z1: b * 1.2 + 2.5 });
}

/** A rail track (two rails on sleepers) along local x. */
export function track(P, o = {}) {
  const M = maker(P, "track", { tone: "lo", ...o });
  const L = o.len ?? 60;
  const g = o.gauge ?? 3;
  M.put("ballast", M.slab({ x: -L / 2, y: -g / 2 - 1.6, w: L, d: g + 3.2, r: 0 }, 0, 0.5, { tone: "lo", crease: "none" }));
  const sleepers = [];
  for (let x = -L / 2 + 0.8; x < L / 2 - 0.5; x += 1.6) sleepers.push(M.slab({ x: x - 0.35, y: -g / 2 - 0.9, w: 0.7, d: g + 1.8, r: 0 }, 0.5, 0.3, { tone: "lo", crease: "none" }));
  M.put("sleepers", sleepers);
  for (const y of [-g / 2, g / 2]) M.put(`rail${y > 0 ? "p" : "m"}`, M.slab({ x: -L / 2, y: y - 0.15, w: L, d: 0.3, r: 0 }, 0.8, 0.4, { tone: "mid" }));
  M.at("railTop", [0, 0, 1.2]);
  return M.done({ x: -L / 2, y: -g / 2 - 1.6, w: L, d: g + 3.2, z0: 0, z1: 1.2 });
}
/** A rail car (box, tank or flat) on two bogies. Local x along the car. Stand it on track's railTop. */
export function trainCar(P, o = {}) {
  const M = maker(P, "trainCar", o);
  const L = o.len ?? 26;
  const W = o.w ?? 5.4;
  const g = o.gauge ?? 3;
  const r = 0.7;
  for (const x of [-L / 2 + 4, L / 2 - 4]) {
    M.put(`bogie${x > 0 ? "B" : "A"}`, M.slab({ x: x - 2.4, y: -g / 2 + 0.2, w: 4.8, d: g - 0.4, r: 0.2 }, r * 0.5, 0.9, { tone: "lo" }));
    M.put(`wheels${x > 0 ? "B" : "A"}L`, [x - 1.3, x + 1.3].map((wx) => M.disc([wx, -g / 2 + 0.1, r], [0, 1, 0], 0.1, r, { tone: "lo" })));
    M.put(`wheels${x > 0 ? "B" : "A"}R`, [x - 1.3, x + 1.3].map((wx) => M.disc([wx, g / 2 - 0.1, r], [0, 1, 0], 0.1, r, { tone: "lo" })));
  }
  M.put("underframe", M.slab({ x: -L / 2, y: -W / 2 + 0.4, w: L, d: W - 0.8, r: 0 }, r * 0.5 + 0.9, 0.8, { tone: "lo" }));
  const z0 = r * 0.5 + 1.7;
  if ((o.style ?? "box") === "tank") M.put("tank", M.disc([0, 0, z0 + 2.4], [1, 0, 0], L / 2 - 1, 2.4, { tone: "hi", lit: o.lit, inner: ({ F, half }) => Ln([-half * 0.5, 0, half * 0.5].map((s) => G.arcOf(F, s, 2.4, P, { least: 0.2 })).join(""), "faint") }));
  else M.put("body", M.slab({ x: -L / 2, y: -W / 2, w: L, d: W, r: 0.3 }, z0, 6, {
    tone: o.tone ?? "hi",
    lit: o.lit,
    bevel: 0.3,
    inner: ({ wp, z, h }) => facesOf(wp, P).map((f) => (f.len > W + 0.1 ? (o.style === "coach" ? windowGrid(f, P, { z0: z + 2.4, z1: z + 4.4, cols: Math.round(f.len / 3), rows: 1, margin: 1.2, gapS: 0.9, detail: 1 }) : Ln(fRect(f, f.len / 2 - 2.6, f.len / 2 + 2.6, z + 0.5, z + h - 0.6, P) + fV(f, f.len / 2, z + 0.5, z + h - 0.6, P), "lo")) : "")).join(""),
  }));
  return M.done({ x: -L / 2, y: -W / 2, w: L, d: W, z0: 0, z1: z0 + 6 });
}

// ================================================================ TECHNOLOGY

/** A server rack: cabinet, unit lines on the front, LEDs as dots, vents, handle. Front is local +x. */
export function serverRack(P, o = {}) {
  const M = maker(P, "rack", o);
  const W = o.w ?? 3;
  const D = o.d ?? 5;
  const H = o.h ?? 10;
  const units = o.units ?? 12;
  M.put("cabinet", M.slab({ x: -W / 2, y: -D / 2, w: W, d: D, r: 0.15 }, 0, H, {
    tone: o.tone ?? "mid",
    lit: o.lit,
    bevel: 0.2,
    inner: ({ wp, z }) => {
      const f = M.face(wp, [1, 0]);
      let out = "";
      for (const g of facesOf(wp, P)) if (!f || g.n[0] !== f.n[0] || g.n[1] !== f.n[1]) out += Ln(fH(g, 0, g.len, z + H - 0.6, P), "faint");
      if (!f) return out;
      const uh = (H - 1.2) / units;
      let lines = fV(f, 0.35, z + 0.4, z + H - 0.4, P) + fV(f, f.len - 0.35, z + 0.4, z + H - 0.4, P);
      for (let i = 0; i <= units; i++) lines += fH(f, 0.35, f.len - 0.35, z + 0.6 + i * uh, P);
      const leds = [];
      const vents = [];
      for (let i = 0; i < units; i++) {
        const zz = z + 0.6 + (i + 0.5) * uh;
        leds.push(facePoint(f, 0.9, zz), facePoint(f, 1.4, zz));
        if (M.detail >= 2) for (let s = 2.2; s < f.len - 0.8; s += 0.5) vents.push(facePoint(f, s, zz));
      }
      return out + Ln(lines, "lo") + Dt(vents, P, 0.18, "faint") + k.dotsSvg(leds.map((p) => k.iso(p, P)), { size: 0.3, tone: "hi", pulse: Boolean(o.pulse) });
    },
  }));
  M.at("front", [W / 2, 0, H / 2]);
  M.at("top", [0, 0, H]);
  return M.done({ x: -W / 2, y: -D / 2, w: W, d: D, z0: 0, z1: H });
}

/** A desk with legs; place desktop props on anchors.top. Local x along the desk. */
export function desk(P, o = {}) {
  const M = maker(P, "desk", o);
  const W = o.w ?? 10;
  const D = o.d ?? 5;
  const H = o.h ?? 4;
  M.put("legs", k.corners({ x: -W / 2, y: -D / 2, w: W, d: D }, 0.5).map(([x, y]) => M.slab({ x: x - 0.2, y: y - 0.2, w: 0.4, d: 0.4, r: 0 }, 0, H - 0.4, { tone: "lo" })));
  M.put("top", M.slab({ x: -W / 2, y: -D / 2, w: W, d: D, r: 0.3 }, H - 0.4, 0.4, { tone: o.tone ?? "mid", bevel: 0.2 }));
  if (o.chair !== false) {
    const cy = D / 2 + 1.6;
    M.put("chairLegs", k.corners({ x: -1, y: cy - 1, w: 2, d: 2 }, 0.2).map(([x, y]) => M.slab({ x: x - 0.12, y: y - 0.12, w: 0.24, d: 0.24, r: 0 }, 0, 1.8, { tone: "lo" })));
    M.put("chairSeat", M.slab({ x: -1.1, y: cy - 1.1, w: 2.2, d: 2.2, r: 0.3 }, 1.8, 0.3, { tone: "mid" }));
    M.put("chairBack", M.slab({ x: -1.1, y: cy + 0.8, w: 2.2, d: 0.3, r: 0.1 }, 2.1, 2.2, { tone: "mid" }));
    M.at("seat", [0, cy, 2.1]);
  }
  M.at("top", [0, 0, H]);
  return M.done({ x: -W / 2, y: -D / 2, w: W, d: D + 3, z0: 0, z1: H });
}
/** A desktop monitor on a stand. Screen faces local +x. content: lines drawn on the screen. */
export function monitor(P, o = {}) {
  const M = maker(P, "monitor", o);
  const W = o.w ?? 5;
  const H = o.h ?? 3.2;
  M.put("foot", M.slab({ x: -0.9, y: -1, w: 1.8, d: 2, r: 0.4 }, 0, 0.2, { tone: "lo" }));
  M.put("neck", M.slab({ x: -0.6, y: -0.2, w: 0.4, d: 0.4, r: 0 }, 0.2, 1.1, { tone: "mid" }));
  M.put("screen", M.slab({ x: -0.2, y: -W / 2, w: 0.4, d: W, r: 0.1 }, 1.3, H, {
    tone: "hi",
    lit: o.lit,
    inner: ({ wp, z, h }) => {
      const f = M.face(wp, [1, 0]);
      if (!f) return "";
      let lines = fRect(f, 0.3, f.len - 0.3, z + 0.3, z + h - 0.3, P);
      let text = "";
      for (let i = 0; i < 4; i++) text += fH(f, 0.8, 0.8 + (f.len - 1.6) * [0.8, 0.55, 0.7, 0.4][i], z + h - 0.9 - i * 0.55, P);
      return Ln(lines, "mid") + Ln(text, "lo", { free: true });
    },
  }));
  return M.done({ x: -1, y: -W / 2, w: 2, d: W, z0: 0, z1: 1.3 + H });
}
/** A laptop: base with a key grid and a raised lid. Lid at local -x, screen faces +x. */
export function laptop(P, o = {}) {
  const M = maker(P, "laptop", o);
  M.put("base", M.slab({ x: -1.6, y: -2.2, w: 3.2, d: 4.4, r: 0.2 }, 0, 0.25, { tone: "mid", after: ({ wp, top }) => k.dotsSvg(k.dotGrid(wp.x + 0.5, wp.y + 0.5, 4, 8, 0.48, top, P), { size: 0.16, tone: "lo" }) }));
  M.put("lid", M.slab({ x: -1.6 - 0.25, y: -2.2, w: 0.25, d: 4.4, r: 0.05 }, 0, 3, {
    tone: "hi",
    lit: o.lit,
    inner: ({ wp, z, h }) => {
      const f = M.face(wp, [1, 0]);
      return f ? Ln(fRect(f, 0.3, f.len - 0.3, z + 0.5, z + h - 0.3, P), "mid") : "";
    },
  }));
  return M.done({ x: -1.85, y: -2.2, w: 3.45, d: 4.4, z0: 0, z1: 3 });
}
/** A chip on a board: PCB with traces, a package with pins and a die outline. */
export function chip(P, o = {}) {
  const M = maker(P, "chip", o);
  const S = o.size ?? 6;
  const B = o.board ?? S * 2.2;
  if (o.board !== false) M.put("board", M.slab({ x: -B / 2, y: -B / 2, w: B, d: B, r: 0.4 }, 0, 0.4, {
    tone: "lo",
    after: ({ wp, top }) => {
      let d = "";
      for (let i = 1; i < 6; i++) {
        const t = wp.x + (wp.w * i) / 6;
        d += k.onTop([[t, wp.y], [t, wp.y + wp.d * 0.2], [t + 1, wp.y + wp.d * 0.2 + 1], [t + 1, (wp.y + wp.y + wp.d) / 2 - S / 2 - 0.6]], top, P);
      }
      return Ln(d, "faint") + Dt(k.corners(wp, 0.8).map(([x, y]) => [x, y, top]), P, 0.4, "mid");
    },
  }));
  const z0 = o.board === false ? 0 : 0.4;
  const pins = [];
  const n = o.pins ?? 6;
  for (let i = 0; i < n; i++) {
    const t = -S / 2 + (S * (i + 0.5)) / n;
    pins.push([M.slab({ x: t - 0.15, y: -S / 2 - 0.5, w: 0.3, d: 0.5, r: 0 }, z0, 0.3, { tone: "mid", crease: "none" }), M.slab({ x: t - 0.15, y: S / 2, w: 0.3, d: 0.5, r: 0 }, z0, 0.3, { tone: "mid", crease: "none" }), M.slab({ x: -S / 2 - 0.5, y: t - 0.15, w: 0.5, d: 0.3, r: 0 }, z0, 0.3, { tone: "mid", crease: "none" }), M.slab({ x: S / 2, y: t - 0.15, w: 0.5, d: 0.3, r: 0 }, z0, 0.3, { tone: "mid", crease: "none" })]);
  }
  for (let side = 0; side < 4; side++) M.put(`pins${side}`, pins.map((row) => row[side]));
  M.put("package", M.slab({ x: -S / 2, y: -S / 2, w: S, d: S, r: 0.2 }, z0, 0.9, { tone: "hi", lit: o.lit, bevel: 0.25, after: ({ wp, top }) => Ln(k.planOutline(k.insetPlan(wp, S * 0.28), top, P, 2), "mid") + Dt([[wp.x + 0.8, wp.y + 0.8, top]], P, 0.35, "hi") }));
  return M.done({ x: -B / 2, y: -B / 2, w: B, d: B, z0: 0, z1: z0 + 0.9 });
}
/** A ground satellite dish on a pedestal, tilted toward local +x. */
export function dish(P, o = {}) {
  const M = maker(P, "dish", o);
  const R = o.r ?? 6;
  const tilt = ((o.tilt ?? 40) * Math.PI) / 180;
  M.put("pad", M.slab({ x: -3, y: -3, w: 6, d: 6, r: 0.4 }, 0, 0.8, { tone: "lo", halo: true }));
  M.put("pedestal", M.cyl([0, 0], 1.1, 0.8, 5, { tone: "mid" }));
  const c = [0, 0, 7];
  const axis = [Math.cos(tilt), 0, Math.sin(tilt)];
  M.put("yoke", M.ball(c, 1.2, { tone: "mid" }));
  const base = G.add3(c, G.mul3(axis, 1.2));
  M.put("reflector", M.turn(base, axis, [[0, 1], [R * 0.25, R * 0.85], [R * 0.32, R]], { tone: "hi", lit: o.lit, inner: ({ F }) => Ln(G.arcOf(F, R * 0.2, R * 0.73, P, { least: 0.2 }), "faint") }));
  const face = G.add3(base, G.mul3(axis, R * 0.32));
  M.put("feed", M.rod(face, G.add3(face, G.mul3(axis, R * 0.55)), 0.3, { tone: "lo", after: () => Dt([M.p(G.add3(face, G.mul3(axis, R * 0.55)))], P, 0.55, "hi") }));
  M.at("feed", G.add3(face, G.mul3(axis, R * 0.55)));
  return M.done({ x: -R, y: -R, w: 2 * R, d: 2 * R, z0: 0, z1: 6 + R });
}
/** A lattice radio mast: square tapered stack with X bracing on visible faces, antenna panels, beacon. */
export function mast(P, o = {}) {
  const M = maker(P, "mast", o);
  const H = o.h ?? 40;
  const w0 = o.base ?? 4;
  const segs = o.segments ?? 5;
  M.put("footing", M.slab({ x: -w0 / 2 - 0.8, y: -w0 / 2 - 0.8, w: w0 + 1.6, d: w0 + 1.6, r: 0.3 }, 0, 0.8, { tone: "lo", halo: true }));
  for (let i = 0; i < segs; i++) {
    const w = w0 * (1 - (0.55 * i) / segs);
    const z = 0.8 + ((H - 0.8) * i) / segs;
    const h = (H - 0.8) / segs;
    M.put(`seg${i}`, M.slab({ x: -w / 2, y: -w / 2, w, d: w, r: 0 }, z, h, {
      tone: "lo",
      crease: "lo",
      inner: ({ wp, z: zz, h: hh }) => facesOf(wp, P).map((f) => Ln(k.segment(facePoint(f, 0, zz), facePoint(f, f.len, zz + hh), P) + k.segment(facePoint(f, f.len, zz), facePoint(f, 0, zz + hh), P), "mid")).join(""),
    }));
  }
  const wt = w0 * 0.45;
  M.put("panels", [[1, 0], [0, 1], [-1, 0], [0, -1]].map(([x, y]) => M.slab({ x: x * (wt / 2) - (x ? 0 : 0.8) + (x > 0 ? 0 : x < 0 ? -0.4 : 0), y: y * (wt / 2) - (y ? 0 : 0.8) + (y > 0 ? 0 : y < 0 ? -0.4 : 0), w: x ? 0.4 : 1.6, d: y ? 0.4 : 1.6, r: 0 }, H - 6, 4, { tone: "hi" })));
  M.put("beacon", M.cyl([0, 0], 0.25, H, 3, { tone: "mid", after: ({ cx, cy, top }) => Dt([[cx, cy, top]], P, 0.8, "hi") }));
  M.at("top", [0, 0, H + 3]);
  return M.done({ x: -w0 / 2 - 0.8, y: -w0 / 2 - 0.8, w: w0 + 1.6, d: w0 + 1.6, z0: 0, z1: H + 3 });
}
/** A network router or switch: a flat box with port row and status LEDs on its front (+x). */
export function router(P, o = {}) {
  const M = maker(P, "router", o);
  const W = o.w ?? 2.4;
  const D = o.d ?? 8;
  M.put("box", M.slab({ x: -W / 2, y: -D / 2, w: W, d: D, r: 0.2 }, 0, 1.2, {
    tone: "hi",
    lit: o.lit,
    inner: ({ wp, z }) => {
      const f = M.face(wp, [1, 0]);
      if (!f) return "";
      let ports = "";
      const leds = [];
      const n = o.ports ?? 8;
      for (let i = 0; i < n; i++) {
        const s = 0.8 + ((f.len - 1.6) * i) / n;
        ports += fRect(f, s, s + ((f.len - 1.6) / n) * 0.7, z + 0.25, z + 0.65, P);
        leds.push(facePoint(f, s + 0.2, z + 0.92));
      }
      return Ln(ports, "mid") + k.dotsSvg(leds.map((p) => k.iso(p, P)), { size: 0.22, tone: "hi", pulse: Boolean(o.pulse) });
    },
  }));
  for (const [i, y] of [-D / 2 + 0.8, D / 2 - 0.8].entries()) M.put(`aerial${i}`, M.cyl([-W / 2 + 0.5, y], 0.15, 1.2, 2.4, { tone: "lo" }));
  M.at("port", [W / 2, 0, 0.45]);
  return M.done({ x: -W / 2, y: -D / 2, w: W, d: D, z0: 0, z1: 3.6 });
}
/** A camera or sensor on a pole, looking along local +x. */
export function sensorPole(P, o = {}) {
  const M = maker(P, "sensor", o);
  const H = o.h ?? 12;
  M.put("footing", M.slab({ x: -1, y: -1, w: 2, d: 2, r: 0.3 }, 0, 0.5, { tone: "lo" }));
  M.put("pole", M.cyl([0, 0], 0.3, 0.5, H - 0.5, { tone: "mid" }));
  M.put("arm", M.slab({ x: 0, y: -0.25, w: 1.6, d: 0.5, r: 0 }, H - 0.8, 0.5, { tone: "mid" }));
  M.put("camera", M.slab({ x: 0.6, y: -0.7, w: 2.8, d: 1.4, r: 0.3 }, H - 0.3, 1.3, {
    tone: "hi",
    lit: o.lit,
    inner: ({ wp, z }) => {
      const f = M.face(wp, [1, 0]);
      return f ? Ln(k.sideRing(facePoint(f, f.len / 2, z + 0.65), 0.4, f.n[0] ? "x" : "y", P, 16), "mid") : "";
    },
  }));
  M.at("lens", [3.4, 0, H + 0.35]);
  return M.done({ x: -1, y: -1, w: 4.4, d: 2, z0: 0, z1: H + 1 });
}
/** A robot arm in a fixed L pose: base, turret, upright arm, horizontal forearm, wrist, gripper. */
export function robotArm(P, o = {}) {
  const M = maker(P, "robotArm", o);
  const reach = o.reach ?? 8;
  const up = o.up ?? 8;
  M.put("base", M.cyl([0, 0], 2.4, 0, 1.2, { tone: "lo", inner: ({ cx, cy, r, z }) => Ln(k.sideArc(cx, cy, r, z + 0.6, P), "faint"), after: ({ cx, cy, r, top }) => Dt([0, 1, 2, 3, 4, 5].map((i) => [cx + (r - 0.4) * Math.cos(i), cy + (r - 0.4) * Math.sin(i), top]), P, 0.3, "mid") }));
  M.put("turret", M.cyl([0, 0], 1.6, 1.2, 1.6, { tone: "mid" }));
  M.put("upper", M.slab({ x: -0.9, y: -0.9, w: 1.8, d: 1.8, r: 0.5 }, 2.8, up, { tone: "hi", lit: o.lit, inner: ({ wp, z, h }) => Ln(k.sideSeam(wp, z + h * 0.5, P, 3), "faint") }));
  M.put("elbow", M.slab({ x: -1.2, y: -1.2, w: 2.4, d: 2.4, r: 0.8 }, 2.8 + up, 1.6, { tone: "mid" }));
  M.put("fore", M.slab({ x: 1.2, y: -0.7, w: reach, d: 1.4, r: 0.4 }, 2.8 + up + 0.2, 1.2, { tone: "hi", lit: o.lit }));
  M.put("wrist", M.cyl([1.2 + reach - 0.8, 0], 0.6, 2.8 + up - 1.2, 1.4, { tone: "mid" }));
  M.put("fingers", [-0.45, 0.25].map((y) => M.slab({ x: 1.2 + reach - 1.1, y, w: 0.6, d: 0.2, r: 0 }, 2.8 + up - 2.6, 1.4, { tone: "lo" })));
  M.at("tool", [1.2 + reach - 0.8, 0, 2.8 + up - 2.6]);
  return M.done({ x: -2.4, y: -2.4, w: reach + 3.6, d: 4.8, z0: 0, z1: 2.8 + up + 1.6 });
}
/** A battery cell or battery bank block: terminals, label band, charge bars on top. */
export function battery(P, o = {}) {
  const M = maker(P, "battery", o);
  const W = o.w ?? 6;
  const D = o.d ?? 4;
  const H = o.h ?? 4;
  const charge = o.charge ?? 0.7;
  M.put("case", M.slab({ x: -W / 2, y: -D / 2, w: W, d: D, r: 0.4 }, 0, H, {
    tone: "mid",
    bevel: 0.3,
    inner: ({ wp, z, h }) => Ln(k.sideSeam(wp, z + h * 0.35, P, 3) + k.sideSeam(wp, z + h * 0.65, P, 3), "faint"),
    after: ({ wp, top }) => {
      const bars = Math.round(charge * 5);
      let d = "";
      for (let i = 0; i < 5; i++) d += k.onTop([[wp.x + 1 + i * 0.8, wp.y + 1], [wp.x + 1.5 + i * 0.8, wp.y + 1], [wp.x + 1.5 + i * 0.8, wp.y + 2.2], [wp.x + 1 + i * 0.8, wp.y + 2.2]], top, P, true);
      return Ln(d, "lo") + Dt(ladder(bars).map((i) => [wp.x + 1.25 + i * 0.8, wp.y + 1.6, top]), P, 0.3, "hi");
    },
  }));
  M.put("terminals", [-W / 4, W / 4].map((x) => M.cyl([x, D / 4], 0.45, H, 0.6, { tone: "hi", lit: o.lit })));
  M.at("plus", [-W / 4, D / 4, H + 0.6]);
  M.at("minus", [W / 4, D / 4, H + 0.6]);
  return M.done({ x: -W / 2, y: -D / 2, w: W, d: D, z0: 0, z1: H + 0.6 });
}
/** A solar array: tilted-looking panels as thin slabs on posts with cell grids. rows x cols panels. */
export function solarArray(P, o = {}) {
  const M = maker(P, "solar", o);
  const rows = o.rows ?? 2;
  const cols = o.cols ?? 3;
  const pw = 6;
  const pd = 4;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x = -((cols - 1) * (pw + 1)) / 2 + c * (pw + 1);
      const y = -((rows - 1) * (pd + 3)) / 2 + r * (pd + 3);
      M.put(`posts${r}${c}`, [[x - pw / 2 + 0.8, y], [x + pw / 2 - 0.8, y]].map(([px, py]) => M.slab({ x: px - 0.15, y: py - 0.15, w: 0.3, d: 0.3, r: 0 }, 0, 2, { tone: "lo" })));
      M.put(`panel${r}${c}`, M.slab({ x: x - pw / 2, y: y - pd / 2, w: pw, d: pd, r: 0.1 }, 2, 0.3, {
        tone: "hi",
        lit: o.lit && r === 0 && c === 0,
        after: ({ wp, top }) => {
          let d = "";
          for (let i = 1; i < 6; i++) d += k.lineOnTop([wp.x + (wp.w * i) / 6, wp.y], [wp.x + (wp.w * i) / 6, wp.y + wp.d], top, P);
          for (let i = 1; i < 4; i++) d += k.lineOnTop([wp.x, wp.y + (wp.d * i) / 4], [wp.x + wp.w, wp.y + (wp.d * i) / 4], top, P);
          return Ln(d, "lo");
        },
      }));
    }
  return M.done({ x: -(cols * (pw + 1)) / 2, y: -(rows * (pd + 3)) / 2, w: cols * (pw + 1), d: rows * (pd + 3), z0: 0, z1: 2.3 });
}
/** A wind turbine: stepped tower, nacelle, hub, three blades in the rotor plane (local y-z). */
export function windTurbine(P, o = {}) {
  const M = maker(P, "turbine", o);
  const H = o.h ?? 40;
  const R = o.r ?? 18;
  const phase = o.phase ?? 0.3;
  M.put("footing", M.cyl([0, 0], 3, 0, 1, { tone: "lo" }));
  const radii = [1.6, 1.3, 1];
  radii.forEach((r, i) => M.put(`tower${i}`, M.cyl([0, 0], r, 1 + ((H - 1) * i) / 3, (H - 1) / 3, { tone: "hi", crease: "none" })));
  M.put("nacelle", M.slab({ x: -4, y: -1.3, w: 7, d: 2.6, r: 1 }, H, 2.6, { tone: "mid", bevel: 0.3 }));
  const hub = [3 + 1, 0, H + 1.3];
  M.put("hub", M.ball(hub, 1.1, { tone: "hi", lit: o.lit }));
  ladder(3).forEach((i) => M.put(`blade${i}`, (() => {
    const a = phase + (i * TAU) / 3;
    const dir = [0, Math.cos(a), Math.sin(a)];
    const start = G.add3(hub, G.mul3(dir, 1.02));
    return M.rod(start, G.add3(start, G.mul3(dir, R)), 0.6, { tone: "hi" });
  })()));
  M.at("hub", hub);
  return M.done({ x: -4, y: -R, w: 8, d: 2 * R, z0: 0, z1: H + 1.3 + R });
}
/** A substation transformer block: tank with cooling fins, bushings and a fenced pad. */
export function substation(P, o = {}) {
  const M = maker(P, "substation", o);
  M.put("pad", M.slab({ x: -7, y: -5, w: 14, d: 10, r: 0.3 }, 0, 0.6, { tone: "lo", halo: true }));
  M.put("tank", M.slab({ x: -4, y: -2.5, w: 8, d: 5, r: 0.3 }, 0.6, 6, {
    tone: "mid",
    lit: o.lit,
    inner: ({ wp, z, h }) => facesOf(wp, P).map((f) => Ln(ladder(Math.floor(f.len / 0.7) - 1).map((i) => fV(f, (i + 1) * 0.7, z + 0.8, z + h - 0.8, P)).join(""), "lo")).join(""),
  }));
  M.put("bushings", [-2.4, 0, 2.4].map((x) => M.turn([x, 0, 6.6], [0, 0, 1], [[0, 0.5], [0.6, 0.6], [1.2, 0.4], [1.8, 0.55], [2.4, 0.35], [3, 0.5], [3.4, 0.25]], { tone: "hi" })));
  M.put("cabinet", M.slab({ x: 4.6, y: -2, w: 1.8, d: 4, r: 0.2 }, 0.6, 4, { tone: "lo" }));
  ["x1", "x2", "x3"].forEach((n, i) => M.at(n, [-2.4 + 2.4 * i, 0, 10]));
  return M.done({ x: -7, y: -5, w: 14, d: 10, z0: 0, z1: 10 });
}
/** A pipe run on saddles: straight round legs joined by block elbows, one inline valve with a
 *  handwheel. points: local [x, y] corners on a horizontal route at height h. */
export function pipeRun(P, o = {}) {
  const M = maker(P, "pipe", o);
  const pts = o.points ?? [[-20, 0], [10, 0], [10, 12]];
  const h = o.h ?? 3;
  const r = o.r ?? 0.8;
  const e = r * 1.25;
  pts.forEach(([x, y], i) => M.put(`elbow${i}`, M.slab({ x: x - e, y: y - e, w: 2 * e, d: 2 * e, r: 0.2 }, h - e, 2 * e, { tone: "mid", after: ({ wp, top }) => Dt(k.corners(wp, 0.35).map(([a, b]) => [a, b, top]), P, 0.3, "mid") })));
  let valveDone = false;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const len = Math.hypot(bx - ax, by - ay);
    const dir = [(bx - ax) / len, (by - ay) / len, 0];
    const leg = (s0, s1, name) => {
      const mid = (s0 + s1) / 2;
      const c = [ax + dir[0] * mid, ay + dir[1] * mid, h];
      M.put(name, M.disc(c, dir, (s1 - s0) / 2, r, { tone: "hi", lit: o.lit, crease: "none" }));
    };
    if (!valveDone && len > 14) {
      const v = len / 2;
      leg(e, v - 1.4, `leg${i}a`);
      const vc = [ax + dir[0] * v, ay + dir[1] * v];
      M.put("valve", M.slab({ x: vc[0] - 1.4, y: vc[1] - 1.4, w: 2.8, d: 2.8, r: 0.5 }, h - 1.4, 2.8, { tone: "mid", bevel: 0.2 }));
      M.put("stem", M.cyl(vc, 0.2, h + 1.4, 1.6, { tone: "lo" }));
      M.put("wheel", M.cyl(vc, 1.5, h + 3, 0.3, { tone: "hi", lit: true, crease: "none", after: ({ cx, cy, top }) => Ln(k.lineOnTop([cx - 1.4, cy], [cx + 1.4, cy], top, P) + k.lineOnTop([cx, cy - 1.4], [cx, cy + 1.4], top, P), "mid") }));
      leg(v + 1.4, len - e, `leg${i}b`);
      M.anchors.valve = M.p([vc[0], vc[1], h + 3.3]);
      valveDone = true;
    } else leg(e, len - e, `leg${i}`);
    for (let s = 4; s < len - 3; s += 8) {
      if (valveDone && Math.abs(s - len / 2) < 3 && i === 0) continue;
      const c = [ax + dir[0] * s, ay + dir[1] * s];
      M.put(`saddle${i}.${s}`, M.slab({ x: c[0] - 0.7, y: c[1] - 0.7, w: 1.4, d: 1.4, r: 0 }, 0, h - r, { tone: "lo" }));
    }
  }
  pts.forEach(([x, y], i) => M.put(`elbowPost${i}`, M.slab({ x: x - 0.6, y: y - 0.6, w: 1.2, d: 1.2, r: 0 }, 0, h - e, { tone: "lo" })));
  M.at("start", [pts[0][0], pts[0][1], h]);
  M.at("end", [pts[pts.length - 1][0], pts[pts.length - 1][1], h]);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return M.done({ x: Math.min(...xs) - e, y: Math.min(...ys) - e, w: Math.max(...xs) - Math.min(...xs) + 2 * e, d: Math.max(...ys) - Math.min(...ys) + 2 * e, z0: 0, z1: h + 3.3 });
}

// ================================================================ KNOWLEDGE AND PAPER

/** A sheet of paper lying flat, with rule lines (printed text) and an optional title block. */
export function documentSheet(P, o = {}) {
  const M = maker(P, "document", o);
  const W = o.w ?? 6;
  const D = o.d ?? 8.4;
  M.put("sheet", M.slab({ x: -W / 2, y: -D / 2, w: W, d: D, r: 0 }, 0, o.thick ?? 0.12, {
    tone: o.tone ?? "hi",
    lit: o.lit,
    crease: "none",
    after: ({ wp, top }) => {
      let d = "";
      const n = o.lines ?? 9;
      for (let i = 0; i < n; i++) {
        const y = wp.y + 1.4 + ((wp.d - 2.2) * i) / n;
        const w = (wp.w - 1.6) * [1, 0.92, 0.85, 1, 0.6, 0.95, 0.88, 0.7, 0.4][i % 9];
        d += k.lineOnTop([wp.x + 0.8, y], [wp.x + 0.8 + w, y], top, P);
      }
      return Ln(d, "lo", { free: true }) + (o.stamp ? Ln(k.ring(wp.x + wp.w - 1.4, wp.y + wp.d - 1.4, 0.8, top, P, 20), "mid") : "");
    },
  }));
  M.at("corner", [W / 2, D / 2, 0.12]);
  return M.done({ x: -W / 2, y: -D / 2, w: W, d: D, z0: 0, z1: 0.12 });
}
/** A stack of sheets (a report, a ream): edges visible as faint lines up the sides. */
export function paperStack(P, o = {}) {
  const M = maker(P, "papers", o);
  const W = o.w ?? 6;
  const D = o.d ?? 8.4;
  const H = o.h ?? 2;
  M.put("stack", M.slab({ x: -W / 2, y: -D / 2, w: W, d: D, r: 0 }, 0, H, {
    tone: o.tone ?? "hi",
    lit: o.lit,
    inner: ({ wp, z, h }) => Ln(facesOf(wp, P).map((f) => ladder(Math.floor(h / 0.3) - 1).map((i) => fH(f, 0, f.len, z + (i + 1) * 0.3, P)).join("")).join(""), "faint"),
    after: ({ wp, top }) => {
      let d = "";
      for (let i = 0; i < 6; i++) d += k.lineOnTop([wp.x + 0.8, wp.y + 1.4 + i * 1], [wp.x + 0.8 + (wp.w - 1.6) * (i % 3 === 2 ? 0.6 : 0.95), wp.y + 1.4 + i * 1], top, P);
      return Ln(d, "lo", { free: true });
    },
  }));
  return M.done({ x: -W / 2, y: -D / 2, w: W, d: D, z0: 0, z1: H });
}
/** A closed book lying flat: covers, page block, spine bands. */
export function book(P, o = {}) {
  const M = maker(P, "book", o);
  const W = o.w ?? 5;
  const D = o.d ?? 7;
  const H = o.h ?? 1.2;
  M.put("cover0", M.slab({ x: -W / 2, y: -D / 2, w: W, d: D, r: 0.1 }, 0, 0.15, { tone: "mid", crease: "none" }));
  M.put("pages", M.slab({ x: -W / 2 + 0.2, y: -D / 2 + 0.2, w: W - 0.2, d: D - 0.4, r: 0 }, 0.15, H - 0.3, { tone: "hi", crease: "none", inner: ({ wp, z, h }) => Ln(facesOf(wp, P).map((f) => ladder(3).map((i) => fH(f, 0, f.len, z + ((i + 1) * h) / 4, P)).join("")).join(""), "faint") }));
  M.put("spine", M.slab({ x: -W / 2, y: -D / 2, w: 0.2, d: D, r: 0 }, 0.15, H - 0.3, { tone: "mid", crease: "none" }));
  M.put("cover1", M.slab({ x: -W / 2, y: -D / 2, w: W, d: D, r: 0.1 }, H - 0.15, 0.15, { tone: o.tone ?? "mid", lit: o.lit, crease: "none", after: ({ wp, top }) => Ln(k.planOutline(k.insetPlan(wp, 0.7), top, P, 2), "lo") }));
  return M.done({ x: -W / 2, y: -D / 2, w: W, d: D, z0: 0, z1: H });
}
/** A ring binder standing on its edge: spine label plate, rings shown as dots on the spine. */
export function binder(P, o = {}) {
  const M = maker(P, "binder", o);
  const T = o.t ?? 1.6;
  const D = o.d ?? 7;
  const H = o.h ?? 8;
  M.put("binder", M.slab({ x: -T / 2, y: -D / 2, w: T, d: D, r: 0.15 }, 0, H, {
    tone: o.tone ?? "mid",
    lit: o.lit,
    inner: ({ wp, z, h }) => {
      const f = M.face(wp, [1, 0]);
      if (!f) return "";
      return Ln(fRect(f, 0.3, f.len - 0.3, z + h * 0.62, z + h * 0.82, P), "lo") + Ln(k.sideRing(facePoint(f, f.len / 2, z + h * 0.25), 0.35, f.n[0] ? "x" : "y", P, 12), "lo");
    },
  }));
  return M.done({ x: -T / 2, y: -D / 2, w: T, d: D, z0: 0, z1: H });
}
/** A whiteboard on a stand, board facing local +x, with drawn lines and a tray. */
export function whiteboard(P, o = {}) {
  const M = maker(P, "whiteboard", o);
  const W = o.w ?? 12;
  const H = o.h ?? 7;
  const z0 = o.raise ?? 4;
  M.put("feet", [-W / 2 + 1, W / 2 - 1].map((y) => M.slab({ x: -1.6, y: y - 0.3, w: 3.2, d: 0.6, r: 0.2 }, 0, 0.4, { tone: "lo" })));
  M.put("legs", [-W / 2 + 1, W / 2 - 1].map((y) => M.slab({ x: -0.2, y: y - 0.2, w: 0.4, d: 0.4, r: 0 }, 0.4, z0 - 0.4, { tone: "mid" })));
  M.put("board", M.slab({ x: -0.25, y: -W / 2, w: 0.5, d: W, r: 0.1 }, z0, H, {
    tone: "hi",
    lit: o.lit,
    inner: ({ wp, z, h }) => {
      const f = M.face(wp, [1, 0]);
      if (!f) return "";
      let d = fRect(f, 0.4, f.len - 0.4, z + 0.4, z + h - 0.4, P);
      let ink = "";
      for (let i = 0; i < 3; i++) ink += k.segment(facePoint(f, 1.4 + i * 3.4, z + h * 0.62), facePoint(f, 3.6 + i * 3.4, z + h * 0.62), P) + k.segment(facePoint(f, 2.5 + i * 3.4, z + h * 0.62), facePoint(f, 2.5 + i * 3.4, z + h * 0.32), P);
      return Ln(d, "mid") + Ln(ink, "lo", { free: true });
    },
  }));
  M.put("tray", M.slab({ x: 0.25, y: -W / 2 + 0.5, w: 0.8, d: W - 1, r: 0 }, z0 - 0.3, 0.3, { tone: "mid" }));
  M.at("board", [0.25, 0, z0 + H / 2]);
  return M.done({ x: -1.6, y: -W / 2, w: 3.2, d: W, z0: 0, z1: z0 + H });
}
/** A shelf or filing cabinet: a carcass with shelf lines and items (binders) as small blocks. */
export function shelf(P, o = {}) {
  const M = maker(P, "shelf", o);
  const W = o.w ?? 3;
  const D = o.d ?? 10;
  const H = o.h ?? 10;
  const n = o.shelves ?? 4;
  M.put("carcass", M.slab({ x: -W / 2, y: -D / 2, w: W, d: D, r: 0.1 }, 0, H, {
    tone: o.tone ?? "mid",
    inner: ({ wp, z, h }) => {
      const f = M.face(wp, [1, 0]);
      if (!f) return "";
      let d = "";
      for (let i = 1; i < n; i++) d += fH(f, 0, f.len, z + (h * i) / n, P);
      let backs = "";
      if (o.drawers) for (let i = 0; i < n; i++) backs += fRect(f, f.len / 2 - 1, f.len / 2 + 1, z + (h * (i + 0.5)) / n - 0.2, z + (h * (i + 0.5)) / n + 0.2, P);
      else for (let i = 0; i < n; i++) for (let s = 0.6; s < f.len - 0.6; s += 0.8) backs += fV(f, s, z + (h * i) / n + 0.3, z + (h * (i + 0.75)) / n, P);
      return Ln(d, "lo") + Ln(backs, "faint", o.drawers ? {} : { free: "end" });
    },
  }));
  return M.done({ x: -W / 2, y: -D / 2, w: W, d: D, z0: 0, z1: H });
}

// ================================================================ LOGISTICS AND GENERIC

/** A wooden crate with plank lines and corner battens. */
export function crate(P, o = {}) {
  const M = maker(P, "crate", o);
  const S = o.size ?? 3;
  M.put("crate", M.slab({ x: -S / 2, y: -S / 2, w: S, d: S, r: 0.1 }, 0, o.h ?? S, {
    tone: o.tone ?? "mid",
    lit: o.lit,
    inner: ({ wp, z, h }) => Ln(facesOf(wp, P).map((f) => ladder(2).map((i) => fH(f, 0, f.len, z + ((i + 1) * h) / 3, P)).join("") + fV(f, 0.35, z, z + h, P) + fV(f, f.len - 0.35, z, z + h, P)).join(""), "lo"),
    after: ({ wp, top }) => Ln(k.lineOnTop([wp.x, wp.y], [wp.x + wp.w, wp.y + wp.d], top, P), "faint"),
  }));
  return M.done({ x: -S / 2, y: -S / 2, w: S, d: S, z0: 0, z1: o.h ?? S });
}
/** A pallet with a load of cartons (strapped). */
export function pallet(P, o = {}) {
  const M = maker(P, "pallet", o);
  const W = o.w ?? 5;
  const D = o.d ?? 4;
  M.put("blocks", [-1, 0, 1].map((i) => M.slab({ x: -W / 2, y: i * (D / 2 - 0.3) - 0.3, w: W, d: 0.6, r: 0 }, 0, 0.5, { tone: "lo" })));
  M.put("deck", M.slab({ x: -W / 2, y: -D / 2, w: W, d: D, r: 0 }, 0.5, 0.25, { tone: "mid", after: ({ wp, top }) => Ln(ladder(4).map((i) => k.lineOnTop([wp.x + ((i + 1) * wp.w) / 5, wp.y], [wp.x + ((i + 1) * wp.w) / 5, wp.y + wp.d], top, P)).join(""), "faint") }));
  const H = o.load ?? 3;
  if (H > 0) M.put("load", M.slab({ x: -W / 2 + 0.2, y: -D / 2 + 0.2, w: W - 0.4, d: D - 0.4, r: 0.1 }, 0.75, H, {
    tone: o.tone ?? "hi",
    lit: o.lit,
    inner: ({ wp, z, h }) => Ln(facesOf(wp, P).map((f) => fH(f, 0, f.len, z + h / 2, P) + fV(f, f.len / 2, z, z + h, P)).join(""), "lo"),
    after: ({ wp, top }) => Ln(k.lineOnTop([wp.x + wp.w / 2, wp.y], [wp.x + wp.w / 2, wp.y + wp.d], top, P) + k.lineOnTop([wp.x, wp.y + wp.d / 2], [wp.x + wp.w, wp.y + wp.d / 2], top, P), "lo"),
  }));
  return M.done({ x: -W / 2, y: -D / 2, w: W, d: D, z0: 0, z1: 0.75 + H });
}
/** A drum or barrel: hoops, lid ring and bung. */
export function drum(P, o = {}) {
  const M = maker(P, "drum", o);
  const r = o.r ?? 1.3;
  const H = o.h ?? 3.4;
  M.put("drum", M.cyl([0, 0], r, 0, H, {
    tone: o.tone ?? "mid",
    lit: o.lit,
    inner: ({ cx, cy, r: rr, z, h }) => Ln([0.33, 0.66].map((t) => k.sideArc(cx, cy, rr, z + h * t, P, 24)).join(""), "lo"),
    after: ({ cx, cy, r: rr, top }) => Ln(k.ring(cx, cy, rr - 0.25, top, P, 24), "faint") + Dt([[cx + rr * 0.5, cy, top]], P, 0.3, "mid"),
  }));
  return M.done({ x: -r, y: -r, w: 2 * r, d: 2 * r, z0: 0, z1: H });
}
/** A conveyor segment along local x: frame, rollers seen as lines on the belt, legs. */
export function conveyor(P, o = {}) {
  const M = maker(P, "conveyor", o);
  const L = o.len ?? 30;
  const W = o.w ?? 4;
  const H = o.h ?? 3;
  M.put("legs", ladder(Math.max(2, Math.round(L / 8)) + 1).flatMap((i) => {
    const x = -L / 2 + 1 + ((L - 2) * i) / Math.max(2, Math.round(L / 8));
    return [-W / 2 + 0.4, W / 2 - 0.4].map((y) => M.slab({ x: x - 0.2, y: y - 0.2, w: 0.4, d: 0.4, r: 0 }, 0, H - 0.8, { tone: "lo" }));
  }));
  M.put("frame", M.slab({ x: -L / 2, y: -W / 2, w: L, d: W, r: 0.2 }, H - 0.8, 0.8, {
    tone: "mid",
    inner: ({ wp, z }) => Ln(facesOf(wp, P).map((f) => fH(f, 0, f.len, z + 0.4, P)).join(""), "faint"),
    after: ({ wp, top }) => {
      let d = "";
      for (let x = wp.x + 1; x < wp.x + wp.w - 0.5; x += 1.2) d += k.lineOnTop([x, wp.y + 0.5], [x, wp.y + wp.d - 0.5], top, P);
      return Ln(d, "lo") + Ln(k.lineOnTop([wp.x, wp.y + 0.5], [wp.x + wp.w, wp.y + 0.5], top, P) + k.lineOnTop([wp.x, wp.y + wp.d - 0.5], [wp.x + wp.w, wp.y + wp.d - 0.5], top, P), "mid");
    },
  }));
  M.at("start", [-L / 2 + 1, 0, H]);
  M.at("end", [L / 2 - 1, 0, H]);
  return M.done({ x: -L / 2, y: -W / 2, w: L, d: W, z0: 0, z1: H });
}
/** A parcel (taped box). */
export function parcel(P, o = {}) {
  const M = maker(P, "parcel", o);
  const s = o.size ?? 2;
  M.put("box", M.slab({ x: -s / 2, y: -s * 0.4, w: s, d: s * 0.8, r: 0.1 }, 0, s * 0.7, {
    tone: o.tone ?? "hi",
    lit: o.lit,
    inner: ({ wp, z, h }) => Ln(facesOf(wp, P).map((f) => fV(f, f.len / 2, z, z + h, P)).join(""), "lo"),
    after: ({ wp, top }) => Ln(k.lineOnTop([wp.x + wp.w / 2, wp.y], [wp.x + wp.w / 2, wp.y + wp.d], top, P), "lo"),
  }));
  return M.done({ x: -s / 2, y: -s * 0.4, w: s, d: s * 0.8, z0: 0, z1: s * 0.7 });
}
/** A flag on a pole: the cloth is a thin slab in the local x-z plane with an optional mark. */
export function flag(P, o = {}) {
  const M = maker(P, "flag", o);
  const H = o.h ?? 14;
  M.put("base", M.cyl([0, 0], 1, 0, 0.6, { tone: "lo" }));
  M.put("pole", M.cyl([0, 0], 0.2, 0.6, H - 0.6, { tone: "mid", after: ({ cx, cy, top }) => Dt([[cx, cy, top]], P, 0.5, "hi") }));
  M.put("cloth", M.slab({ x: 0.2, y: -0.06, w: 5, d: 0.12, r: 0 }, H - 3.6, 3.2, {
    tone: "hi",
    lit: o.lit,
    crease: "none",
    inner: ({ wp, z, h }) => {
      if (!o.mark) return "";
      const f = facesOf(wp, P).find((g) => g.len > 1);
      return f ? Ln(fH(f, f.len / 2 - 1, f.len / 2 + 1, z + h / 2, P) + fV(f, f.len / 2, z + h / 2 - 1, z + h / 2 + 1, P), "mid") : "";
    },
  }));
  return M.done({ x: -1, y: -1, w: 6.2, d: 2, z0: 0, z1: H });
}
/** A signpost: post and a sign board facing local +x with rule lines for its text. */
export function signpost(P, o = {}) {
  const M = maker(P, "sign", o);
  const H = o.h ?? 6;
  M.put("post", M.slab({ x: -0.2, y: -0.2, w: 0.4, d: 0.4, r: 0 }, 0, H - 2.4, { tone: "mid" }));
  M.put("board", M.slab({ x: -0.15, y: -2, w: 0.3, d: 4, r: 0.1 }, H - 2.4, 2.4, {
    tone: "hi",
    lit: o.lit,
    inner: ({ wp, z, h }) => {
      const f = M.face(wp, [1, 0]);
      return f ? Ln(fRect(f, 0.3, f.len - 0.3, z + 0.3, z + h - 0.3, P), "mid") + Ln(fH(f, 0.7, f.len - 0.9, z + h * 0.6, P) + fH(f, 0.7, f.len * 0.6, z + h * 0.35, P), "lo", { free: true }) : "";
    },
  }));
  return M.done({ x: -0.2, y: -2, w: 0.4, d: 4, z0: 0, z1: H });
}
/** A traffic or marker cone. */
export function cone(P, o = {}) {
  const M = maker(P, "cone", o);
  M.put("base", M.slab({ x: -0.9, y: -0.9, w: 1.8, d: 1.8, r: 0.2 }, 0, 0.2, { tone: "lo" }));
  M.put("cone", M.turn([0, 0, 0.2], [0, 0, 1], [[0, 0.7], [2.2, 0.15]], { tone: "hi", lit: o.lit, inner: ({ F }) => Ln(G.arcOf(F, 1.1, 0.45, P, { slope: -0.25 }), "lo") }));
  return M.done({ x: -0.9, y: -0.9, w: 1.8, d: 1.8, z0: 0, z1: 2.4 });
}
/** A bollard (mooring post) on a quay edge. */
export function bollard(P, o = {}) {
  const M = maker(P, "bollard", o);
  M.put("bollard", M.turn([0, 0, 0], [0, 0, 1], [[0, 0.9], [0.3, 0.9], [0.4, 0.6], [1.4, 0.6], [1.6, 0.85], [1.9, 0.85]], { tone: o.tone ?? "lo" }));
  return M.done({ x: -0.9, y: -0.9, w: 1.8, d: 1.8, z0: 0, z1: 1.9 });
}
/** A floor arrow or lane marking, painted on the ground (decal, local x is the direction). */
export function floorArrow(P, o = {}) {
  const L = o.len ?? 6;
  const W = o.w ?? 2;
  const [x, y, z = 0] = o.at ?? [0, 0, 0];
  const rot = (((o.rot ?? 0) % 4) + 4) % 4;
  const cs = [1, 0, -1, 0][rot];
  const sn = [0, 1, 0, -1][rot];
  const pts = [[-L / 2, -W * 0.22], [L / 2 - W, -W * 0.22], [L / 2 - W, -W / 2], [L / 2, 0], [L / 2 - W, W / 2], [L / 2 - W, W * 0.22], [-L / 2, W * 0.22]];
  return Ln(k.onTop(pts.map(([a, b]) => [x + a * cs - b * sn, y + a * sn + b * cs]), z + 0.02, P, true), o.tone ?? "mid");
}
/** A lamp mast (floodlight pole): pole, head frame and lamps as dots. */
export function lightMast(P, o = {}) {
  const M = maker(P, "lightMast", o);
  const H = o.h ?? 30;
  M.put("footing", M.slab({ x: -1.2, y: -1.2, w: 2.4, d: 2.4, r: 0.3 }, 0, 0.6, { tone: "lo" }));
  M.put("pole", M.cyl([0, 0], 0.5, 0.6, H - 0.6, { tone: "mid", crease: "none" }));
  M.put("head", M.slab({ x: -2, y: -0.6, w: 4, d: 1.2, r: 0.2 }, H, 1.4, { tone: "mid", inner: ({ wp, z }) => facesOf(wp, P).map((f) => Dt(ladder(Math.max(1, Math.floor(f.len / 1))).map((i) => facePoint(f, 0.5 + i, z + 0.7)), P, 0.35, "hi")).join("") }));
  M.at("head", [0, 0, H + 1.4]);
  return M.done({ x: -2, y: -1.2, w: 4, d: 2.4, z0: 0, z1: H + 1.4 });
}
/** A platform or stage: a low deck with steps on its local +x side. */
export function platform(P, o = {}) {
  const M = maker(P, "platform", o);
  const W = o.w ?? 16;
  const D = o.d ?? 10;
  const H = o.h ?? 1.6;
  M.put("deck", M.slab({ x: -W / 2, y: -D / 2, w: W, d: D, r: 0.3 }, 0, H, { tone: o.tone ?? "mid", halo: true, bevel: 0.3, after: ({ wp, top }) => Ln(ladder(Math.floor(wp.w / 2) - 1).map((i) => k.lineOnTop([wp.x + (i + 1) * 2, wp.y], [wp.x + (i + 1) * 2, wp.y + wp.d], top, P)).join(""), "faint") }));
  const n = Math.max(1, Math.round(H / 0.6));
  M.put("steps", ladder(n).map((i) => M.slab({ x: W / 2 + (n - 1 - i) * 1, y: -2, w: 1, d: 4, r: 0 }, 0, (H * (i + 1)) / (n + 1), { tone: "lo" })).reverse());
  M.at("top", [0, 0, H]);
  return M.done({ x: -W / 2, y: -D / 2, w: W + n, d: D, z0: 0, z1: H });
}
/** A gatehouse with a canopy over the lanes and barrier arms. Local y across the lanes. */
export function gate(P, o = {}) {
  const M = maker(P, "gate", o);
  const W = o.w ?? 30;
  const D = o.d ?? 8;
  const H = o.h ?? 10;
  const lanes = o.lanes ?? 2;
  const posts = [];
  for (const y of [-W / 2, W / 2]) for (const x of [-D / 2 + 0.6, D / 2 - 0.6]) posts.push([x, y]);
  M.put("postsFar", posts.filter(([, y]) => (M.sees([0, 1, 0]) ? y < 0 : y > 0)).map(([x, y]) => M.slab({ x: x - 0.4, y: y - 0.4, w: 0.8, d: 0.8, r: 0 }, 0, H, { tone: "mid" })));
  M.put("postsNear", posts.filter(([, y]) => (M.sees([0, 1, 0]) ? y > 0 : y < 0)).map(([x, y]) => M.slab({ x: x - 0.4, y: y - 0.4, w: 0.8, d: 0.8, r: 0 }, 0, H, { tone: "mid" })));
  M.put("canopy", M.slab({ x: -D / 2, y: -W / 2 - 1, w: D, d: W + 2, r: 0.3 }, H, 1.4, {
    tone: "hi",
    bevel: 0.3,
    inner: ({ wp, z, h }) => facesOf(wp, P).map((f) => Ln(fH(f, 0, f.len, z + h / 2, P), "faint")).join(""),
    after: ({ wp, top }) => Ln(ladder(lanes - 1).map((i) => k.lineOnTop([wp.x, wp.y + 1 + ((wp.d - 2) * (i + 1)) / lanes], [wp.x + wp.w, wp.y + 1 + ((wp.d - 2) * (i + 1)) / lanes], top, P)).join(""), "faint"),
  }));
  for (let i = 0; i <= lanes; i++) {
    if (i === 0 || i === lanes) continue;
    const y = -W / 2 + (W * i) / lanes;
    M.put(`booth${i}`, M.slab({ x: -1.6, y: y - 1.4, w: 3.2, d: 2.8, r: 0.3 }, 0, 5, { tone: "hi", inner: ({ wp, z }) => facesOf(wp, P).map((f) => windowGrid(f, P, { z0: z + 2.4, z1: z + 4.3, cols: 1, rows: 1, margin: 0.5, detail: 1, tone: "mid" })).join("") }));
    M.put(`boothRoof${i}`, M.slab({ x: -1.9, y: y - 1.7, w: 3.8, d: 3.4, r: 0.3 }, 5, 0.4, { tone: "mid" }));
  }
  for (let i = 0; i < lanes; i++) {
    const y = -W / 2 + (W * i) / lanes + 1.6;
    M.put(`barrierPost${i}`, M.slab({ x: D / 2 + 0.4, y: y - 0.5, w: 1, d: 1, r: 0.2 }, 0, 2.6, { tone: "mid" }));
    if (!(o.open ?? []).includes(i)) M.put(`arm${i}`, M.slab({ x: D / 2 + 0.6, y: y + 0.5, w: 0.5, d: W / lanes - 3.6, r: 0.1 }, 2.1, 0.4, { tone: "hi", lit: o.lit, after: ({ wp, top }) => Ln(ladder(Math.floor(wp.d / 1.2)).map((j) => k.lineOnTop([wp.x, wp.y + 0.6 + j * 1.2], [wp.x + wp.w, wp.y + 1.1 + j * 1.2], top, P)).join(""), "lo") }));
  }
  M.at("lane0", [0, -W / 2 + W / (2 * lanes), 0]);
  return M.done({ x: -D / 2, y: -W / 2 - 1, w: D + 2, d: W + 2, z0: 0, z1: H + 1.4 });
}

// ================================================================ NATURE

/** A tree: "round" (trunk and stacked crowns) or "cone" (conifer tiers). */
export function tree(P, o = {}) {
  const M = maker(P, "tree", o);
  const H = o.h ?? 10;
  const style = o.style ?? "round";
  const trunk = style === "cone" ? H * 0.2 : H * 0.4;
  M.put("trunk", M.cyl([0, 0], H * 0.05, 0, trunk, { tone: "lo", crease: "none" }));
  if (style === "cone") M.put("crown", M.turn([0, 0, trunk], [0, 0, 1], [[0, H * 0.28], [H * 0.3, H * 0.18], [H * 0.32, H * 0.22], [H * 0.6, H * 0.1], [H * 0.62, H * 0.13], [H * 0.8, 0.2]], { tone: o.tone ?? "mid" }));
  else M.put("crown", M.ball([0, 0, trunk + H * 0.3], H * 0.3, { tone: o.tone ?? "mid" }));
  return M.done({ x: -H * 0.3, y: -H * 0.3, w: H * 0.6, d: H * 0.6, z0: 0, z1: H });
}
/** A low shrub: a flattened ball resting on the ground. */
export function shrub(P, o = {}) {
  const M = maker(P, "shrub", o);
  const r = o.r ?? 1.8;
  M.put("shrub", M.turn([0, 0, 0], [0, 0, 1], [[0, r * 0.7], [r * 0.5, r, 1], [r, r * 0.7, 1], [r * 1.3, 0.1]], { tone: o.tone ?? "mid" }));
  return M.done({ x: -r, y: -r, w: 2 * r, d: 2 * r, z0: 0, z1: r * 1.3 });
}
/** A rock: an irregular convex block. */
export function rock(P, o = {}) {
  const M = maker(P, "rock", o);
  const s = o.size ?? 3;
  const ring = [[-s, -0.3 * s], [-0.4 * s, -0.8 * s], [0.6 * s, -0.7 * s], [s, 0], [0.5 * s, 0.7 * s], [-0.6 * s, 0.6 * s]];
  M.put("rock", M.extrude(ring, 0, s * 0.8, { tone: o.tone ?? "lo", bevel: 0.3 }));
  return M.done({ x: -s, y: -0.8 * s, w: 2 * s, d: 1.5 * s, z0: 0, z1: s * 0.8 });
}
/** A flat stylised cloud, airborne. Use sparingly (weather, cloud computing). */
export function cloud(P, o = {}) {
  const M = maker(P, "cloud", { airborne: true, ...o });
  const s = o.size ?? 6;
  M.put("cloud", M.slab({ x: -s, y: -s * 0.55, w: 2 * s, d: s * 1.1, r: s * 0.5 }, 0, s * 0.35, { tone: o.tone ?? "hi", steps: 8, crease: "none" }));
  M.put("puff", M.slab({ x: -s * 0.5, y: -s * 0.4, w: s, d: s * 0.8, r: s * 0.4 }, s * 0.35, s * 0.3, { tone: o.tone ?? "hi", steps: 8, crease: "none" }));
  return M.done({ x: -s, y: -s * 0.55, w: 2 * s, d: s * 1.1, z0: 0, z1: s * 0.65 });
}

// ================================================================ COMPOSITION

/** Layout helpers. Each returns world [x, y] points. */
export const place = {
  grid: (at, cols, rows, gx, gy) => ladder(rows).flatMap((r) => ladder(cols).map((c) => [at[0] + (c - (cols - 1) / 2) * gx, at[1] + (r - (rows - 1) / 2) * gy])),
  row: (from, to, count) => ladder(count).map((i) => [from[0] + ((to[0] - from[0]) * i) / Math.max(1, count - 1), from[1] + ((to[1] - from[1]) * i) / Math.max(1, count - 1)]),
  ring: (centre, radius, count, phase = 0) => ladder(count).map((i) => [centre[0] + radius * Math.cos(phase + (i * TAU) / count), centre[1] + radius * Math.sin(phase + (i * TAU) / count)]),
};

/** A floor route between two anchors: axis-aligned legs (x first, then y) through via points.
 *  Returns { points, length }. Draw it with routeSvg (a painted lane or a buried cable) or
 *  feed it to flow() for moving tokens. */
export function route(a, b, { via = [], z = null, order = "xy" } = {}) {
  const lift = z ?? Math.min(a[2] ?? 0, b[2] ?? 0);
  const stops = [a, ...via, b].map((p) => [p[0], p[1], lift]);
  const points = [stops[0]];
  for (let i = 1; i < stops.length; i++) {
    const p = points[points.length - 1];
    const q = stops[i];
    if (Math.abs(p[0] - q[0]) > 1e-6 && Math.abs(p[1] - q[1]) > 1e-6) points.push(order === "xy" ? [q[0], p[1], lift] : [p[0], q[1], lift]);
    points.push(q);
  }
  return { points, length: G.pathLength(points) };
}
/** A route drawn on the floor with terminal dots on both ends (they land on the anchors). */
export function routeSvg(r, P, { tone = "mid", dashed = false, ends = "both", size = 0.8 } = {}) {
  const flat = r.points.map((p) => k.iso(p, P));
  return k.wireSvg(flat[0], flat[flat.length - 1], { via: flat.slice(1, -1), tone, dashed, ends, size });
}
/** A route drawn as a round cable or pipe with the tube kit (not recorded for the audit:
 *  record it yourself with R.route when it must pass the clearance checks). */
export function routeTube(r, P, { radius = 0.4, tone = "mid", maxLength = 18 } = {}) {
  return tubePieces(G.fillet(r.points, radius * 3), radius, P, { maxLength }).map((piece) => tubeSvg(piece, { tone })).join("");
}
/** Tokens moving along a route: plain data for the live loop (see SCENE_LIVE flowAt). */
export function flow(r, { count = 4, speed = 6, phase = 0 } = {}) {
  return { points: r.points, length: r.length, count, speed, phase };
}

/** Collects props, records every item for the audit, settles the order, writes the body.
 *    const sc = scene(P, { recorder: A.recorder(P), settle: A.settle });
 *    sc.add(ground(P, {...}), truck(P, {...}));
 *    const body = sc.build();            // svg strings in settled painter's order
 *    A.auditOrExit(sc.R, P);
 *  Moving things: sc.mover(name, stations, build) records the mover at each station (a
 *  position along its path) so the audit orders it against every static item there; the
 *  body gets one empty slot per station and item, and SCENE_LIVE moves the drawn item into
 *  the slot of the nearest station each frame. */
export function scene(P, { recorder = null, settle = null } = {}) {
  const V = G.viewOf(P);
  const R = recorder ?? { P, items: [], solids: [], put(item) { const it = { ...item, key: item.key ?? G.dot3(item.at ?? [0, 0, 0], V) + (item.bias ?? 0) }; this.items.push(it); return it; }, solid: (s) => s };
  const S = { P, R, props: [], movers: new Map(), extra: [] };
  const record = (item, extra = {}) => R.put({ ...item, ...extra, shapes: (item.shapes ?? []).map((s) => (R.solid ? R.solid({ ...s, ...(extra.shapeMeta ?? {}) }) : s)) });
  S.add = (...props) => {
    for (const p of props.flat()) {
      if (!p) continue;
      S.props.push(p);
      for (const item of p.items) record(item);
    }
    return S;
  };
  /** stations: [[x, y, z] ...] positions of the mover's origin. build(at, index) -> prop. */
  S.mover = (name, stations, build) => {
    const entries = stations.map((at, i) => {
      const prop = build(at, i);
      return { at, items: prop.items.map((item, j) => record({ ...item, name: `${name}@${i}.${j}` }, { mover: name, station: i, slot: `${name}:${i}:${j}`, shapeMeta: { owner: "mover" } })) };
    });
    S.movers.set(name, { name, stations, entries, ref: stations[0], refItems: build(stations[0], 0).items });
    return S;
  };
  /** Skip pairs inside one mover (its stations overlap each other) and between movers. */
  S.skip = (a, b) => (a.route && a.route === b.route && Math.abs(a.chunk - b.chunk) <= 1) || Boolean(a.mover && b.mover);
  S.build = ({ settleOptions = {}, start = {} } = {}) => {
    if (settle) settle(R, P, { skip: S.skip, ...settleOptions });
    R.items.sort((a, b) => a.key - b.key);
    const first = new Map([...S.movers.keys()].map((n) => [n, start[n] ?? 0]));
    const refs = new Map([...S.movers.values()].map((m) => [m.name, m.refItems]));
    return R.items.map((item) => {
      if (!item.mover) return item.svg;
      const at = first.get(item.mover);
      const j = Number(item.slot.split(":")[2]);
      const inner = item.station === at ? `<g data-mover="${item.mover}" data-item="${j}">${refs.get(item.mover)[j].svg}</g>` : "";
      return `<g data-slot="${item.slot}">${inner}</g>`;
    });
  };
  /** JSON for the page: { name: { ref, stations, items } }. */
  S.moverData = () => Object.fromEntries([...S.movers.values()].map((m) => [m.name, { ref: m.ref, stations: m.stations, items: m.refItems.length }]));
  return S;
}

/** Runtime for movers and flows, to inline after kitScript() (uses translateAlong). */
export const SCENE_LIVE = `
function moverRuntime(svg, P, data) {
  const state = {};
  for (const [name, d] of Object.entries(data)) {
    const els = Array.from({ length: d.items }, (_, j) => svg.querySelector('[data-mover="' + name + '"][data-item="' + j + '"]'));
    state[name] = { d, els, station: -1 };
  }
  const nearest = (d, p) => { let best = 0, bd = Infinity; d.stations.forEach((s, i) => { const q = (s[0] - p[0]) ** 2 + (s[1] - p[1]) ** 2 + (s[2] - p[2]) ** 2; if (q < bd) { bd = q; best = i; } }); return best; };
  return {
    move(name, p, { show = true, opacity = 1 } = {}) {
      const m = state[name];
      if (!m) return;
      const i = nearest(m.d, p);
      if (i !== m.station) {
        m.els.forEach((el, j) => { const slot = svg.querySelector('[data-slot="' + name + ':' + i + ':' + j + '"]'); if (el && slot) slot.appendChild(el); });
        m.station = i;
      }
      const t = translateAlong(P, [p[0] - m.d.ref[0], p[1] - m.d.ref[1], p[2] - m.d.ref[2]]);
      m.els.forEach((el) => { if (!el) return; el.setAttribute("transform", t); el.style.display = show ? "" : "none"; el.style.opacity = opacity < 1 ? String(opacity) : ""; });
    },
    elements: (name) => (state[name] ? state[name].els : []),
  };
}
function flowAt(f, t) {
  const pts = f.points, out = [], seg = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]); seg.push(l); total += l; }
  for (let n = 0; n < f.count; n++) {
    let s = (((t * f.speed + f.phase + (n * total) / f.count) % total) + total) % total;
    let i = 0;
    while (i < seg.length - 1 && s > seg[i]) { s -= seg[i]; i++; }
    const u = seg[i] ? s / seg[i] : 0;
    out.push({ index: n, at: [0, 1, 2].map((a) => pts[i][a] + (pts[i + 1][a] - pts[i][a]) * u), dir: [0, 1, 2].map((a) => (pts[i + 1][a] - pts[i][a]) / (seg[i] || 1)) });
  }
  return out;
}
`;

/** Every prop by name, for contact sheets and brief-check. */
export const PROPS = {
  ground, road, runway, water, terraces, fence, wall, bridge,
  building, warehouse, controlTower, hangar, house, tent, tank, silo, factory,
  person, seated, group,
  truck, van, car, forklift, ship, container, containerStack, quayCrane, gantryCrane, aircraft, helicopter, drone, satellite, track, trainCar,
  serverRack, desk, monitor, laptop, chip, dish, mast, router, sensorPole, robotArm, battery, solarArray, windTurbine, substation, pipeRun,
  documentSheet, paperStack, book, binder, whiteboard, shelf,
  crate, pallet, drum, conveyor, parcel, flag, signpost, cone, bollard, lightMast, platform, gate,
  tree, shrub, rock, cloud,
};
