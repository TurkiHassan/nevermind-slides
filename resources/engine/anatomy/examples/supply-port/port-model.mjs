// Pure model of one berth: a quay crane works one bay, ship -> stack -> truck.
// No imports. build.mjs uses it in Node and inlines it (exports stripped) in the page,
// so the motion and the readout come from the same numbers.

export const U = 0.5; // metres per world unit (a 40 ft box is 24 units long)
export const SPEC = {
  trolley: 4, // m/s, trolley travel (typical ship-to-shore crane)
  hoistLoaded: 1.5, // m/s, hoisting with a box
  hoistEmpty: 3, // m/s, hoisting with an empty spreader
  lock: 12, // s, aligning the spreader, damping sway, locking the twistlocks
  unlock: 6, // s, unlocking the twistlocks
  truck: 5, // m/s, terminal truck on the lane
};
export const GEOM = {
  craneY: 14.5, // world y of the worked bay and the crane
  rows: [-35.4, -30, -24.6], // world x of the three rows across the ship
  pickHooks: [23.4, 18.2], // spreader height on the top tier, then the tier below
  safe: 31, // travel height of the spreader
  lane: 6, // world x of the truck lane under the crane
  slots: [30, 36], // world x of the two buffer slots on the stack (backreach)
  slotHook: 10.4, // spreader height landing on the stack's second tier
  truckHook: 8, // spreader height landing on a truck bed
  truckIn: -62, // truck centre where it appears
  truckOut: 66, // truck centre where it leaves through the gate
  truckStop: 19.5, // truck centre with its bed under the crane
};
export const CYCLES = 6; // 3 rows x 2 tiers, then the next bay

const metres = (a, b) => Math.abs(b - a) * U;

/** Every cycle as a list of segments { kind, t0, t1, x0, x1, z0, z1, carry, label }. */
export function plan() {
  const segs = [];
  let t = 0;
  let x = GEOM.lane;
  let z = GEOM.safe;
  const push = (kind, dur, x1, z1, carry, label, extra = {}) => {
    segs.push({ kind, t0: t, t1: t + dur, x0: x, x1, z0: z, z1, carry, label, ...extra });
    t += dur;
    x = x1;
    z = z1;
  };
  for (let c = 0; c < CYCLES; c++) {
    const row = GEOM.rows[c % 3];
    const pick = GEOM.pickHooks[Math.floor(c / 3)];
    const into = GEOM.slots[(c + 1) % 2];
    const from = GEOM.slots[c % 2];
    const tag = { cycle: c };
    push("trolley", metres(x, row) / SPEC.trolley, row, z, null, "to the ship", tag);
    push("hoist", metres(z, pick) / SPEC.hoistEmpty, row, pick, null, "lowering to the box", tag);
    push("lock", SPEC.lock, row, pick, null, "locking", { ...tag, pick: c });
    push("hoist", metres(pick, GEOM.safe) / SPEC.hoistLoaded, row, GEOM.safe, "ship", "lifting from the ship", tag);
    push("trolley", metres(row, into) / SPEC.trolley, into, GEOM.safe, "ship", "ship to stack", tag);
    push("hoist", metres(GEOM.safe, GEOM.slotHook) / SPEC.hoistLoaded, into, GEOM.slotHook, "ship", "landing on the stack", tag);
    push("unlock", SPEC.unlock, into, GEOM.slotHook, null, "unlocking", { ...tag, stacked: into });
    push("hoist", metres(GEOM.slotHook, GEOM.safe) / SPEC.hoistEmpty, into, GEOM.safe, null, "clearing the stack", tag);
    push("trolley", metres(into, from) / SPEC.trolley, from, GEOM.safe, null, "to the next box", tag);
    push("hoist", metres(GEOM.safe, GEOM.slotHook) / SPEC.hoistEmpty, from, GEOM.slotHook, null, "lowering to the stack", tag);
    push("lock", SPEC.lock, from, GEOM.slotHook, null, "locking", { ...tag, unstack: from });
    push("hoist", metres(GEOM.slotHook, GEOM.safe) / SPEC.hoistLoaded, from, GEOM.safe, "stack", "lifting from the stack", tag);
    push("trolley", metres(from, GEOM.lane) / SPEC.trolley, GEOM.lane, GEOM.safe, "stack", "stack to truck", tag);
    push("hoist", metres(GEOM.safe, GEOM.truckHook) / SPEC.hoistLoaded, GEOM.lane, GEOM.truckHook, "stack", "landing on the truck", tag);
    push("unlock", SPEC.unlock, GEOM.lane, GEOM.truckHook, null, "unlocking", { ...tag, loaded: c });
    push("hoist", metres(GEOM.truckHook, GEOM.safe) / SPEC.hoistEmpty, GEOM.lane, GEOM.safe, null, "clearing the truck", tag);
  }
  return { segs, period: t };
}

const P0 = plan();
export const PERIOD = P0.period;
/** Average crane moves per hour (two moves per cycle) and boxes to the road per hour. */
export const RATES = { movesPerHour: (2 * CYCLES * 3600) / PERIOD, boxesPerHour: (CYCLES * 3600) / PERIOD, cycleSeconds: PERIOD / CYCLES };

const ease = (u) => u * u * (3 - 2 * u);

/** The berth at time t (seconds, looped). */
export function stateAt(time) {
  const t = ((time % PERIOD) + PERIOD) % PERIOD;
  const segs = P0.segs;
  let i = segs.findIndex((s) => t < s.t1);
  if (i < 0) i = segs.length - 1;
  const s = segs[i];
  const u = s.t1 > s.t0 ? ease(Math.min(1, (t - s.t0) / (s.t1 - s.t0))) : 1;
  const x = s.x0 + (s.x1 - s.x0) * u;
  const hook = s.z0 + (s.z1 - s.z0) * u;
  // what has happened so far this loop
  const picked = [];
  const slotFull = [true, false];
  let truckLoadedAt = null;
  let unloadEnd = [];
  for (const g of segs) {
    if (g.pick !== undefined && g.t1 <= t) picked.push(g.pick);
    if (g.unstack !== undefined && g.t1 <= t) slotFull[GEOM.slots.indexOf(g.unstack)] = false;
    if (g.stacked !== undefined && g.t0 <= t) slotFull[GEOM.slots.indexOf(g.stacked)] = true;
    if (g.loaded !== undefined && g.t0 <= t) truckLoadedAt = g.t0;
  }
  for (const g of segs) if (g.loaded !== undefined) unloadEnd.push(g.t1);
  // a ship box is on the ship until its lock ends; the carried box hangs from the spreader
  const shipBoxes = [0, 1, 2, 3, 4, 5].map((c) => !picked.includes(c));
  // the truck: arrives before each landing, leaves after each unlock
  const drive = (metres(GEOM.truckIn, GEOM.truckStop)) / SPEC.truck;
  const leave = (metres(GEOM.truckStop, GEOM.truckOut)) / SPEC.truck;
  let truck = { show: false, y: GEOM.truckIn, loaded: false, opacity: 0 };
  for (const end of unloadEnd) {
    const landStart = segs.find((g) => g.kind === "hoist" && g.carry === "stack" && g.x1 === GEOM.lane && g.t1 <= end && g.t1 > end - SPEC.unlock - 0.01).t0;
    const arrive0 = landStart - 6 - drive;
    if (t >= arrive0 && t < end + leave) {
      if (t < arrive0 + drive) {
        const v = (t - arrive0) / drive;
        truck = { show: true, y: GEOM.truckIn + (GEOM.truckStop - GEOM.truckIn) * ease(v), loaded: false, opacity: Math.min(1, v * 5) };
      } else if (t < end) truck = { show: true, y: GEOM.truckStop, loaded: t >= end - SPEC.unlock, opacity: 1 };
      else {
        const v = (t - end) / leave;
        truck = { show: true, y: GEOM.truckStop + (GEOM.truckOut - GEOM.truckStop) * ease(v), loaded: true, opacity: Math.min(1, (1 - v) * 5) };
      }
    }
  }
  const done = segs.filter((g) => g.t1 <= t && g.kind === "unlock").length;
  return { t, x, hook, carry: s.carry, label: s.label, cycle: s.cycle, shipBoxes, slotFull, truck, moves: done };
}
