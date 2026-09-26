# Engine — the maths

`src/engine/` is pure TypeScript: no React, no store. Everything the UI shows is derived
here. Tests live in `tests/*.test.ts`; the sheet's own rows are the sizing fixtures.

## Sizing — `sizing.ts` → `cabinetDims(cabinet, tool, settings)`

| Output | Formula |
|---|---|
| width | `tool.baseWidth + 2 × clearance` (override wins) |
| length | `tool.baseLength + 2 × clearance` (override wins) |
| surfaceHeight | `targetHeight − tool.deckHeight`; exempt tool → `tool.fixedSurfaceHeight`; no tool → `targetHeight` (override wins) |
| topThickness | `topLayers × sheet.thickness` (measured thickness, not nominal) |
| lift | `leveler.travel / 2` with levelling feet, else 0 |
| baseHeight | `casterHeight + lift` (floor → underside of the bottom panel at design height) |
| carcassHeight | `surfaceHeight − baseHeight − topThickness` |
| adjust | with feet: `{ min: deck − lift, max: deck + travel − lift }` (top instead of deck without a tool); null without |
| deckTop | `surfaceHeight + tool.deckHeight` (null without a tool) |

A tool-less cabinet defaults to 600 × 600 (`TOOLLESS_SIZE`). A non-positive carcass is
returned, not thrown — `checks` reports it and `parts` yields nothing for that cabinet.

The sheet has no feet: its fixtures below are tested with `levelers: false`; with feet on,
every carcass is 15 mm shorter (e.g. GTS 10 XC 415 instead of 430).

Fixtures from the sheet (100 mm casters, 2 × 15 top): GTS 10 XC 790×620 / 560 / 430,
2012NB 530×420 / 710 / 580, BTS 700 530×440 / 670 / 540, GCM 8 SJL 610×480 / 805 / 675,
PBD 40 (exempt, 800 typed) 380×400 / 800 / 670.

## Sheet nesting — `nest.ts` → `nestSheets(pieces, sheetSpec)`

Guillotine free-rectangle packing (after Jylänki, "A Thousand Ways to Pack the Bin") that
keeps an explicit **cut tree** per sheet.

- Sheet space: **x along the sheet length (2500, the OSB strong axis), y along the width**.
  A piece's `length` lies along x unless `rotated`. `canRotate: false` pins it (grain lock).
  A **rip** runs along x (constant y), a **crosscut** along y (constant x).
- Each placement goes in the bottom-left of a free rectangle, carved out with up to two
  full-width/full-height cuts (`carve`) — every plan is edge-to-edge track-saw cuttable.
  Kerf between neighbours, never against the sheet edge; `trim` shrinks the usable area.
  A cut is made whenever a piece doesn't reach its region's edge, even if what's left is
  thinner than the kerf.
- `finishSheet` then **drops cuts that only separate waste from waste** (that waste merges
  into one bigger offcut) and numbers the remaining cuts in pre-order — a region is always
  cut before the pieces inside it. `sheet.cuts[]` carries the line, kind, length, the region
  being cut and the offset from its bottom/left edge; `sheet.freeRects` are the merged offcuts.
- Heuristics: fill 2 (`sequential` = fill one sheet before opening the next, so the waste
  collects on the last sheet; `global` = best spot on any open sheet) × 4 sorts × 3 orientation
  rules (`long-x` long side along the sheet → strip layouts, `free`, `long-y`) × 3 fit rules ×
  8 split rules = 576 runs (~40 ms for the timber-cleat seed, ~300 ms for osb-cleat).
- **Choosing** (Y's priorities, 2026-09-26: easy cuts first, then big offcuts, never more
  material): fewest sheets; then lowest `cuts × (1 + 0.1 × share of waste NOT in usable
  offcuts)` — a layout may take up to 10 % more cuts if that turns its slivers into usable
  offcuts; then largest offcut; then longer total cut length. Usable = short side ≥ 300
  (`USABLE_OFFCUT`). `result.stats` = cuts, cutLength, largestOffcut, usableOffcutArea,
  wasteArea; `heuristic` names the winner (`fill/sort/orient/fit/split`).
- Pieces too big for an empty sheet in any allowed orientation go to `unplaced` up front.
- Deterministic: ties break on piece id.
- Tests replay every cut list (`replayCuts` in `tests/nest.test.ts`): each cut must span one
  whole region, and every piece must come out exactly.

Fixtures: 20 × (1250 × 750) → 7 sheets at 3 mm kerf, 5 at 0; one 800 × 600 piece → 2 cuts,
turned and crosscut first to leave a 1897 × 1500 offcut; six 2500 × 200 strips → 6 rips.

Seed numbers after this change (timber cleats, feet): 4 sheets (3.74), 92 cuts averaging
0.76 m, largest offcut 2500 × 334, 53 % of the waste in usable offcuts.

## Timber — `timber.ts` → `packTimber(pieces, stock, { kerf, defaultLength })`

Best-fit decreasing 1D packing. Pieces go longest first into the open bar with the least room
that still fits (each cut consumes `length + kerf`; the last kerf may run off the end). A new
bar comes from the **longest remaining stock length that fits**; when stock runs out — or none
was entered — from unlimited `defaultLength` bars (3000).

- `stockKnown` is false while Settings → Timber stock is empty; the bars are then a shopping
  list and `shortfall` stays 0 (the budget shows "need N × 3 m" instead of an error).
- `shortfall` = bars beyond the entered stock. `oversize` = pieces longer than every stock
  length and the default length.
- `totalLength` = Σ piece lengths, the linear metres the design consumes before kerf.

## Cut list — `cutlist.ts`

- **Part codes**: cabinets are lettered in list order (A, B, …), parts numbered in generator
  order → `A1`, `A2`, … `B1`. Codes label the sheet diagrams, timber bars and parts table.
  Reordering cabinets renames codes — print the cut plan after the design is final.
- `osbPieces(parts, codes, kerf)`: one nest piece per OSB panel; a laminated OSB cleat
  becomes `laminations` identical strips sharing the part's code (ids `…#1..#3`). **Foot
  blocks are ganged**: per cabinet, `layers` sticks of block × (n·block + (n−1)·kerf), labelled
  with the code range (e.g. `A7–A10`) — glue the sticks into a stack, then crosscut it into
  the n blocks. 5 sticks instead of 20 little squares per cabinet.
- `partRows`: identical parts of a cabinet grouped for the table (label stripped of
  left/right/numbers).

## Checks — `checks.ts` → `runChecks(...)`, sorted error → warn → info

| Level | Fires when |
|---|---|
| error | carcass ≤ 0; cabinet too small for its framing; more sheets than `sheet.count`; a piece fits no sheet; timber shortfall (stock entered); timber piece longer than any bar |
| warn | deck off the target plane (±0.5); feet on but no room for them; **tipping**: narrowest spread of wheels and feet < 0.2 × (top + tool height); fixture off the plane *beyond* the feet's reach; tool base bigger than the top; shelf outside `shelfRange`; no back; footprints overlap (touching is fine); outside the room; something **taller than the deck** inside a feed path; fixture top ≠ target; cabinet's tool deleted |
| info | MEASURE for unmeasured tools/fixtures; timber stock not entered; fixture off the plane but within every levelled cabinet's range ("wind the feet down 5 mm") |

Footprints use the rotated size (90°/270° swap width and length). A **feed path** exists for
non-exempt tools with `feedAxis` x/z: a strip `tool base` wide, running `feedLength` (2500)
beyond both ends of the cabinet along the feed axis (turned with the cabinet). Anything in it
whose top is above the deck blocks long stock; things at deck height are support.

## analyze — `analyze.ts` → `analyze(state): Derived`

Runs sizing → parts → codes → nest + timber → checks → budget. The UI calls only this.
`budget.sheetsFraction` = whole sheets before the last + used fraction of the last (e.g. 2.83).
Nesting is memoised on its JSON input, so dragging cabinets (position-only changes) is free.

## Reference numbers (seed state, 2026-09-26)

| All cabinets | OSB sheets | Pieces nested | Timber | Nest time |
|---|---|---|---|---|
| osb-cleat | 3.75 | 185 | 0 | ~70 ms |
| timber-cleat (seed default) | 2.83 | 35 | 23.0 m (8 × 3 m bars) | ~4 ms |
| timber-frame | 2.79 | 35 | 32.4 m (12 bars) | ~4 ms |

The spreadsheet's "7 sheets" was an area estimate including 10 drawers and 15 % waste; real
nesting of open boxes with one shelf each needs about half the stock.

## Hardware — `hardware.ts`

`cabinetHardware(cab, dims, parts, s)` per cabinet, `hardwareTotals(lists)` sums identical
items (same key + spec). Every buildable cabinet: 4 braked casters, 16 caster bolts
(M8 × ⌈t + 25⌉₁₀). With feet, per foot: rod, T-nut, 3 hex nuts, washer, dome nut + pad.
Rod length = ⌈block + t + 30 (nuts inside) + (baseHeight + travel − lift − block)⌉₁₀ —
180 mm for 100 mm casters and ±15 travel. `Derived.hardware = { byCabinet, totals }`.
