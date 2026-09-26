# Cabinet Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> Execution: native, inline, autonomous (Y: "drive the build autonomously"). Engine tasks are
> TDD with the listed test cases; UI tasks are verified by Playwright screenshots.

**Goal:** A single local web app that configures rolling OSB tool cabinets in a 3D shop layout and produces guillotine cut plans against the stock on hand.

**Architecture:** config (zustand + localStorage) → pure TypeScript engine (sizing → parts → nesting/timber/checks) → React UI (react-three-fiber layout + SVG cut plan). The part list is the single source of geometry for both 3D and cutting.

**Tech Stack:** Vite 7, React 19, TypeScript 5.9, three + @react-three/fiber 9 + @react-three/drei 10, zustand 5, vitest 3, playwright (screenshots). Node 24 via nvm (`~/.nvm/versions/node/v24.13.0/bin`).

**Spec:** `docs/specs/2026-09-26-cabinet-planner-design.md`

## Global Constraints

- Millimetres everywhere, including the three.js scene. X = width, Y = up, Z = depth, +Z = front.
- Stock default: 7 sheets 2500 × 1500 × 15 OSB-3; timber 30 × 40; kerf 3; target plane 900.
- Every OSB cut is a straight rip or crosscut — no notches, no dados (sheet rule).
- Engine modules are pure (no React, no store imports) and unit-tested.
- localStorage key `cabinet-planner`, schema version starts at 1.
- Living skill in `skill/`, updated in the same commit as any behaviour change.
- One commit per task, message says what and why.

## Review Focus

1. A configuration that makes a part bigger than a sheet (e.g. override width 2600) → reported as "does not fit any sheet", nester still terminates, other parts still nested. (Task 4 test.)
2. Deck height ≥ target or caster too tall → carcass height ≤ 0 → error in checks, parts generator returns no parts for that cabinet, 3D does not crash on NaN/negative sizes. (Tasks 3, 6 tests.)
3. Corrupt localStorage or a foreign JSON file on import → rejected with a message, app keeps working. (Task 7 test.)
4. Timber stock empty, or a piece longer than every stock length → timber result reports shortfall/oversize instead of looping. (Task 5 test.)
5. Deleting a tool referenced by a cabinet, or shelf heights above the carcass → cabinet becomes tool-less / shelf is clamped and warned. (Tasks 3, 7 tests.)

---

## File structure

```
src/engine/types.ts        domain types (Settings, Tool, Cabinet, Fixture, Part, ...)
src/engine/seed.ts         default settings, the 5 tools, 5 cabinets, 2 fixtures
src/engine/sizing.ts       cabinetDims(cabinet, tool, settings)
src/engine/parts.ts        cabinetParts(cabinet, dims, settings) → Part[]
src/engine/nest.ts         nestSheets(pieces, sheetSpec) → NestResult
src/engine/timber.ts       packTimber(pieces, stock, opts) → TimberResult
src/engine/cutlist.ts      collect parts → OSB pieces (expanding laminations) + timber pieces
src/engine/checks.ts       checks(state, derived) → Warning[]
src/engine/analyze.ts      analyze(state) → Derived (dims, parts, nest, timber, budget, warnings)
src/store.ts               zustand store + persist + actions + export/import
src/ui/*                   App shell, Sidebar, Inspector, Budget, fields
src/three/*                Scene, CabinetMesh, ToolMesh, FixtureMesh, drag
src/cutplan/*              SheetDiagram, TimberBars, PartsTable
tests/*.test.ts            engine + store tests
scripts/shot.mjs           Playwright screenshot script
skill/SKILL.md, skill/references/*.md   living docs
```

## Task 1: Scaffold + living-doc skeleton

- [ ] package.json, vite/ts config, index.html, `src/main.tsx` rendering a placeholder.
- [ ] vitest configured (`npm test`), one trivial test passes.
- [ ] `CLAUDE.md` (points at the skill, restates the living-doc rule, nvm PATH trap).
- [ ] `skill/SKILL.md` skeleton + symlink `~/.claude/skills/cabinet-planner → skill/`.
- [ ] `npm run build` passes; commit.

## Task 2: Types, seed data, sizing

**Produces:**
```ts
cabinetDims(cab: Cabinet, tool: Tool | undefined, s: Settings): CabinetDims
// CabinetDims = { width, length, surfaceHeight, topThickness, carcassHeight, casterHeight, t }
```
Tests (sheet rows, default settings, caster 100, 2 top layers of 15):
- GTS 10 XC (740×570, deck 340) → 790 × 620, surface 560, carcass 430
- 2012NB (480×370, deck 190) → 530 × 420, surface 710, carcass 580
- BTS 700 (480×390, deck 230) → 530 × 440, surface 670, carcass 540
- GCM 8 SJL (560×430, deck 95) → 610 × 480, surface 805, carcass 675
- PBD 40 exempt, fixed 800 → 380 × 400, surface 800, carcass 670
- overrides win; measured thickness 15.4 changes topThickness to 30.8
- no tool → uses overrides or 600×600, surface = target

## Task 3: Parts generator

**Produces:** `cabinetParts(cab, dims, s): Part[]`
```ts
Part = { id, cabinetId, label, role, material: 'osb'|'timber',
         size: [x,y,z], center: [x,y,z],            // cabinet space, mm
         cut: { length, width, thickness, laminations } // OSB: laminations strips each; timber: length only
         grainLocked: boolean }
```
Tests:
- every method: 1 bottom, 1 back, 2 sides, `topLayers` top layers, one shelf per valid shelf height
- panel sizes for GTS: bottom 790×620, back 790×(430−15), sides (620−15)×(430−15), top 790×620 ×2
- osb-cleat: cleats have material osb, laminations 3, width 60; timber-cleat: material timber, no osb cleats
- timber-frame has ≥ 4 more timber parts than timber-cleat (front posts + rails)
- all parts lie inside the cabinet bounding box (−W/2..W/2, 0..surface, −L/2..L/2), all sizes > 0
- no two OSB panels overlap in volume (pairwise AABB intersection volume ≈ 0)
- carcassHeight ≤ 0 → []
- shelf above inner height is dropped (checks warn)

## Task 4: Guillotine nester

**Produces:** `nestSheets(pieces: NestPiece[], sheet: SheetSpec): NestResult`
```ts
NestPiece = { id, label, length, width, canRotate }
SheetSpec = { length, width, kerf, trim }
NestResult = { sheets: { placements: Placement[], usedArea, freeRects }[], unplaced: NestPiece[] (too big) }
Placement = { pieceId, label, x, y, w, h, rotated }
```
Tests: single piece fits at origin; pieces never overlap (with kerf gap unless touching sheet edge); all within sheet minus trim; oversize piece lands in `unplaced`, others still placed; canRotate=false respected; 20 × 1250×750 pieces → ≤ 6 sheets (4 per sheet minus kerf gives 3 — assert sheets*capacity sane); deterministic output.

## Task 5: Timber packer

**Produces:** `packTimber(pieces: TimberPiece[], stock: StockLength[], opts: {kerf, defaultLength}): TimberResult`
```ts
TimberResult = { bars: { stockLength, cuts: {pieceId,label,length}[], waste }[], fromStock: boolean,
                 totalLength, shortfall: number /* bars beyond stock */, oversize: TimberPiece[] }
```
Tests: fits pieces into one bar with kerf; empty stock → default-length bars, fromStock false; piece longer than every stock length → oversize; stock exhausted → shortfall counted.

## Task 6: Cut list + checks + analyze

**Produces:** `analyze(state: PlanState): Derived`
```ts
Derived = { dims: Record<cabId, CabinetDims>, parts: Record<cabId, Part[]>, nest: NestResult,
            timber: TimberResult, budget: { sheetsUsed, sheetsFraction, sheetsStock, timberNeeded, timberStock, ok },
            warnings: Warning[] }
Warning = { level: 'error'|'warn'|'info', objectId?, message }
```
Tests: seed state → no errors except MEASURE infos; deck mismatch warns; overlapping cabinets warns; carcass ≤ 0 errors; over-stock errors; tool bigger than top warns.

## Task 7: Store

zustand + persist (`version: 1`, `migrate`), actions: select, update/add/remove cabinet/tool/fixture, move, rotate, settings, reset, exportJson, importJson (validates `app === 'cabinet-planner'` + version). Removing a tool nulls cabinet.toolId. Tests with vitest (jsdom not needed; use storage mock).

## Task 8: App shell, sidebar, inspector, budget badge

Layout grid: header / sidebar / centre / inspector. Numeric fields commit on blur/enter. Verify with screenshot.

## Task 9: 3D layout

Scene (floor grid, room, target plane, lights), CabinetMesh (parts, x-ray, explode), ToolMesh per shape, FixtureMesh, selection outline, drag on floor with 10 mm snap, R rotates, top-view toggle, feed strips. Verify with screenshots.

## Task 10: Cut plan view

SheetDiagram SVG (numbered parts, dimensions, waste hatch), TimberBars, PartsTable per cabinet. Verify with screenshots.

## Task 11: Verification + docs

Full `npm test`, `npm run build`, screenshots of both tabs; complete skill references (app, data model, engine, OSB rules, traps); memory pointer.
