/**
 * Perspective correction: maps the four detected page corners onto a flat
 * rectangle, so a page photographed at an angle comes out straight and
 * cropped. Pure functions over RGBA arrays.
 */
import type { Point, Quad } from "./detect";

/**
 * The 3x3 homography (row-major, h[8] = 1) taking each `from[i]` to
 * `to[i]`: solves the standard 8-equation linear system by Gaussian
 * elimination with partial pivoting.
 */
export function homography(from: Quad, to: Quad): number[] {
  const a: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i]!;
    const { x: u, y: v } = to[i]!;
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  const n = 8;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(a[r]![col]!) > Math.abs(a[pivot]![col]!)) pivot = r;
    }
    [a[col], a[pivot]] = [a[pivot]!, a[col]!];
    const p = a[col]![col]!;
    if (Math.abs(p) < 1e-12) throw new Error("Degenerate corners");
    for (let c = col; c <= n; c++) a[col]![c]! /= p;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = a[r]![col]!;
      if (f === 0) continue;
      for (let c = col; c <= n; c++) a[r]![c]! -= f * a[col]![c]!;
    }
  }
  return [...a.map((row) => row[n]!), 1];
}

export function applyHomography(h: number[], p: Point): Point {
  const w = h[6]! * p.x + h[7]! * p.y + h[8]!;
  return {
    x: (h[0]! * p.x + h[1]! * p.y + h[2]!) / w,
    y: (h[3]! * p.x + h[4]! * p.y + h[5]!) / w,
  };
}

/**
 * Size of the flattened page: the longer of each pair of opposite edges
 * (so nothing is squashed), scaled to fit `maxSide`.
 */
export function flattenedSize(quad: Quad, maxSide: number): { width: number; height: number } {
  const d = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
  const [tl, tr, br, bl] = quad;
  const w = Math.max(d(tl, tr), d(bl, br));
  const h = Math.max(d(tl, bl), d(tr, br));
  const scale = Math.min(1, maxSide / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

/**
 * Renders the region inside `quad` of the source image as a flat
 * `outWidth` x `outHeight` image. For every output pixel, the inverse
 * mapping finds where it came from in the photo; bilinear sampling keeps
 * text edges smooth.
 */
export function warpToRect(
  src: Uint8ClampedArray,
  srcWidth: number,
  srcHeight: number,
  quad: Quad,
  outWidth: number,
  outHeight: number,
): Uint8ClampedArray {
  const rect: Quad = [
    { x: 0, y: 0 },
    { x: outWidth, y: 0 },
    { x: outWidth, y: outHeight },
    { x: 0, y: outHeight },
  ];
  const h = homography(rect, quad); // output pixel -> source pixel
  const out = new Uint8ClampedArray(outWidth * outHeight * 4);
  const maxX = srcWidth - 1;
  const maxY = srcHeight - 1;

  for (let y = 0; y < outHeight; y++) {
    // Sample at pixel centres.
    const oy = y + 0.5;
    for (let x = 0; x < outWidth; x++) {
      const ox = x + 0.5;
      const w = h[6]! * ox + h[7]! * oy + h[8]!;
      const sx = Math.min(maxX, Math.max(0, (h[0]! * ox + h[1]! * oy + h[2]!) / w - 0.5));
      const sy = Math.min(maxY, Math.max(0, (h[3]! * ox + h[4]! * oy + h[5]!) / w - 0.5));
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = Math.min(maxX, x0 + 1);
      const y1 = Math.min(maxY, y0 + 1);
      const fx = sx - x0;
      const fy = sy - y0;
      const i00 = (y0 * srcWidth + x0) * 4;
      const i10 = (y0 * srcWidth + x1) * 4;
      const i01 = (y1 * srcWidth + x0) * 4;
      const i11 = (y1 * srcWidth + x1) * 4;
      const o = (y * outWidth + x) * 4;
      for (let c = 0; c < 3; c++) {
        const top = src[i00 + c]! + (src[i10 + c]! - src[i00 + c]!) * fx;
        const bottom = src[i01 + c]! + (src[i11 + c]! - src[i01 + c]!) * fx;
        out[o + c] = top + (bottom - top) * fy;
      }
      out[o + 3] = 255;
    }
  }
  return out;
}
