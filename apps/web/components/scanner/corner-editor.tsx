"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { fullFrameQuad, type Point, type Quad } from "@/lib/scan/detect";

/**
 * Manual crop for a scanned page: the original photo with the page
 * outline drawn on top and a draggable handle on each corner. Used when
 * detection missed, or to tighten its crop. Works with mouse, touch and
 * pen (pointer events), and with the keyboard (arrow keys move the focused
 * handle).
 *
 * The SVG overlay uses the photo's own pixel coordinates as its viewBox
 * and the same aspect-fit as the <img>, so corners are stored in photo
 * pixels and never need converting for the warp.
 */
export function CornerEditor({
  photoUrl,
  width,
  height,
  initial,
  detected,
  onApply,
  onCancel,
}: {
  photoUrl: string;
  width: number;
  height: number;
  initial: Quad;
  detected: Quad | null;
  onApply: (quad: Quad) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("vault");
  const [quad, setQuad] = useState<Quad>(initial);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef<number | null>(null);

  const handle = Math.max(width, height) / 32;

  function toPhoto(e: React.PointerEvent): Point {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: Math.min(width, Math.max(0, p.x)), y: Math.min(height, Math.max(0, p.y)) };
  }

  function move(index: number, to: Point) {
    setQuad((q) => q.map((p, i) => (i === index ? to : p)) as Quad);
  }

  function onKey(index: number, e: React.KeyboardEvent) {
    const step = Math.max(width, height) / (e.shiftKey ? 20 : 100);
    const delta: Record<string, Point> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };
    const d = delta[e.key];
    if (!d) return;
    e.preventDefault();
    const p = quad[index]!;
    move(index, {
      x: Math.min(width, Math.max(0, p.x + d.x)),
      y: Math.min(height, Math.max(0, p.y + d.y)),
    });
  }

  const cornerNames = [t("cornerTopLeft"), t("cornerTopRight"), t("cornerBottomRight"), t("cornerBottomLeft")];
  const button =
    "tap-target rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-text transition hover:border-primary-500";

  return (
    <div className="flex h-full flex-col">
      <p className="px-4 pt-3 text-sm text-text-muted">{t("cornersHint")}</p>
      <div className="relative min-h-0 flex-1 bg-black p-3">
        <div className="relative h-full w-full">
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob: photo */}
          <img src={photoUrl} alt="" className="absolute inset-0 h-full w-full object-contain" draggable={false} />
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="xMidYMid meet"
            className="absolute inset-0 h-full w-full touch-none"
            onPointerMove={(e) => {
              if (dragging.current !== null) move(dragging.current, toPhoto(e));
            }}
            onPointerUp={() => (dragging.current = null)}
            onPointerCancel={() => (dragging.current = null)}
          >
            {/* Dim everything outside the page. */}
            <path
              fillRule="evenodd"
              fill="rgba(0,0,0,0.45)"
              d={`M0 0H${width}V${height}H0Z M${quad.map((p) => `${p.x} ${p.y}`).join(" L")}Z`}
            />
            <polygon
              points={quad.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="#7fe3da"
              strokeWidth={handle / 6}
            />
            {quad.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={handle}
                fill="rgba(127,227,218,0.25)"
                stroke="#fff"
                strokeWidth={handle / 6}
                tabIndex={0}
                role="slider"
                aria-label={cornerNames[i]}
                aria-valuetext={`${Math.round((p.x / width) * 100)}%, ${Math.round((p.y / height) * 100)}%`}
                className="cursor-grab focus:outline-none focus-visible:stroke-[#fde68a]"
                onPointerDown={(e) => {
                  (e.target as Element).setPointerCapture?.(e.pointerId);
                  dragging.current = i;
                }}
                onKeyDown={(e) => onKey(i, e)}
              />
            ))}
          </svg>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
        <button type="button" className={button} onClick={() => setQuad(fullFrameQuad(width, height))}>
          {t("useFullPhoto")}
        </button>
        {detected && (
          <button type="button" className={button} onClick={() => setQuad(detected)}>
            {t("autoDetect")}
          </button>
        )}
        <div className="ms-auto flex gap-2">
          <button type="button" className={button} onClick={onCancel}>
            {t("cancel")}
          </button>
          <button
            type="button"
            className="tap-target rounded-md bg-primary-700 px-4 py-2 text-sm font-semibold text-text-on-primary transition hover:bg-primary-800"
            onClick={() => onApply(quad)}
          >
            {t("apply")}
          </button>
        </div>
      </div>
    </div>
  );
}
