import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Inside the skill repository the layout presets sit next to the editor; outside it the installed skill is used.
const presetsInRepo = fileURLToPath(new URL('../resources/engine/frontend-slides/layout-presets', import.meta.url));

export default defineConfig({
  test: {
    include: ['spikes/**/*.test.ts', 'test/**/*.test.ts'],
    testTimeout: 60_000,
    env: { NM_LAYOUT_PRESETS_DIR: process.env.NM_LAYOUT_PRESETS_DIR ?? presetsInRepo },
  },
});
