# Traps

Things that cost time. Newest at the bottom. Each entry: symptom → cause → fix.

## Tooling

- **`node`/`npm` not found** in a fresh shell → Node exists only under nvm, not on the default
  PATH → `export PATH="$HOME/.nvm/versions/node/v24.13.0/bin:$PATH"` first.
- **`tsc -b` fails with "'test' does not exist in type 'UserConfigExport'"** in
  `vite.config.ts` → `defineConfig` imported from `vite` doesn't know vitest's `test` key →
  import `defineConfig` from `vitest/config` instead.
- **TypeScript is pinned to ~5.9** on purpose: npm's `latest` is 7.x (the native port) and
  `tsc -b` behaviour/flags differ; don't bump casually.

## Engine

- **Nester packed 2 pieces/sheet where 3 fit** → when opening a new sheet it took the first
  orientation that fit, not the best-scoring one → score orientations against the empty sheet
  with the same fit rule (`nest.ts`, new-sheet branch). Test: "kerf is respected".
- **Debug `console.log` from a vitest test prints nothing** → vitest 5's default reporter
  hides stdout of passing tests → run with `--reporter=verbose` (and `< /dev/null`). Put the
  throwaway test in `tests/_tmp/` via a heredoc and delete it afterwards.
- **Shallow cleat cabinets were rejected as "too small for its framing"** → the depth guard
  assumed framing at both ends, but only timber-frame has front framing → guard on the real
  span `zFront − zRear` (found by the branch review, 2026-09-26).
- **A `cat > file` without a heredoc in a Bash call hangs forever** waiting on stdin.

## Tooling (Playwright)

- **`npm run shot` fails with "Executable doesn't exist … chromium_headless_shell-NNNN"** →
  the Playwright npm version wants a newer browser build than the cache holds → run
  `npx playwright install chromium` once (≈95 MB).
- The shot script launches Chromium with SwiftShader flags so WebGL renders headless.

## 3D view (react-three-fiber / three)

- **Labels disappeared and the console filled with "Attempted to synchronously unmount a root
  while React was already rendering"** → drei `<Html>` makes one React root per label and
  unmounts it inside React 19's commit phase → don't use `<Html>`. Labels are plain DOM in
  `LabelLayer` over the canvas, positioned each frame by `LabelProjector` (`three/labels.tsx`).
- **Toggling X-ray did nothing** → changing `transparent` on an existing three.js material
  isn't picked up without a recompile → the material is keyed on the ghost state so React
  remounts it.
- **"PCFSoftShadowMap has been removed"** warning → r3f's `shadows` boolean asks for the removed
  soft map → use `shadows="percentage"`.
- **Every Playwright run starts with empty localStorage** (fresh browser context) — select
  things with `--click=` before clicking selection-dependent toolbar buttons (X-ray is
  disabled with nothing selected and the click times out).
