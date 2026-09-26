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
