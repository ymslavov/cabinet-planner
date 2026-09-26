# The app — running it, data model, persistence, UI

## Running

```bash
~/projects/cabinet-planner/start   # Y's way in: sets the nvm PATH, starts the server, opens the browser
```

By hand:

```bash
export PATH="$HOME/.nvm/versions/node/v24.13.0/bin:$PATH"   # node only exists under nvm
cd ~/projects/cabinet-planner
npm run dev        # http://127.0.0.1:5188 (localhost:5188 also works)
npm test           # vitest: engine + store
npm run build      # tsc -b + vite build → dist/
npm run shot       # Playwright screenshots → shots/ (dev server must be running)
```

## Data model (`src/engine/types.ts`)

`PlanState = { settings, tools[], cabinets[], fixtures[] }` — all millimetres.

- **Settings**: targetHeight, clearance, kerf, sheet {length, width, thickness (measured), count},
  edgeTrim, respectGrain, timber {a, b, defaultLength, stock[{length, qty}]},
  osbCleat {width, laminations}, topLayers, feedLength, room {enabled, width, length}.
- **Tool**: footprint (baseWidth × baseLength), deckHeight above its own base, overallHeight,
  shape (drives the 3D model), color, feedAxis (x/z/none, in cabinet space), exempt +
  fixedSurfaceHeight, measured, notes.
- **Cabinet**: toolId (nullable), method, casterHeight, shelves[] (top-face heights above
  the inside floor), hasBack, overrides {width, length, surfaceHeight}, x, z, rotation.
- **Fixture**: existing furniture (outfeed cabinets): width, length, height, x, z, rotation, measured.

World placement: an object's x/z is its footprint centre; rotation turns it about Y in 90°
steps (90/270 swap its X/Z extents).

## Store (`src/store.ts`)

zustand vanilla store + `persist`, exposed as `planStore` and the `usePlan(selector)` hook.
`createPlanStore(storage)` builds one against any `StateStorage` — tests use `memoryStorage()`.

- **Persisted** under localStorage key `cabinet-planner`: settings, tools, cabinets, fixtures,
  and view prefs. **Not persisted**: selection.
- **Schema version** `SCHEMA_VERSION = 2`. To change the shape: bump it and add a step to
  `migrate()`. History: v2 (2026-09-26) adds the HMS 850 tool + "Planer base" cabinet to older
  saves (only if missing) — seed changes never reach an existing save on their own. New *settings* keys need no migration — `withDefaults` fills them from
  `defaultSettings()` on load and import.
- **Corrupt save**: `safeStorage` copies an unparseable value to `cabinet-planner.corrupt`
  and starts from the seed — the app never white-screens on bad storage.
- **localStorage unavailable** (private mode) → silently falls back to memory storage; the
  plan works but won't survive a reload. Export regularly.
- **Export/import**: `{ app: 'cabinet-planner', version, exportedAt, state }`. Import rejects
  other apps, newer versions and files missing any of the four collections, and leaves the
  current plan untouched when it does.
- Removing a tool sets `toolId: null` on its cabinets. Removing the selected object clears
  the selection. `reset()` restores the seed.

## UI map (`src/ui/`)

| Area | File | What it does |
|---|---|---|
| Header | `Header.tsx` | Title, tabs (Shop layout / Cut plan), the **tape** stock gauge, Export / Import / Reset |
| Left | `Sidebar.tsx` | Cabinets (lettered A, B … = part-code prefix), existing furniture, tools, "Shop settings and stock", Checks (click a check to select its object) |
| Centre | `three/LayoutView.tsx` / `cutplan/CutPlan.tsx` | Lazy-loaded per tab, inside `ViewBoundary` (shows "Loading the …" while the chunk loads, and an error panel instead of a blank area if the view crashes — e.g. no WebGL) |
| Right | `Inspector.tsx` | Form for the selection: cabinet, fixture, tool or settings |
| Fields | `fields.tsx` | `NumberField` commits on blur/Enter, Escape reverts; `ConfirmButton` = click twice within 3 s (no dialogs anywhere) |

- **The tape**: yellow tape-measure strip with one tick per sheet on hand; the dark hatched
  fill is `sheetsFraction`. It turns red when the nest needs more sheets than you have.
  Beneath: timber metres needed (and in stock, once entered).
- **Size overrides**: cabinet width/depth/top fields are empty while they follow the tool
  (computed value shown as a placeholder); typing a number overrides it (field turns yellow)
  and "auto" clears the override.
- **Keyboard**: R turns the selected cabinet/fixture 90°, Escape clears the selection
  (ignored while typing in a field).
- `useDerived()` (`src/useDerived.ts`) memoises `analyze()` on the four plan collections;
  every panel reads from that one result.

### Design language

Concrete-grey ground, graphite ink, **tape-measure yellow `#F5B800` means "selected / measure /
stock"** and nothing else; red-pen `#C63A2F` for errors. Barlow for UI, Barlow Condensed for
headings and dimension labels, tabular figures everywhere. OSB `#C9A66B` and timber
`#E3C592` are the material colours in the model and the diagrams. Sentence case, no
all-caps labels.

## 3D layout (`src/three/`)

| File | Role |
|---|---|
| `LayoutView.tsx` | Canvas, lights, floor + 100/1000 mm grid, room walls, work plane, feed strips, camera rig, toolbar, legend, label list |
| `CabinetObject.tsx` | One cabinet: casters, every `Part` as a textured box with edges, the tool on top, selection box, dimension lines; x-ray + exploded view |
| `ToolModel.tsx` | Primitive models per `tool.shape` at the real footprint/deck/overall height (table saw with blade/fence/guard, thicknesser with columns/head, sander with disc + belt, mitre saw with turntable/fence/Axial-Glide arm, drill press with column/table/head) |
| `FixtureObject.tsx` | Existing furniture: grey body, light top, wheels; translucent while unmeasured |
| `useFloorDrag.ts` | Click selects; drag slides on the floor plane with 10 mm snap, keeps the grab offset, disables orbit while dragging |
| `labels.tsx` | Screen-space DOM labels projected each frame (letter tags, names, dimension values) |
| `materials.ts` | Colours + procedural OSB strand texture; `osbTextureFor(size)` keeps strand scale constant per part |

- Scene units are millimetres; camera near 20 / far 80 000. An object's group sits at
  (x, 0, z) turned by `-rotation` about Y (clockwise seen from above).
- **Camera**: "Top view" toggles a straight-down preset; "Fit all" re-frames the bounds of all
  footprints (`fitNonce` in the store). Bounds changes alone (dragging) don't move the camera.
- **Work plane**: translucent yellow plane at `targetHeight` over the layout. **Feed strips**:
  green at deck height per feed-axis tool, red when a `feed-blocked` warning exists for it.
- **X-ray** (selected cabinet): panels ghost to 16 % so the framing shows. **Exploded**:
  parts pushed out 70 % from the carcass centre, top layers lifted, tool raised 420 mm.
- A cabinet the engine can't build (no parts) is drawn as a red translucent envelope.
- Verified 2026-09-26 with Playwright: dragging E moved it (400, 900) → (1170, 1160) on the
  10 mm snap and R turned it 90°; no console errors.

## Cut plan tab (`src/cutplan/CutPlan.tsx`)

- **OSB sheets**: one SVG per nested sheet in sheet space (x = 2500 length = strong axis,
  labelled under the sheet). Pieces are tinted per cabinet (legend above), labelled with the
  part code and their **on-sheet** size (what you mark out), hatched background = waste,
  offcuts ≥ 150 × 150 labelled with their size. Hovering a piece or a table row highlights
  every piece with that code in yellow; the SVG `<title>` names the part and cabinet.
- **Timber**: one row per bar, cuts left to right with code + length, kerf gaps between,
  "N left" for offcuts ≥ 200. Bars say "to buy" while stock isn't entered.
- **Parts by cabinet**: `partRows` groups identical parts; laminated OSB cleats show
  "(3 strips per cleat)"; grain-locked parts say "(along the strong axis)".
- Errors (pieces bigger than a sheet, more sheets than stock, timber oversize) appear as red
  notes at the top of their section.
