# Cabinet Planner

Plan rolling OSB base cabinets for workshop machines in 3D, then get the cut plan.

**Live:** https://ymslavov.github.io/cabinet-planner/

- Every machine's deck lands on one shared work height, so each base doubles as infeed and
  outfeed support for the others. DIY levelling feet fine-tune each cabinet to meet existing
  outfeed tables.
- Cabinets are generated part by part (panels, cleats, shelves, laminated tops, foot blocks)
  in three build methods: laminated OSB cleats, timber cleats, or a timber frame.
- The 3D shop layout shows the machines, cabinets and outfeed tables at real size. Drag to
  move, R to turn, and check feed paths and the work plane.
- The cut plan nests every OSB part onto your sheets as guillotine layouts for a track saw:
  fewest sheets, then fewest and longest cuts, with the waste kept as big offcuts. Cuts are
  numbered in order. It also packs the timber into bars and lists the hardware to buy.

Your plan is stored in your own browser (`localStorage`). Use **Export** and **Import** to
back it up or hand it to someone else.

## Run locally

```bash
npm install
npm run dev     # http://127.0.0.1:5188
npm test
```
