# Cabinet Planner — design

Date: 2026-09-26 · Status: approved (Y, "yes, drive the build autonomously")

## Purpose

Y is building rolling OSB base cabinets for five workshop tools so every tool deck lands at
the same 900 mm working plane, and two existing 900 mm rolling cabinets serve as outfeed
tables. Stock on hand: **7 sheets of 2500 × 1500 × 15 mm OSB-3** plus an unknown quantity of
**30 × 40 mm timber**. The source spreadsheet
(`<sheet-id: see skill/references/private.md>`, tab gid=0) already derives cabinet sizes and
estimates that the OSB-only build needs exactly 7 sheets — no margin.

The app answers three questions, live, as the configuration changes:

1. **What does the shop look like?** — a 3D layout, at real size, of every cabinet (every
   panel, cleat, shelf and top layer as a real part), each tool on top, and the outfeed tables.
2. **Does it line up?** — every deck at the target plane, nothing overlapping, tools fit
   their tops, feed paths visible.
3. **Can I cut it from what I have?** — guillotine-nested sheet diagrams for a track saw,
   a timber cut list against stock lengths, and a budget badge that goes red when it doesn't fit.

Success: Y can change any tool dimension, caster height, build method or shelf and immediately
see the 3D model, the cut plan and the stock verdict change, then take the sheet diagrams
into the shop.

## Decisions (from brainstorming)

| Topic | Decision |
|---|---|
| 3D scope | Whole-shop layout: all cabinets + outfeed tables on a floor, drag/rotate, deck-plane check |
| Build method | Choosable per cabinet: `osb-cleat` (sheet rules), `timber-cleat`, `timber-frame` |
| Interior | Open box + fixed shelves (no drawers or doors) |
| Cut output | Nested sheet diagrams, timber cut list, live stock-budget warning. No PDF. |
| Saw | Track saw → guillotine-only nesting, kerf 3 mm (editable) |
| Timber stock | Unknown — entered in-app; app reports needed lengths until then |
| Outfeed tables | 1000 × 600 × 900 placeholders flagged MEASURE |
| Tool models | Simplified-but-recognizable primitives at exact footprint/deck height; cabinets fully detailed |
| Storage | Browser `localStorage` (zustand persist, versioned) + JSON export/import |
| Delivery | Vite dev server / static build on localhost; `.app` wrapper possible later |

## Architecture

Parametric, single source of truth: **config → pure engine → parts → (3D, nester, budget)**.

```
store (zustand+persist)          engine (pure TS, unit-tested)                 UI (React)
┌──────────────────────┐        ┌───────────────────────────────┐        ┌──────────────────┐
│ settings             │──────▶ │ sizing: cabinet dims          │──────▶ │ Layout (r3f)     │
│ tools[]              │        │ parts: Part[] per cabinet     │        │ Cut plan (SVG)   │
│ cabinets[]           │        │ nest: guillotine sheets       │        │ Inspector/lists  │
│ fixtures[] (outfeed) │        │ timber: 1D bar packing        │        │ Budget badge     │
│ room                 │        │ checks: warnings              │        └──────────────────┘
└──────────────────────┘        └───────────────────────────────┘
```

Units: millimetres everywhere, including the three.js scene. Axes: X = width (left→right),
Y = up, Z = depth (+Z is the cabinet front, facing the operator).

### Data model

- **Settings**: `targetHeight` 900, `clearance` 25, `kerf` 3, `sheet` {length 2500, width 1500,
  thickness 15 (measured value — nominal varies 14.5–15.5), count 7}, `edgeTrim` 0,
  `respectGrain` false, `timber` {a 30, b 40, stock: [{length, qty}], defaultLength 3000},
  `osbCleat` {width 60, laminations 3}, `topLayers` 2, `feedLength` 2500.
- **Tool**: id, name, shape (`tableSaw | thicknesser | sander | mitreSaw | drillPress | generic`),
  baseWidth, baseLength, deckHeight, overallHeight, weightKg, color, feedAxis (`z | x | none`),
  exempt (bool), fixedSurfaceHeight (used when exempt), notes.
- **Cabinet**: id, name, toolId|null, method, casterHeight, shelves (heights above the inside
  floor), hasBack, overrides {width?, length?, surfaceHeight?}, x, z, rotation (0/90/180/270).
- **Fixture** (existing outfeed cabinets): id, name, width, length, height, x, z, rotation, measured flag.
- **Room**: enabled, width, length.

Seed data: the five tools and their sheet values; five cabinets placed in a row; two outfeed fixtures.

### Engine

- **Sizing**: `width = baseWidth + 2·clearance`, `length = baseLength + 2·clearance`,
  `surface = target − deckHeight` (or `fixedSurfaceHeight` if exempt),
  `topThickness = topLayers · t`, `carcassHeight = surface − caster − topThickness`.
  Overrides replace computed values. Verified against the sheet: GTS 10 XC → 790 × 620,
  surface 560, carcass 430.
- **Parts** (open box, same panel set for every method):
  bottom W×L (casters bolt through it); back W×(H−t) full width behind the sides; sides
  (L−t)×(H−t) standing on the bottom; top = `topLayers` layers of W×L; shelves
  (W−2t)×(L−t−cleatDepth), stopping in front of the rear corner cleats so every cut stays a
  straight rip/crosscut.
  Framing:
  - `osb-cleat`: 45×60 laminated OSB cleats (3 strips of t×60) at every panel joint — rear
    corner verticals, side/back rails at bottom and top, shelf-support rails on the sides.
    Each strip is a nested OSB part.
  - `timber-cleat`: same layout in 30×40 timber.
  - `timber-frame`: timber-cleat plus front corner posts and front top/bottom rails, which
    stiffen the open face.
  Every part carries: label, role, material, 3D box (size + centre in cabinet space) and cut
  size (length × width × thickness, or timber length).
- **Nesting**: guillotine free-rectangle packing with kerf, multi-sheet, trying several sort
  orders × fit rules × split rules and keeping the best (fewest sheets, then most compact
  last sheet). Parts may rotate unless `respectGrain` locks tops/shelves to the sheet's long
  (strong) axis. Parts larger than a sheet are reported, not dropped silently.
- **Timber**: best-fit-decreasing 1D packing with kerf against the entered stock, falling back
  to unlimited `defaultLength` bars to report what is needed.
- **Checks**: deck off-plane, tool footprint larger than top, footprint overlaps (floor
  AABB), outside room, OSB sheets over stock, timber over stock, part too big for sheet,
  non-positive carcass height, fixtures not at target height, MEASURE flags.

### UI

- Header: title, tabs (Layout / Cut plan), budget badge ("6.4 / 7 sheets · timber 23.1 m"),
  export/import/reset.
- Left: object list (cabinets, fixtures), tool library, settings.
- Centre, **Layout**: r3f scene — floor grid, optional room, cabinets rendered part-by-part
  (OSB and timber materials), tools as primitives, fixtures, translucent target plane,
  feed-path strips. Click to select, drag on the floor (10 mm snap), R to rotate, top view
  toggle, x-ray and exploded view for the selected cabinet.
- Centre, **Cut plan**: SVG per sheet with numbered parts and waste shaded, timber bars,
  parts table grouped by cabinet.
- Right: inspector for the selection plus the warnings list.

### Persistence

zustand `persist` under key `cabinet-planner`, `version` + `migrate`. Export writes the JSON
to a file; import validates the version before replacing state; reset restores the seed data.

## Testing

vitest on the engine: sizing matches the sheet's rows; parts count/dimensions per method;
nester invariants (inside the sheet, no overlaps including kerf, every part placed or reported);
timber packing invariants; checks fire. Playwright smoke screenshots of both tabs for visual
verification.

## Living documentation

`skill/` (symlinked to `~/.claude/skills/cabinet-planner`) is the operating manual — app
function, data model, formulas, OSB rules, nester behaviour, traps. Updating it is part of
every change, in the same commit.

## Out of scope

PDF export, drawers/doors, importing 3D models, multi-project management.
