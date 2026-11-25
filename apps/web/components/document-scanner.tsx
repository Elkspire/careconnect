"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Camera,
  Check,
  Crop,
  ImagePlus,
  LoaderCircle,
  Plus,
  RotateCcw,
  RotateCw,
  ScanLine,
  Trash2,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { CornerEditor } from "@/components/scanner/corner-editor";
import { fullFrameQuad, type Quad } from "@/lib/scan/detect";
import { buildJpegPdf } from "@/lib/scan/jpeg-pdf";
import {
  captureFrame,
  detectInSource,
  EXPORT_ATTEMPTS,
  imageSize,
  renderPage,
  renderPreview,
  type Rotation,
  type ScanMode,
} from "@/lib/scan/process-page";

/** The API and Next's server-action body limit are both 10 MB; leave headroom for the form fields. */
const MAX_PDF_BYTES = 9.5 * 1024 * 1024;
const MAX_PAGES = 20;
const DETECT_INTERVAL_MS = 300;

interface ScannedPage {
  id: string;
  /** The original photo, kept so crop/rotation/look can be redone. */
  photo: Blob;
  photoUrl: string;
  width: number;
  height: number;
  /** What detection found (null = no page edges found). */
  detected: Quad | null;
  /** Crop actually used: detected, hand-adjusted, or null for the whole photo. */
  quad: Quad | null;
  rotation: Rotation;
  /** Rendered finished page, and the settings it was rendered with. */
  previewUrl?: string;
  previewKey?: string;
}

type View = "camera" | "review" | "corners" | "preview";
type CameraState = "off" | "starting" | "live" | "unavailable";

const previewKey = (p: ScannedPage, mode: ScanMode) =>
  JSON.stringify([p.quad, p.rotation, mode]);

/**
 * "Scan a document" for the patient's records. Works like a scanner app:
 *
 *   camera   live camera with the detected page outlined as you aim
 *   review   right after each capture: the page cropped, straightened and
 *            cleaned up — adjust corners, rotate, retake, or keep going
 *   corners  drag the page's corners by hand when detection missed
 *   preview  every finished page exactly as it will be saved, then
 *            "Save as PDF" through the same upload action as the file form
 *
 * All processing — detection, perspective correction, clean-up and PDF
 * assembly — runs in the browser (lib/scan/*). Without a usable camera it
 * falls back to the device's own camera/photo picker.
 */
export function DocumentScanner({
  familyMembers,
  uploadAction,
}: {
  familyMembers: Array<{ id: string; fullName: string }>;
  uploadAction: (formData: FormData) => Promise<{ recorded: boolean }>;
}) {
  const t = useTranslations("vault");
  const tAudit = useTranslations("audit");
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [view, setView] = useState<View>("camera");
  const [camera, setCamera] = useState<CameraState>("off");
  const [liveQuad, setLiveQuad] = useState<Quad | null>(null);
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });
  const [pages, setPages] = useState<ScannedPage[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [mode, setMode] = useState<ScanMode>("document");
  const [recordType, setRecordType] = useState("lab_report");
  const [familyMemberId, setFamilyMemberId] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [savedNotice, setSavedNotice] = useState<"recorded" | "unrecorded" | null>(null);

  const current = pages.find((p) => p.id === currentId) ?? null;
  const full = pages.length >= MAX_PAGES;

  // ---- camera -------------------------------------------------------------

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCamera("off");
    setLiveQuad(null);
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamera("unavailable");
      return;
    }
    setCamera("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setCamera("live");
    } catch {
      setCamera("unavailable");
    }
  }

  // Never leave the camera running if the page itself goes away.
  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  // Live page detection while the camera view is showing.
  useEffect(() => {
    if (view !== "camera" || camera !== "live") return;
    const timer = setInterval(() => {
      const video = videoRef.current;
      if (!video?.videoWidth) return;
      setVideoSize({ width: video.videoWidth, height: video.videoHeight });
      setLiveQuad(detectInSource(video, video.videoWidth, video.videoHeight));
    }, DETECT_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [view, camera]);

  // ---- finished-page previews --------------------------------------------

  // (Re)render each page's finished preview whenever its crop, rotation or
  // the look changes. One at a time, newest settings win.
  useEffect(() => {
    const stale = pages.find((p) => p.previewKey !== previewKey(p, mode));
    if (!stale) return;
    let cancelled = false;
    const key = previewKey(stale, mode);
    void renderPreview(stale.photo, stale.quad, stale.rotation, mode).then((url) => {
      if (cancelled) {
        URL.revokeObjectURL(url);
        return;
      }
      setPages((prev) =>
        prev.map((p) => {
          if (p.id !== stale.id) return p;
          if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
          return { ...p, previewUrl: url, previewKey: key };
        }),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [pages, mode]);

  // ---- pages --------------------------------------------------------------

  async function addPhoto(photo: Blob) {
    const size = await imageSize(photo);
    const bitmap = await createImageBitmap(photo);
    const detected = detectInSource(bitmap, size.width, size.height);
    bitmap.close();
    const page: ScannedPage = {
      id: crypto.randomUUID(),
      photo,
      photoUrl: URL.createObjectURL(photo),
      ...size,
      detected,
      quad: detected,
      rotation: 0,
    };
    setPages((prev) => (prev.length >= MAX_PAGES ? prev : [...prev, page]));
    setCurrentId(page.id);
    setError(null);
    setView("review");
  }

  async function capture() {
    if (!videoRef.current || camera !== "live" || full || capturing) return;
    setCapturing(true);
    setFlash(true);
    setTimeout(() => setFlash(false), 150);
    try {
      await addPhoto(await captureFrame(videoRef.current));
    } finally {
      setCapturing(false);
    }
  }

  async function onFilesChosen(files: FileList | null) {
    for (const file of Array.from(files ?? [])) {
      if (file.type.startsWith("image/")) await addPhoto(file);
    }
  }

  function updatePage(id: string, change: (page: ScannedPage) => ScannedPage) {
    setPages((prev) => prev.map((p) => (p.id === id ? change(p) : p)));
  }

  function removePage(id: string) {
    setPages((prev) => {
      const page = prev.find((p) => p.id === id);
      if (page) {
        URL.revokeObjectURL(page.photoUrl);
        if (page.previewUrl) URL.revokeObjectURL(page.previewUrl);
      }
      return prev.filter((p) => p.id !== id);
    });
  }

  function movePage(id: string, delta: -1 | 1) {
    setPages((prev) => {
      const i = prev.findIndex((p) => p.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  }

  const rotateBy = (id: string, quarterTurns: 1 | -1) =>
    updatePage(id, (p) => ({ ...p, rotation: (((p.rotation + quarterTurns * 90) % 360) + 360) % 360 as Rotation }));

  // ---- open / close / save ------------------------------------------------

  function open() {
    setError(null);
    setSavedNotice(null);
    setView("camera");
    dialogRef.current?.showModal();
    void startCamera();
  }

  function discardPages() {
    pages.forEach((p) => {
      URL.revokeObjectURL(p.photoUrl);
      if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
    });
    setPages([]);
    setCurrentId(null);
  }

  // Runs for every way the dialog closes (X button, Esc, after saving).
  function onDialogClose() {
    stopCamera();
    if (!saving) discardPages();
  }

  async function save() {
    if (pages.length === 0 || saving) return;
    setSaving(true);
    setError(null);
    try {
      // Step down size/quality until the PDF fits the upload limit.
      let pdf: Blob | null = null;
      for (const attempt of EXPORT_ATTEMPTS) {
        const rendered = [];
        for (const page of pages) {
          rendered.push(
            await renderPage(page.photo, page.quad, page.rotation, mode, attempt.maxSide, attempt.quality),
          );
        }
        const candidate = buildJpegPdf(rendered);
        if (candidate.size <= MAX_PDF_BYTES) {
          pdf = candidate;
          break;
        }
      }
      if (!pdf) {
        setError(t("scanTooLarge"));
        return;
      }

      const date = new Date().toISOString().slice(0, 10);
      const formData = new FormData();
      formData.set("recordType", recordType);
      if (familyMemberId) formData.set("familyMemberId", familyMemberId);
      formData.set("file", new File([pdf], `scan-${date}.pdf`, { type: "application/pdf" }));
      const { recorded } = await uploadAction(formData);

      discardPages();
      dialogRef.current?.close();
      setSavedNotice(recorded ? "recorded" : "unrecorded");
      router.refresh();
    } catch (err) {
      console.error(err);
      setError(t("scanFailed"));
    } finally {
      setSaving(false);
    }
  }

  // ---- UI -----------------------------------------------------------------

  const secondary =
    "tap-target flex items-center justify-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-text transition hover:border-primary-500 disabled:opacity-40";
  const primary =
    "tap-target flex items-center justify-center gap-2 rounded-md bg-primary-700 px-4 py-2 text-sm font-semibold text-text-on-primary transition hover:bg-primary-800 disabled:cursor-not-allowed disabled:opacity-50";
  const iconOnly =
    "tap-target flex items-center justify-center rounded-md border border-border bg-surface p-2 text-text-muted transition hover:border-primary-500 hover:text-text disabled:opacity-40";
  const selectInput =
    "tap-target w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";
  const fileInput = (withCapture: boolean) => (
    <input
      type="file"
      accept="image/*"
      {...(withCapture ? { capture: "environment" as const } : {})}
      multiple
      className="sr-only"
      onChange={(e) => {
        const files = e.target.files;
        void onFilesChosen(files).finally(() => {
          e.target.value = "";
        });
      }}
    />
  );
  const pageImage = (page: ScannedPage, className: string) =>
    page.previewUrl ? (
      // eslint-disable-next-line @next/next/no-img-element -- local blob: preview
      <img src={page.previewUrl} alt={t("pageN", { n: pages.indexOf(page) + 1 })} className={className} />
    ) : (
      <div className="flex h-40 items-center justify-center gap-2 text-sm text-text-muted">
        <LoaderCircle aria-hidden className="size-4 animate-spin" />
        {t("processing")}
      </div>
    );

  const titles: Record<View, string> = {
    camera: t("scanTitle"),
    review: t("reviewTitle"),
    corners: t("cornersTitle"),
    preview: t("previewTitle"),
  };

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="tap-target flex items-center gap-2 rounded-md border border-primary-600 bg-primary-50 px-4 py-2 text-sm font-semibold text-primary-800 transition hover:bg-primary-100"
      >
        <ScanLine aria-hidden className="size-4" />
        {t("scanButton")}
      </button>
      {savedNotice && (
        <p
          role="status"
          className={`mt-3 max-w-xs text-sm font-medium ${savedNotice === "recorded" ? "text-success-fg" : "text-warning-fg"}`}
        >
          {savedNotice === "recorded" ? t("scanSaved") : tAudit("saved.body")}
        </p>
      )}

      <dialog
        ref={dialogRef}
        onClose={onDialogClose}
        aria-labelledby="scanner-title"
        className="m-0 h-dvh max-h-none w-full max-w-none bg-surface p-0 text-text backdrop:bg-black/60 sm:m-auto sm:h-[min(92dvh,880px)] sm:max-w-3xl sm:rounded-2xl"
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <ScanLine aria-hidden className="size-5 text-primary-600" />
            <h2 id="scanner-title" className="text-base font-bold">
              {titles[view]}
            </h2>
            <span className="text-sm text-text-muted">· {t("pagesCount", { count: pages.length })}</span>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label={t("close")}
              className="tap-target ms-auto flex items-center justify-center rounded-md p-2 text-text-muted hover:bg-surface-muted hover:text-text"
            >
              <X aria-hidden className="size-5" />
            </button>
          </div>

          {/* Camera — stays mounted (hidden) in other views so the stream keeps running. */}
          <div className={view === "camera" ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
            <div className="relative min-h-0 flex-1 bg-black">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className={`absolute inset-0 h-full w-full object-contain ${camera === "live" ? "" : "invisible"}`}
              />
              {camera === "live" && liveQuad && videoSize.width > 0 && (
                <svg
                  aria-hidden
                  viewBox={`0 0 ${videoSize.width} ${videoSize.height}`}
                  preserveAspectRatio="xMidYMid meet"
                  className="pointer-events-none absolute inset-0 h-full w-full"
                >
                  <polygon
                    points={liveQuad.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="rgba(20,184,166,0.18)"
                    stroke="#2dd4bf"
                    strokeWidth={Math.max(videoSize.width, videoSize.height) / 220}
                    strokeLinejoin="round"
                  />
                </svg>
              )}
              {flash && <div aria-hidden className="absolute inset-0 bg-white/70" />}

              {camera === "starting" && (
                <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-white/80">
                  <LoaderCircle aria-hidden className="size-5 animate-spin" />
                  {t("cameraStarting")}
                </div>
              )}

              {camera === "unavailable" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
                  <Camera aria-hidden className="size-10 text-white/60" />
                  <p className="max-w-sm text-sm text-white/85">{t("cameraUnavailable")}</p>
                  <label className="tap-target flex cursor-pointer items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-text hover:bg-white/90">
                    <ImagePlus aria-hidden className="size-4" />
                    {t("takePhotos")}
                    {fileInput(true)}
                  </label>
                </div>
              )}

              {camera === "live" && (
                <>
                  <p
                    role="status"
                    className={`absolute inset-x-0 top-3 mx-auto w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                      liveQuad ? "bg-primary-600 text-white" : "bg-black/60 text-white/85"
                    }`}
                  >
                    {full ? t("maxPagesReached") : liveQuad ? t("pageDetected") : t("lookingForPage")}
                  </p>
                  <button
                    type="button"
                    onClick={() => void capture()}
                    disabled={full || capturing}
                    aria-label={t("capture")}
                    className="absolute bottom-5 left-1/2 flex size-16 -translate-x-1/2 items-center justify-center rounded-full border-4 border-white/60 bg-white shadow-lg transition active:scale-95 disabled:opacity-40"
                  >
                    {capturing ? (
                      <LoaderCircle aria-hidden className="size-6 animate-spin text-text-muted" />
                    ) : (
                      <span className="size-12 rounded-full border-2 border-text/20" />
                    )}
                  </button>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-3">
              {pages.length === 0 ? (
                <p className="min-w-0 flex-1 text-sm text-text-muted">{t("noPagesHint")}</p>
              ) : (
                <ol className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
                  {pages.map((page, i) => (
                    <li key={page.id} className="shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentId(page.id);
                          setView("review");
                        }}
                        aria-label={t("pageN", { n: i + 1 })}
                        className="relative flex size-16 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-muted"
                      >
                        {pageImage(page, "max-h-full max-w-full object-contain")}
                        <span className="absolute bottom-0.5 start-1 rounded bg-black/60 px-1 text-[10px] font-semibold text-white">
                          {i + 1}
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
              {camera === "live" && (
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-primary-700 hover:underline">
                  <ImagePlus aria-hidden className="size-3.5" />
                  {t("addFromFiles")}
                  {fileInput(false)}
                </label>
              )}
              {pages.length > 0 && (
                <button type="button" className={primary} onClick={() => setView("preview")}>
                  <Check aria-hidden className="size-4" />
                  {t("reviewAll", { count: pages.length })}
                </button>
              )}
            </div>
          </div>

          {/* Review one page, right after capturing it (or when picked). */}
          {view === "review" && current && (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-surface-muted p-4">
                {pageImage(current, "max-h-full max-w-full rounded shadow-md")}
              </div>
              <p className="px-4 pt-3 text-sm text-text-muted">
                {current.quad ? t("reviewDetected") : t("reviewNotDetected")}
              </p>
              <div className="flex flex-wrap items-center gap-2 px-4 py-3">
                <button type="button" className={secondary} onClick={() => setView("corners")}>
                  <Crop aria-hidden className="size-4" />
                  {t("adjustCorners")}
                </button>
                <button type="button" className={iconOnly} aria-label={t("rotateLeft")} title={t("rotateLeft")} onClick={() => rotateBy(current.id, -1)}>
                  <RotateCcw aria-hidden className="size-4" />
                </button>
                <button type="button" className={iconOnly} aria-label={t("rotate")} title={t("rotate")} onClick={() => rotateBy(current.id, 1)}>
                  <RotateCw aria-hidden className="size-4" />
                </button>
                <button
                  type="button"
                  className={`${secondary} hover:border-danger-fg hover:text-danger-fg`}
                  onClick={() => {
                    removePage(current.id);
                    setView("camera");
                  }}
                >
                  <Trash2 aria-hidden className="size-4" />
                  {t("retake")}
                </button>
                <div className="ms-auto flex flex-wrap gap-2">
                  <button type="button" className={secondary} disabled={full} onClick={() => setView("camera")}>
                    <Plus aria-hidden className="size-4" />
                    {t("keepAndNext")}
                  </button>
                  <button type="button" className={primary} onClick={() => setView("preview")}>
                    <Check aria-hidden className="size-4" />
                    {t("reviewAll", { count: pages.length })}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Adjust corners by hand. */}
          {view === "corners" && current && (
            <div className="min-h-0 flex-1">
              <CornerEditor
                key={current.id}
                photoUrl={current.photoUrl}
                width={current.width}
                height={current.height}
                initial={current.quad ?? current.detected ?? fullFrameQuad(current.width, current.height)}
                detected={current.detected}
                onCancel={() => setView("review")}
                onApply={(quad) => {
                  updatePage(current.id, (p) => ({ ...p, quad }));
                  setView("review");
                }}
              />
            </div>
          )}

          {/* Final preview of every page, then save. */}
          {view === "preview" && (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto bg-surface-muted px-4 py-4">
                <p className="mb-3 text-sm text-text-muted">{t("previewHint")}</p>
                <ol className="flex flex-col gap-5">
                  {pages.map((page, i) => (
                    <li key={page.id} className="rounded-lg border border-border bg-surface p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-sm font-semibold">{t("pageN", { n: i + 1 })}</span>
                        <div className="ms-auto flex gap-1.5">
                          <button
                            type="button"
                            className={iconOnly}
                            aria-label={t("editPage")}
                            title={t("editPage")}
                            onClick={() => {
                              setCurrentId(page.id);
                              setView("review");
                            }}
                          >
                            <Crop aria-hidden className="size-4" />
                          </button>
                          <button type="button" className={iconOnly} aria-label={t("moveUp")} title={t("moveUp")} disabled={i === 0} onClick={() => movePage(page.id, -1)}>
                            <ArrowUp aria-hidden className="size-4" />
                          </button>
                          <button type="button" className={iconOnly} aria-label={t("moveDown")} title={t("moveDown")} disabled={i === pages.length - 1} onClick={() => movePage(page.id, 1)}>
                            <ArrowDown aria-hidden className="size-4" />
                          </button>
                          <button type="button" className={`${iconOnly} hover:border-danger-fg hover:text-danger-fg`} aria-label={t("removePage")} title={t("removePage")} onClick={() => removePage(page.id)}>
                            <Trash2 aria-hidden className="size-4" />
                          </button>
                        </div>
                      </div>
                      <div className="flex justify-center">{pageImage(page, "max-h-[60vh] max-w-full rounded border border-border")}</div>
                    </li>
                  ))}
                </ol>
                <button type="button" className={`${secondary} mt-4`} disabled={full} onClick={() => setView("camera")}>
                  <Plus aria-hidden className="size-4" />
                  {t("addPage")}
                </button>
              </div>

              <div className="grid gap-3 border-t border-border px-4 py-3 sm:grid-cols-[auto_1fr_1fr_auto] sm:items-end">
                <fieldset>
                  <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">{t("modeLabel")}</legend>
                  <div className="flex rounded-md border border-border p-0.5">
                    {(["document", "color"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        aria-pressed={mode === m}
                        onClick={() => setMode(m)}
                        className={`rounded px-3 py-1.5 text-sm font-medium transition ${
                          mode === m ? "bg-primary-600 text-white" : "text-text-muted hover:text-text"
                        }`}
                      >
                        {m === "document" ? t("modeDocument") : t("modeColor")}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">{t("recordTypeLabel")}</span>
                  <select value={recordType} onChange={(e) => setRecordType(e.target.value)} className={selectInput}>
                    <option value="lab_report">{t("types.lab_report")}</option>
                    <option value="prescription_photo">{t("types.prescription_photo")}</option>
                    <option value="other_document">{t("types.other_document")}</option>
                  </select>
                </label>
                {familyMembers.length > 0 ? (
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">{t("familyMemberLabel")}</span>
                    <select value={familyMemberId} onChange={(e) => setFamilyMemberId(e.target.value)} className={selectInput}>
                      <option value="">{t("forSelf")}</option>
                      {familyMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.fullName}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <span className="hidden sm:block" />
                )}
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={pages.length === 0 || saving}
                  aria-busy={saving || undefined}
                  className={primary}
                >
                  {saving && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
                  {saving ? t("savingScan") : t("saveScan")}
                </button>
                {error && (
                  <p role="alert" className="text-sm font-medium text-danger-fg sm:col-span-4">
                    {error}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}
