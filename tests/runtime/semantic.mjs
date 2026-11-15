// Semantic state of a Nevermind runtime v2 deck, read in the page. Logical facts only (which slide and step, what is
// shown, which act is open, what the plugins generated), so a snapshot is independent of fonts, GPU and timing and
// can be compared between runs, between ?nm-speed=0 and full motion, and against committed golden files.
//
// Element ids are stable labels: "s<slide>.<tag>#<n>" where n is the element's index among the slide's step
// elements (document order), so no attribute has to be added to the deck.

export function readState() {
  const deck = window.NM.deck;
  const slide = deck.slides[deck.index];
  const steps = [...slide.querySelectorAll("[data-step]")];
  const label = (el) => `s${deck.index + 1}.${el.tagName.toLowerCase()}#${steps.indexOf(el)}`;
  const shown = (el) => {
    for (let n = el; n && n !== slide; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) < 0.05) return false; // dimmed by zoom or focus still counts as shown
    }
    return true;
  };
  const rig = slide.querySelector(":scope > .camera-rig");
  const rigT = rig ? getComputedStyle(rig).transform : "none";
  const overlay = document.getElementById("nmOverlayLayer");
  const ghosts = document.getElementById("nmGhostLayer");
  const running = document.getAnimations().filter((a) => a.playState === "running" && a.effect && a.effect.getTiming().iterations !== Infinity).length;
  return {
    slide: deck.index + 1,
    step: deck.stepIndex,
    active: [...document.querySelectorAll(".deck-stage > section.slide.active")].map((s) => deck.slides.indexOf(s) + 1),
    stepsOn: steps.filter((e) => e.classList.contains("is-on")).map(label),
    current: steps.filter((e) => e.classList.contains("is-current")).map(label),
    // a transient act (zoom, highlight, focus, detail, lens, pins, slice) is open on this step
    transient: steps.some((e) => e.classList.contains("is-current") && /^(zoom|highlight|focus|detail|lens|pins|slice)$/.test(e.getAttribute("data-act") || "")),
    hiddenSteps: steps.filter((e) => !shown(e)).map(label),
    // lasting acts (reveal, draw) that are on must be visible; transient isolation acts may hide the original while
    // the overlay shows its lifted copy or pins
    hiddenLasting: steps.filter((e) => e.classList.contains("is-on") && /^(reveal|draw|)$/.test(e.getAttribute("data-act") || "") && !shown(e)).map(label),
    body: [...document.body.classList].filter((c) => c.startsWith("nm-") && !["nm-ready", "nm-instant", "nm-print"].includes(c)).sort(),
    overlay: overlay ? [...overlay.children].map((c) => [c.tagName.toLowerCase(), ...[...c.classList].filter((x) => x.startsWith("nm-")).sort()].join(".")).sort() : [],
    ghosts: ghosts ? ghosts.childElementCount : 0,
    camera: rigT === "none" || rigT === "matrix(1, 0, 0, 1, 0, 0)" ? "rest" : "moved",
    figures: [...slide.querySelectorAll("figure.nm-diagram")].map((f) => {
      const nodes = [...f.querySelectorAll("[data-nm-generated] .nm-dg-node")];
      return { id: f.getAttribute("data-id"), play: f.classList.contains("nm-dg-play"), nodes: nodes.length, shownNodes: nodes.filter(shown).length };
    }),
    running,
  };
}

/** Walk the deck at ?nm-speed=0: every slide, every step, plus the release step. Returns one state per position. */
export async function walk(page, nextKey) {
  const out = [];
  const total = await page.evaluate(() => window.NM.deck.slides.length);
  await page.evaluate(() => window.NM.deck.go(0));
  await page.evaluate(() => window.NM.test.settle());
  for (let guard = 0; guard < total * 12; guard++) {
    out.push(await page.evaluate(readState));
    const before = out[out.length - 1];
    await page.keyboard.press(nextKey);
    await page.evaluate(() => window.NM.test.settle());
    const after = await page.evaluate(() => ({ slide: window.NM.deck.index + 1, step: window.NM.deck.stepIndex }));
    if (after.slide === before.slide && after.step === before.step) break; // end of the deck
  }
  return out;
}
