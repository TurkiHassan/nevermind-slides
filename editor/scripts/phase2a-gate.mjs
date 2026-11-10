// Phase 2a gate (the plan's Task 5 scripted run): build, copy dist/nm-studio.mjs ALONE to a temp dir, start `edit` on
// a temp copy of the attention deck, drive 10 ops and a save through the HTTP API, check that the diff is limited to
// the touched lines, then run `nm-studio apply` (the agent) on the same file and confirm the editor sees it via SSE.
// Run: node scripts/phase2a-gate.mjs   (Node >= 24: imports TypeScript through type stripping)
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EditorDocument } from '../src/engine/index.ts';
import { ATTENTION, ROOT, tempCopyDeck } from '../test/helpers.ts';

const checks = [];
const check = (name, ok, detail = '') => { checks.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };

const t0 = Date.now();
const build = spawnSync(process.execPath, [join(ROOT, 'scripts', 'build.mjs')], { encoding: 'utf8' });
check('npm run build', build.status === 0, build.stdout.trim());
const buildMs = Date.now() - t0;

const lone = join(mkdtempSync(join(tmpdir(), 'nm-gate-bundle-')), 'nm-studio.mjs');
copyFileSync(join(ROOT, 'dist', 'nm-studio.mjs'), lone);
const { path: deck, dir } = tempCopyDeck(ATTENTION);
const original = readFileSync(deck, 'utf8');

const child = spawn(process.execPath, [lone, 'edit', deck, '--no-open'], { cwd: join(lone, '..'), stdio: ['ignore', 'pipe', 'inherit'] });
let buf = '';
const info = await new Promise((ok, fail) => {
  const t = setTimeout(() => fail(new Error('edit did not start')), 15000);
  child.stdout.on('data', (c) => { buf += c; try { const j = JSON.parse(buf); clearTimeout(t); ok(j); } catch { /* partial */ } });
});
const startMs = Date.now() - t0 - buildMs;
const url = new URL(info.url);
const port = Number(url.port);
const token = url.searchParams.get('t');
check('edit --no-open started from the lone bundle', port > 0, `url ${url.origin}/?t=…, ${startMs} ms`);

function call(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? undefined : JSON.stringify(body);
    const req = request({
      host: '127.0.0.1', port, method, path: method === 'GET' ? `${path}${path.includes('?') ? '&' : '?'}t=${token}` : path,
      headers: { host: `127.0.0.1:${port}`, ...(method === 'GET' ? {} : { origin: url.origin, 'x-nm-token': token, 'content-type': 'application/json' }) },
    }, (res) => {
      let s = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (s += c));
      res.on('end', () => resolve({ status: res.statusCode, json: s ? JSON.parse(s) : null }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// SSE
const events = [];
const sse = request({ host: '127.0.0.1', port, path: `/api/events?t=${token}`, headers: { host: `127.0.0.1:${port}` } }, (res) => {
  let b = '';
  res.setEncoding('utf8');
  res.on('data', (c) => {
    b += c;
    let i;
    while ((i = b.indexOf('\n\n')) >= 0) {
      const f = b.slice(0, i); b = b.slice(i + 2);
      const ev = /^event: (.*)$/m.exec(f); const d = /^data: (.*)$/m.exec(f);
      if (ev && d) events.push({ event: ev[1], data: JSON.parse(d[1]) });
    }
  });
});
sse.on('error', () => {});
sse.end();

// 10 ops, each a transaction, built from a mirror document with the same keys.
const mirror = EditorDocument.fromText(original);
const d = mirror.doc;
const leaves = d.nodes.filter((n) => n.tag === 'span' && n.children.length === 0 && n.patchable && d.text.slice(n.startTagEnd, n.endTagStart).trim().length > 3);
const abs = d.nodes.filter((n) => n.patchable && /\babsolute\b/.test(n.attrs.class?.value ?? '') && /top-\[\d+px\]/.test(n.attrs.class?.value ?? ''));
const k = (n) => mirror.refs.keyOf(n.id);
const ops = [
  { kind: 'setText', id: k(leaves[0]), text: 'عنوان معدّل ١' },
  { kind: 'setUtility', id: k(abs[0]), group: 'top', value: '148' },
  { kind: 'setAttr', id: k(leaves[1]), name: 'data-gate', value: 'one' },
  { kind: 'setStyle', id: k(leaves[2]), prop: 'opacity', value: '0.9' },
  { kind: 'setText', id: k(leaves[3]), text: 'نص ثانٍ معدّل' },
  { kind: 'setUtility', id: k(abs[1]), group: 'left', value: '90' },
  { kind: 'setAttr', id: k(leaves[4]), name: 'title', value: 'gate' },
  { kind: 'setClasses', id: k(leaves[5]), classes: [...(leaves[5].attrs.class?.value ?? '').split(/\s+/).filter(Boolean), 'nm-gate'] },
  { kind: 'setUtility', id: k(abs[2]), group: 'top', value: '200' },
  { kind: 'setText', id: k(leaves[6]), text: 'نص ثالث معدّل' },
];
let version = (await call('GET', '/api/state')).json.version;
let patched = 0;
const opT0 = Date.now();
for (const op of ops) {
  const r = await call('POST', '/api/ops', { ops: [op], baseVersion: version });
  if (r.status !== 200) { check(`op ${op.kind}`, false, JSON.stringify(r.json)); continue; }
  version = r.json.version;
  if (Array.isArray(r.json.previewPatch)) patched++;
  mirror.applyKeyed([op]);
}
const opMs = (Date.now() - opT0) / ops.length;
check('10 ops applied', version === 11, `final version ${version}, ${patched} of 10 patched in place, ${opMs.toFixed(0)} ms per op round trip`);
const save = await call('POST', '/api/save', {});
check('save', save.status === 200 && save.json.dirty === false);
const saved = readFileSync(deck, 'utf8');
check('saved file equals the mirror EditorDocument', saved === mirror.text);

const diffDir = mkdtempSync(join(tmpdir(), 'nm-gate-diff-'));
writeFileSync(join(diffDir, 'a.html'), original);
writeFileSync(join(diffDir, 'b.html'), saved);
const diff = spawnSync('diff', ['-U0', join(diffDir, 'a.html'), join(diffDir, 'b.html')], { encoding: 'utf8' }).stdout;
const removed = diff.split('\n').filter((l) => l.startsWith('-') && !l.startsWith('---')).length;
const added = diff.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).length;
const hunks = diff.split('\n').filter((l) => l.startsWith('@@')).length;
const totalLines = original.split('\n').length;
check('diff limited to the touched lines', hunks <= ops.length && removed <= ops.length && added <= ops.length, `${hunks} hunks, -${removed} +${added} of ${totalLines} lines`);

// the agent edits the same file with the CLI; the editor must report it
const agentOps = [{ kind: 'setText', id: EditorDocument.fromText(saved).doc.nodes.find((n) => n.tag === 'span' && n.children.length === 0 && n.patchable && saved.slice(n.startTagEnd, n.endTagStart).includes('نص ثالث')).id, text: 'تعديل الوكيل' }];
const apply = spawnSync(process.execPath, [lone, 'apply', deck, '-'], { input: JSON.stringify(agentOps), encoding: 'utf8' });
check('nm-studio apply (agent) on the same file', apply.status === 0, apply.stderr.trim());
const tAgent = Date.now();
while (Date.now() - tAgent < 5000 && !events.some((e) => e.event === 'disk-changed')) await new Promise((r) => setTimeout(r, 25));
const ev = events.find((e) => e.event === 'disk-changed');
const sseMs = Date.now() - tAgent;
check('SSE disk-changed {reloaded: true}', ev?.data.reloaded === true && ev?.data.conflict === false, `after ${sseMs} ms`);
const st = (await call('GET', '/api/state')).json;
check('editor state matches the disk after the agent edit', st.dirty === false && st.fingerprint === ev?.data.fingerprint);
const html = await new Promise((resolve) => {
  const req = request({ host: '127.0.0.1', port, path: `/preview?t=${token}`, headers: { host: `127.0.0.1:${port}` } }, (res) => { let s = ''; res.setEncoding('utf8'); res.on('data', (c) => (s += c)); res.on('end', () => resolve(s)); });
  req.end();
});
check('the preview shows the agent edit', html.includes('تعديل الوكيل'));

sse.destroy();
child.kill('SIGINT');
const code = await new Promise((r) => child.on('exit', (c) => r(c)));
check('SIGINT exits cleanly', code === 0, `exit code ${code}`);

const failed = checks.filter((c) => !c.ok).length;
console.log(`\nphase 2a gate: ${checks.length - failed}/${checks.length} checks passed, build ${buildMs} ms, start ${startMs} ms, total ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(failed ? 1 : 0);
