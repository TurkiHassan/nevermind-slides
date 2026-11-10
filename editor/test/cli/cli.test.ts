import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSource } from '../../src/engine/source.ts';
import { NotesStore } from '../../src/server/notes.ts';
import { ATTENTION, MINIMAL, ROOT, fixturePath, tempCopyDeck } from '../helpers.ts';

const CLI = join(ROOT, 'src', 'cli', 'nm-studio.ts');
function cli(args: string[], input?: string) {
  const r = spawnSync(process.execPath, [CLI, ...args], { input, encoding: 'utf8' });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}
const haveAttention = existsSync(fixturePath(ATTENTION));

describe('nm-studio version', () => {
  it('reports the tag-ready package version', () => {
    const result = cli(['--version']);
    expect(result).toEqual(expect.objectContaining({ code: 0, stdout: '0.1.0\n', stderr: '' }));
    expect(JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version).toBe('0.1.0');
  });
});

describe('nm-studio inspect', () => {
  (haveAttention ? it : it.skip)('attention slide 1 outline includes the title wrapper with its classes', () => {
    const { path } = tempCopyDeck(ATTENTION);
    const r = cli(['inspect', path, '--slide', '1']);
    expect(r.code).toBe(0);
    const info = JSON.parse(r.stdout);
    expect(info.slides).toHaveLength(7);
    expect(info.tailwind).toBe('local');
    expect(Array.isArray(info.tokens.colors)).toBe(true);
    type O = { classes: string[]; text: string; children: O[] };
    const all: O[] = [];
    const walk = (o: O) => { all.push(o); o.children.forEach(walk); };
    walk(info.outline);
    const wrapper = all.find((o) => o.classes.join(' ') === 'absolute right-[104px] top-[132px] w-[1080px]');
    expect(wrapper).toBeDefined();
    expect(wrapper!.text.startsWith('ورقة تأسيسية')).toBe(true);
    expect(wrapper!.text.length).toBeLessThanOrEqual(80);
  });
  it('--depth limits the outline', () => {
    const { path } = tempCopyDeck(MINIMAL);
    const info = JSON.parse(cli(['inspect', path, '--slide', '1', '--depth', '1']).stdout);
    expect(info.outline.children.every((c: { children: unknown[] }) => c.children.length === 0)).toBe(true);
    expect(info.outline.children[0].truncated).toBeGreaterThan(0);
  });
  it('bad slide number and unknown command exit 1 with a message on stderr', () => {
    const { path } = tempCopyDeck(MINIMAL);
    const r = cli(['inspect', path, '--slide', '9']);
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/3 slides/);
    expect(cli(['frobnicate', path]).code).toBe(1);
  });
});

describe('nm-studio apply', () => {
  it('setUtility top 148 changes exactly the expected bytes and snapshots', () => {
    const { path } = tempCopyDeck(MINIMAL);
    const before = readFileSync(path, 'utf8');
    const id = parseSource(before).query({ attr: 'id=title-block' })[0].id;
    const r = cli(['apply', path, '-'], JSON.stringify([{ kind: 'setUtility', id, group: 'top', value: '148' }]));
    expect(r.stderr).toBe('');
    expect(r.code).toBe(0);
    const res = JSON.parse(r.stdout);
    expect(res.splices).toBe(1);
    expect(res.changedBytes).toBe(4); // "32" removed, "48" inserted (the "1" is shared)
    const after = readFileSync(path, 'utf8');
    const at = before.indexOf('top-[132px] w-[900px]" id="title-block"') + 'top-['.length;
    expect(after).toBe(before.slice(0, at) + '148' + before.slice(at + 3));
    expect(existsSync(join(path, '..', '.nevermind', 'history'))).toBe(true);
  });
  it('ops from a file, with a label object', () => {
    const { dir, path } = tempCopyDeck(MINIMAL);
    const id = parseSource(readFileSync(path, 'utf8')).query({ attr: 'id=lede' })[0].id;
    const opsFile = join(dir, 'ops.json');
    writeFileSync(opsFile, JSON.stringify({ label: 'test', ops: [{ kind: 'setAttr', id, name: 'data-x', value: '1' }] }));
    expect(cli(['apply', path, opsFile]).code).toBe(0);
    expect(readFileSync(path, 'utf8')).toContain('id="lede" data-x="1"');
  });
  it('--dry-run prints a unified diff and writes nothing', () => {
    const { path } = tempCopyDeck(MINIMAL);
    const before = readFileSync(path, 'utf8');
    const id = parseSource(before).query({ attr: 'id=title-block' })[0].id;
    const r = cli(['apply', path, '-', '--dry-run'], JSON.stringify([{ kind: 'setUtility', id, group: 'top', value: '148' }]));
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/^--- a\/deck\.html\n\+\+\+ b\/deck\.html\n@@ /);
    expect(r.stdout).toContain('-        <div class="absolute right-[104px] top-[132px] w-[900px]" id="title-block">');
    expect(r.stdout).toContain('+        <div class="absolute right-[104px] top-[148px] w-[900px]" id="title-block">');
    expect(readFileSync(path, 'utf8')).toBe(before);
    expect(existsSync(join(path, '..', '.nevermind'))).toBe(false);
  });
  it('--expect mismatch exits 1 and leaves the file untouched', () => {
    const { path } = tempCopyDeck(MINIMAL);
    const before = readFileSync(path, 'utf8');
    const r = cli(['apply', path, '-', '--expect', 'deadbeef'], JSON.stringify([{ kind: 'setAttr', id: 1, name: 'a', value: 'b' }]));
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/conflict.*changed on disk/);
    expect(readFileSync(path, 'utf8')).toBe(before);
  });
  it('--expect with the right fingerprint applies', () => {
    const { path } = tempCopyDeck(MINIMAL);
    const fp = JSON.parse(cli(['inspect', path]).stdout).fingerprint;
    const id = parseSource(readFileSync(path, 'utf8')).query({ attr: 'id=lede' })[0].id;
    expect(cli(['apply', path, '-', '--expect', fp], JSON.stringify([{ kind: 'remove', id }])).code).toBe(0);
  });
  it('an invalid op exits 1 with its code and leaves the file untouched', () => {
    const { path } = tempCopyDeck(MINIMAL);
    const before = readFileSync(path, 'utf8');
    const r = cli(['apply', path, '-'], JSON.stringify([{ kind: 'remove', id: 99999 }]));
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/\[not-found\]/);
    expect(readFileSync(path, 'utf8')).toBe(before);
    expect(cli(['apply', path, '-'], 'not json').code).toBe(1);
  });
});

describe('nm-studio undo', () => {
  it('restores the bytes before the last apply', () => {
    const { path } = tempCopyDeck(MINIMAL);
    const before = readFileSync(path);
    const id = parseSource(before.toString('utf8')).query({ attr: 'id=lede' })[0].id;
    expect(cli(['apply', path, '-'], JSON.stringify([{ kind: 'setText', id, text: 'نص' }])).code).toBe(0);
    expect(readFileSync(path).equals(before)).toBe(false);
    const r = cli(['undo', path]);
    expect(r.code).toBe(0);
    expect(readFileSync(path).equals(before)).toBe(true);
    expect(cli(['undo', path]).code).toBe(1);
  });
});

describe('nm-studio lint', () => {
  it('exit 0 without errors, 1 with errors', () => {
    const { path } = tempCopyDeck(MINIMAL);
    const ok = cli(['lint', path]);
    expect(ok.code).toBe(0);
    expect(JSON.parse(ok.stdout).filter((i: { severity: string }) => i.severity === 'error')).toEqual([]);
    writeFileSync(path, readFileSync(path, 'utf8').replace('الخلاصة</h2>', 'الخلاصة \u{1F680}</h2>'));
    const bad = cli(['lint', path]);
    expect(bad.code).toBe(1);
    expect(JSON.parse(bad.stdout).map((i: { code: string }) => i.code)).toContain('emoji');
  });
});

describe('nm-studio notes', () => {
  it('lists open notes, includes completed notes with --all, and completes without changing deck bytes', async () => {
    const { path } = tempCopyDeck(MINIMAL);
    const before = readFileSync(path);
    const store = await NotesStore.open(path);
    const open = await store.create({
      text: 'عدّل العنوان',
      target: { kind: 'area', slide: 1, rect: { x: 10, y: 20, width: 300, height: 100 } },
    });
    const completed = await store.create({
      text: 'ملاحظة منتهية',
      target: { kind: 'area', slide: 2, rect: { x: 0, y: 0, width: 100, height: 100 } },
    });
    await store.done(completed.id);
    store.close();

    const listed = cli(['notes', 'list', path]);
    expect(listed.code).toBe(0);
    expect(JSON.parse(listed.stdout).notes.map((note: { id: string }) => note.id)).toEqual([open.id]);
    const all = cli(['notes', 'list', path, '--all']);
    expect(all.code).toBe(0);
    expect(JSON.parse(all.stdout).notes).toHaveLength(2);

    const done = cli(['notes', 'done', path, open.id]);
    expect(done.code).toBe(0);
    expect(JSON.parse(done.stdout).note).toMatchObject({ id: open.id, status: 'done' });
    expect(readFileSync(path).equals(before)).toBe(true);
    expect(cli(['notes', 'done', path, 'note_missing']).code).toBe(1);
  });
});

describe('nm-studio export', () => {
  (haveAttention ? it : it.skip)('writes one self-contained HTML, prints the manifest and the font warnings, and never touches the deck', () => {
    const { dir, path } = tempCopyDeck(ATTENTION);
    const before = readFileSync(path);
    const out = join(dir, 'portable.html');
    const r = cli(['export', path, '--format', 'html', '--out', out]);
    expect(r.code).toBe(0);
    const summary = JSON.parse(r.stdout);
    expect(summary).toMatchObject({ format: 'html', slides: 7, experimental: false, remote: [] });
    expect(summary.warnings.length).toBeGreaterThan(0);
    expect(r.stderr).toMatch(/does not grant redistribution rights/);
    expect(readFileSync(out, 'utf8')).not.toMatch(/src=["']assets\//);
    expect(readFileSync(path).equals(before)).toBe(true);
  });

  it('needs a known --format and an explicit --out, and says why a deck cannot be made portable', () => {
    const { dir, path } = tempCopyDeck(MINIMAL);
    expect(cli(['export', path, '--format', 'docx', '--out', join(dir, 'x')]).code).toBe(1);
    const noOut = cli(['export', path, '--format', 'html']);
    expect(noOut.code).toBe(1);
    expect(noOut.stderr).toMatch(/--out/);
    writeFileSync(path, '<html><body><section class="slide"><img src="https://example.com/a.png"></section></body></html>');
    const remote = cli(['export', path, '--format', 'html', '--out', join(dir, 'x.html')]);
    expect(remote.code).toBe(1);
    expect(remote.stderr).toMatch(/remote asset/);
    expect(existsSync(join(dir, 'x.html'))).toBe(false);
  });
});
