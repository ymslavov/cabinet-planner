# Roadmap and open items

Keep this current: tick things off with a date, add what Y asks for. Newest decisions at the top of each list.

## Waiting on Y (real-world measurements)

- [ ] Measure every tool's real base footprint and deck height (all but the PBD 40 are sheet
      estimates). Enter them in the app, untick nothing — tick **Measured** on the tool.
      Mirror into `workshop.md` and `seed.ts`.
- [x] Outfeed cabinet widths: 800 and 400 (2026-09-26).
- [ ] Measure the outfeed cabinets' depth and top height, then tick **Measured**.
- [ ] Count the 30 × 40 timber: lengths and quantities → Settings → Lengths on hand.
- [ ] Gauge the real OSB thickness → Settings → Measured thickness (affects every carcass
      height and the tops).
- [ ] Decide casters per cabinet (sheet suggests 125 mm braked for the table saw, 75 mm for
      the sander).

## Built (2026-09-26, branch build/initial → main)

- Scheppach HMS 850 planer-thicknesser (schema v2), hardware list.
- Height trimming with slotted shims under each tool (schema v4) — replaced the levelling
  feet of v3, which Y rejected: the cabinets stay on their casters.
- Default layout for the 8 × 4 m room (table saw centre + outfeeds, stations on the long
  walls), orthographic plan view, schema v5.
- Cut planning: explicit cut tree, numbered cut order, fewest/longest cuts and consolidated
  offcuts preferred.
- If nesting ever feels slow while typing (osb-cleat ≈ 300 ms in node), move `nestSheets`
  into a Web Worker.

- Sizing from the sheet's formulas, three build methods, open boxes with fixed shelves.
- Part-level 3D shop layout with tool models, drag/rotate, x-ray, exploded view, work plane,
  feed paths.
- Guillotine OSB nesting with kerf/trim/grain lock, timber bar packing, stock gauge, checks.
- localStorage persistence with export/import.

## Ideas not built (ask before building — each changes the part generator)

- Drawers and doors (the sheet planned 10 drawers; stock now has room: seed uses ~2.8 of 7 sheets).
- Top overhang / T-track cut-outs in the top.
- Sawdust tray under the table saw (the Pragmatic Workshop stand has one).
- Printable cut sheets (PDF was out of scope for v1; browser print of the Cut plan tab is
  untested).
- Wrap as an Assay-style `.app` (thin Electron launcher) if Y wants it in /Applications.
