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
| carcassHeight | `surfaceHeight − casterHeight − topThickness` |
| deckTop | `surfaceHeight + tool.deckHeight` (null without a tool) |

A tool-less cabinet defaults to 600 × 600 (`TOOLLESS_SIZE`). A non-positive carcass is
returned, not thrown — `checks` reports it and `parts` yields nothing for that cabinet.

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
