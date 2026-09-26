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
