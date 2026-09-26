import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative asset URLs so the build works at any path — GitHub Pages serves it under
  // /cabinet-planner/, locally it's /.
  base: './',
  // 127.0.0.1, not the default: on macOS Vite binds `localhost` to IPv6 [::1] only, so
  // http://127.0.0.1:5188 was refused. Browsers fall back from ::1 to 127.0.0.1 for
  // "localhost", so both URLs work this way. strictPort: fail loudly instead of drifting to 5189.
  server: { host: '127.0.0.1', port: 5188, strictPort: true },
  // three.js + r3f make the lazy-loaded 3D chunk ~1 MB; that's expected, not a regression.
  build: { chunkSizeWarningLimit: 1200 },
  test: { include: ['tests/**/*.test.ts'] },
})
