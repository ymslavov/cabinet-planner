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

Guillotine free-rectangle packing (after Jylänki, "A Thousand Ways to Pack the Bin").

- Sheet space: **x along the sheet length (2500, the OSB strong axis), y along the width**.
  A piece's `length` lies along x unless `rotated`. `canRotate: false` pins it (grain lock).
- Each placement goes in the bottom-left of a free rectangle, which is then split into two
  by one full-width or full-height cut — so every plan is cuttable with edge-to-edge track-saw
  cuts. Kerf is left between neighbours and never against the sheet edge (a 2500 × 1500 piece
  fits a sheet exactly). `trim` shrinks the usable area on all four edges.
- Heuristics: 4 sort orders (area, long side, short side, perimeter) × 3 fit rules (best
  area, best short side, best long side) × 8 split rules (`rip` = always rip full-length
  strips first, `cross`, shorter/longer axis, shorter/longer leftover, min/max area).
  96 runs; the winner has the fewest sheets, then the smallest used area on the last sheet
  (one big offcut). `heuristic` in the result names the winner.
- Pieces too big for an empty sheet in any allowed orientation go to `unplaced` up front;
  the rest still nest.
- Offcuts (`freeRects`) are not merged — merging can break guillotine-ness.
- Deterministic: ties break on piece id.

Kerf fixture: 20 × (1250 × 750) → 7 sheets at 3 mm kerf (3 per sheet), 5 sheets at 0 kerf.

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
- `osbPieces`: one nest piece per OSB panel; a laminated OSB cleat becomes `laminations`
  identical strips sharing the part's code (ids `…#1..#3`).
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
