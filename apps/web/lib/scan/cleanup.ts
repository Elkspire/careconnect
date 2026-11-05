/**
 * "Document" clean-up: makes paper evenly white and ink crisp, the way a
 * flatbed scan looks. Pure function over an RGBA array (no DOM).
 *
 * The usual problem with a phone photo of paper is uneven light — most of
 * all the phone's own shadow across part of the page. A global contrast
 * stretch can't fix that, so:
 *
 *   1. Estimate the light falling on each part of the page. On a quarter-
 *      size copy, a morphological closing: the brightest value in each
 *      neighbourhood (text is dark and thin, so it disappears and only
 *      paper — lit or shadowed — remains), then the darkest value over the
 *      same neighbourhood, which puts the edge of a shadow back exactly
 *      where it was (a max filter alone pushes lit paper into the shadow,
 *      leaving a dark band along its edge). A small blur then smooths it.
 *   2. Divide each pixel by that light, so lit and shadowed paper both
 *      become the same white and only ink stays dark.
 *   3. Levels and a curve: the darkest ~1% to black, paper to white.
 */
export function cleanUpDocument(rgba: Uint8ClampedArray, width: number, height: number): void {
  const n = width * height;
  const gray = new Float32Array(n);
  for (let i = 0, p = 0; p < n; i += 4, p++) {
    gray[p] = (rgba[i]! * 299 + rgba[i + 1]! * 587 + rgba[i + 2]! * 114) / 1000;
  }

  const light = estimateLight(gray, width, height);

  const normalized = new Float32Array(n);
  const hist = new Uint32Array(256);
  for (let p = 0; p < n; p++) {
    const v = Math.min(255, (gray[p]! / Math.max(8, light[p]!)) * 240);
    normalized[p] = v;
    hist[v | 0]!++;
  }

  const percentile = (fraction: number) => {
    let seen = 0;
    for (let v = 0; v < 256; v++) {
      seen += hist[v]!;
      if (seen >= n * fraction) return v;
    }
    return 255;
  };
  const low = percentile(0.01);
  // Most of a page is paper: treat the brightest ~half as paper white.
  const high = Math.max(low + 1, Math.min(percentile(0.5), 235));
  for (let i = 0, p = 0; p < n; i += 4, p++) {
    const t = Math.min(1, Math.max(0, (normalized[p]! - low) / (high - low)));
    const v = Math.round(255 * Math.pow(t, 1.5));
    rgba[i] = rgba[i + 1] = rgba[i + 2] = v;
  }
}

/** Per-pixel estimate of how brightly the paper is lit (same size as `gray`). */
export function estimateLight(gray: Float32Array, width: number, height: number): Float32Array {
  const scale = 4;
  const sw = Math.max(1, Math.ceil(width / scale));
  const sh = Math.max(1, Math.ceil(height / scale));

  // Max-pool to quarter size: already drops most thin strokes.
  let small: Float32Array = new Float32Array(sw * sh);
  for (let y = 0; y < height; y++) {
    const row = Math.floor(y / scale) * sw;
    for (let x = 0; x < width; x++) {
      const i = row + Math.floor(x / scale);
      const v = gray[y * width + x]!;
      if (v > small[i]!) small[i] = v;
    }
  }

  // Closing wide enough to swallow bold text and headings, while keeping
  // shadow edges in place…
  const closeRadius = Math.max(2, Math.round(Math.max(sw, sh) / 30));
  small = separable(small, sw, sh, closeRadius, "max");
  small = separable(small, sw, sh, closeRadius, "min");
  // …then the smallest blur that removes blockiness — any wider and it
  // reopens a band along hard shadow edges.
  small = separable(small, sw, sh, 1, "mean");

  // Back up to full size (bilinear).
  const light = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    const fy = Math.min(sh - 1, Math.max(0, (y + 0.5) / scale - 0.5));
    const y0 = Math.floor(fy);
    const y1 = Math.min(sh - 1, y0 + 1);
    const ty = fy - y0;
    for (let x = 0; x < width; x++) {
      const fx = Math.min(sw - 1, Math.max(0, (x + 0.5) / scale - 0.5));
      const x0 = Math.floor(fx);
      const x1 = Math.min(sw - 1, x0 + 1);
      const tx = fx - x0;
      const top = small[y0 * sw + x0]! + (small[y0 * sw + x1]! - small[y0 * sw + x0]!) * tx;
      const bottom = small[y1 * sw + x0]! + (small[y1 * sw + x1]! - small[y1 * sw + x0]!) * tx;
      light[y * width + x] = top + (bottom - top) * ty;
    }
  }
  return light;
}

/** Separable max or mean filter with a square window of the given radius. */
function separable(
  src: Float32Array,
  w: number,
  h: number,
  radius: number,
  op: "max" | "min" | "mean",
): Float32Array {
  const pass = (input: Float32Array, horizontal: boolean) => {
    const out = new Float32Array(input.length);
    const len = horizontal ? w : h;
    const lines = horizontal ? h : w;
    for (let line = 0; line < lines; line++) {
      for (let k = 0; k < len; k++) {
        let acc = op === "min" ? Infinity : 0;
        let count = 0;
        for (let d = -radius; d <= radius; d++) {
          const j = k + d;
          if (j < 0 || j >= len) continue;
          const v = horizontal ? input[line * w + j]! : input[j * w + line]!;
          if (op === "max") {
            if (v > acc) acc = v;
          } else if (op === "min") {
            if (v < acc) acc = v;
          } else {
            acc += v;
            count++;
          }
        }
        const value = op === "mean" ? acc / count : acc;
        if (horizontal) out[line * w + k] = value;
        else out[k * w + line] = value;
      }
    }
    return out;
  };
  return pass(pass(src, true), false);
}
