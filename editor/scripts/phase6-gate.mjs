// Phase 6 non-browser gate: full utility write-back, fixed preset catalog, safe assets, and SVG-safe slide structure.
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EditorDocument, parseSource } from '../src/engine/index.ts';
import { listLayoutPresets, readLayoutPreset } from '../src/server/layout-presets.ts';
import { saveUploadedImage } from '../src/server/uploads.ts';
import { imageClasses, propertyClasses } from '../src/ui/property-ops.ts';

const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`);
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const catalog = listLayoutPresets();
check('layout catalog has exactly 23 unique presets', catalog.length === 23 && new Set(catalog.map((preset) => preset.id)).size === 23);
try {
  const preset = readLayoutPreset('opening/offset-marquee');
  check('preset reader returns one inactive slide fragment', preset.html.startsWith('<section class="slide ') && !/\bactive\b/.test(preset.html) && !preset.html.includes('<html'));
} catch (error) {
  check('preset reader returns one inactive slide fragment', false, error.message);
}

check('spacing utility replacement preserves variants', same(
  propertyClasses(['p-4', 'md:p-8', 'text-ink'], 'padding', 32), ['p-[32px]', 'md:p-8', 'text-ink'],
));
check('radius, shadow, and border utilities are source-ready', same(
  propertyClasses(propertyClasses(propertyClasses(['rounded-lg', 'shadow-sm', 'border-2'], 'radius', 18), 'shadow', 'xl'), 'borderWidth', 6),
  ['rounded-[18px]', 'shadow-xl', 'border-[6px]'],
));
check('image crop and focal point are Tailwind utilities', same(
  imageClasses(imageClasses(['object-contain', 'md:object-cover'], { fit: 'cover' }), { focalX: 70, focalY: 20 }),
  ['object-cover', 'md:object-cover', 'object-[70%_20%]'],
));

const source = `<div class="deck-stage">
  <section class="slide" id="slide-a"><svg aria-labelledby="title"><title id="title">A</title><defs><linearGradient id="paint"><stop/></linearGradient><clipPath id="clip"><rect/></clipPath></defs><style>.shape{fill:url(#paint)}</style><rect class="shape" fill="url(#paint)" clip-path="url(#clip)"/></svg></section>
</div>`;
const editor = EditorDocument.fromText(source);
const slide = editor.doc.query({ attr: 'id=slide-a' })[0];
editor.apply([{ kind: 'duplicate', id: slide.id }]);
const duplicated = parseSource(editor.text);
const ids = duplicated.nodes.map((node) => node.attrs.id?.value).filter(Boolean);
check('duplicated SVG slide has no id collisions', ids.length > 0 && new Set(ids).size === ids.length);
check('duplicated SVG references use the renamed gradient', editor.text.includes('url(#paint-2)') && editor.text.includes('url(#clip-2)'));

const dir = mkdtempSync(join(tmpdir(), 'nm-phase6-gate-'));
const deck = join(dir, 'deck.html');
writeFileSync(deck, '<html></html>');
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const first = await saveUploadedImage(deck, { name: '../hero.png', type: 'image/png', data: png });
const second = await saveUploadedImage(deck, { name: '../hero.png', type: 'image/png', data: png });
check('uploads stay in assets and never overwrite', first.path === 'assets/hero.png' && second.path === 'assets/hero-2.png');

const failed = checks.filter((item) => !item.ok).length;
console.log(`\nPhase 6 gate: ${checks.length - failed}/${checks.length} checks passed.`);
process.exit(failed ? 1 : 0);
