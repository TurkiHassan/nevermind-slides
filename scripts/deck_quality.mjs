// Visual quality checks (roadmap NM-05) and the quality report (NM-06) for deck_check.mjs. Node >= 20, no npm
// dependencies.
//
// pageQuality() runs inside the deck page (deck_check injects it with toString), so it must stay self-contained.
// The other functions run in Node.
//
// Codes (warnings unless stated):
//   C-FRAME    error  an iframe or anatomy figure on the slide shows nothing (failed load, empty document)
//   C-ARABIC   error  letter-spacing on Arabic text, or an Arabic word split across elements (letters lose their
//                     joins); warn: Arabic-Indic and Western digits mixed on one slide
//   C-EMPTY           a content slide is almost empty (ink below 4% of the stage; calibrated on the corpus)
//   C-FILL            a diagram or figure draws on less than 45% of the box it is given
//   C-DRIFT           the title of a slide sits more than 8px away from the titles of the other slides with the
//                     same composition (cross-slide, computed in Node)
//   C-BIDI            a Latin or numeric run with neutral punctuation inside Arabic text, not isolated (<bdi> or
//                     dir); punctuation and order can jump
//   C-WIDOW           a title ends with a single word on its last line
//   C-DENSITY         more than 60 words of visible text on one slide (diagram labels excluded)

export const CODES = {
  "C-OUT": { tier: "HOLD", confidence: "confident", fix: "Move or shrink the element so it stays inside 1920x1080, or mark decoration aria-hidden / .nm-bleed." },
  "C-CLIP": { tier: "HOLD", confidence: "confident", fix: "Shorten the text, enlarge its box, or lower the type size one step." },
  "C-OVERLAP": { tier: "FIX", confidence: "likely", fix: "Give the two text blocks their own cells or space them apart." },
  "C-SMALL": { tier: "FIX", confidence: "likely", fix: "Use a larger type class (body text 28px or more on the stage)." },
  "C-CONTRAST": { tier: "FIX", confidence: "likely", fix: "Darken the text or lighten the background (4.5:1, or 3:1 at 32px and above)." },
  "C-IMG": { tier: "HOLD", confidence: "confident", fix: "Fix the image path or save the file under assets/img/." },
  "C-FONT": { tier: "HOLD", confidence: "confident", fix: "Run stage-fonts and check the @font-face urls." },
  "C-GHOST": { tier: "HOLD", confidence: "confident", fix: "A morph did not finish: check the data-morph pairs on this slide and the previous one." },
  "C-STEPS": { tier: "HOLD", confidence: "confident", fix: "Number data-step from 1 and use known data-act values." },
  "C-CONSOLE": { tier: "HOLD", confidence: "confident", fix: "Read the console error; usually a missing file or a script typo." },
  "C-RUNTIME": { tier: "NOTE", confidence: "confident", fix: "Link the runtime (stage-runtime) to check steps and motion." },
  "C-SHEET": { tier: "NOTE", confidence: "confident", fix: "Contact sheet only; the deck is unaffected." },
  "C-FRAME": { tier: "HOLD", confidence: "confident", fix: "The frame shows nothing: build the figure page and check the iframe src (it must stay inside the deck folder)." },
  "C-ARABIC": { tier: "HOLD", confidence: "confident", fix: "Remove letter-spacing from Arabic text and never wrap parts of one Arabic word in separate elements." },
  "C-ARABIC-DIGITS": { tier: "FIX", confidence: "likely", fix: "Use one digit system on the slide (Arabic-Indic or Western)." },
  "C-EMPTY": { tier: "NOTE", confidence: "possible", fix: "Give the slide a visual or merge it with a neighbour; section, quote and closing slides are exempt." },
  "C-FILL": { tier: "NOTE", confidence: "possible", fix: "Let the figure grow into its cell (data-grow on diagrams) or give it a smaller cell." },
  "C-DRIFT": { tier: "FIX", confidence: "likely", fix: "Use the same composition and title classes so titles line up across slides." },
  "C-BIDI": { tier: "FIX", confidence: "likely", fix: "Wrap the Latin or numeric run in <bdi> (or give it dir=\"ltr\")." },
  "C-WIDOW": { tier: "NOTE", confidence: "likely", fix: "Rephrase the title or add text-wrap: balance so the last line holds two words or more." },
  "C-DENSITY": { tier: "NOTE", confidence: "possible", fix: "Move detail to the speaker note, a detail act or the next slide." },
};

// ----------------------------------------------------------------------------------------------- in the page

export async function pageQuality(idx, png) {
  const slides = Array.from(document.querySelectorAll(".slide"));
  const slide = slides[idx];
  const issues = [];
  const stageEl = document.getElementById("deckStage") || slide.parentElement;
  const sr = stageEl.getBoundingClientRect();
  const scale = sr.width / 1920 || 1;
  const rectOf = (el) => {
    try { if (window.NM && NM.geom && NM.geom.rectInStage) { const r = NM.geom.rectInStage(el); if (r && Number.isFinite(r.w)) return r; } } catch (e) {}
    const r = el.getBoundingClientRect();
    return { x: (r.left - sr.left) / scale, y: (r.top - sr.top) / scale, w: r.width / scale, h: r.height / scale };
  };
  const sel = (el) => {
    const parts = [];
    let n = el;
    for (let d = 0; n && n !== slide && d < 3; d++, n = n.parentElement) {
      let s = n.tagName.toLowerCase();
      if (n.id) s += "#" + n.id; else if (n.classList.length) s += "." + Array.from(n.classList).slice(0, 2).join(".");
      parts.unshift(s);
    }
    return parts.join(" > ");
  };
  const add = (code, el, message, severity = "warn", evidence = null) => issues.push({ code, severity, message, selector: el ? sel(el) : "", evidence });
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
  const skip = (el) => !!el.closest('script, style, template, [aria-hidden="true"], aside.nm-speaker-note');
  const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
  const ARABIC_LETTER = /[ء-يٮ-ۓۺ-ۼ]/;
  const role = (slide.getAttribute("data-role") || "").toLowerCase();
  const metrics = { role };

  // text nodes of the slide that are visible
  const texts = [];
  const tw = document.createTreeWalker(slide, NodeFilter.SHOW_TEXT);
  for (let n; (n = tw.nextNode());) {
    if (!n.data.trim() || !n.parentElement || skip(n.parentElement) || !shown(n.parentElement)) continue;
    texts.push(n);
  }

  // C-FRAME: frames and anatomy figures that show nothing
  for (const f of slide.querySelectorAll("iframe")) {
    if (!shown(f)) continue;
    let empty = null, why = "";
    const src = (f.getAttribute("src") || "").trim();
    const local = src !== "" && !/^(https?:|data:|blob:|about:|javascript:)/i.test(src);
    try {
      const d = f.contentDocument;
      // deck_check runs Chrome with --allow-file-access-from-files, so a local page that loaded is readable; an
      // unreadable local frame holds Chrome's error page (missing file or a path outside the deck folder)
      if (!d && local) { empty = true; why = "the page did not load (missing file?)"; }
      else if (d) {
        const b = d.body;
        const href = d.location ? d.location.href : "";
        if (href === "about:blank" && (f.getAttribute("src") || "") !== "about:blank") { empty = true; why = "the page did not load"; }
        else if (!b || (!b.children.length && !b.textContent.trim())) { empty = true; why = "the page is empty"; }
        else empty = false;
      }
    } catch (e) { empty = null; } // cross-origin: cannot tell
    if (empty) add("C-FRAME", f, `frame ${(f.getAttribute("src") || "").slice(0, 80)} shows nothing: ${why}`, "error");
  }
  for (const a of slide.querySelectorAll("svg[data-anatomy], [data-anatomy] > svg")) {
    if (!shown(a) || a.closest("iframe")) continue;
    const r = rectOf(a);
    let drawn = 0;
    for (const s of a.querySelectorAll("path, rect, circle, ellipse, polygon, polyline, line, use, image")) { const b = s.getBoundingClientRect(); if (b.width > 1 || b.height > 1) { drawn++; if (drawn > 2) break; } }
    if (r.w > 40 && r.h > 40 && drawn === 0) add("C-FRAME", a, "anatomy figure has no visible shapes", "error");
  }

  // C-ARABIC: letter-spacing on Arabic, Arabic words split across elements, mixed digits
  const spaced = new Set();
  for (const t of texts) {
    const el = t.parentElement;
    if (spaced.has(el) || !ARABIC_LETTER.test(t.data)) continue;
    // Positive tracking opens gaps in the joins of Arabic letters (0.4px is already visible at 20px). A small
    // negative value (the display scale uses -0.005em) leaves the joins intact; a large negative one makes letters collide.
    const ls = parseFloat(cs(el).letterSpacing) || 0;
    const fs = parseFloat(cs(el).fontSize) || 16;
    if (ls > 0.25) { spaced.add(el); add("C-ARABIC", el, `letter-spacing ${ls}px on Arabic text "${t.data.trim().slice(0, 30)}" opens gaps in the joins between letters`, "error"); }
    else if (ls < -0.04 * fs) { spaced.add(el); add("C-ARABIC", el, `letter-spacing ${ls}px on Arabic text "${t.data.trim().slice(0, 30)}" makes letters collide`, "warn"); }
  }
  const flat = [];
  for (const t of texts) flat.push(t);
  for (let i = 1; i < flat.length; i++) {
    const a = flat[i - 1], b = flat[i];
    const last = a.data.slice(-1), first = b.data.charAt(0);
    if (!ARABIC_LETTER.test(last) || !ARABIC_LETTER.test(first)) continue;
    // adjacent in document order with no space between, in different elements, on the same line: one word split
    if (a.parentElement === b.parentElement) continue;
    const block = (n) => { for (let e = n.parentElement; e && e !== slide; e = e.parentElement) { const d = cs(e).display; if (d !== "inline" && d !== "contents") return e; } return slide; };
    if (block(a) !== block(b)) continue;
    const ra = a.parentElement.getBoundingClientRect(), rb = b.parentElement.getBoundingClientRect();
    if (Math.abs(ra.top - rb.top) > ra.height) continue;
    add("C-ARABIC", b.parentElement, `an Arabic word is split across elements ("${a.data.trim().slice(-8)}|${b.data.trim().slice(0, 8)}"); letters at the cut lose their joins`, "error");
  }
  const allText = texts.map((t) => t.data).join(" ");
  if (/[٠-٩]/.test(allText) && /[0-9]/.test(allText.replace(/[A-Za-z][\w-]*\d[\w-]*/g, ""))) {
    add("C-ARABIC", null, "the slide mixes Arabic-Indic and Western digits", "warn", { kind: "digits" });
  }

  // C-BIDI: Latin or numeric runs with neutral punctuation inside Arabic text, not isolated
  const RISKY = /[A-Za-z0-9][A-Za-z0-9.]*[\s]*[()[\]{}\/\\+\-:%][\s]*[A-Za-z0-9(]|[(\[][A-Za-z0-9]|[A-Za-z0-9][)\]]/;
  const bidiSeen = new Set();
  for (const t of texts) {
    const el = t.parentElement;
    if (bidiSeen.has(el) || !ARABIC.test(t.data) || !RISKY.test(t.data)) continue;
    // Isolation protects the run only when the isolating element wraps the run alone (no Arabic inside it);
    // Chrome computes unicode-bidi: isolate on many blocks, which does nothing for a run inside mixed text.
    let isolated = false;
    for (let e = el; e && e !== slide; e = e.parentElement) {
      if (ARABIC.test(e.textContent)) continue;
      if (e.tagName === "BDI" || (e.hasAttribute("dir") && e.getAttribute("dir") !== "rtl") || /isolate|plaintext/.test(cs(e).unicodeBidi)) { isolated = true; break; }
    }
    if (isolated || el.closest("svg")) continue;
    bidiSeen.add(el);
    const m = RISKY.exec(t.data);
    add("C-BIDI", el, `Latin or numeric text with punctuation inside Arabic ("${t.data.slice(Math.max(0, m.index - 6), m.index + 14).trim()}") is not isolated; its order can jump`);
  }

  // C-WIDOW: a title whose last line holds one word
  for (const h of slide.querySelectorAll("h1, h2, h3, .nm-t-display, .nm-t-h1, .nm-t-h2")) {
    if (!shown(h) || skip(h)) continue;
    const tops = [];
    const walker = document.createTreeWalker(h, NodeFilter.SHOW_TEXT);
    for (let n; (n = walker.nextNode());) {
      const re = /\S+/g;
      for (let m; (m = re.exec(n.data));) {
        const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
        const rects = r.getClientRects();
        if (rects.length) tops.push(Math.round(rects[0].top));
      }
    }
    if (tops.length < 3) continue;
    const lines = [...new Set(tops)].sort((a, b) => a - b);
    const groups = lines.reduce((acc, y) => { if (acc.length && y - acc[acc.length - 1].y < 4) acc[acc.length - 1].n++; else acc.push({ y, n: 0 }); return acc; }, []);
    if (groups.length < 2) continue;
    const lastTop = groups[groups.length - 1].y;
    const onLast = tops.filter((y) => Math.abs(y - lastTop) < 4).length;
    if (onLast === 1) add("C-WIDOW", h, `the title "${h.textContent.trim().slice(0, 40)}" ends with one word on its own line`);
  }

  // C-DENSITY: visible words, diagram labels and generated text excluded
  let words = 0;
  for (const t of texts) {
    if (t.parentElement.closest(".nm-diagram, [data-nm-generated], svg, .nm-detail, .nm-sheet, .nm-sources")) continue; // image credits are required
    words += (t.data.trim().match(/\S+/g) || []).length;
  }
  metrics.words = words;
  if (words > 60) add("C-DENSITY", null, `${words} words of visible text (budget 60)`, "warn", { words });

  // C-FILL: diagrams and figures that draw on a small part of their box
  const fills = [];
  for (const fig of slide.querySelectorAll("figure.nm-diagram")) {
    if (!shown(fig)) continue;
    const box = rectOf(fig);
    if (box.w < 200 || box.h < 120) continue;
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const p of fig.querySelectorAll("[data-nm-generated] .nm-dg-node, [data-nm-generated] .nm-dg-label, [data-nm-generated] path, [data-nm-generated] rect, [data-nm-generated] circle, [data-nm-generated] text")) {
      const b = p.getBoundingClientRect();
      if (b.width < 1 && b.height < 1) continue;
      const r = { x: (b.left - sr.left) / scale, y: (b.top - sr.top) / scale, w: b.width / scale, h: b.height / scale };
      x1 = Math.min(x1, r.x); y1 = Math.min(y1, r.y); x2 = Math.max(x2, r.x + r.w); y2 = Math.max(y2, r.y + r.h);
    }
    if (!Number.isFinite(x1)) continue;
    const ratio = Math.min(1, ((x2 - x1) * (y2 - y1)) / (box.w * box.h));
    fills.push({ id: fig.getAttribute("data-id") || "", ratio: Math.round(ratio * 100) / 100 });
    if (ratio < 0.45) add("C-FILL", fig, `the diagram draws on ${Math.round(ratio * 100)}% of its ${Math.round(box.w)}x${Math.round(box.h)} box`, "warn", { ratio });
  }
  metrics.fill = fills;

  // title position, for the cross-slide drift check
  const title = slide.querySelector("h1, h2, .nm-t-display, .nm-t-h1");
  const comp = slide.querySelector('[class*="nm-l-"]');
  metrics.title = title && shown(title) ? { y: Math.round(rectOf(title).y), x: Math.round(rectOf(title).x + rectOf(title).w) } : null;
  metrics.composition = comp ? Array.from(comp.classList).find((c) => c.startsWith("nm-l-")) || "" : "";

  // C-EMPTY: ink density from the screenshot (pixels differing from the slide background)
  if (png) {
    const im = new Image();
    im.src = "data:image/png;base64," + png;
    await im.decode();
    const W = 480, H = 270;
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d"); g.drawImage(im, 0, 0, W, H);
    const d = g.getImageData(0, 0, W, H).data;
    const counts = new Map();
    for (let i = 0; i < d.length; i += 4 * 7) { const k = (d[i] >> 3) + "," + (d[i + 1] >> 3) + "," + (d[i + 2] >> 3); counts.set(k, (counts.get(k) || 0) + 1); }
    const bg = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0].split(",").map((v) => Number(v) * 8 + 4);
    let ink = 0;
    for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) > 48) ink++;
    metrics.ink = Math.round((ink / (W * H)) * 1000) / 10;
    const exempt = ["cover", "section", "quote", "closing", "summary"].includes(role) || !!slide.querySelector(".nm-l-section, .nm-l-quote, .nm-l-title");
    // Calibrated on the corpus: finished content slides carry 4.6% or more, unfinished placeholder slides 3.6% or less.
    if (!exempt && metrics.ink < 4) add("C-EMPTY", null, `only ${metrics.ink}% of the stage carries ink (a finished content slide carries 4% or more)`, "warn", { ink: metrics.ink });
  }
  return { issues, metrics };
}

// ----------------------------------------------------------------------------------------------- in Node

/** Cross-slide checks on the per-slide metrics: titles of slides with the same composition should line up. */
export function crossSlide(reports) {
  const groups = new Map();
  for (const r of reports) {
    const m = r.metrics;
    if (!m || !m.title || !m.composition) continue;
    if (!groups.has(m.composition)) groups.set(m.composition, []);
    groups.get(m.composition).push(r);
  }
  for (const [comp, list] of groups) {
    if (list.length < 3) continue; // two slides cannot tell which one drifted
    const ys = list.map((r) => r.metrics.title.y).sort((a, b) => a - b);
    const median = ys[Math.floor(ys.length / 2)];
    // Only top-anchored compositions keep their titles on one line; split and title compositions centre their text
    // column vertically, so the title follows the content height by design (corpus: hero-figure 148px on every
    // slide, split 257px to 490px).
    if (median > 1080 * 0.3) continue;
    for (const r of list) {
      const dy = r.metrics.title.y - median;
      if (Math.abs(dy) > 8) r.issues.push({ code: "C-DRIFT", severity: "warn", message: `the title sits ${dy > 0 ? dy + "px lower" : -dy + "px higher"} than on the other ${comp} slides`, selector: "", evidence: { dy, median } });
    }
  }
}

const TIER_POINTS = { HOLD: 25, FIX: 5, NOTE: 1 };

/** The quality report: every finding with tier, confidence and a fix, plus scores. Deterministic for one input. */
export function qualityReport(report) {
  const classify = (i) => {
    const key = i.code === "C-ARABIC" && i.evidence && i.evidence.kind === "digits" ? "C-ARABIC-DIGITS" : i.code;
    const info = CODES[key] || { tier: i.severity === "error" ? "HOLD" : "NOTE", confidence: "possible", fix: "" };
    // a warning never blocks: an error-tier code reported as a warning drops to FIX
    const tier = i.severity === "warn" && info.tier === "HOLD" ? "FIX" : info.tier;
    return { code: i.code, severity: i.severity, tier, confidence: info.confidence, message: i.message, selector: i.selector || "", evidence: i.evidence ?? null, fix: info.fix };
  };
  const score = (findings) => Math.max(0, 100 - findings.reduce((n, f) => n + TIER_POINTS[f.tier], 0));
  const slides = report.slides.map((r) => {
    const findings = r.issues.map(classify);
    return { slide: r.slide, id: r.id, title: r.title, score: score(findings), metrics: r.metrics ?? null, findings };
  });
  const deck = report.deck.map(classify);
  const all = [...deck, ...slides.flatMap((s) => s.findings)];
  const count = (t) => all.filter((f) => f.tier === t).length;
  return {
    schema: "nevermind-quality/1",
    html_path: report.html_path,
    passed: report.passed,
    score: Math.max(0, Math.round((slides.reduce((n, s) => n + s.score, 0) / Math.max(1, slides.length)) * 10) / 10 - deck.reduce((n, f) => n + TIER_POINTS[f.tier], 0)),
    summary: { HOLD: count("HOLD"), FIX: count("FIX"), NOTE: count("NOTE") },
    deck,
    slides,
  };
}
