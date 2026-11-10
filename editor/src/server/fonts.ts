// The editor chrome's fonts (Thmanyah Sans, Thmanyah Serif Display, Zain Rounded) are served from the nevermind
// skill's bundled font folder, never copied into this repository. NM_STUDIO_FONTS overrides the folder. When the
// folder is missing the chrome falls back to the system stack; the server says so once.
import { existsSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** The font files the chrome asks for. Anything else under /ui/fonts/ is refused. */
export const UI_FONT_FILES = new Set([
  'thmanyahsans-Regular.otf', 'thmanyahsans-Medium.otf', 'thmanyahsans-Bold.otf',
  'thmanyahserifdisplay-Bold.otf', 'thmanyahserifdisplay-Black.otf', 'ZainRounded-VF.ttf',
]);

let warned = false;

/** The real path of the font folder, or null (logged once) when it is absent. */
export function uiFontsDir(): string | null {
  const dir = process.env.NM_STUDIO_FONTS || join(homedir(), '.claude', 'skills', 'nevermind-slides', 'resources', 'fonts');
  if (existsSync(dir)) return realpathSync(dir);
  if (!warned) {
    warned = true;
    process.stderr.write(`nm-studio: editor fonts not found at ${dir}; the interface uses the system fonts\n`);
  }
  return null;
}
