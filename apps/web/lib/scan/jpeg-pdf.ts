/**
 * Builds a PDF whose pages are JPEG images — all a scanned document needs,
 * without pulling a general-purpose PDF library (~200 KB) into the patient
 * bundle. JPEG data embeds into PDF as-is (the DCTDecode filter), so this is
 * only the PDF object structure around the bytes the browser's canvas
 * already produced.
 *
 * Each page is A4 width (595pt) and as tall as the photo's proportions
 * need, with the image filling it edge to edge.
 */

export interface JpegPage {
  /** Raw JPEG file bytes (e.g. from canvas.toBlob("image/jpeg")). */
  jpeg: Uint8Array;
  width: number;
  height: number;
}

const PAGE_WIDTH_PT = 595.28; // A4

export function buildJpegPdf(pages: JpegPage[]): Blob {
  if (pages.length === 0) {
    throw new Error("A PDF needs at least one page");
  }

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = []; // byte offset of each object, index = object number
  let length = 0;

  const write = (part: string | Uint8Array) => {
    const bytes = typeof part === "string" ? encoder.encode(part) : part;
    chunks.push(bytes);
    length += bytes.length;
  };
  const startObject = (num: number) => {
    offsets[num] = length;
    write(`${num} 0 obj\n`);
  };

  // Header. The second line's high-bit bytes mark the file as binary.
  write("%PDF-1.4\n");
  write(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  // Object numbers: 1 catalog, 2 page tree, then 3 per page
  // (page, image, content stream).
  const pageObj = (i: number) => 3 + i * 3;
  const imageObj = (i: number) => 4 + i * 3;
  const contentObj = (i: number) => 5 + i * 3;

  startObject(1);
  write("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  startObject(2);
  const kids = pages.map((_, i) => `${pageObj(i)} 0 R`).join(" ");
  write(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>\nendobj\n`);

  pages.forEach((page, i) => {
    const w = PAGE_WIDTH_PT;
    const h = +((PAGE_WIDTH_PT * page.height) / page.width).toFixed(2);

    startObject(pageObj(i));
    write(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] ` +
        `/Resources << /XObject << /Im0 ${imageObj(i)} 0 R >> >> ` +
        `/Contents ${contentObj(i)} 0 R >>\nendobj\n`,
    );

    startObject(imageObj(i));
    write(
      `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode ` +
        `/Length ${page.jpeg.length} >>\nstream\n`,
    );
    write(page.jpeg);
    write("\nendstream\nendobj\n");

    // Scale the 1x1 image unit square up to the full page, then draw it.
    const content = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
    startObject(contentObj(i));
    write(`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream\nendobj\n`);
  });

  // Cross-reference table: every entry exactly 20 bytes, per the spec.
  const objectCount = 3 + pages.length * 3; // includes the free object 0
  const xrefOffset = length;
  write(`xref\n0 ${objectCount}\n0000000000 65535 f \n`);
  for (let n = 1; n < objectCount; n++) {
    write(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`);
  }
  write(`trailer\n<< /Size ${objectCount} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  return new Blob(chunks as BlobPart[], { type: "application/pdf" });
}
