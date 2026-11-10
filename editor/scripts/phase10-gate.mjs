// Phase 10 gate: performance budgets on the real decks, release hygiene, and the Arabic docs. Each budget is about
// three times the median measured on a development laptop (see docs/phase-10-report.md), so a real regression fails
// it while ordinary machine noise does not.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { join } from 'node:path';
import { EditorDocument, inspectDeck } from '../src/engine/index.ts';
import { buildPreview } from '../src/server/preview.ts';

const root = join(import.meta.dirname, '..');
const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`);
};
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const timed = (fn, runs = 7) => { const out = []; for (let i = 0; i < runs; i++) { const t = performance.now(); fn(i); out.push(performance.now() - t); } return median(out); };

// name: [file, inspect ms, preview ms, apply-op ms]
const BUDGETS = { attention: [150, 60, 200], mechanistic: [40, 20, 40] };
for (const [deck, [inspectBudget, previewBudget, opBudget]] of Object.entries(BUDGETS)) {
  const text = readFileSync(join(root, 'fixtures/real', deck, 'deck.html'), 'utf8');
  const doc = EditorDocument.fromText(text);
  const inspect = timed(() => inspectDeck(EditorDocument.fromText(text).doc));
  const preview = timed(() => { const fresh = EditorDocument.fromText(text); buildPreview(fresh.doc, fresh.refs, { css: '', js: '' }, 1); });
  const heading = doc.doc.nodes.find((n) => n.tag === 'h1' || n.tag === 'h2');
  const apply = timed((i) => doc.apply([{ kind: 'setText', id: heading.id, text: `عنوان ${i}` }]));
  check(`${deck}: parse and inspect within ${inspectBudget} ms`, inspect <= inspectBudget, `${inspect.toFixed(1)} ms`);
  check(`${deck}: parse and preview build within ${previewBudget} ms`, preview <= previewBudget, `${preview.toFixed(1)} ms`);
  check(`${deck}: one text edit applies within ${opBudget} ms`, apply <= opBudget, `${apply.toFixed(1)} ms`);
}

const bundle = join(root, 'dist/nm-studio.mjs');
check('the built bundle exists', existsSync(bundle));
if (existsSync(bundle)) {
  const size = statSync(bundle).size;
  check('bundle stays under 1.25 MB', size < 1.25 * 1024 * 1024, `${(size / 1024).toFixed(0)} KB`);
}

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
check('package version is 0.1.0', pkg.version === '0.1.0');
for (const doc of ['docs/user-guide-ar.md', 'docs/release-0.1.md', 'docs/deck-helper-edit.patch', 'docs/skill-integration.md']) check(`${doc} exists`, existsSync(join(root, doc)));
const guide = readFileSync(join(root, 'docs/user-guide-ar.md'), 'utf8');
check('the Arabic guide has no emoji', !/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(guide));
check('the Arabic guide covers editing, export, notes and the font licence warning', ['التعديل', 'التصدير', 'الملاحظات للوكيل', 'رخصة'].every((w) => guide.includes(w)));

const failed = checks.filter((c) => !c.ok).length;
console.log(`\nPhase 10 gate: ${checks.length - failed}/${checks.length} checks passed.`);
process.exit(failed ? 1 : 0);
