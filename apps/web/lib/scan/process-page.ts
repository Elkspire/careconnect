/**
 * Turns a captured photo into a finished scan page: crop and flatten the
 * detected page (warp.ts), clean it up, rotate, encode as JPEG. Also
 * grabs camera frames and runs page detection on them (detect.ts).
 */
import { DETECT_MAX_SIDE, detectQuad, scaleQuad, type Quad } from "./detect";
import { cleanUpDocument } from "./cleanup";
import { flattenedSize, warpToRect } from "./warp";

export type ScanMode = "document" | "color";

/** Quarter turns clockwise. */
export type Rotation = 0 | 90 | 180 | 270;

/** Captured photos are kept at most this size; export may scale further. */
export const CAPTURE_MAX_SIDE = 2400;

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not encode image"))),
      "image/jpeg",
      quality,
    ),
  );
}

function fit(width: number, height: number, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

function context(canvas: HTMLCanvasElement) {
  return canvas.getContext("2d", { willReadFrequently: true })!;
}

/** Freezes the current video frame as a high-quality JPEG. */
export async function captureFrame(video: HTMLVideoElement): Promise<Blob> {
  const { width, height } = fit(video.videoWidth, video.videoHeight, CAPTURE_MAX_SIDE);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  context(canvas).drawImage(video, 0, 0, width, height);
  return canvasToBlob(canvas, 0.92);
}

/**
 * Looks for a page in any drawable source (a video frame, a photo) and
 * returns its corners in that source's own pixel coordinates.
 */
const detectCanvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
export function detectInSource(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
): Quad | null {
  if (!detectCanvas || !sourceWidth || !sourceHeight) return null;
  const { width, height } = fit(sourceWidth, sourceHeight, DETECT_MAX_SIDE);
  detectCanvas.width = width;
  detectCanvas.height = height;
  const ctx = context(detectCanvas);
  ctx.drawImage(source, 0, 0, width, height);
  const quad = detectQuad(ctx.getImageData(0, 0, width, height).data, width, height);
  return quad ? scaleQuad(quad, sourceWidth / width) : null;
}

/** Pixel size of a captured photo (for corner coordinates). */
export async function imageSize(blob: Blob): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(blob);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return size;
}

/**
 * The finished JPEG for one page: cropped and flattened to `quad` (or the
 * whole photo when there's none), cleaned up in "document" mode, rotated,
 * and scaled to fit `maxSide`.
 */
export async function renderPage(
  source: Blob,
  quad: Quad | null,
  rotation: Rotation,
  mode: ScanMode,
  maxSide: number,
  quality: number,
): Promise<{ jpeg: Uint8Array; width: number; height: number }> {
  const bitmap = await createImageBitmap(source);

  // 1. Crop + flatten (or just scale the whole photo).
  const flat = document.createElement("canvas");
  const flatCtx = context(flat);
  if (quad) {
    const full = document.createElement("canvas");
    full.width = bitmap.width;
    full.height = bitmap.height;
    const fullCtx = context(full);
    fullCtx.drawImage(bitmap, 0, 0);
    const size = flattenedSize(quad, maxSide);
    const pixels = warpToRect(
      fullCtx.getImageData(0, 0, bitmap.width, bitmap.height).data,
      bitmap.width,
      bitmap.height,
      quad,
      size.width,
      size.height,
    );
    flat.width = size.width;
    flat.height = size.height;
    flatCtx.putImageData(new ImageData(pixels as Uint8ClampedArray<ArrayBuffer>, size.width, size.height), 0, 0);
  } else {
    const size = fit(bitmap.width, bitmap.height, maxSide);
    flat.width = size.width;
    flat.height = size.height;
    flatCtx.drawImage(bitmap, 0, 0, size.width, size.height);
  }
  bitmap.close();

  // 2. Clean up.
  if (mode === "document") {
    const image = flatCtx.getImageData(0, 0, flat.width, flat.height);
    cleanUpDocument(image.data, flat.width, flat.height);
    flatCtx.putImageData(image, 0, 0);
  }

  // 3. Rotate.
  const sideways = rotation === 90 || rotation === 270;
  const out = document.createElement("canvas");
  out.width = sideways ? flat.height : flat.width;
  out.height = sideways ? flat.width : flat.height;
  const outCtx = context(out);
  outCtx.translate(out.width / 2, out.height / 2);
  outCtx.rotate((rotation * Math.PI) / 180);
  outCtx.drawImage(flat, -flat.width / 2, -flat.height / 2);

  const blob = await canvasToBlob(out, quality);
  return { jpeg: new Uint8Array(await blob.arrayBuffer()), width: out.width, height: out.height };
}

/** Preview of a finished page, as an object URL (caller revokes it). */
export async function renderPreview(
  source: Blob,
  quad: Quad | null,
  rotation: Rotation,
  mode: ScanMode,
): Promise<string> {
  const page = await renderPage(source, quad, rotation, mode, 1100, 0.85);
  return URL.createObjectURL(new Blob([page.jpeg as BlobPart], { type: "image/jpeg" }));
}

/**
 * Export settings to try in order until the PDF fits the upload limit:
 * full detail first, then progressively smaller/softer. A typical
 * 1–5 page scan fits on the first try.
 */
export const EXPORT_ATTEMPTS: Array<{ maxSide: number; quality: number }> = [
  { maxSide: 2000, quality: 0.82 },
  { maxSide: 1700, quality: 0.72 },
  { maxSide: 1400, quality: 0.62 },
  { maxSide: 1100, quality: 0.55 },
];
