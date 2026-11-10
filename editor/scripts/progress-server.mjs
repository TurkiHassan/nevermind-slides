#!/usr/bin/env node
// Live progress board for the Codex phase run. Read-only: it only reads the driver log, docs/codex-logs and phase reports.
// Usage: node scripts/progress-server.mjs [port]   then open http://127.0.0.1:<port>
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOGS = join(ROOT, 'docs', 'codex-logs');
const DRIVER = join(ROOT, 'docs', 'codex-logs-driver.txt');
const PORT = Number(process.argv[2] || 4321);
const PHASES = [
  ['2b', 'واجهة المحرّر', 'الهيكل، الفهرس، التحديد، اللوحة'],
  ['3', 'تحرير النص والخصائص', 'الكتابة العربية، قرص الحجم، الألوان'],
  ['4', 'ملاحظات للوكيل', 'ملاحظات مثبتة، الإصدار 0.1'],
  ['5', 'التحريك المباشر', 'سحب، تحجيم، أدلة محاذاة'],
  ['6', 'الخصائص والشرائح والصور', 'إضافة شرائح، استبدال الصور'],
  ['7', 'الحركة والهوية وanatomy', 'Morph، التقريب، ألوان الهوية'],
  ['8', 'الذكاء داخل المحرّر', 'طلب تعديل من الوكيل مع فرق قبل/بعد'],
  ['9', 'التصدير', 'PDF، PNG، ملف محمول، PPTX'],
  ['10', 'التصليب والإصدار', 'أداء، إتاحة، توثيق'],
];

const read = (p) => { try { return readFileSync(p, 'utf8'); } catch { return ''; } };
const mtime = (p) => { try { return statSync(p).mtimeMs; } catch { return 0; } };
const tail = (s, n) => s.split('\n').filter((l) => l.trim()).slice(-n).join('\n');

function status() {
  const driver = read(DRIVER);
  const lines = driver.split('\n');
  const files = existsSync(LOGS) ? readdirSync(LOGS) : [];
  const phases = PHASES.map(([id, title, sub]) => {
    const esc = id.replace('.', '\\.');
    let state = 'pending';
    for (const l of lines) {   // events in order: a later resume overrides an earlier stop
      if (new RegExp(`phase ${esc} (started|already implemented)`).test(l)) state = 'running';
      else if (new RegExp(`phase ${esc} gate failed`).test(l)) state = 'fixing';
      else if (new RegExp(`phase ${esc} gate green`).test(l)) state = 'done';
      else if (new RegExp(`(STOP|ESCALATE):.*phase ${esc}\\b`).test(l)) state = 'failed';
    }
    const startLine = lines.find((l) => new RegExp(`phase ${esc} started`).test(l));
    const doneLine = lines.find((l) => new RegExp(`phase ${esc} gate green`).test(l));
    const fixes = files.filter((f) => f.startsWith(`phase-${id}-fix-`) && f.endsWith('.log')).length;
    const report = join(ROOT, 'docs', `phase-${id}-report.md`);
    return { id, title, sub, state, fixes,
      started: startLine?.match(/(\d\d:\d\d)/)?.[1] ?? null,
      finished: doneLine?.match(/(\d\d:\d\d)/)?.[1] ?? null,
      report: existsSync(report) ? `docs/phase-${id}-report.md` : null };
  });
  const active = phases.find((p) => p.state === 'running' || p.state === 'fixing');
  let activity = '', activityAt = 0;
  if (active) {
    const logs = files.filter((f) => f.startsWith(`phase-${active.id}`) && f.endsWith('.log'))
      .map((f) => join(LOGS, f)).sort((a, b) => mtime(b) - mtime(a));
    if (logs[0]) { activity = tail(read(logs[0]).replace(/\x1b\[[0-9;]*m/g, ''), 14); activityAt = mtime(logs[0]); }
  }
  const gates = files.filter((f) => /-gate-\d+\.txt$/.test(f)).map((f) => join(LOGS, f)).sort((a, b) => mtime(b) - mtime(a));
  const lastGate = gates[0] ? { file: gates[0].slice(ROOT.length + 1), tail: tail(read(gates[0]), 6) } : null;
  return { phases, driver: tail(driver, 8), activity, activityAt, lastGate,
    finished: /all phases done/.test(driver), stopped: /STOP:|ESCALATE:/.test(lines.filter(Boolean).slice(-1)[0] || ''), now: Date.now() };
}

const PAGE = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>سير العمل · Codex</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
@font-face{font-family:TS;src:url('/font/thmanyahsans-Regular.otf')}@font-face{font-family:TS;src:url('/font/thmanyahsans-Bold.otf');font-weight:700}
@font-face{font-family:TD;src:url('/font/thmanyahserifdisplay-Black.otf');font-weight:900}
:root{--m:#e6e2dc;--hi:#fff;--lo:rgba(163,155,143,.55);--ink:#27241f;--ink3:#5c564c;--verm:#d63f22;--ok:#2f7d4f;--warn:#a35a12}
*{box-sizing:border-box;margin:0}body{background:var(--m);color:var(--ink);font-family:TS,system-ui,sans-serif;padding:28px 16px;font-size:15px}
.wrap{max-width:1080px;margin:auto;display:grid;gap:20px}
h1{font-family:TD;font-weight:900;font-size:30px}.sub{color:var(--ink3);margin-top:4px}
.raised{background:var(--m);box-shadow:-6px -6px 14px var(--hi),6px 6px 14px var(--lo);border-radius:24px}
.pressed{background:var(--m);box-shadow:inset 4px 4px 9px var(--lo),inset -4px -4px 9px var(--hi);border-radius:16px}
.top{display:flex;gap:16px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:20px 22px}
.bar{height:14px;flex:1;min-width:220px;position:relative;overflow:hidden}
.fill{position:absolute;inset-block:3px;right:3px;border-radius:6px;background:linear-gradient(to left,#4cc9f0,#a8d98a 60%,#ff8a4c);transition:width .6s}
.big{font-size:28px;font-weight:700;font-variant-numeric:tabular-nums}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:16px}
.ph{padding:16px 18px;display:grid;gap:6px;min-height:118px}
.ph .n{font-family:TD;font-weight:900;font-size:22px;color:var(--ink3)}
.ph b{font-size:16px}.ph small{color:var(--ink3);font-size:13px}
.st{font-size:13px;font-weight:700;display:flex;gap:6px;align-items:center}
.st i{width:9px;height:9px;border-radius:50%;background:#b5ada0}
.done .st{color:var(--ok)}.done .st i{background:var(--ok)}
.running .st,.fixing .st{color:var(--verm)}.running .st i,.fixing .st i{background:var(--verm);animation:p 1.2s ease-in-out infinite}
.failed .st{color:#9b1c0e}.failed .st i{background:#9b1c0e}
.running,.fixing{box-shadow:inset 4px 4px 9px var(--lo),inset -4px -4px 9px var(--hi);outline:2px solid rgba(214,63,34,.5);outline-offset:-4px}
@keyframes p{50%{opacity:.3}}@media (prefers-reduced-motion:reduce){.running .st i,.fixing .st i{animation:none}.fill{transition:none}}
pre{white-space:pre-wrap;word-break:break-word;direction:ltr;text-align:left;font:12.5px/1.55 ui-monospace,Menlo,monospace;color:#3b372f;padding:14px 16px;max-height:300px;overflow:auto}
h2{font-size:15px;margin:0 6px 8px}.meta{color:var(--ink3);font-size:13px}
</style></head><body><div class="wrap">
<div><h1>استوديو نيفرمايند · سير العمل</h1><div class="sub">Codex ينفّذ المراحل، وبوابة اختبار بعد كل مرحلة. تتحدث الصفحة كل ٥ ثوانٍ.</div></div>
<div class="raised top"><div><div class="meta" id="state">…</div><div class="big" id="count">٠ / ٩</div></div><div class="bar pressed"><span class="fill" id="fill" style="width:0"></span></div></div>
<div class="grid" id="grid"></div>
<div><h2>ما يفعله Codex الآن <span class="meta" id="ago"></span></h2><pre class="pressed" id="act">لا نشاط بعد</pre></div>
<div><h2>آخر بوابة اختبار <span class="meta" id="gf"></span></h2><pre class="pressed" id="gate">لم تُشغَّل بعد</pre></div>
<div><h2>سجل المشغّل</h2><pre class="pressed" id="drv"></pre></div>
</div><script>
const AR=n=>String(n).replace(/\\d/g,d=>'٠١٢٣٤٥٦٧٨٩'[d]);
const LABEL={pending:'بانتظار دوره',running:'قيد التنفيذ',fixing:'يصلح بعد فشل البوابة',done:'اكتملت، البوابة خضراء',failed:'توقفت: البوابة فشلت، صُعِّدت للمراجعة'};
async function tick(){try{const s=await (await fetch('/status')).json();
 const done=s.phases.filter(p=>p.state==='done').length;
 document.getElementById('count').textContent=AR(done)+' / '+AR(s.phases.length)+' مراحل';
 document.getElementById('fill').style.width=(done/s.phases.length*100)+'%';
 document.getElementById('state').textContent=s.finished?'انتهت كل المراحل':s.stopped?'توقف التشغيل، يحتاج مراجعة':'يعمل';
 document.getElementById('grid').innerHTML=s.phases.map(p=>'<div class="ph raised '+p.state+'"><span class="n">'+AR(p.id)+'</span><b>'+p.title+'</b><small>'+p.sub+'</small><span class="st"><i></i>'+LABEL[p.state]+(p.fixes?' · جولات إصلاح '+AR(p.fixes):'')+'</span><small>'+(p.started?'بدأت '+AR(p.started):'')+(p.finished?' · انتهت '+AR(p.finished):'')+(p.report?' · التقرير جاهز':'')+'</small></div>').join('');
 document.getElementById('act').textContent=s.activity||'لا نشاط بعد';
 document.getElementById('ago').textContent=s.activityAt?'· آخر تحديث قبل '+AR(Math.round((s.now-s.activityAt)/1000))+' ث':'';
 document.getElementById('gate').textContent=s.lastGate?s.lastGate.tail:'لم تُشغَّل بعد';
 document.getElementById('gf').textContent=s.lastGate?'· '+s.lastGate.file:'';
 document.getElementById('drv').textContent=s.driver||'';
}catch(e){document.getElementById('state').textContent='انقطع الاتصال بلوحة المتابعة'}}
tick();setInterval(tick,5000);
</script></body></html>`;

const FONTS = join(process.env.HOME || '', '.claude/skills/nevermind-slides/resources/fonts');
createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/status') { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); return res.end(JSON.stringify(status())); }
  if (url.pathname.startsWith('/font/')) {
    const f = url.pathname.slice(6);
    if (!/^[\w.-]+\.otf$/.test(f)) { res.writeHead(404); return res.end(); }
    try { res.writeHead(200, { 'content-type': 'font/otf' }); return res.end(readFileSync(join(FONTS, f))); } catch { res.writeHead(404); return res.end(); }
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(PAGE);
}).listen(PORT, '127.0.0.1', () => console.log(`progress board: http://127.0.0.1:${PORT}`));
