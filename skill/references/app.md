# The app — running it, data model, persistence, UI

## Running

```bash
export PATH="$HOME/.nvm/versions/node/v24.13.0/bin:$PATH"   # node only exists under nvm
cd ~/projects/cabinet-planner
npm run dev        # http://localhost:5188
npm test           # vitest: engine + store
npm run build      # tsc -b + vite build → dist/
npm run shot       # Playwright screenshots → shots/ (dev server must be running)
```

## Data model (`src/engine/types.ts`)

`PlanState = { settings, tools[], cabinets[], fixtures[] }` — all millimetres.

- **Settings**: targetHeight, clearance, kerf, sheet {length, width, thickness (measured), count},
  edgeTrim, respectGrain, timber {a, b, defaultLength, stock[{length, qty}]},
  osbCleat {width, laminations}, topLayers, feedLength, room {enabled, width, length}.
- **Tool**: footprint (baseWidth × baseLength), deckHeight above its own base, overallHeight,
  shape (drives the 3D model), color, feedAxis (x/z/none, in cabinet space), exempt +
  fixedSurfaceHeight, measured, notes.
- **Cabinet**: toolId (nullable), method, casterHeight, shelves[] (top-face heights above
  the inside floor), hasBack, overrides {width, length, surfaceHeight}, x, z, rotation.
- **Fixture**: existing furniture (outfeed cabinets): width, length, height, x, z, rotation, measured.

World placement: an object's x/z is its footprint centre; rotation turns it about Y in 90°
steps (90/270 swap its X/Z extents).

## Store (`src/store.ts`)

zustand vanilla store + `persist`, exposed as `planStore` and the `usePlan(selector)` hook.
`createPlanStore(storage)` builds one against any `StateStorage` — tests use `memoryStorage()`.

- **Persisted** under localStorage key `cabinet-planner`: settings, tools, cabinets, fixtures,
  and view prefs. **Not persisted**: selection.
- **Schema version** `SCHEMA_VERSION = 1`. To change the shape: bump it and add a case to
  `migrate()`. New *settings* keys need no migration — `withDefaults` fills them from
  `defaultSettings()` on load and import.
- **Corrupt save**: `safeStorage` copies an unparseable value to `cabinet-planner.corrupt`
  and starts from the seed — the app never white-screens on bad storage.
- **localStorage unavailable** (private mode) → silently falls back to memory storage; the
  plan works but won't survive a reload. Export regularly.
- **Export/import**: `{ app: 'cabinet-planner', version, exportedAt, state }`. Import rejects
  other apps, newer versions and files missing any of the four collections, and leaves the
  current plan untouched when it does.
- Removing a tool sets `toolId: null` on its cabinets. Removing the selected object clears
  the selection. `reset()` restores the seed.
