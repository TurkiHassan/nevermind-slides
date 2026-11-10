// Phase 8 non-browser gate: isolated AI proposals, rejection, one-step acceptance, safe process arguments, and images.
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentProposalStore } from '../src/server/agent-proposals.ts';
import { createLocalAgentRunners } from '../src/server/local-agent-runner.ts';
import { Session } from '../src/server/session.ts';

const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`);
};

const dir = mkdtempSync(join(tmpdir(), 'nm-phase8-gate-'));
const deckPath = join(dir, 'deck.html');
const source = '<!doctype html><html><body><section class="slide"><h1>عنوان طويل</h1><img src="old.png"></section></body></html>\n';
writeFileSync(deckPath, source);
writeFileSync(join(dir, 'old.png'), Buffer.from('old'));
const session = await Session.open(deckPath);
const outline = session.outline(1, 8).outline;
const all = outline.children.flatMap(function walk(node) { return [node, ...node.children.flatMap(walk)]; });
const heading = all.find((node) => node.tag === 'h1');
const image = all.find((node) => node.tag === 'img');

const store = new AgentProposalStore({
  text: async ({ selection }) => ({ summary: 'اختصار', ops: [{ kind: 'setText', id: selection.id, text: 'عنوان موجز' }] }),
  image: async ({ outputPath }) => { writeFileSync(outputPath, Buffer.from('89504e470d0a1a0a00000000', 'hex')); },
});
const text = store.createText('اختصر العنوان', session.agentSelection(heading.key));
const ready = await store.settled(text.id);
check('text proposal exposes a source diff without touching the live session', ready.status === 'ready' && ready.diff.includes('عنوان موجز') && session.text === source);
store.reject(text.id);
check('rejection leaves the session and disk byte-identical', session.text === source && readFileSync(deckPath, 'utf8') === source && !session.isDirty);

const accepted = await store.settled(store.createText('اختصر العنوان', session.agentSelection(heading.key)).id);
session.acceptAgentOps({ baseVersion: accepted.baseVersion, ops: accepted.ops, label: 'AI: shorten' });
check('acceptance changes the selection', session.text.includes('<h1>عنوان موجز</h1>'));
session.undo();
check('one Undo reverses the complete accepted proposal', session.text === source);

const stale = await store.settled(store.createText('اختصر العنوان', session.agentSelection(heading.key)).id);
session.applyOps({ baseVersion: session.currentVersion, ops: [{ kind: 'setAttr', id: heading.key, name: 'data-version', value: 'new' }] });
let staleCode = '';
try { session.acceptAgentOps({ baseVersion: stale.baseVersion, ops: stale.ops, label: 'stale' }); }
catch (error) { staleCode = error.code; }
check('a proposal cannot overwrite a newer session version', staleCode === 'stale-proposal');
session.undo();

const imageProposal = store.createImage('رسم تقني', session.agentSelection(image.key));
const imageReady = await store.settled(imageProposal.id);
check('generated image stays temporary before acceptance', imageReady.status === 'ready' && !existsSync(join(dir, 'assets')));
store.reject(imageProposal.id);
check('rejecting an image creates no asset directory', !existsSync(join(dir, 'assets')));

const invocations = [];
const local = createLocalAgentRunners({
  available: async (command) => command === 'codex',
  run: async (invocation) => {
    invocations.push(invocation);
    return { stdout: JSON.stringify({ summary: 'safe', ops: [{ kind: 'setText', id: 4, text: 'x' }] }), stderr: '' };
  },
});
await local.text({ prompt: 'value; touch /tmp/forbidden', selection: { ...session.agentSelection(heading.key), id: 4 } }, new AbortController().signal);
check('agent prompt uses stdin and spawn arguments never invoke a shell', invocations[0].shell === false && !invocations[0].args.join(' ').includes('touch /tmp/forbidden') && invocations[0].stdin.includes('touch /tmp/forbidden'));

await store.close();
session.close();
const failed = checks.filter((item) => !item.ok).length;
console.log(`\nPhase 8 gate: ${checks.length - failed}/${checks.length} checks passed.`);
process.exit(failed ? 1 : 0);
