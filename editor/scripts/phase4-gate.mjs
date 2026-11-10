// Phase 4 non-browser gate. Runs the lone built bundle on a temporary deck, creates an editor note, lists it through
// the bundled CLI, applies an agent edit, completes the note externally, and requires live SSE/state/preview convergence.
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, statSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EditorDocument } from '../src/engine/index.ts';
import { MINIMAL, ROOT, tempCopyDeck } from '../test/helpers.ts';

const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`);
};

const build = spawnSync(process.execPath, [join(ROOT, 'scripts', 'build.mjs')], { encoding: 'utf8' });
check('tag-ready build', build.status === 0, build.stdout.trim());
const lone = join(mkdtempSync(join(tmpdir(), 'nm-phase4-bundle-')), 'nm-studio.mjs');
copyFileSync(join(ROOT, 'dist', 'nm-studio.mjs'), lone);
const bundleBytes = statSync(lone).size;
check('lone bundle stays below 1.5 MB', bundleBytes < 1_500_000, `${bundleBytes} bytes`);
const version = spawnSync(process.execPath, [lone, '--version'], { encoding: 'utf8' });
check('bundle reports v0.1.0', version.status === 0 && version.stdout.trim() === '0.1.0');

const { path: deck, dir } = tempCopyDeck(MINIMAL);
const original = readFileSync(deck, 'utf8');
const child = spawn(process.execPath, [lone, 'edit', deck, '--no-open'], { stdio: ['ignore', 'pipe', 'inherit'] });
let output = '';
const started = await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('edit did not start')), 15_000);
  child.stdout.on('data', (chunk) => {
    output += chunk;
    try { clearTimeout(timeout); resolve(JSON.parse(output)); } catch { /* partial JSON */ }
  });
});
const editorUrl = new URL(started.url);
const port = Number(editorUrl.port);
const token = editorUrl.searchParams.get('t');
check('edit starts from the lone bundle', port > 0);

function call(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? undefined : JSON.stringify(body);
    const req = request({
      host: '127.0.0.1', port, method,
      path: method === 'GET' ? `${path}${path.includes('?') ? '&' : '?'}t=${token}` : path,
      headers: { host: `127.0.0.1:${port}`, ...(method === 'GET' ? {} : { origin: editorUrl.origin, 'x-nm-token': token, 'content-type': 'application/json' }) },
    }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { text += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, json: text ? JSON.parse(text) : null }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

const events = [];
const sse = request({ host: '127.0.0.1', port, path: `/api/events?t=${token}`, headers: { host: `127.0.0.1:${port}` } }, (res) => {
  let buffer = '';
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    buffer += chunk;
    let end;
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const frame = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const event = /^event: (.*)$/m.exec(frame);
      const data = /^data: (.*)$/m.exec(frame);
      if (event && data) events.push({ event: event[1], data: JSON.parse(data[1]) });
    }
  });
});
sse.on('error', () => {});
sse.end();

const mirror = EditorDocument.fromText(original);
const heading = mirror.doc.query({ tag: 'h1' })[0];
const headingKey = mirror.refs.keyOf(heading.id);
const made = await call('POST', '/api/notes', { text: 'اختصر العنوان', target: { kind: 'element', key: headingKey } });
check('editor creates an element note', made.status === 201 && made.json.note.target.key === headingKey);
const noteId = made.json.note.id;
check('note metadata does not change deck bytes', readFileSync(deck, 'utf8') === original);
const notesFile = join(dir, '.nevermind', 'notes.json');
check('notes.json is durable', existsSync(notesFile) && JSON.parse(readFileSync(notesFile, 'utf8')).notes[0].id === noteId);

const current = await call('POST', '/api/current', { slide: 1, key: headingKey, fingerprint: 'ignored' });
check('current.json uses server context', current.status === 200 && current.json.selection.key === headingKey && existsSync(join(dir, '.nevermind', 'current.json')));

const listed = spawnSync(process.execPath, [lone, 'notes', 'list', deck], { encoding: 'utf8' });
const listedDoc = listed.status === 0 ? JSON.parse(listed.stdout) : null;
check('bundled CLI lists the editor note', listed.status === 0 && listedDoc.notes[0].id === noteId && listedDoc.notes[0].target.role === 'العنوان الرئيس', listed.stderr.trim());

const externalDoc = EditorDocument.fromText(original);
const paragraph = externalDoc.doc.query({ attr: 'id=lede' })[0];
const applied = spawnSync(process.execPath, [lone, 'apply', deck, '-'], {
  input: JSON.stringify([{ kind: 'setText', id: paragraph.id, text: 'نفّذ الوكيل التعديل' }]), encoding: 'utf8',
});
check('agent-style apply changes the deck', applied.status === 0 && readFileSync(deck, 'utf8').includes('نفّذ الوكيل التعديل'), applied.stderr.trim());
const applyStart = Date.now();
while (Date.now() - applyStart < 5000 && !events.some((event) => event.event === 'disk-changed' && event.data.reloaded)) {
  await new Promise((resolve) => setTimeout(resolve, 25));
}
check('open editor receives the agent apply', events.some((event) => event.event === 'disk-changed' && event.data.reloaded));

const done = spawnSync(process.execPath, [lone, 'notes', 'done', deck, noteId], { encoding: 'utf8' });
check('bundled CLI completes the note', done.status === 0 && JSON.parse(done.stdout).note.status === 'done', done.stderr.trim());
const doneStart = Date.now();
while (Date.now() - doneStart < 5000 && !events.some((event) => event.event === 'notes' && event.data.source === 'external' && event.data.notes.notes[0]?.status === 'done')) {
  await new Promise((resolve) => setTimeout(resolve, 25));
}
check('notes done clears the live editor through notes SSE', events.some((event) => event.event === 'notes' && event.data.source === 'external' && event.data.notes.notes[0]?.status === 'done'));

const state = (await call('GET', '/api/state')).json;
const preview = await new Promise((resolve, reject) => {
  const req = request({ host: '127.0.0.1', port, path: `/preview?t=${token}`, headers: { host: `127.0.0.1:${port}` } }, (res) => {
    let text = '';
    res.setEncoding('utf8');
    res.on('data', (chunk) => { text += chunk; });
    res.on('end', () => resolve(text));
  });
  req.on('error', reject);
  req.end();
});
check('state and preview converge without reopening', state.notes.notes[0].status === 'done' && preview.includes('نفّذ الوكيل التعديل'));

sse.destroy();
child.kill('SIGINT');
const exitCode = await new Promise((resolve) => child.on('exit', resolve));
check('SIGINT exits cleanly', exitCode === 0, `exit code ${exitCode}`);

const failed = checks.filter((item) => !item.ok).length;
console.log(`\nPhase 4 gate: ${checks.length - failed}/${checks.length} checks passed.`);
process.exit(failed ? 1 : 0);
