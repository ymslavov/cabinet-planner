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
- **A `cat > file` without a heredoc in a Bash call hangs forever** waiting on stdin.
