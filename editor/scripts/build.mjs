// Bundle the CLI, the engine, the server, the edit layer and the editor UI into one file: dist/nm-studio.mjs
// (no node_modules needed). The UI (src/ui, Preact) is bundled first and inlined into the shell page.
import * as esbuild from 'esbuild';
import { chmodSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleUi, composeShell, readShellTemplate } from '../src/server/ui-bundle.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const serverDir = join(root, 'src', 'server');
const out = join(root, 'dist', 'nm-studio.mjs');

const t0 = Date.now();
const ui = await bundleUi(esbuild);
const shell = composeShell(readShellTemplate(), ui);

// src/server/assets.ts reads (and bundles) its files at run time in development; in the bundle they become literals.
const inlineAssets = {
  name: 'inline-assets',
  setup(b) {
    b.onLoad({ filter: /src[\\/]server[\\/]assets\.ts$/ }, () => {
      const lit = (rel) => JSON.stringify(readFileSync(join(serverDir, rel), 'utf8'));
      return {
        loader: 'js',
        contents:
          `export const EDIT_MODE_JS = ${lit('edit-layer/edit-mode.js')};\n` +
          `export const EDIT_MODE_CSS = ${lit('edit-layer/edit-mode.css')};\n` +
          `const SHELL = ${JSON.stringify(shell)};\n` +
          'export const shellHtml = () => Promise.resolve(SHELL);\n',
      };
    });
  },
};

await esbuild.build({
  entryPoints: [join(root, 'src', 'cli', 'nm-studio.ts')],
  outfile: out,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  plugins: [inlineAssets],
  legalComments: 'none',
  logLevel: 'warning',
});
chmodSync(out, 0o755);
const kb = statSync(out).size / 1024;
console.log(`dist/nm-studio.mjs ${kb.toFixed(1)} KB (${statSync(out).size} bytes) in ${Date.now() - t0} ms; UI ${(ui.js.length / 1024).toFixed(1)} KB JS + ${(ui.css.length / 1024).toFixed(1)} KB CSS`);
