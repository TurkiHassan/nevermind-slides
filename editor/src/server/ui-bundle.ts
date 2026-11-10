// The editor UI (src/ui, Preact) as one JS string and one CSS string, and the shell page that inlines them.
// Used by scripts/build.mjs at build time and by assets.ts on the first request when running from source.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

type EsbuildApi = typeof import('esbuild');

const UI_ENTRY = fileURLToPath(new URL('../ui/main.tsx', import.meta.url));
const SHELL_TEMPLATE = fileURLToPath(new URL('./shell.html', import.meta.url));

export async function bundleUi(esbuild: EsbuildApi): Promise<{ js: string; css: string }> {
  const r = await esbuild.build({
    entryPoints: [UI_ENTRY],
    bundle: true,
    write: false,
    outdir: 'nm-ui',
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    minify: true,
    jsx: 'automatic',
    jsxImportSource: 'preact',
    legalComments: 'none',
    logLevel: 'warning',
  });
  const pick = (ext: string) => r.outputFiles.find((f) => f.path.endsWith(ext))?.text ?? '';
  return { js: pick('.js'), css: pick('.css') };
}

/** The shell template with the bundle inlined. A literal "</script" or "</style" never closes its own tag. */
export function composeShell(template: string, ui: { js: string; css: string }): string {
  const js = ui.js.replace(/<\/script/gi, '<\\/script');
  const css = ui.css.replace(/<\/style/gi, '<\\/style');
  return template.split('/*NM_UI_CSS*/').join(css).split('/*NM_UI_JS*/').join(js);
}

export const readShellTemplate = (): string => readFileSync(SHELL_TEMPLATE, 'utf8');
