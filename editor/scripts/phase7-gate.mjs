// Phase 7 non-browser gate: motion metadata, identity splices, anatomy variables, and legacy preview runtime.
import { readFileSync } from 'node:fs';
import { EditorDocument, inspectDeck, parseSource } from '../src/engine/index.ts';
import { RefMap } from '../src/engine/refs.ts';
import { buildPreview } from '../src/server/preview.ts';
import { anatomyColourOp, entranceOps, identityColourOp, morphPairOps, zoomOrderOps } from '../src/ui/phase7-ops.ts';

const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`);
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const source = `<html><head><script>tailwind.config = { theme: { extend: { colors: { verm: '#ed3b2f' }, fontFamily: { body: 'Sans' } } } }</script></head><body><main class="deck-stage">
<section class="slide"><h1 id="a" class="reveal d2">A</h1><svg id="heart" data-anatomy="heart" style="--anatomy-artery:#aa0000"><path/></svg></section>
<section class="slide"><h1 id="b">B</h1></section></main></body></html>`;
const inspected = inspectDeck(parseSource(source));
check('legacy entrance fallback is inspected without a native runtime', inspected.runtime.native === false && inspected.entrances[0]?.legacy && inspected.entrances[0]?.order === 2);
check('inline anatomy is one inspected host with namespaced variables', inspected.anatomy.length === 1 && inspected.anatomy[0].name === 'heart' && inspected.anatomy[0].variables['--anatomy-artery'] === '#aa0000');

check('entrance operations use the explicit source contract', same(entranceOps('a', { kind: 'fade-up', order: 3, delay: 450 }).map((op) => [op.name, op.value]), [
  ['data-entrance', 'fade-up'], ['data-entrance-order', '3'], ['data-entrance-delay', '450'],
]));
check('Morph pairing is consecutive and collision-free', morphPairOps({ fromKey: 'a', toKey: 'b', fromSlide: 1, toSlide: 2, group: 'hero', existingGroups: ['hero'] }).every((op) => op.value === 'hero-2'));
check('Zoom ordering rewrites stable one-based steps and labels', same(zoomOrderOps([{ key: 'b', label: 'B' }, { key: 'a', label: null }]).map((op) => op.value), ['1', 'B', '2', null]));

const editor = EditorDocument.fromText(source);
const heart = editor.doc.query({ attr: 'id=heart' })[0];
editor.apply([
  { kind: 'setToken', path: identityColourOp('verm', '#123456').path, value: '#123456' },
  { kind: 'setStyle', id: heart.id, prop: anatomyColourOp('heart', '--anatomy-artery', '#654321').prop, value: '#654321' },
]);
check('identity and anatomy edits are surgical source changes', editor.text.includes("verm: '#123456'") && editor.text.includes('--anatomy-artery:#654321') && editor.text.includes('<path/>'));
editor.undo();
check('identity and anatomy transaction is reversible', editor.text === source);

const doc = parseSource(source);
const runtime = readFileSync(new URL('../src/server/edit-layer/edit-mode.js', import.meta.url), 'utf8');
const preview = buildPreview(doc, new RefMap(doc), { css: '', js: runtime }, 1);
check('legacy preview injects the versioned cookbook compatibility facade', preview.includes('runtime.goTo = goTo') && preview.includes('runtime.setEditMode') && preview.includes('runtime.runtimeVersion = 1') && preview.includes('name="nm-runtime" content="1"'));
check('preview instrumentation does not mutate the source document', doc.text === source && !source.includes('data-nm-key'));

const failed = checks.filter((item) => !item.ok).length;
console.log(`\nPhase 7 gate: ${checks.length - failed}/${checks.length} checks passed.`);
process.exit(failed ? 1 : 0);
