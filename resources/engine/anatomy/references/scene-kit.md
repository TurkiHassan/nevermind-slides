# Scene kit (`kit/scene.mjs`)

Topic-native props for subject-first figures (`references/subject-first.md`). Every prop is built from the kit's own solids (`slabOf`, `cylinder`, `extrude`, `G.prismOf`, `G.disc`, `G.solidOf`, `G.sphereOf`) and records its true shape, so `A.settle` orders it and `A.auditOrExit` proves it like any hand-built part.

```js
import * as k from "../../kit/iso-kit.mjs";
import * as A from "../../kit/audit.mjs";
import * as S from "../../kit/scene.mjs";
```

## 1. The convention

```js
const prop = S.truck(P, { id: "truck1", at: [x, y, z], rot: 1, tone: "mid", lit: false, detail: 2, ...sizes });
// prop = { id, kind, items, anchors, bounds }
```

| Field | Meaning |
|---|---|
| `items` | `[{ name, at, bias, svg, shapes }]`. One convex solid per item (or a few disjoint ones painted far to near), with its surface detail (windows, ribs, hubs, LEDs) inside its own svg. Ready for `R.put`; `scene().add()` does it for you. |
| `anchors` | Named world points: `door`, `top`, `bed`, `roof`, `front`, `feed` ... Use them to place one prop on another, to start and end routes, and for terminal dots. Every prop has `centre` and `top`. |
| `bounds` | `{ x, y, w, d, z0, z1 }` world footprint, for layout and `fitProjection`. |

Common options for every prop:

| Option | Meaning |
|---|---|
| `at` | `[x, y]` or `[x, y, z]`: footprint centre on the floor (z defaults to 0). |
| `rot` | 0-3 quarter turns about z. Local +x becomes world +x, +y, -x, -y. Detail is drawn only on faces that face the viewer, so turn a prop to show its door or windscreen. |
| `tone` | Body tone: `lo` (ground, terrain), `mid` (structure, vehicles), `hi` (the subject). |
| `lit` | The one accent the reader should watch. Use it on exactly one thing. |
| `detail` | 0 bare, 1 main detail, 2 everything (default). |
| `id` | Unique id; item names are `<id>.<part>`. An id starting `stand.` (or a `ground`/`water` prop) is ground for the support check. |
| `airborne` | A prop in flight holds itself up for the support check (satellite and cloud default to it). |

Units: about 0.5 m per world unit in the shipped props (a 40 ft container is 24 long, a person 3.6 tall). Keep one scale across a figure.

## 2. Composition

```js
const R = A.recorder(P);
const sc = S.scene(P, { recorder: R, settle: A.settle });
sc.add(S.ground(P, { id: "stand.site", w: 120, d: 90 }), S.tent(P, { id: "ward", at: [10, 0], rot: 1 }));
const body = sc.build();          // settles, sorts, returns svg strings in painter's order
A.auditOrExit(R, P);              // node build.mjs --audit must end "audit passed"
```

| Helper | What it does |
|---|---|
| `scene(P, { recorder, settle })` | `add(...props)` records every item and shape; `build({ start })` runs `settle` with the scene's `skip`, sorts, and returns the body; `mover(...)` and `moverData()` below. Without a recorder it sorts by plain depth (no audit). |
| `sc.mover(name, stations, build)` | A moving thing. `stations` are world positions along its path; `build(at, i)` returns the prop at that position. Each station is recorded, so the audit orders the mover against every static item there. The body gets an empty slot per station and item; the drawn item sits in the `start[name]` station (default 0). Movers share owner `mover`, so stations may overlap each other. |
| `SCENE_LIVE` | Page runtime (inline after `kitScript()`): `moverRuntime(svg, P, sc.moverData())` returns `{ move(name, [x, y, z], { show, opacity }) }`, which puts each item in the slot of the nearest station and translates it; `flowAt(flow, t)` gives token positions on a route. |
| `place.grid(at, cols, rows, gx, gy)`, `place.row(from, to, n)`, `place.ring(centre, r, n, phase)` | World `[x, y]` positions for layouts. |
| `route(a, b, { via, z, order })` | Axis-aligned floor path between anchors: `{ points, length }`. |
| `routeSvg(route, P, { tone, dashed, ends })` | The route as a painted line with terminal dots that land on the anchors. Put it in `ground({ decals })` so props paint over it. |
| `routeTube(route, P, { radius })` | The route as a round cable or pipe (record it yourself with `R.route` when it must pass the clearance checks). |
| `flow(route, { count, speed, phase })` | Plain data for tokens moving along a route in the live loop. |
| `floorArrow(P, { at, rot, len })` | A lane arrow (svg string, for `ground({ decals })`). |
| `merge(id, kind, props)` | Several props as one. |
| `facesOf(plan, P)`, `facePoint(face, s, z)`, `windowGrid(face, P, opts)` | Draw your own detail on the visible faces of a slab. |
| `shapes.slab / prism / disc / cylinder / body / ball / extruded` | Shape records in the audit's format, for custom parts. |
| `PROPS` | Every prop by name (contact sheets, `brief-check`). |

Rules that keep scenes audit-clean:
- Props meet flush: stand things on `0` or on an anchor's z; never sink one prop into another. The audit reports `sunk` pairs.
- Leave clear lanes for movers: a mover's stations must not pass through static props.
- Painted marks (lanes, helipad, routes) go in `ground({ decals })`; they then sit under every prop.

## 3. Props, one snippet each

`at` and `rot` are omitted below; every call takes them. Anchors in brackets.

### Ground and terrain
```js
S.ground(P, { id: "stand.site", w: 140, d: 100, h: 4, grid: 10, inset: 3, decals: "" }) // [nw, se] plinth, halo, paving grid
S.road(P, { len: 80, w: 12, lanes: 2, stop: 30 })      // [start, end] dashed lanes, optional stop line
S.runway(P, { len: 160, w: 18 })                         // threshold bars, centreline, edge lights
S.water(P, { w: 60, d: 60, h: 2, ripples: 30 })          // [level] basin with fading ripples (is ground)
S.terraces(P, { w: 50, d: 40, steps: 4, rise: 3 })       // hill as contour steps
S.fence(P, { len: 40, h: 3.4, pitch: 5 })               // posts and two rails along local x
S.wall(P, { len: 30, h: 5, t: 1.2, course: 1 })         // block courses and coping
S.bridge(P, { len: 50, w: 10, h: 8 })                    // [deck] piers, deck, railings
```

### Buildings
```js
S.building(P, { w: 24, d: 16, floors: 4, floorH: 6, bay: 4 })   // [door, roof] window grid, door on local +y
S.warehouse(P, { w: 40, d: 24, h: 9, rise: 4, doors: 3 })        // [door, dock] gable roof, roller doors on +y
S.controlTower(P, { h: 34, r: 3 })                               // [cab] glazed cab, mast
S.hangar(P, { len: 40, w: 30 })                                  // [door] barrel vault, ribs, door panels on +x end
S.house(P, { w: 14, d: 10, h: 6, rise: 4 })                      // [door] gable roof, chimney on the gable end
S.tent(P, { len: 16, w: 10, h: 6, mark: true })                  // [door] ridge tent, door and optional cross on +x end
S.tank(P, { r: 6, h: 14, cone: 3 })                               // [inlet] seams, ladder, cone roof
S.silo(P, {})                                                     // tall tank
S.factory(P, { w: 36, d: 22, h: 8, teeth: 4 })                   // [door, stack] sawtooth roof, chimney
```

### People
```js
S.person(P, { h: 3.6 })                 // [head] turned body and head, no face
S.seated(P, { seatH: 1.8 })             // on a stool (stool: false when on a chair anchor)
S.group(P, { count: 5, radius: 3 })     // a ring of people
```

### Vehicles
```js
S.truck(P, { load: "flat" | "box" | "none", cabTone: "hi" })   // [bed, cab, front] cab at local +x
S.van(P, { mark: true })                                         // [rear] ambulance with the mark, light bar
S.car(P, {})
S.forklift(P, { lift: 0 })                                       // [forks]
S.ship(P, { len: 140, beam: 26, h: 10 })                         // [deck, bow, bayAt(b, row, rows, tier)] hull, hatches, bridge, funnel
S.container(P, { len: 24, doors: 1 })                            // [top] ribs, door end, corner castings; local x along the box
S.containerStack(P, { rows: 2, cols: 1, tiers: 2, heights: (r, c) => 2 })
S.quayCrane(P, { trolley: 0, hook: 30 })                         // [waterside, landside] legs, girders, apex, stays; trolley: null for a mover
S.craneParts(P, { crane: S.craneGeometry(), x, hook, carry })    // { trolley, hoist } at a pose, for movers
S.gantryCrane(P, { span: 26, d: 12, h: 22, trolley: 0 })
S.aircraft(P, { len: 36, span: 40 })                             // [nose, door] high wing, four engines, T-tail
S.helicopter(P, {})                                              // [door] skids, stacked rotor blades
S.drone(P, { size: 3, airborne: true })
S.satellite(P, { size: 4 })                                      // solar wings with cell grids, dish
S.track(P, { len: 60 })                                          // [railTop]
S.trainCar(P, { style: "box" | "coach" | "tank", at: [x, y, railTop] })
```

### Technology
```js
S.serverRack(P, { units: 12, pulse: true })       // [front, top] unit lines, LEDs, vents on local +x
S.desk(P, { w: 10, chair: true })                  // [top, seat]
S.monitor(P, { at: deskTop })                      // screen on local +x with text lines
S.laptop(P, { at: deskTop })
S.chip(P, { size: 6, pins: 6 })                    // board, traces, package, pin 1
S.dish(P, { r: 6, tilt: 40 })                      // [feed]
S.mast(P, { h: 40 })                               // [top] lattice, panels, beacon
S.router(P, { ports: 8 })                          // [port]
S.sensorPole(P, { h: 12 })                         // [lens] camera looking along local +x
S.robotArm(P, { reach: 8, up: 8 })                 // [tool]
S.battery(P, { charge: 0.7 })                      // [plus, minus]
S.solarArray(P, { rows: 2, cols: 3 })
S.windTurbine(P, { h: 40, r: 18, phase: 0.3 })     // [hub]
S.substation(P, {})                                 // [x1, x2, x3] bushings
S.pipeRun(P, { points: [[-20, 0], [10, 0], [10, 12]], h: 3, r: 0.8 }) // [start, end, valve]
```

### Knowledge and paper
```js
S.documentSheet(P, { lines: 9, stamp: true })  // [corner]
S.paperStack(P, { h: 2 })
S.book(P, {})
S.binder(P, {})
S.whiteboard(P, { w: 12 })                     // [board] faces local +x
S.shelf(P, { shelves: 4, drawers: false })
```

### Logistics and generic
```js
S.crate(P, { size: 3 })
S.pallet(P, { load: 3 })        // load: 0 for an empty pallet or a stretcher
S.drum(P, {})
S.conveyor(P, { len: 30 })      // [start, end] rollers on the belt
S.parcel(P, { size: 2 })
S.flag(P, { h: 14, mark: true })
S.signpost(P, {})
S.cone(P, {})
S.bollard(P, {})
S.lightMast(P, { h: 30 })       // [head]
S.platform(P, { w: 16, d: 10 }) // [top] stage with steps on +x
S.gate(P, { w: 30, lanes: 2, open: [1] }) // [lane0] canopy, booths, barrier arms
```

### Nature
```js
S.tree(P, { h: 10, style: "round" | "cone" })
S.shrub(P, {})
S.rock(P, { size: 3 })
S.cloud(P, { at: [x, y, 30] })  // sparingly
```

## 4. A full minimal build

```js
import { writeFileSync } from "node:fs";
import * as k from "../../kit/iso-kit.mjs";
import * as A from "../../kit/audit.mjs";
import * as S from "../../kit/scene.mjs";

const SITE = { x: -40, y: -30, w: 80, d: 60 };
const P = k.fitProjection(k.boxCorners(SITE, -3, 20), 600, 380, { pad: 24 });
const R = A.recorder(P);
const sc = S.scene(P, { recorder: R, settle: A.settle });
const lane = S.route([-30, 12, 0], [28, 12, 0]);
sc.add(S.ground(P, { id: "stand.yard", w: SITE.w, d: SITE.d, h: 3, decals: S.routeSvg(lane, P, { dashed: true }) }));
sc.add(S.warehouse(P, { id: "shed", at: [0, -10], w: 36, d: 18 }));
sc.add(S.truck(P, { id: "truck", at: [6, 12], load: "box", lit: true }));
sc.add(S.forklift(P, { id: "lift", at: [-22, 10], rot: 0 }), S.pallet(P, { id: "pallet", at: [-14, 10] }));
sc.add(S.person(P, { id: "clerk", at: [24, 2] }));
const body = sc.build();
A.auditOrExit(R, P);
const svg = k.figureSvg({ width: 600, height: 380, label: "A warehouse dock: a truck at the doors, a forklift bringing a pallet.", body, standalone: "dark" });
writeFileSync("dock.svg", svg);
```

For a live figure, follow `examples/supply-port/build.mjs`: a pure model module, `sc.mover(...)` for every moving thing, `kitScript() + S.SCENE_LIVE + model + live` as the page script, and `moverRuntime(...).move(...)` each frame. A live figure inside a deck must not bind ArrowLeft or ArrowRight: the deck owns them.

## 5. Checking props

- A contact sheet of every prop: loop over `S.PROPS`, put each on its own `ground`, `scene().build()`, and render the SVGs in a grid; read the PNG at 1x and 4x.
- Every prop passes `A.audit` alone at all four rotations except `quayCrane` with a parked trolley at `rot: 1` or `2`, where the hoist ropes graze the far girder in one settle (0.3 px slivers); use the crane's trolley as a mover, as the port does, or keep `rot` 0 or 3.

## 6. Limits

- Props are prisms, turned bodies, balls and boxes: no free-form surfaces. Tapered lattice towers are stepped segments.
- Detail on faces is drawn only on faces that face the viewer at build time; a prop seen from another azimuth needs a rebuild (it is a build-time picture, like the rest of the kit).
- `mover` picks the nearest recorded station each frame, so its order is exact at stations and approximate between them; space stations closer where it passes near tall props.
