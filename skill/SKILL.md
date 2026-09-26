---
name: cabinet-planner
description: Living operating manual for Y's Cabinet Planner — the local web app at ~/projects/cabinet-planner that designs rolling OSB base cabinets for the workshop tools (Bosch GTS 10 XC table saw, Makita 2012NB thicknesser, Scheppach BTS 700 sander, Bosch GCM 8 SJL mitre saw, Bosch PBD 40 drill press), shows them in a 3D shop layout with the outfeed tables, and nests the cut plan onto 7 sheets of 2500x1500x15 OSB-3 plus 30x40 timber. Use this skill whenever the user mentions the cabinet planner, tool cabinets, rolling bases, mobile tool stands, OSB cut plans, sheet nesting, the workshop layout, outfeed tables, the 900 mm work plane, or asks to change, extend, debug or run the app. Also use it AFTER any change to the app, to record what changed — this documentation is meant to be amended continuously, not written once.
---

# Cabinet Planner — workshop tool cabinets

This skill is the **living documentation** for the Cabinet Planner app. It has two jobs:

1. **Tell you how the app and the build work right now**, so you can act without
   re-discovering it.
2. **Get updated by you** in the same pass as any change to the app or any new fact about
   the workshop build.

**Imperative:** every change to behaviour, formulas, data model, construction rules, UI or
tooling updates the matching file here *in the same commit*. Every trap you hit goes into
`references/traps.md`. Every measurement Y reports (real tool sizes, outfeed tables, timber
stock) goes into `references/workshop.md`. If you find this doc wrong, fix it before doing
anything else — it will be trusted.

## How to use this skill

Read this file for orientation, then only the reference you need:

| File | Read it when |
|---|---|
| `references/workshop.md` | The real-world facts: tools, stock, outfeed tables, what is measured vs estimated |
| `references/construction.md` | How a cabinet is built — OSB rules, the three build methods, every part and why |
| `references/engine.md` | Sizing formulas, part generator, nester, timber packer, checks — the maths |
| `references/app.md` | Running the app, UI map, data model, persistence, export/import |
| `references/traps.md` | Anything that bit us — read before debugging |

## Shape in one paragraph

A Vite + React + TypeScript single-page app, no backend. State (settings, tools, cabinets,
fixtures, room) lives in a zustand store persisted to `localStorage` under
`cabinet-planner`. A pure engine in `src/engine/` turns that state into cabinet dimensions,
then into a list of real parts (every panel, cleat, shelf, top layer), which feeds three
consumers: the react-three-fiber 3D layout, the guillotine sheet nester and the timber
packer. Nothing in the UI computes geometry itself — if the 3D view and the cut plan
disagree, the bug is upstream of both.

```
store ──▶ sizing ──▶ parts ──┬──▶ 3D layout (src/three)
                             ├──▶ nest (OSB sheets) ──┐
                             └──▶ timber (1D bars) ───┴──▶ budget + checks ──▶ UI
```
