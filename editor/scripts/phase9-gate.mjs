// Phase 9 gate: real Chrome. Exports the real "attention" deck in every format and proves the artifacts are real:
// the portable HTML renders offline from a directory with no assets/, the PDF has one page per slide, every PNG is
// 1920x1080 and not blank, the PPTX packages open in python-pptx when it is installed, and the deck is untouched.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createChromiumDriver, findChrome } from '../src/export/chromium.ts';
import { ExportService } from '../src/export/service.ts';

const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`);
};

const t0 = Date.now();
const tmpBefore = new Set(readdirSync(tmpdir()));
const root = join(import.meta.dirname, '..');
const work = mkdtempSync(join(tmpdir(), 'nm-phase9-gate-'));
const deckDir = join(work, 'deck');
cpSync(join(root, 'fixtures/real/attention'), deckDir, { recursive: true });
const deckPath = join(deckDir, 'deck.html');
const original = readFileSync(deckPath);
const source = original.toString('utf8');
check('a Chrome or Chromium is available', !!findChrome(), String(findChrome()));

const service = new ExportService(createChromiumDriver());
const artifacts = {};
try {
  for (const format of ['html', 'pdf', 'png', 'pptx', 'pptx-editable']) {
    const t = Date.now();
    artifacts[format] = await service.export({ format, source, deckPath });
    check(`${format} export succeeds`, artifacts[format].data.length > 1000, `${artifacts[format].filename} ${artifacts[format].data.length} bytes, ${((Date.now() - t) / 1000).toFixed(1)} s`);
  }
} finally {
  await service.close();
}
check('the deck file is byte-identical after exporting', readFileSync(deckPath).equals(original));

// Portable HTML: delete assets/, then render it with Chrome from a different directory.
const html = artifacts.html.data.toString('utf8');
check('portable HTML has no deck-relative reference', !/(?:src|href)=["']assets\//.test(html) && !/url\(\s*['"]?assets\//.test(html));
check('portable HTML embeds the fonts and images', (html.match(/data:font\//g) ?? []).length >= 10 && html.includes('data:image/png;base64,'));
rmSync(join(deckDir, 'assets'), { recursive: true, force: true });
const portableDir = mkdtempSync(join(tmpdir(), 'nm-phase9-portable-'));
writeFileSync(join(portableDir, 'portable.html'), html);
const shot = join(portableDir, 'shot.png');
const chrome = spawnSync(findChrome(), ['--headless', '--disable-gpu', '--window-size=1920,1080', '--hide-scrollbars', '--virtual-time-budget=6000', `--user-data-dir=${join(portableDir, 'profile')}`, `--screenshot=${shot}`, `file://${join(portableDir, 'portable.html')}`], { encoding: 'utf8', timeout: 120_000 });
check('Chrome renders the portable HTML with assets/ deleted', chrome.status === 0 && existsSync(shot) && readFileSync(shot).length > 50_000, existsSync(shot) ? `${readFileSync(shot).length} bytes` : 'no screenshot');

// PDF
const pdf = artifacts.pdf.data;
const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
check('PDF starts with %PDF and has one page per slide', pdf.subarray(0, 4).toString() === '%PDF' && pages === artifacts.pdf.slides, `${pages} pages for ${artifacts.pdf.slides} slides`);

// PNG
const zip = artifacts.png.data;
const names = [];
for (let i = 0; ; ) {
  i = zip.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]), i);
  if (i < 0) break;
  const size = zip.readUInt32LE(i + 18);
  const nameLen = zip.readUInt16LE(i + 26);
  const name = zip.subarray(i + 30, i + 30 + nameLen).toString();
  const data = zip.subarray(i + 30 + nameLen, i + 30 + nameLen + size);
  names.push({ name, w: data.readUInt32BE(16), h: data.readUInt32BE(20), size });
  i += 30 + nameLen + size;
}
check('one PNG per slide', names.length === artifacts.png.slides, `${names.length} files`);
check('every PNG is exactly 1920x1080 and not blank', names.every((n) => n.w === 1920 && n.h === 1080 && n.size > 30_000), names.map((n) => n.size).join(','));
check('ZIP files unpack with readable permissions', zip.readUInt32LE(zip.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])) + 38) >>> 16 === 0o100644);

// PPTX
for (const format of ['pptx', 'pptx-editable']) {
  const out = join(work, `${format}.pptx`);
  writeFileSync(out, artifacts[format].data);
  const probe = spawnSync('python3', ['-c', `
import sys
try:
    import pptx
except Exception:
    print('SKIP'); sys.exit(0)
p = pptx.Presentation(sys.argv[1])
texts = 0
pics = 0
for slide in p.slides:
    for sh in slide.shapes:
        if sh.shape_type == 13: pics += 1
        elif sh.has_text_frame and sh.text_frame.text.strip(): texts += 1
print(len(p.slides.__iter__.__self__._sldIdLst), pics, texts)
`, out], { encoding: 'utf8' });
  const [slides, pics, texts] = probe.stdout.trim().split(/\s+/).map(Number);
  if (probe.stdout.trim() === 'SKIP') { console.log(`SKIP  ${format} package check (python-pptx is not installed)`); continue; }
  const ok = probe.status === 0 && slides === 7 && pics === 7 && (format === 'pptx' ? texts === 0 : texts > 20);
  check(`${format} opens in python-pptx with 7 picture slides${format === 'pptx' ? ' and no text boxes' : ' and editable text boxes'}`, ok, probe.stdout.trim() || probe.stderr.trim().split('\n').pop());
}
check('editable PPTX is flagged experimental', artifacts['pptx-editable'].experimental && artifacts['pptx-editable'].data.toString('latin1').includes('nm-editable-experimental'));

// A deck with remote Tailwind and fonts: rendered formats still work (Chrome fetches them), when a network exists.
{
  const online = await fetch('https://cdn.tailwindcss.com', { method: 'HEAD', signal: AbortSignal.timeout(5000) }).then(() => true, () => false);
  if (!online) console.log('SKIP  mechanistic PDF (no network to reach the Tailwind CDN)');
  else {
    const mDir = join(work, 'mechanistic');
    cpSync(join(root, 'fixtures/real/mechanistic'), mDir, { recursive: true });
    const mSource = readFileSync(join(mDir, 'deck.html'), 'utf8');
    const svc = new ExportService(createChromiumDriver());
    try {
      const out = await svc.export({ format: 'pdf', source: mSource, deckPath: join(mDir, 'deck.html') });
      const n = (out.data.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
      check('mechanistic (remote Tailwind and fonts) PDF has one page per slide', n === out.slides && n > 1, `${n} pages for ${out.slides} slides`);
    } finally { await svc.close(); }
  }
}
const leftovers = readdirSync(tmpdir()).filter((n) => (n.startsWith('nm-export-profile-') || /^nm-export-[A-Za-z0-9]{6}$/.test(n)) && !tmpBefore.has(n));
check('no temporary export directories were left behind', leftovers.length === 0, leftovers.join(','));

rmSync(work, { recursive: true, force: true });
rmSync(portableDir, { recursive: true, force: true });
const failed = checks.filter((c) => !c.ok).length;
console.log(`\nPhase 9 gate: ${checks.length - failed}/${checks.length} checks passed in ${((Date.now() - t0) / 1000).toFixed(1)} s.`);
process.exit(failed ? 1 : 0);
