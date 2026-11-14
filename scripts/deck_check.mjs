#!/usr/bin/env node
// Headless-Chrome runtime checks for a Nevermind runtime-v2 deck. Node >= 20, no npm dependencies.
//
//   node deck_check.mjs <deck.html> [--shots DIR] [--slides 1-5] [--out report.json] [--steps]
//
// Drives Chrome over the DevTools protocol with Node's built-in WebSocket (Node 22, or Node 20.10+
// re-launched with --experimental-websocket). Per slide it goes through every step with ?nm-speed=0,
// waits for NM.test.settle(), then reports: console errors, elements leaving the 1920x1080 stage,
// clipped text, overlapping text, small text, low contrast, broken images, missing fonts, leftover
// morph ghosts and unreachable steps. Writes a JSON report, one PNG per slide and a contact sheet.
//
// Exit codes: 0 clean, 1 problems found, 2 Node/Chrome unavailable.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

if (typeof WebSocket === "undefined" && !process.execArgv.includes("--experimental-websocket")) {
  const child = spawn(process.execPath, ["--experimental-websocket", ...process.argv.slice(1)], { stdio: "inherit" });
  child.on("error", () => process.exit(2));
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  await main();
}

function usage() {
  console.log(`Check a runtime-v2 deck in headless Chrome.

  node deck_check.mjs <deck.html> [options]

  --shots <dir>     screenshots + contact sheet (default: <deck dir>/check-shots)
  --slides <spec>   slides to check, 1-based: 3, 1-5 or 2,4,7 (default: all)
  --out <json>      JSON report (default: <shots>/report.json)
  --steps           also save a screenshot after every step
  --help            this text

Exit codes: 0 clean, 1 problems found, 2 Node or Chrome unavailable.`);
}

function parse(argv) {
  const o = { steps: false };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === "--shots") o.shots = next();
    else if (a === "--slides") o.slides = next();
    else if (a === "--out") o.out = next();
    else if (a === "--steps") o.steps = true;
    else if (a === "--help" || a === "-h") o.help = true;
    else rest.push(a);
  }
  o.target = rest[0];
  return o;
}

function parseSlides(spec, total) {
  if (!spec) return Array.from({ length: total }, (_, i) => i);
  const picked = new Set();
  for (const part of spec.split(",")) {
    const m = part.trim().match(/^(\d+)(?:-(\d+))?$/);
    if (!m) continue;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let n = Math.min(a, b); n <= Math.max(a, b); n++) if (n >= 1 && n <= total) picked.add(n - 1);
  }
  return [...picked].sort((x, y) => x - y);
}

function findChrome() {
  const out = [];
  const add = (p) => p && out.push(p);
  add(process.env.CHROME_PATH);
  for (const base of ["/opt/pw-browsers", join(homedir(), ".cache/ms-playwright"), join(homedir(), "Library/Caches/ms-playwright"), join(homedir(), "AppData/Local/ms-playwright")]) {
    if (!existsSync(base)) continue;
    for (const dir of readdirSync(base).sort().reverse()) {
      if (!/^chromium(-\d+)?$/.test(dir)) continue;
      for (const sub of ["chrome-linux64/chrome", "chrome-linux/chrome", "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing", "chrome-mac/Chromium.app/Contents/MacOS/Chromium", "chrome-win/chrome.exe", "chrome-win64/chrome.exe", "chrome"]) add(join(base, dir, sub));
    }
  }
  for (const p of [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser",
    "/snap/bin/chromium",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ]) add(p);
  if (process.env.LOCALAPPDATA) add(join(process.env.LOCALAPPDATA, "Google\\Chrome\\Application\\chrome.exe"));
  const found = out.find((p) => existsSync(p));
  if (found) return found;
  return null;
}

async function whichChrome() {
  const direct = findChrome();
  if (direct) return direct;
  const finder = process.platform === "win32" ? "where" : "which";
  for (const name of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "chrome", "msedge"]) {
    const found = await new Promise((done) => {
      const p = spawn(finder, [name]);
      let text = "";
      p.stdout.on("data", (c) => (text += c));
      p.on("error", () => done(null));
      p.on("exit", (code) => done(code === 0 ? text.split(/\r?\n/)[0].trim() : null));
    });
    if (found && existsSync(found)) return found;
  }
  return null;
}

function chromePort(chrome) {
  return new Promise((done, fail) => {
    let text = "";
    const timer = setTimeout(() => fail(new Error("Chrome did not start within 20 s")), 20000);
    chrome.stderr.on("data", (chunk) => {
      text += chunk;
      const m = text.match(/DevTools listening on ws:\/\/[^:]+:(\d+)\//);
      if (m) {
        clearTimeout(timer);
        done(Number(m[1]));
      }
    });
    chrome.on("error", (e) => {
      clearTimeout(timer);
      fail(e);
    });
    chrome.on("exit", (code, signal) => {
      clearTimeout(timer);
      fail(new Error(`Chrome exited before startup: ${code ?? signal}`));
    });
  });
}

// ---------------------------------------------------------------------------------------------
// In-page code (serialised with Function.prototype.toString, so it must not reference Node scope)
// ---------------------------------------------------------------------------------------------

/* eslint-disable */
function pageInspect(idx) {
  const slides = Array.from(document.querySelectorAll(".slide"));
  const slide = slides[idx];
  const issues = [];
  const stageEl = document.getElementById("deckStage") || slide.parentElement;
  const sr = stageEl.getBoundingClientRect();
  const scale = sr.width / 1920 || 1;
  const toStage = (r) => ({ x: (r.left - sr.left) / scale, y: (r.top - sr.top) / scale, w: r.width / scale, h: r.height / scale });
  const rectOf = (el) => {
    try {
      if (window.NM && NM.geom && NM.geom.rectInStage) {
        const r = NM.geom.rectInStage(el);
        if (r && Number.isFinite(r.w)) return r;
      }
    } catch (e) {}
    return toStage(el.getBoundingClientRect());
  };
  const sel = (el) => {
    const parts = [];
    let n = el;
    for (let d = 0; n && n !== slide && d < 3; d++, n = n.parentElement) {
      let s = n.tagName.toLowerCase();
      if (n.id) s += "#" + n.id;
      else if (n.classList.length) s += "." + Array.from(n.classList).slice(0, 2).join(".");
      parts.unshift(s);
    }
    return parts.join(" > ");
  };
  const add = (code, el, message, severity = "error") => issues.push({ code, severity, message, selector: el ? sel(el) : "" });
  const short = (t) => (t || "").replace(/\s+/g, " ").trim().slice(0, 40);

  const cs = (el) => getComputedStyle(el);
  const shown = (el) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const s = cs(n);
      if (s.display === "none" || s.visibility === "hidden") return false;
      if (n !== slide && parseFloat(s.opacity) < 0.05) return false;
      if (n === slide) break;
    }
    return true;
  };
  const decor = (el) => !!el.closest('[aria-hidden="true"], .nm-bleed, [data-decor], template, script, style, aside.nm-speaker-note');
  const inSvg = (el) => !!el.closest("svg") && el.tagName.toLowerCase() !== "svg";
  const all = Array.from(slide.querySelectorAll("*")).filter((el) => !["SCRIPT", "STYLE", "TEMPLATE", "TITLE"].includes(el.tagName) && shown(el));

  // clip chain
  const visibleRect = (el, r) => {
    let x1 = r.x, y1 = r.y, x2 = r.x + r.w, y2 = r.y + r.h;
    for (let n = el.parentElement; n && n !== slide; n = n.parentElement) {
      const s = cs(n);
      if (/(hidden|clip|auto|scroll)/.test(s.overflowX + s.overflowY)) {
        const p = rectOf(n);
        x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); x2 = Math.min(x2, p.x + p.w); y2 = Math.min(y2, p.y + p.h);
      }
    }
    return { x1, y1, x2, y2 };
  };

  // 1. out of stage
  const offending = new Set();
  for (const el of all) {
    if (decor(el) || inSvg(el)) continue;
    const r = rectOf(el);
    if (r.w <= 0 || r.h <= 0) continue;
    const v = visibleRect(el, r);
    if (v.x2 <= v.x1 || v.y2 <= v.y1) continue;
    if (v.x1 < -2 || v.y1 < -2 || v.x2 > 1922 || v.y2 > 1082) {
      if (el.parentElement && offending.has(el.parentElement)) continue;
      offending.add(el);
      add("C-OUT", el, `leaves the 1920x1080 stage (x ${Math.round(v.x1)}..${Math.round(v.x2)}, y ${Math.round(v.y1)}..${Math.round(v.y2)}); shrink or move it, or mark decoration aria-hidden`);
    }
  }

  // text blocks
  const texts = [];
  for (const el of all) {
    if (inSvg(el) || decor(el)) continue;
    const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own.length) continue;
    const range = document.createRange();
    let box = null;
    for (const n of own) {
      range.selectNodeContents(n);
      for (const rc of range.getClientRects()) {
        if (rc.width < 1 || rc.height < 1) continue;
        box = box ? { left: Math.min(box.left, rc.left), top: Math.min(box.top, rc.top), right: Math.max(box.right, rc.right), bottom: Math.max(box.bottom, rc.bottom) } : { left: rc.left, top: rc.top, right: rc.right, bottom: rc.bottom };
      }
    }
    if (!box) continue;
    texts.push({ el, client: box, rect: toStage({ left: box.left, top: box.top, width: box.right - box.left, height: box.bottom - box.top }), text: short(own.map((n) => n.textContent).join(" ")) });
  }

  // 2. clipped text
  const clipped = new Set();
  for (const t of texts) {
    const s = cs(t.el);
    if (/(hidden|clip|auto|scroll)/.test(s.overflowX + s.overflowY) && (t.el.scrollWidth > t.el.clientWidth + 1 || t.el.scrollHeight > t.el.clientHeight + 1)) {
      clipped.add(t.el);
      add("C-CLIP", t.el, `text "${t.text}" is clipped by its box (content ${t.el.scrollWidth}x${t.el.scrollHeight}, box ${t.el.clientWidth}x${t.el.clientHeight}); shorten the text or enlarge the box`);
      continue;
    }
    for (let n = t.el.parentElement; n && n !== slide; n = n.parentElement) {
      const sn = cs(n);
      if (/(hidden|clip)/.test(sn.overflowX + sn.overflowY)) {
        const p = rectOf(n);
        const r = t.rect;
        if (r.x < p.x - 2 || r.y < p.y - 2 || r.x + r.w > p.x + p.w + 2 || r.y + r.h > p.y + p.h + 2) {
          if (!clipped.has(t.el)) {
            clipped.add(t.el);
            add("C-CLIP", t.el, `text "${t.text}" is cut off by its container ${sel(n)}; shorten the text or enlarge the container`);
          }
          break;
        }
      }
    }
  }

  // 3. overlapping text
  let overlaps = 0;
  const absDecor = (el) => {
    for (let n = el; n && n !== slide; n = n.parentElement) {
      const p = cs(n).position;
      if ((p === "absolute" || p === "fixed") && n.matches('[aria-hidden="true"], .nm-bleed, [data-decor]')) return true;
    }
    return false;
  };
  for (let i = 0; i < texts.length && overlaps < 5; i++) {
    for (let j = i + 1; j < texts.length && overlaps < 5; j++) {
      const a = texts[i], b = texts[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      if (absDecor(a.el) || absDecor(b.el)) continue;
      const dx = Math.min(a.rect.x + a.rect.w, b.rect.x + b.rect.w) - Math.max(a.rect.x, b.rect.x);
      const dy = Math.min(a.rect.y + a.rect.h, b.rect.y + b.rect.h) - Math.max(a.rect.y, b.rect.y);
      if (dx > 8 && dy > 8) {
        overlaps++;
        add("C-OVERLAP", a.el, `text "${a.text}" overlaps "${b.text}" (${Math.round(dx)}x${Math.round(dy)}px); separate them or shorten the text`);
      }
    }
  }

  // 4. small text
  let small = 0;
  for (const t of texts) {
    if (small >= 6) break;
    if (t.el.closest(".nm-caption, .nm-t-caption, figcaption, [data-nm-small]")) continue;
    const fs = parseFloat(cs(t.el).fontSize);
    if (fs < 22) {
      small++;
      add("C-SMALL", t.el, `text "${t.text}" is ${fs.toFixed(0)}px; body text must be at least 22px on the 1920x1080 stage`);
    }
  }

  // 5. contrast
  const parseColor = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(parseFloat);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  let low = 0;
  for (const t of texts) {
    if (low >= 6) break;
    const el = t.el;
    const style = cs(el);
    let fg = parseColor(style.color);
    if (!fg) continue;
    let op = 1;
    const layers = [];
    let skip = false;
    for (let n = el; n; n = n.parentElement) {
      const s = cs(n);
      op *= parseFloat(s.opacity);
      if (s.backgroundImage !== "none") { skip = true; break; }
      const bg = parseColor(s.backgroundColor);
      if (bg && bg.a > 0) {
        layers.push(bg);
        if (bg.a >= 0.99) break;
      }
      if (n === document.documentElement) break;
    }
    if (skip) continue;
    const cx = (t.client.left + t.client.right) / 2, cy = (t.client.top + t.client.bottom) / 2;
    const stack = document.elementsFromPoint(cx, cy);
    const at = stack.findIndex((n) => el === n || el.contains(n) || n.contains(el) && n === el);
    const below = at >= 0 ? stack.slice(at + 1) : stack;
    if (below.some((n) => ["IMG", "VIDEO", "CANVAS"].includes(n.tagName) || (n !== document.documentElement && n !== document.body && cs(n).backgroundImage !== "none"))) continue;
    let bgc = layers.length && layers[layers.length - 1].a >= 0.99 ? { ...layers[layers.length - 1] } : { r: 255, g: 255, b: 255, a: 1 };
    const start = layers.length && layers[layers.length - 1].a >= 0.99 ? layers.length - 2 : layers.length - 1;
    for (let k = start; k >= 0; k--) {
      const l = layers[k];
      bgc = { r: l.r * l.a + bgc.r * (1 - l.a), g: l.g * l.a + bgc.g * (1 - l.a), b: l.b * l.a + bgc.b * (1 - l.a), a: 1 };
    }
    const a = fg.a * op;
    const fgc = { r: fg.r * a + bgc.r * (1 - a), g: fg.g * a + bgc.g * (1 - a), b: fg.b * a + bgc.b * (1 - a) };
    const L1 = lum(fgc), L2 = lum(bgc);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const fs = parseFloat(style.fontSize);
    const need = fs >= 32 ? 3 : 4.5;
    if (ratio < need) {
      low++;
      add("C-CONTRAST", el, `text "${t.text}" has contrast ${ratio.toFixed(2)}:1 (need ${need}:1); change the text or background color`);
    }
  }

  // 6. images
  for (const img of slide.querySelectorAll("img")) {
    if (!shown(img)) continue;
    if (!img.complete || img.naturalWidth === 0) add("C-IMG", img, `image failed to load: ${(img.getAttribute("src") || "").slice(0, 80)}; fix the path or save the file`);
  }

  // 7. ghosts
  const ghost = document.getElementById("nmGhostLayer");
  const ghosts = ghost ? ghost.children.length : 0;
  if (ghosts) add("C-GHOST", ghost, `${ghosts} morph ghost element(s) left in #nmGhostLayer after the transition settled`);

  return issues;
}

function pageSteps(idx) {
  const slides = Array.from(document.querySelectorAll(".slide"));
  const slide = slides[idx];
  const map = {};
  for (const el of slide.querySelectorAll("[data-step], [data-zoom-step]")) {
    const n = parseInt(el.getAttribute("data-step") || el.getAttribute("data-zoom-step"), 10);
    if (!Number.isFinite(n)) continue;
    const act = el.getAttribute("data-step") ? el.getAttribute("data-act") || "reveal" : "zoom";
    (map[n] ||= []).push(act);
  }
  return {
    title: slide.getAttribute("data-title") || "",
    id: slide.id || "",
    steps: Object.keys(map).map(Number).sort((a, b) => a - b).map((n) => ({ n, acts: map[n] })),
  };
}

async function pageFonts() {
  const cs = getComputedStyle(document.body);
  const strip = (s) => s.trim().replace(/^['"]|['"]$/g, "");
  const fams = ["--nm-font-display", "--nm-font-body"].map((v) => strip(cs.getPropertyValue(v).split(",")[0] || "")).filter(Boolean);
  const out = [];
  for (const f of [...new Set(fams)]) {
    try {
      await document.fonts.load(`700 40px "${f}"`, "ابت");
      await document.fonts.load(`400 24px "${f}"`, "ابت");
    } catch (e) {}
    const faces = [...document.fonts].filter((ff) => strip(ff.family) === f);
    out.push({ family: f, declared: faces.length, loaded: faces.filter((x) => x.status === "loaded").length });
  }
  const errored = [...document.fonts].filter((ff) => ff.status === "error").map((ff) => strip(ff.family));
  return { families: out, errored: [...new Set(errored)] };
}
/* eslint-enable */

// ---------------------------------------------------------------------------------------------

async function main() {
  const o = parse(process.argv.slice(2));
  if (o.help || !o.target) {
    usage();
    process.exit(o.help ? 0 : 1);
  }
  const deck = resolve(o.target);
  if (!existsSync(deck)) {
    console.error(`deck_check: file not found: ${deck}`);
    process.exit(1);
  }
  const binary = await whichChrome();
  if (!binary) {
    console.error("deck_check: no Chrome or Chromium found. Install Chrome, or set CHROME_PATH to its binary. The deck is unaffected; audit-deck does not need Chrome.");
    process.exit(2);
  }
  const shots = resolve(o.shots ?? join(dirname(deck), "check-shots"));
  mkdirSync(shots, { recursive: true });
  const outJson = resolve(o.out ?? join(shots, "report.json"));

  const profile = mkdtempSync(join(tmpdir(), "nm-check-"));
  let chrome;
  const finish = (code) => {
    try { chrome?.kill("SIGKILL"); } catch {}
    try { rmSync(profile, { recursive: true, force: true }); } catch {}
    process.exit(code);
  };
  try {
    chrome = spawn(binary, [
      "--headless=new", ...(process.platform === "linux" ? ["--no-sandbox"] : []), ...(process.platform === "win32" ? ["--do-not-de-elevate"] : []),
      "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "--hide-scrollbars",
      "--allow-file-access-from-files", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--force-device-scale-factor=1", "--window-size=1920,1080", "about:blank",
    ]);
    const port = await chromePort(chrome);
    const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    let nextId = 0;
    const pending = new Map();
    const consoleLog = [];
    let current = -1;
    let onLoad = () => {};
    socket.onmessage = (m) => {
      const d = JSON.parse(m.data);
      if (d.id && pending.has(d.id)) {
        pending.get(d.id)(d);
        pending.delete(d.id);
      } else if (d.method === "Page.loadEventFired") onLoad();
      else if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") {
        consoleLog.push({ slide: current, kind: "console", text: d.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 300) });
      } else if (d.method === "Runtime.exceptionThrown") {
        const x = d.params.exceptionDetails;
        consoleLog.push({ slide: current, kind: "exception", text: (x.exception?.description ?? x.text ?? "").split("\n")[0].slice(0, 300) });
      } else if (d.method === "Log.entryAdded" && d.params.entry.level === "error") {
        const e = d.params.entry;
        consoleLog.push({ slide: current, kind: e.source === "network" ? "network" : "log", text: `${e.text}${e.url ? " " + e.url : ""}`.slice(0, 300), url: e.url || "" });
      }
    };
    await new Promise((done, fail) => { socket.onopen = done; socket.onerror = () => fail(new Error("DevTools socket failed")); });
    const send = (method, params = {}) =>
      new Promise((done, fail) => {
        const id = ++nextId;
        const timer = setTimeout(() => { pending.delete(id); fail(new Error(`Chrome did not answer ${method} within 60 s`)); }, 60000);
        pending.set(id, (d) => { clearTimeout(timer); done(d); });
        socket.send(JSON.stringify({ id, method, params }));
      });
    const evaluate = async (expression) => {
      const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text);
      return r.result?.result?.value;
    };
    const sleep = (ms) => new Promise((d) => setTimeout(d, ms));
    const shot = async (file) => {
      const r = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: 1920, height: 1080, scale: 1 } });
      writeFileSync(join(shots, file), Buffer.from(r.result.data, "base64"));
    };

    await send("Runtime.enable");
    await send("Page.enable");
    await send("Log.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });

    const load = new Promise((done) => { onLoad = done; setTimeout(done, 15000); });
    const url = pathToFileURL(deck).href + "?nm-speed=0";
    const nav = await send("Page.navigate", { url });
    if (nav.result?.errorText) throw new Error(`Navigation failed: ${nav.result.errorText}`);
    await load;

    // wait for the runtime
    let hasNM = false;
    for (let t = 0; t < 60; t++) {
      hasNM = await evaluate("!!(window.NM && NM.deck && NM.deck.slides && NM.deck.slides.length)");
      if (hasNM) break;
      await sleep(150);
    }
    const settle = async () => {
      if (hasNM) await evaluate("(window.NM && NM.test && NM.test.settle) ? NM.test.settle().then(()=>1) : new Promise(r=>setTimeout(r,60))");
      else await sleep(60);
      await evaluate("document.fonts ? document.fonts.ready.then(()=>1) : 1");
    };
    if (hasNM) await settle();

    const total = await evaluate("document.querySelectorAll('.slide').length");
    const deckProblems = [];
    if (!hasNM) deckProblems.push({ code: "C-RUNTIME", severity: "warn", message: "window.NM not found (not a runtime v2 deck or nm-deck.js failed to load); checking static layout only, steps are not walked" });
    const mode = hasNM ? await evaluate("NM.deck.mode || document.body.getAttribute('data-nm-mode') || 'morph-and-zoom'") : "classic";

    const fonts = await evaluate(`(${pageFonts.toString()})()`);
    for (const f of fonts.families) {
      if (!f.declared) deckProblems.push({ code: "C-FONT", severity: "error", message: `font "${f.family}" has no @font-face; stage fonts and check the --nm-font-* tokens` });
      else if (!f.loaded) deckProblems.push({ code: "C-FONT", severity: "error", message: `font "${f.family}" did not load; check assets/fonts/ and the @font-face url` });
    }
    for (const fam of fonts.errored) deckProblems.push({ code: "C-FONT", severity: "error", message: `font face "${fam}" failed to load` });

    const wanted = parseSlides(o.slides, total);
    const reports = [];
    for (const idx of wanted) {
      current = idx;
      if (hasNM) await evaluate(`(async()=>{ const r = NM.deck.go(${idx}); if (r && r.then) await r; return 1; })()`);
      else await evaluate(`(()=>{ document.querySelectorAll('.slide').forEach((s,i)=>{ s.classList.toggle('active', i===${idx}); s.classList.toggle('visible', i===${idx}); }); return 1; })()`);
      await settle();
      const info = await evaluate(`(${pageSteps.toString()})(${idx})`);
      // Skipped by arrows outside morph-and-zoom: zoom steps.
      const walkable = info.steps.filter((s) => mode === "morph-and-zoom" || !s.acts.every((a) => a === "zoom"));
      const transient = new Set(["zoom", "highlight", "focus", "detail", "lens", "pins", "slice"]);
      let lastFull = 0;
      walkable.forEach((s, k) => { if (!s.acts.every((a) => transient.has(a))) lastFull = k + 1; });

      const issues = [];
      let measured = false;
      const measure = async (stepNo) => {
        await evaluate(`Promise.all(Array.from(document.querySelectorAll('.slide')[${idx}].querySelectorAll('img')).map(i=>i.complete?1:new Promise(r=>{i.onload=i.onerror=r;setTimeout(r,3000)}))).then(()=>1)`);
        issues.push(...(await evaluate(`(${pageInspect.toString()})(${idx})`)));
        await shot(`s${String(idx + 1).padStart(2, "0")}.png`);
        measured = true;
      };
      if (lastFull === 0) await measure(0);
      let reached = 0;
      if (hasNM) {
        for (let k = 1; k <= walkable.length + 1; k++) {
          const before = await evaluate("({i: NM.deck.index, s: NM.deck.stepIndex})");
          await evaluate("(async()=>{ const r = NM.deck.next(); if (r && r.then) await r; return 1; })()");
          await settle();
          const after = await evaluate("({i: NM.deck.index, s: NM.deck.stepIndex})");
          if (after.i !== before.i || after.s === before.s) break;
          reached++;
          if (o.steps) await shot(`s${String(idx + 1).padStart(2, "0")}-step${reached}.png`);
          if (!measured && reached === lastFull) await measure(reached);
          if (reached >= walkable.length && k > walkable.length) break;
        }
        // the probe above may have left the slide; make the slide the current one again for the next loop
      }
      if (!measured) await measure(reached);
      if (hasNM && reached < walkable.length) {
        issues.push({ code: "C-STEPS", severity: "error", message: `${walkable.length} step(s) declared but only ${reached} reachable with the arrow keys; check data-step numbering (1..N) and data-act values`, selector: "" });
      } else if (hasNM && reached > walkable.length) {
        issues.push({ code: "C-STEPS", severity: "warn", message: `${walkable.length} step(s) declared but ${reached} reachable; an act (for example detail with several pages) adds extra steps`, selector: "" });
      }
      const slideConsole = consoleLog.filter((c) => c.slide === idx);
      for (const c of slideConsole) {
        const external = c.kind === "network" && /^https?:/.test(c.url || "");
        issues.push({ code: "C-CONSOLE", severity: external ? "warn" : "error", message: `${c.kind}: ${c.text}${external ? " (external resource; ignore when offline)" : ""}`, selector: "" });
      }
      reports.push({ slide: idx + 1, id: info.id, title: info.title, steps: { declared: walkable.length, reachable: reached }, issues });
    }
    // console messages produced before the first slide (page load)
    for (const c of consoleLog.filter((c) => c.slide === -1)) {
      const external = c.kind === "network" && /^https?:/.test(c.url || "");
      deckProblems.push({ code: "C-CONSOLE", severity: external ? "warn" : "error", message: `${c.kind}: ${c.text}${external ? " (external resource; ignore when offline)" : ""}` });
    }

    // contact sheet
    let sheet = null;
    try {
      const cells = reports.map((r) => {
        const file = `s${String(r.slide).padStart(2, "0")}.png`;
        const errs = r.issues.filter((i) => i.severity === "error").length;
        return `<figure class="${errs ? "bad" : ""}"><img src="${file}"><figcaption>${r.slide}. ${(r.title || r.id || "").replace(/[<&]/g, "")} ${errs ? `(${errs} problem${errs > 1 ? "s" : ""})` : ""}</figcaption></figure>`;
      }).join("");
      const sheetHtml = `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:24px;background:#1b1b1f;color:#eee;font:22px/1.3 sans-serif;display:grid;grid-template-columns:repeat(4,1fr);gap:20px;width:1872px}figure{margin:0}img{width:100%;display:block;border:3px solid #444}.bad img{border-color:#e5484d}figcaption{padding:6px 2px;direction:rtl;text-align:right}</style>${cells}`;
      const sheetHtmlPath = join(shots, "contact-sheet.html");
      writeFileSync(sheetHtmlPath, sheetHtml);
      const loaded = new Promise((done) => { onLoad = done; setTimeout(done, 15000); });
      await send("Page.navigate", { url: pathToFileURL(sheetHtmlPath).href });
      await loaded;
      await sleep(200);
      const h = Math.min(16000, Math.ceil(await evaluate("document.body.offsetHeight")));
      await send("Emulation.setDeviceMetricsOverride", { width: 1920, height: h, deviceScaleFactor: 1, mobile: false });
      const r = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: 1920, height: h, scale: 1 } });
      sheet = join(shots, "contact-sheet.png");
      writeFileSync(sheet, Buffer.from(r.result.data, "base64"));
      rmSync(sheetHtmlPath, { force: true });
    } catch (e) {
      deckProblems.push({ code: "C-SHEET", severity: "warn", message: `contact sheet failed: ${e.message}` });
    }

    const errorCount = reports.reduce((n, r) => n + r.issues.filter((i) => i.severity === "error").length, 0) + deckProblems.filter((i) => i.severity === "error").length;
    const warnCount = reports.reduce((n, r) => n + r.issues.filter((i) => i.severity === "warn").length, 0) + deckProblems.filter((i) => i.severity === "warn").length;
    const report = { passed: errorCount === 0, html_path: deck, mode, runtime: hasNM ? "nm-v2" : "none", total_slides: total, checked: wanted.map((i) => i + 1), errors: errorCount, warnings: warnCount, deck: deckProblems, slides: reports, shots_dir: shots, contact_sheet: sheet };
    mkdirSync(dirname(outJson), { recursive: true });
    writeFileSync(outJson, JSON.stringify(report, null, 2) + "\n");

    // compact table
    const pad = (s, n) => (String(s) + " ".repeat(n)).slice(0, n);
    console.log(`Deck check ${report.passed ? "PASSED" : "FAILED"}: ${reports.length} slide(s), ${errorCount} error(s), ${warnCount} warning(s)`);
    console.log(`${pad("#", 4)}${pad("id", 8)}${pad("steps", 8)}problems`);
    for (const r of reports) {
      const counts = {};
      for (const i of r.issues) counts[i.code] = (counts[i.code] || 0) + 1;
      const label = Object.entries(counts).map(([k, v]) => (v > 1 ? `${k} x${v}` : k)).join(", ") || "-";
      console.log(`${pad(r.slide, 4)}${pad(r.id, 8)}${pad(`${r.steps.reachable}/${r.steps.declared}`, 8)}${label}`);
    }
    for (const d of deckProblems) console.log(`deck  ${d.severity}  ${d.code}  ${d.message}`);
    for (const r of reports) for (const i of r.issues.slice(0, 8)) console.log(`slide ${r.slide}  ${i.severity}  ${i.code}  ${i.message}${i.selector ? `  [${i.selector}]` : ""}`);
    console.log(`Report: ${outJson}`);
    console.log(`Screenshots: ${shots}${sheet ? `  Contact sheet: ${sheet}` : ""}`);
    finish(report.passed ? 0 : 1);
  } catch (e) {
    console.error(`deck_check: ${e.message}`);
    finish(e.message.includes("Chrome") ? 2 : 1);
  }
}
