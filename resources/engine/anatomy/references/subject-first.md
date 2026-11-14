# Subject first

Read this before any geometry. It overrides "invent a machine" in `SKILL.md`. Follow the steps in order. Do not skip a step. Do not start drawing until step 5 is done and `brief-check` passes.

## The rule

1. The figure's subject comes from the topic's own world: its objects, places, people, vehicles, tools and paperwork.
2. Test: cover the caption and the title. A reader must still name the topic from the drawing alone. If they would say "a gauge" or "a machine", the figure fails.
3. The craft rules still hold: many small true parts, four tones, painter's order, audit to zero. A scene is not a shortcut.

## Step 1. Extract from the source text

Write these lists before choosing anything. Copy words from the source; do not invent.

| List | Minimum | What goes in it |
|---|---|---|
| `source_nouns` | 12 | Concrete things: objects, places, actors, tools, materials, vehicles, documents. Not ideas ("efficiency", "trust" are not nouns for this list). |
| `verbs` | 5 | What moves or changes: loads, routes, heals, trains, flows, fails, queues. |
| `quantities` | 3 to 5 | Numbers the figure must show truthfully, each with value, unit and where it came from. |

If the text has fewer than 12 concrete nouns, add the nouns of the field the text is about (what a practitioner would see on a normal working day), and mark them in the brief's `source` notes.

## Step 2. Climb the Subject Ladder

Take the FIRST rung that works. For every rung you skip, write one line saying why it fails.

| Rung | Subject | Use it when | Example |
|---|---|---|---|
| 1 | The thing itself: cutaway, exploded, or in operation | The topic is a physical thing or has one | A paper on battery chemistry: the cell, cut open, ions crossing the separator |
| 2 | The thing's native setting as a small diorama | The topic is an activity that happens in a place | Port throughput: the quay, the ship, the crane, the trucks |
| 3 | The field's own instrument or workspace | Practitioners use a recognisable tool, room or desk for it | Radiology triage: the reading room, screens, the queue of studies |
| 4 | A process made physical with the domain's real objects | The topic is a pipeline; each step has a real object | A data pipeline: ingest racks, a conveyor of parcels (records), sorting bins, a warehouse (the store) |
| 5 | LAST RESORT: a metaphor machine | The topic is purely abstract AND rungs 1-4 are written down as rejected with reasons | A theorem about lattices with no physical setting |

Rung 5 needs four entries in `rejected_rungs` (rungs 1, 2, 3 and 4), each with a reason. `brief-check` fails otherwise.

## Step 3. Pick subject, setting, mover, mapping

| Field | Rule |
|---|---|
| `subject` | One noun phrase from `source_nouns`. The thing the reader looks at first. |
| `setting` | Where it sits: a quay, a ward, a server hall, a classroom, a field. |
| `moves` | One sentence: what moves and what that motion means. It must be what really moves in that world. |
| `mapping` | At least 6 rows `part -> meaning`. Every `part` is a real noun from `source_nouns` or a scene prop you will draw. No row maps to a generic machine part ("dial", "knob", "lever") unless the topic literally has it. |

## Step 4. Static or animated

Ask: in the real subject, what moves, and is the motion the point?

| The real subject... | Mode | Example |
|---|---|---|
| moves, and the motion carries the idea (flow, cycle, throughput, queue, handoff) | `animated` | Containers moving ship to stack to truck; packets crossing a network |
| is a structure whose arrangement is the idea (layout, hierarchy, who sits where) | `static` | A field hospital's layout; a classroom's seating; a data centre floor |
| moves, but the idea is a single state or comparison | `static`, drawn at the telling moment | A grounded aircraft during a turnaround, frozen at refuelling |

Animated figures move only what moves in the real world, driven by a small pure model that also writes the readout. Never animate decoration.

## Step 5. Write the brief and check it

Save `<figure>.brief.json` next to `<figure>/build.mjs`:

```json
{
  "topic": "Container terminal throughput at a single berth",
  "source_nouns": ["ship", "quay", "crane", "container", "truck", "yard", "stack", "gate", "spreader", "trolley", "berth", "lane"],
  "verbs": ["unload", "lift", "carry", "stack", "load", "drive"],
  "quantities": [
    { "name": "trolley speed", "value": 4, "unit": "m/s", "source": "typical STS crane spec" },
    { "name": "hoist speed loaded", "value": 1.5, "unit": "m/s", "source": "typical STS crane spec" },
    { "name": "box length", "value": 12.2, "unit": "m", "source": "ISO 40 ft container" }
  ],
  "rung": 2,
  "rejected_rungs": [{ "rung": 1, "reason": "Throughput is not one object; it is the berth working." }],
  "subject": "quay crane",
  "setting": "container quay with ship alongside",
  "moves": "The crane lifts a container off the ship, sets it on the stack, then loads a truck that drives to the gate.",
  "mapping": [
    { "part": "ship", "meaning": "the vessel being worked" },
    { "part": "crane", "meaning": "the bottleneck resource" },
    { "part": "trolley", "meaning": "horizontal travel time" },
    { "part": "spreader", "meaning": "lock and unlock time" },
    { "part": "stack", "meaning": "the buffer between quay and road" },
    { "part": "truck", "meaning": "landside capacity" }
  ],
  "mode": "animated",
  "props": ["scene.ship", "scene.quayCrane", "scene.containerStack", "scene.truck", "scene.gate"]
}
```

Run:

```
node <anatomy>/scripts/brief-check.mjs path/to/figure.brief.json --build path/to/build.mjs
```

It must print `brief ok`. It fails on: short lists, wrong types, a banned subject, a rung 5 without four rejected rungs, mapping parts that are not in `source_nouns` or `props`, a build that neither imports `kit/scene.mjs` nor declares `// custom-subject: <reason>`, and a listed prop the build never calls. Fix each line it prints and run it again.

## Banned by default

These are allowed ONLY when the topic text names that object. `brief-check` enforces it.

| Instead of | Draw |
|---|---|
| Dial indicator / dial gauge for "a metric" | The place where the metric is produced, with its readout in the card: the berth for throughput, the ward for occupancy, the server hall for latency |
| Generic test rig / bench | The real workplace: the lab bench of that field, the hangar, the trading floor, the classroom |
| Lock / pin tumbler for "security" or "caching" | The guarded thing: the gate with its barrier and booth, the server rack behind a cage, the vault room |
| Gauge panel / instrument cluster | The control room of that domain: the tower cab, the dispatch desk with monitors, the bridge of the ship |
| "Machine with knobs" / lever box | The domain's own equipment: crane, conveyor, robot arm, ambulance, tractor, turbine |
| Plotter / gantry print head for "one resource serves many" | The real shared resource: one quay crane serving many bays, one runway serving many aircraft, one nurse station serving many beds |
| Chest of drawers for "storage tiers" | A warehouse with racks and pallets, a container yard with stacks, a library with shelves |

## Domain table

Start here. Pick props from `kit/scene.mjs` (API in `references/scene-kit.md`).

| Domain | Native subjects and settings | What moves | Useful props |
|---|---|---|---|
| Machine learning / AI models | A training hall of server racks; a sorting hall where tokens are parcels; a classroom where the model is the student | Parcels (tokens) routed between labelled bins; batches carried rack to rack | serverRack, conveyor, parcel, shelf, desk, monitor, person, route, flow |
| Transformer / attention papers | A sorting hall: tokens are parcels on conveyors, attention is the routing between bins, heads are parallel sorting lines | Parcels diverted along routes weighted by attention | conveyor, parcel, crate, signpost, floorArrow, robotArm, route, flow |
| Data pipelines | Ingest dock, conveyor line, sorting, warehouse (store), loading bay (serve) | Records as parcels along the line; trucks leaving the bay | conveyor, parcel, pallet, warehouse, forklift, truck, route |
| Networks / telecom | Masts on terrain, dishes, an exchange building, cable routes between sites | Packets along routes; signal hops mast to mast | mast, dish, router, building, terraces, route, routeTube, flow |
| Cybersecurity | A perimeter: fence, gate with barrier and booth, guarded server hall, camera poles | Visitors (packets) stopped or passed at the gate | fence, gate, sensorPole, serverRack, building, person, wall |
| Cloud / infrastructure | Data centre floor: rack rows, cooling, substation, generator, fibre in | Load moving rack to rack; power from substation | serverRack, substation, battery, pipeRun, building, route |
| Logistics / supply chain | Port, yard, warehouse, distribution centre, roads | Containers, trucks, forklifts, parcels | ship, quayCrane, containerStack, truck, forklift, warehouse, pallet, gate |
| Aviation | Apron, runway, hangar, control tower | Aircraft taxiing; fuel truck; passengers boarding | aircraft, runway, hangar, controlTower, van, person, cone |
| Maritime | Harbour, ship alongside, bollards, pilot boat | Ship berthing; cargo moving | ship, water, bollard, quayCrane, lightMast, container |
| Land vehicles | Road network, depot, workshop | Vehicles along roads; queue at a junction | road, truck, car, van, building, signpost, cone |
| Military training / exercises | A training range: tents, vehicles, flag, observation tower, terrain | Units moving between positions | tent, truck, van, flag, terraces, fence, person, group, controlTower |
| Command and control | Operations room: desks, monitors, whiteboard, a mast outside | Reports flowing in, orders flowing out | desk, monitor, whiteboard, person, seated, mast, dish, route |
| Medicine / hospital | Ward, theatre, ambulance bay, helipad | Patients moving triage to ward; ambulance arriving | building, tent, van (ambulance, mark), helicopter, person, seated |
| Public health | Clinic, vaccination tent, queue, supply truck | People through stations; supplies arriving | tent, group, person, truck, crate, signpost, flag |
| Education / classroom | Classroom: desks, whiteboard, seated students, teacher | Material from board to students; hands up | desk, seated, person, whiteboard, book, shelf, laptop |
| Finance / markets | Trading floor desks with monitors; a bank vault room; a clearing house | Orders along routes to the exchange | desk, monitor, building, paperStack, route, flow |
| Energy / grids | Wind farm, solar field, substation, lines to town | Power along routes; turbines turning | windTurbine, solarArray, substation, battery, house, route |
| Oil and gas | Wellpad, tank farm, pipe runs with valves, flare stack | Flow in pipes; trucks loading | tank, pipeRun, factory, truck, fence |
| Water | Reservoir, treatment tanks, pump house, pipes to town | Water through pipes and tanks | water, tank, pipeRun, building, terraces |
| Agriculture | Field plots, silo, barn, tractor (car/truck), irrigation | Harvest from field to silo | terraces, silo, warehouse, truck, tree, fence |
| Construction / urban planning | Site with crane, blocks, roads, fence | Floors rising; trucks delivering | building, gantryCrane, road, fence, truck, cone, house |
| Manufacturing | Factory hall, conveyor, robot arms, pallets | Parts along the line, arms placing | factory, conveyor, robotArm, pallet, forklift, crate |
| Space / satellites | Satellite in orbit, ground station dishes, launch pad | Signal satellite to dish; orbit position | satellite, dish, mast, building, platform |
| Law / governance | Courtroom or council chamber: bench, desks, documents, archive shelves | Documents through stages | desk, seated, person, documentSheet, paperStack, binder, shelf, platform |
| Media / publishing | Newsroom desks, print room, delivery vans | Stories desk to press to van | desk, monitor, paperStack, conveyor, van |
| Sports | Pitch or track, stands (platform), players (person) | Players and ball moving | ground (grid), platform, person, group, flag, cone |
| Environment / climate | Terrain, river, forest, factory chimney, town | Emissions rising; water level changing | terraces, water, tree, factory, house, cloud |

## Staying native on abstract software topics

Do not escape to a gauge. Find the workplace the software imitates.

| Topic | Native scene |
|---|---|
| Transformer attention | Sorting hall. Tokens are parcels on an inbound conveyor. Each attention head is a sorting line; signposts above the bins are the keys; parcels route to bins in proportion to the weights shown in the readout. |
| Caching | A warehouse with a small forward-pick shelf by the dock: hits are picked from the shelf, misses send a forklift to the back racks. |
| Load balancing | A gate with several lanes and booths; trucks assigned to the shortest queue. |
| Consensus / replication | Several buildings (sites) linked by routes; a document copied to each, stamped when the majority holds it. |
| Gradient descent | A hiker (person) walking down contour terraces toward the lowest step. |

## Craft still applies

- Parts density: a Figure scene still has 40-80 parts; a Hero 80-150. A diorama of five plain boxes fails.
- Tones: ground and terrain `lo`, buildings and vehicles `mid`, the subject `hi`, exactly one `lit` accent: the thing the reader should watch.
- Small true detail: windows with mullions, doors, roof seams, wheel hubs, corrugation ribs, LEDs as dots, page lines on paper.
- Painter's order: record every item with `scene().add()`, run `A.settle`, end with `A.auditOrExit`. `node build.mjs --audit` must end `audit passed`.
- No words in the drawing except at most one tiny engraved label. Words go in the card and caption.

## Checklist before you finish

- [ ] Brief written, `brief-check` prints `brief ok`.
- [ ] A stranger names the topic from the drawing with the caption covered.
- [ ] The subject is `hi`, one accent is `lit`, the setting is `lo`/`mid`.
- [ ] What moves is what really moves; the readout comes from the same model.
- [ ] `node build.mjs --audit` ends `audit passed`.
- [ ] Screenshots at 1x and 4x, dark and light, read and fixed.
