// Open a URL in the default browser. Never throws: a missing launcher only means the user opens the printed URL.
import { spawn } from 'node:child_process';

export function openBrowser(url: string): void {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '""', url.replace(/&/g, '^&')] : [url];
  try {
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
    child.on('error', () => { /* no launcher on this machine */ });
    child.unref();
  } catch {
    /* ignore */
  }
}
