/**
 * Canvas helpers for the document scanner: grabbing a camera frame,
 * rotating it, and the "Document" enhancement that makes a photo of paper
 * look like a scan.
 */

export type ScanMode = "document" | "color";

/** Quarter turns clockwise. */
export type Rotation = 0 | 90 | 180 | 270;

/** Captured pages are stored at most this size; export may scale further. */
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

/** Freezes the current video frame as a high-quality JPEG. */
export async function captureFrame(video: HTMLVideoElement): Promise<Blob> {
  const { width, height } = fit(video.videoWidth, video.videoHeight, CAPTURE_MAX_SIDE);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(video, 0, 0, width, height);
  return canvasToBlob(canvas, 0.92);
}

/**
 * Greyscale plus an automatic levels stretch: the darkest ~1% of pixels
 * become black and the brightest ~1% white, so grey paper photographed
 * under room light comes out white with crisp text. Percentiles (rather
 * than plain min/max) keep a single shadow or glare spot from flattening
 * the whole page.
 */
function enhanceDocument(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const image = ctx.getImageData(0, 0, width, height);
  const px = image.data;
  const gray = new Uint8ClampedArray(width * height);
  const histogram = new Uint32Array(256);
  for (let i = 0, p = 0; i < px.length; i += 4, p++) {
    const y = (px[i]! * 299 + px[i + 1]! * 587 + px[i + 2]! * 114) / 1000;
    gray[p] = y;
    histogram[gray[p]!]!++;
  }

  const total = width * height;
  const percentile = (fraction: number) => {
    let seen = 0;
    for (let v = 0; v < 256; v++) {
      seen += histogram[v]!;
      if (seen >= total * fraction) return v;
    }
    return 255;
  };
  const low = percentile(0.01);
  const high = Math.max(low + 1, percentile(0.99));
  const range = high - low;

  for (let i = 0, p = 0; i < px.length; i += 4, p++) {
    // Stretch, then a gentle curve that pushes paper towards white while
    // keeping ink dark.
    const t = Math.min(1, Math.max(0, (gray[p]! - low) / range));
    const v = Math.round(255 * Math.pow(t, 0.8));
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  ctx.putImageData(image, 0, 0);
}

/**
 * Produces the final JPEG for one page: rotated, scaled to fit `maxSide`,
 * and enhanced if `mode` is "document".
 */
export async function renderPage(
  source: Blob,
  rotation: Rotation,
  mode: ScanMode,
  maxSide: number,
  quality: number,
): Promise<{ jpeg: Uint8Array; width: number; height: number }> {
  const bitmap = await createImageBitmap(source);
  const drawn = fit(bitmap.width, bitmap.height, maxSide);
  const sideways = rotation === 90 || rotation === 270;
  const width = sideways ? drawn.height : drawn.width;
  const height = sideways ? drawn.width : drawn.height;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: mode === "document" })!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.translate(width / 2, height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(bitmap, -drawn.width / 2, -drawn.height / 2, drawn.width, drawn.height);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  bitmap.close();

  if (mode === "document") {
    enhanceDocument(ctx, width, height);
  }

  const blob = await canvasToBlob(canvas, quality);
  return { jpeg: new Uint8Array(await blob.arrayBuffer()), width, height };
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
