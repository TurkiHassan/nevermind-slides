// The files the server serves from memory: the edit layer and the editor shell. In development the edit layer is
// read from disk and the shell's UI bundle is built with esbuild on the first request (then cached);
// scripts/build.mjs replaces this module with the same exports holding the finished strings, so the built bundle is
// one file and never loads esbuild.
import { readFileSync } from 'node:fs';
import { bundleUi, composeShell, readShellTemplate } from './ui-bundle.ts';

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

export const EDIT_MODE_JS = read('./edit-layer/edit-mode.js');
export const EDIT_MODE_CSS = read('./edit-layer/edit-mode.css');

let shell: Promise<string> | null = null;

export function shellHtml(): Promise<string> {
  shell ??= import('esbuild').then(async (esbuild) => composeShell(readShellTemplate(), await bundleUi(esbuild)));
  shell.catch(() => { shell = null; }); // a failed build (syntax error while developing) is retried on the next request
  return shell;
}
