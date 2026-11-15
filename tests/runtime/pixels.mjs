// Pixel comparison without dependencies: both PNGs are decoded and compared inside Chromium (canvas).
// A pixel counts as different when any channel differs by more than `channel` (absorbs anti-aliasing noise).
export async function diffRatio(page, pngA, pngB, channel = 24) {
  return page.evaluate(async ([a, b, channel]) => {
    const load = async (b64) => { const im = new Image(); im.src = "data:image/png;base64," + b64; await im.decode(); return im; };
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    if (ia.width !== ib.width || ia.height !== ib.height) return 1;
    const read = (im) => { const c = new OffscreenCanvas(im.width, im.height); const g = c.getContext("2d"); g.drawImage(im, 0, 0); return g.getImageData(0, 0, im.width, im.height).data; };
    const da = read(ia), db = read(ib);
    let diff = 0;
    for (let i = 0; i < da.length; i += 4) {
      if (Math.abs(da[i] - db[i]) > channel || Math.abs(da[i + 1] - db[i + 1]) > channel || Math.abs(da[i + 2] - db[i + 2]) > channel) diff++;
    }
    return diff / (da.length / 4);
  }, [pngA.toString("base64"), pngB.toString("base64"), channel]);
}
