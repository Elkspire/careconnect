/**
 * Finds a sheet of paper in a photo and returns its four corners.
 *
 * Deliberately not OpenCV.js (~8 MB of WebAssembly for every patient who
 * opens the scanner). Paper is almost always the largest bright, roughly
 * rectangular region in the frame, so:
 *
 *   1. greyscale + blur, then split bright from dark at a few thresholds
 *      (Otsu's, plus the ones that separate the darker and brighter halves
 *      again) — a single cut fails when the phone's shadow covers part of
 *      the page, since shadowed paper can be as dark as the desk
 *   2. morphological opening, so thin bright lines don't join the page to
 *      bright things around it
 *   3. take the largest connected bright region and its convex hull
 *   4. reduce the hull to the four corners that keep the most area
 *   5. reject anything that isn't page-shaped (too small, fills the whole
 *      frame, not quadrilateral enough, extreme angles), and of what's
 *      left keep the most page-like: large, and filling its outline
 *
 * If paper is darker than its background (white desk, coloured paper) the
 * same thing is tried on the inverted image. And because paper is neutral
 * (white or grey) whether lit or in shadow, while desks, beds and cloth
 * usually have some colour, "neutral pixels" is tried as well — that is
 * what finds the whole page when a shadow makes part of it as dark as the
 * desk. On a colourless surface with a hard shadow it can still cut the
 * page short; the outline shows where it landed, and corners are
 * adjustable by hand. When nothing passes, the
 * caller uses the full frame and the user can adjust corners by hand.
 *
 * Pure functions over RGBA arrays (no DOM), so they run anywhere — the
 * caller downsizes the image first; ~320px on the long side is plenty.
 */

export interface Point {
  x: number;
  y: number;
}

/** Corners in order: top-left, top-right, bottom-right, bottom-left. */
export type Quad = [Point, Point, Point, Point];

export const DETECT_MAX_SIDE = 320;

export function detectQuad(rgba: Uint8ClampedArray, width: number, height: number): Quad | null {
  const gray = blur(toGray(rgba, width, height), width, height);
  const t0 = otsu(gray, 0, 255);
  const t1 = otsu(gray, 0, t0); // splits the darker half (e.g. desk vs shadowed paper)
  const t2 = otsu(gray, t0 + 1, 255); // splits the brighter half
  const thresholds = [...new Set([t0, t1, Math.round((t0 + t1) / 2), t2])];

  let best: { quad: Quad; score: number } | null = null;
  const consider = (mask: Uint8Array) => {
    const opened = dilate(erode(erode(mask, width, height), width, height), width, height);
    const candidate = largestRegionQuad(dilate(opened, width, height), width, height);
    if (candidate && (!best || candidate.score > best.score)) best = candidate;
  };

  // Neutral (unsaturated), not-too-dark pixels: paper, lit or shadowed.
  const saturation = blur(toSaturation(rgba, width, height), width, height);
  const satCut = otsu(saturation, 0, 255);
  const floor = Math.max(40, t1);
  const neutral = new Uint8Array(width * height);
  for (let i = 0; i < neutral.length; i++) {
    neutral[i] = saturation[i]! <= satCut && gray[i]! > floor ? 1 : 0;
  }
  consider(neutral);

  for (const threshold of thresholds) {
    for (const brightIsPaper of [true, false]) {
      const mask = new Uint8Array(width * height);
      for (let i = 0; i < mask.length; i++) {
        mask[i] = (gray[i]! > threshold) === brightIsPaper ? 1 : 0;
      }
      consider(mask);
    }
  }
  return (best as { quad: Quad; score: number } | null)?.quad ?? null;
}

function toGray(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const gray = new Uint8Array(width * height);
  for (let i = 0, p = 0; p < gray.length; i += 4, p++) {
    gray[p] = (rgba[i]! * 299 + rgba[i + 1]! * 587 + rgba[i + 2]! * 114) / 1000;
  }
  return gray;
}

/** HSV-style saturation, 0 (grey/white) to 255 (vivid colour). */
function toSaturation(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const sat = new Uint8Array(width * height);
  for (let i = 0, p = 0; p < sat.length; i += 4, p++) {
    const max = Math.max(rgba[i]!, rgba[i + 1]!, rgba[i + 2]!);
    const min = Math.min(rgba[i]!, rgba[i + 1]!, rgba[i + 2]!);
    sat[p] = max === 0 ? 0 : ((max - min) * 255) / max;
  }
  return sat;
}

/** 5x5 box blur (two separable passes): enough to dissolve text into the page. */
function blur(src: Uint8Array, width: number, height: number): Uint8Array {
  const r = 2;
  const tmp = new Uint8Array(src.length);
  const out = new Uint8Array(src.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let n = 0;
      for (let k = -r; k <= r; k++) {
        const xx = x + k;
        if (xx >= 0 && xx < width) {
          sum += src[y * width + xx]!;
          n++;
        }
      }
      tmp[y * width + x] = sum / n;
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let n = 0;
      for (let k = -r; k <= r; k++) {
        const yy = y + k;
        if (yy >= 0 && yy < height) {
          sum += tmp[yy * width + x]!;
          n++;
        }
      }
      out[y * width + x] = sum / n;
    }
  }
  return out;
}

/**
 * Otsu's method over the pixels in [lo, hi]: the threshold that best
 * separates them into two brightness groups.
 */
function otsu(gray: Uint8Array, lo: number, hi: number): number {
  const hist = new Float64Array(256);
  for (const v of gray) if (v >= lo && v <= hi) hist[v]!++;
  let total = 0;
  let sumAll = 0;
  for (let v = 0; v < 256; v++) {
    total += hist[v]!;
    sumAll += v * hist[v]!;
  }
  if (total === 0) return lo;
  let sumB = 0;
  let weightB = 0;
  let best = lo;
  let bestVar = -1;
  for (let t = lo; t <= hi; t++) {
    weightB += hist[t]!;
    if (weightB === 0) continue;
    const weightF = total - weightB;
    if (weightF === 0) break;
    sumB += t * hist[t]!;
    const meanB = sumB / weightB;
    const meanF = (sumAll - sumB) / weightF;
    const between = weightB * weightF * (meanB - meanF) ** 2;
    if (between > bestVar) {
      bestVar = between;
      best = t;
    }
  }
  return best;
}

function erode(mask: Uint8Array, width: number, height: number): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      out[i] = mask[i]! & mask[i - 1]! & mask[i + 1]! & mask[i - width]! & mask[i + width]!;
    }
  }
  return out;
}

function dilate(mask: Uint8Array, width: number, height: number): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      out[i] =
        mask[i]! |
        (x > 0 ? mask[i - 1]! : 0) |
        (x < width - 1 ? mask[i + 1]! : 0) |
        (y > 0 ? mask[i - width]! : 0) |
        (y < height - 1 ? mask[i + width]! : 0);
    }
  }
  return out;
}

function largestRegionQuad(
  mask: Uint8Array,
  width: number,
  height: number,
): { quad: Quad; score: number } | null {
  // Label 4-connected regions, keeping only the largest.
  const labels = new Int32Array(mask.length);
  const stack = new Int32Array(mask.length);
  let bestLabel = 0;
  let bestSize = 0;
  let next = 0;
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || labels[start]) continue;
    next++;
    let size = 0;
    let top = 0;
    stack[top++] = start;
    labels[start] = next;
    while (top > 0) {
      const i = stack[--top]!;
      size++;
      const x = i % width;
      const neighbours = [
        x > 0 ? i - 1 : -1,
        x < width - 1 ? i + 1 : -1,
        i - width,
        i + width,
      ];
      for (const j of neighbours) {
        if (j >= 0 && j < mask.length && mask[j] && !labels[j]) {
          labels[j] = next;
          stack[top++] = j;
        }
      }
    }
    if (size > bestSize) {
      bestSize = size;
      bestLabel = next;
    }
  }
  const frame = width * height;
  if (bestSize < frame * 0.1) return null;

  // Area of the region with its holes filled — text and pictures on the
  // page are holes in the bright region, and shouldn't count against it.
  // Flood the background in from the image border; whatever it can't
  // reach is either the region or enclosed by it.
  const outside = new Uint8Array(mask.length);
  let top = 0;
  const pushIfOutside = (i: number) => {
    if (labels[i] !== bestLabel && !outside[i]) {
      outside[i] = 1;
      stack[top++] = i;
    }
  };
  for (let x = 0; x < width; x++) {
    pushIfOutside(x);
    pushIfOutside((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    pushIfOutside(y * width);
    pushIfOutside(y * width + width - 1);
  }
  while (top > 0) {
    const i = stack[--top]!;
    const x = i % width;
    if (x > 0) pushIfOutside(i - 1);
    if (x < width - 1) pushIfOutside(i + 1);
    if (i >= width) pushIfOutside(i - width);
    if (i < mask.length - width) pushIfOutside(i + width);
  }
  let filledSize = 0;
  for (let i = 0; i < outside.length; i++) if (!outside[i]) filledSize++;

  // Outline pixels of that region, then its convex hull.
  const outline: Point[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (labels[i] !== bestLabel) continue;
      if (
        x === 0 ||
        y === 0 ||
        x === width - 1 ||
        y === height - 1 ||
        labels[i - 1] !== bestLabel ||
        labels[i + 1] !== bestLabel ||
        labels[i - width] !== bestLabel ||
        labels[i + width] !== bestLabel
      ) {
        outline.push({ x, y });
      }
    }
  }
  const hull = convexHull(outline);
  if (hull.length < 4) return null;

  const hullArea = polygonArea(hull);
  const quad = orderCorners(reduceToFour(hull));
  const quadArea = polygonArea(quad);

  // Page-shaped? Big enough, not just "the whole frame", region fills the
  // quad (rules out L-shapes and blobs), and no extreme corner angles.
  if (quadArea < frame * 0.12 || quadArea > frame * 0.97) return null;
  // How well four corners describe the region: the region fills the quad
  // (no L-shapes or blobs), and the quad keeps the region's whole outline
  // (cutting a corner off — as when a shadow hides part of the page —
  // shows up as the quad being smaller than the hull).
  const fill = Math.min(1, filledSize / quadArea);
  const coverage = Math.min(1, quadArea / hullArea);
  const fit = fill * coverage;
  if (fit < 0.85) return null;
  if (!quad.every((_, k) => cornerAngle(quad, k) > 45 && cornerAngle(quad, k) < 135)) return null;
  return { quad: insetQuad(quad, 0.015), score: quadArea * fit ** 8 };
}

/**
 * Pulls each corner slightly towards the centre. Blur and the opening
 * leave the outline a pixel or two outside the paper, which shows up as a
 * sliver of desk along the scanned edge; a small inset trades a hair of
 * margin for a clean edge (as dedicated scanner apps do).
 */
function insetQuad(quad: Quad, fraction: number): Quad {
  const cx = quad.reduce((s, p) => s + p.x, 0) / 4;
  const cy = quad.reduce((s, p) => s + p.y, 0) / 4;
  return quad.map((p) => ({
    x: p.x + (cx - p.x) * fraction,
    y: p.y + (cy - p.y) * fraction,
  })) as Quad;
}

/** Andrew's monotone chain. */
function convexHull(points: Point[]): Point[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length < 3) return pts;
  const cross = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Point[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Point[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/**
 * Repeatedly drops the hull vertex whose removal loses the least area,
 * until four remain — the corners of the best-fitting quadrilateral, at
 * any rotation.
 */
function reduceToFour(hull: Point[]): Point[] {
  const poly = [...hull];
  const triangle = (a: Point, b: Point, c: Point) =>
    Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
  while (poly.length > 4) {
    let minLoss = Infinity;
    let minIdx = 0;
    for (let i = 0; i < poly.length; i++) {
      const prev = poly[(i - 1 + poly.length) % poly.length]!;
      const next = poly[(i + 1) % poly.length]!;
      const loss = triangle(prev, poly[i]!, next);
      if (loss < minLoss) {
        minLoss = loss;
        minIdx = i;
      }
    }
    poly.splice(minIdx, 1);
  }
  return poly;
}

/** Clockwise from the corner nearest the image's top-left. */
export function orderCorners(points: Point[]): Quad {
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
  const byAngle = [...points].sort(
    (a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx),
  );
  let start = 0;
  byAngle.forEach((p, i) => {
    if (p.x + p.y < byAngle[start]!.x + byAngle[start]!.y) start = i;
  });
  return [0, 1, 2, 3].map((k) => byAngle[(start + k) % 4]!) as Quad;
}

export function polygonArea(points: Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

function cornerAngle(quad: Quad, k: number): number {
  const p = quad[k]!;
  const a = quad[(k + 3) % 4]!;
  const b = quad[(k + 1) % 4]!;
  const v1 = { x: a.x - p.x, y: a.y - p.y };
  const v2 = { x: b.x - p.x, y: b.y - p.y };
  const cos = (v1.x * v2.x + v1.y * v2.y) / (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y));
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

/** Scales a quad found on a downsized image back to the original's pixels. */
export function scaleQuad(quad: Quad, factor: number): Quad {
  return quad.map((p) => ({ x: p.x * factor, y: p.y * factor })) as Quad;
}

/** The whole image as a quad — the fallback when no page is detected. */
export function fullFrameQuad(width: number, height: number): Quad {
  return [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
}
