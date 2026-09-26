# Roadmap and open items

Keep this current: tick things off with a date, add what Y asks for. Newest decisions at the top of each list.

## Waiting on Y (real-world measurements)

- [ ] Measure every tool's real base footprint and deck height (all but the PBD 40 are sheet
      estimates). Enter them in the app, untick nothing — tick **Measured** on the tool.
      Mirror into `workshop.md` and `seed.ts`.
- [ ] Measure the two outfeed cabinets (width × depth × top height), tick **Measured**.
- [ ] Count the 30 × 40 timber: lengths and quantities → Settings → Lengths on hand.
- [ ] Gauge the real OSB thickness → Settings → Measured thickness (affects every carcass
      height and the tops).
- [ ] Decide casters per cabinet (sheet suggests 125 mm braked for the table saw, 75 mm for
      the sander).

## Built (2026-09-26, branch build/initial → main)

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
- Cut sequence numbering on the sheet diagrams (the nester knows the guillotine splits but
  doesn't record their order yet).
- Wrap as an Assay-style `.app` (thin Electron launcher) if Y wants it in /Applications.
