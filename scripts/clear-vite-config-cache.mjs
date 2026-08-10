import { rmSync } from 'node:fs'

// Render restores node_modules between builds. Vite's bundled config cache can
// otherwise survive a deployment and start the API with an older vite.config.ts.
rmSync('node_modules/.vite-temp', { recursive: true, force: true })
