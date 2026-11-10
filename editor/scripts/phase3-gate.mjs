// Phase 3 non-browser gate. Uses temp copies only: minimal Arabic text writeback with inline-run preservation,
// all basic property utilities, and preview instrumentation of the real deck that has no data-edit attributes.
import { readFileSync } from 'node:fs';
import { classList, EditorDocument, inspectDeck, loadDeck, saveDeck, visibleText } from '../src/engine/index.ts';
import { buildPreview } from '../src/server/preview.ts';
import { ATTENTION, MECHANISTIC, ROOT, tempCopyDeck } from '../test/helpers.ts';

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`);
};

const attentionCopy = tempCopyDeck(ATTENTION);
const attentionFile = await loadDeck(attentionCopy.path);
const attention = EditorDocument.fromText(attentionFile.text);
const inline = attention.doc.nodes.find((node) => {
  if (node.tag !== 'p' || !node.patchable || node.children.length === 0) return false;
  return visibleText(attention.doc, node.id).includes('استعلام');
});
if (!inline) throw new Error('attention inline text target not found');
const inlineKey = attention.refs.keyOf(inline.id);
const beforeVisible = visibleText(attention.doc, inline.id);
const inlineMarkup = '<span class="font-mono text-blue text-[19px]" dir="ltr">Q</span>';
attention.applyKeyed([{ kind: 'setText', id: inlineKey, text: beforeVisible.replace('استعلام', 'استعلام محرر') }], { label: 'Arabic text gate' });
check('Arabic setText changed the intended visible text', attention.text.includes('استعلام محرر'));
check('inline run survived text writeback', attention.text.includes(inlineMarkup));
await saveDeck(attentionFile, attention.text);
const attentionSaved = readFileSync(attentionCopy.path, 'utf8');
const aLines = attentionFile.text.split('\n');
const bLines = attentionSaved.split('\n');
const changedLines = Math.max(aLines.length, bLines.length) - aLines.filter((line, i) => line === bLines[i]).length;
check('saved diff is limited to the touched source line', changedLines === 1, `${changedLines} changed line`);

const mechanisticCopy = tempCopyDeck(MECHANISTIC);
const mechanisticFile = await loadDeck(mechanisticCopy.path);
const mechanistic = EditorDocument.fromText(mechanisticFile.text);
const target = mechanistic.doc.nodes.find((node) => node.patchable && node.tag === 'span' &&
  classList(node).includes('absolute') === false && classList(node).some((c) => /^text-\[/.test(c)) && visibleText(mechanistic.doc, node.id).trim().length > 3);
if (!target) throw new Error('mechanistic property target not found');
const targetKey = mechanistic.refs.keyOf(target.id);
mechanistic.applyKeyed([
  { kind: 'setUtility', id: targetKey, group: 'font-family', value: 'Thmanyah Sans' },
  { kind: 'setUtility', id: targetKey, group: 'font-size', value: '42' },
  { kind: 'setUtility', id: targetKey, group: 'font-weight', value: '700' },
  { kind: 'setUtility', id: targetKey, group: 'text-color', value: 'tab-mint' },
  { kind: 'setUtility', id: targetKey, group: 'leading', value: '1.35' },
  { kind: 'setUtility', id: targetKey, group: 'opacity', value: '0.65' },
  { kind: 'setUtility', id: targetKey, group: 'right', value: '77' },
  { kind: 'setUtility', id: targetKey, group: 'top', value: '88' },
], { label: 'Basic properties gate' });
const propertyClass = mechanistic.doc.byId(mechanistic.refs.idOf(targetKey)).attrs.class?.value ?? '';
for (const expected of ["font-['Thmanyah_Sans']", 'text-[42px]', 'font-bold', 'text-tab-mint', 'leading-[1.35]', 'opacity-[0.65]', 'right-[77px]', 'top-[88px]']) {
  check(`property utility ${expected}`, propertyClass.split(/\s+/).includes(expected));
}
await saveDeck(mechanisticFile, mechanistic.text);
check('mechanistic fixture source has no legacy data-edit contract', !mechanisticFile.text.includes('data-edit='));

const layer = {
  css: readFileSync(`${ROOT}/src/server/edit-layer/edit-mode.css`, 'utf8'),
  js: readFileSync(`${ROOT}/src/server/edit-layer/edit-mode.js`, 'utf8'),
};
const preview = buildPreview(mechanistic.doc, mechanistic.refs, layer, 1);
const textNodes = mechanistic.doc.nodes.filter((node) => {
  if (!node.patchable || !/^(h[1-6]|p|span|li|small|strong|em|button)$/.test(node.tag)) return false;
  try { return visibleText(mechanistic.doc, node.id).trim().length > 0; } catch { return false; }
});
const keyedTextNodes = textNodes.filter((node) => preview.includes(`data-nm-key="${mechanistic.refs.keyOf(node.id)}"`));
check('preview exposes the Phase 3 text-session API', preview.includes('beginText: beginText') && preview.includes("contenteditable', 'plaintext-only"));
check('mechanistic text is instrumented without data-edit', keyedTextNodes.length > 0, `${textNodes.length} text-bearing source nodes`);

if (results.some((ok) => !ok)) process.exitCode = 1;
else console.log(`Phase 3 gate passed: ${results.length}/${results.length} checks.`);
