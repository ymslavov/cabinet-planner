# Workshop facts

Source of truth for the physical world. Update whenever Y measures something.
The app's seed data (`src/engine/seed.ts`) mirrors this file — change both together.

## Origin

Planning spreadsheet: Google Sheet `<sheet-id: see skill/references/private.md>`, tab gid=0
("Workshop Tool Inventory & Rolling Base Build Planner (15 mm OSB only)"). It is on an account
the Google Drive connector can't see; it *is* link-readable, so fetch it with
`curl -sL ".../export?format=csv&gid=0"`. The app replaced it as the working tool on
2026-09-26 — the sheet is history, not a live source.

## Stock on hand (2026-09-26)

- **7 sheets OSB-3, 2500 × 1500 × 15 mm nominal.** Nominal 15 often measures 14.5–15.5 —
  gauge a real sheet and enter the measured thickness in Settings before cutting.
  OSB-3's strength axis runs along the 2500 mm length.
- **30 × 40 mm timber, quantity and lengths unknown.** Enter in Settings → Timber stock
  once counted; until then the app reports needed bars at the default length (3000).
- **Two existing rolling cabinets, 900 mm work surface**, used as outfeed tables.
  **Widths 800 and 400 mm** (Y, 2026-09-26); **depth not yet measured** (600 placeholder), so
  both stay flagged MEASURE.

## The room (2026-09-26)

8 × 4 m. Y's layout: table saw in the middle with the two outfeed cabinets either side, all
other stations against the two long walls. The app's `arrangeDefault` (engine `layout.ts`)
builds exactly that — see `engine.md` → Default layout.

## Shared plane

Target work height **900 mm** from the floor: every tool deck lands there so every base
doubles as infeed/outfeed support for the others. Casters 100 mm incl. plate (default);
the sheet suggests 125 mm braked casters for the table saw and 75 mm for the sander —
caster height is per cabinet in the app.

## Tools (sheet values — all "MEASURE before cutting")

| Tool | Base W × L | Deck h | Cabinet W × L | Surface | Carcass | Notes |
|---|---|---|---|---|---|---|
| Bosch GTS 10 XC table saw | 740 × 570 | 340 | 790 × 620 | 560 | 430 | ~34 kg, heaviest; 125 mm braked casters; manufacturer dims |
| Makita 2012NB thicknesser | 480 × 370 | 190 | 530 × 420 | 710 | 580 | ~28 kg; needs clear space fore and aft |
| Scheppach BTS 700 belt/disc sander | 480 × 390 | 230 | 530 × 440 | 670 | 540 | ~19 kg; dims are estimates |
| Bosch GCM 8 SJL mitre saw | 560 × 430 | 95 | 610 × 480 | 805 | 675 | 17.3 kg; Axial-Glide, can sit against a wall; wants wings left/right |
| Scheppach HMS 850 planer-thicknesser | 790 × 450 | 355 | 840 × 500 | 545 | 415 | 21.75 kg net, 470 tall; deck = jointer table (Scheppach "working height" 355 — measure); feed runs left–right along the 790 side; thicknessing bed sits lower, so the plane supports jointing; 63 mm dust port. Added 2026-09-26 (sheet row 14) |
| Bosch PBD 40 drill press | 330 × 350 | — | 380 × 400 | 800 (typed) | 670 | 11.2 kg, 650 tall; **exempt** from the plane, table adjustable; top-heavy |

Cabinet = base + 2 × 25 mm clearance; surface = 900 − deck; carcass = surface − caster − top (2 × 15).
The app additionally builds each tool cabinet 10 mm low and puts the tool on 10 mm slotted
shims so the deck can be trimmed ±10 to the outfeed tables (the sheet doesn't model this).

## Accessories to store (drives shelf layout)

- GTS 10 XC: rip fence, mitre gauge, push sticks, 254 mm blades, wrenches, riving knife, inserts, featherboards, crosscut sled, dust adapter.
- 2012NB: spare 304 mm blades, setting jig, wax, 100 mm dust hood, roller stands, thin-stock sled.
- BTS 700: 100 × 914 belts, 150 mm discs, mitre gauge, cleaning stick, dust bag.
- GCM 8 SJL: 216 mm blades, clamp, dust bag, stop rail and blocks, sacrificial fences.
- PBD 40: bit sets, Forstners, hole saws, vice, sanding drums.
- HMS 850: spare 210 mm HSS knives, knife setting gauge, 4 mm hex key, crank, push stick/block,
  rip fence, cutter guard, chip hood + 63 mm hose adapter, 2 spare drive belts, roller stands.

## The spreadsheet after 2026-09-26

Row 14 = HMS 850 (all 12 columns; E–H are the same formulas as the rows above). The material
take-off formulas (now B23, B24, C30) were extended from `$9:$13` to `$9:$14` and A26 reads
"Total for six cabinets". The sheet's area estimate now says 9 sheets OSB-only / 6 with a timber
frame — still the pessimistic estimate incl. 10 drawers; the app's nesting is the real number.
HMS 850 source: scheppach.co.uk product page 5902205906 (790 × 450 × 470, 21.75 kg,
working height 355); the manual says 815 × 450 × 425, retailers 780 × 420 × 450.
