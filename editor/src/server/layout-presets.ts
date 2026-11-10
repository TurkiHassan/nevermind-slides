import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { setAttrSplices } from '../engine/attrs.ts';
import { classList, parseSource } from '../engine/source.ts';
import { applySplices } from '../engine/splice.ts';

export interface LayoutPreset { id: string; slot: string; name: string }

const CATALOG: readonly LayoutPreset[] = [
  ['opening/offset-marquee', 'Offset Marquee'], ['opening/monolith', 'Monolith'], ['opening/split-ledger', 'Split Ledger'],
  ['opening/half-plate', 'Half Plate'], ['section/chapter-gate', 'Chapter Gate'], ['section/waypoint', 'Waypoint'],
  ['section/index-ledger', 'Index Ledger'], ['list/ledger-list', 'Ledger List'], ['list/counter-cards', 'Counter Cards'],
  ['list/staircase', 'Staircase'], ['stats/keynote-figure', 'Keynote Figure'], ['stats/stat-strip', 'Stat Strip'],
  ['stats/ratio-split', 'Ratio Split'], ['chart/skyline', 'Skyline'], ['chart/aperture', 'Aperture'],
  ['chart/crossover', 'Crossover'], ['quote/testimony', 'Testimony'], ['comparison/ledger-versus', 'Ledger Versus'],
  ['comparison/fulcrum', 'Fulcrum'], ['image/plate-caption', 'Plate Caption'], ['image/triptych', 'Triptych'],
  ['timeline/meridian', 'Meridian'], ['closing/terminal-frame', 'Terminal Frame'],
].map(([id, name]) => ({ id, slot: id.split('/')[0], name }));

export class LayoutPresetError extends Error {
  code: 'unknown-preset' | 'missing-presets' | 'invalid-preset';
  constructor(code: LayoutPresetError['code'], message: string) {
    super(message);
    this.name = 'LayoutPresetError';
    this.code = code;
  }
}

export const defaultLayoutPresetsRoot = () => process.env.NM_LAYOUT_PRESETS_DIR || join(homedir(), '.claude', 'skills', 'nevermind-slides', 'resources', 'engine', 'frontend-slides', 'layout-presets');

export function listLayoutPresets(): LayoutPreset[] {
  return CATALOG.map((preset) => ({ ...preset }));
}

export function readLayoutPreset(id: string, root = defaultLayoutPresetsRoot()): LayoutPreset & { html: string } {
  const preset = CATALOG.find((candidate) => candidate.id === id);
  if (!preset) throw new LayoutPresetError('unknown-preset', `unknown layout preset ${JSON.stringify(id)}`);
  let text: string;
  try {
    text = readFileSync(join(root, ...preset.id.split('/'), 'preview.html'), 'utf8');
  } catch {
    throw new LayoutPresetError('missing-presets', `layout preset resources are not installed at ${root}`);
  }
  const doc = parseSource(text);
  const slide = doc.nodes.find((node) => node.tag === 'section' && classList(node).includes('slide') && node.patchable);
  if (!slide) throw new LayoutPresetError('invalid-preset', `layout preset ${id} has no source-backed slide section`);
  const local = parseSource(text.slice(slide.start, slide.end));
  const localSlide = local.nodes.find((node) => node.tag === 'section' && classList(node).includes('slide') && node.patchable);
  if (!localSlide) throw new LayoutPresetError('invalid-preset', `layout preset ${id} slide cannot be extracted`);
  const classes = classList(localSlide).filter((name) => name !== 'active' && name !== 'visible');
  const html = applySplices(local.text, setAttrSplices(local, localSlide, 'class', classes.join(' ')));
  return { ...preset, html };
}
