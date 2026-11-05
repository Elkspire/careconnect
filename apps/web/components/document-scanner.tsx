"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  ImagePlus,
  LoaderCircle,
  RotateCw,
  ScanLine,
  Trash2,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { buildJpegPdf } from "@/lib/scan/jpeg-pdf";
import {
  captureFrame,
  EXPORT_ATTEMPTS,
  renderPage,
  type Rotation,
  type ScanMode,
} from "@/lib/scan/process-page";

/** The API and Next's server-action body limit are both 10 MB; leave headroom for the form fields. */
const MAX_PDF_BYTES = 9.5 * 1024 * 1024;
const MAX_PAGES = 20;

interface ScannedPage {
  id: string;
  blob: Blob;
  url: string;
  rotation: Rotation;
}

type CameraState = "off" | "starting" | "live" | "unavailable";

/**
 * "Scan a document" for the patient's records: photograph each page with
 * the device camera (rear camera on phones), tidy the pages up, and save
 * them as one PDF through the same upload action as the file form.
 *
 * Everything happens in the browser — capture, the "Document" clean-up and
 * PDF assembly — so nothing new is needed on the server. Without a usable
 * camera (permission denied, desktop with no webcam) it falls back to the
 * device's own camera/photo picker via a file input.
 */
export function DocumentScanner({
  familyMembers,
  uploadAction,
}: {
  familyMembers: Array<{ id: string; fullName: string }>;
  uploadAction: (formData: FormData) => Promise<void>;
}) {
  const t = useTranslations("vault");
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [camera, setCamera] = useState<CameraState>("off");
  const [pages, setPages] = useState<ScannedPage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<ScanMode>("document");
  const [recordType, setRecordType] = useState("lab_report");
  const [familyMemberId, setFamilyMemberId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const selectedIndex = pages.findIndex((p) => p.id === selectedId);
  const full = pages.length >= MAX_PAGES;

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCamera("off");
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamera("unavailable");
      return;
    }
    setCamera("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
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

  function open() {
    setError(null);
    setSavedNotice(false);
    dialogRef.current?.showModal();
    void startCamera();
  }

  function discardPages() {
    pages.forEach((p) => URL.revokeObjectURL(p.url));
    setPages([]);
    setSelectedId(null);
  }

  // Runs for every way the dialog closes (X button, Esc, after saving).
  function onDialogClose() {
    stopCamera();
    if (!saving) discardPages();
  }

  // Never leave the camera running if the page itself goes away.
  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  function addPage(blob: Blob) {
    const page: ScannedPage = {
      id: crypto.randomUUID(),
      blob,
      url: URL.createObjectURL(blob),
      rotation: 0,
    };
    setPages((prev) => (prev.length >= MAX_PAGES ? prev : [...prev, page]));
    setSelectedId(page.id);
    setError(null);
  }

  async function capture() {
    if (!videoRef.current || camera !== "live" || full) return;
    setFlash(true);
    setTimeout(() => setFlash(false), 150);
    addPage(await captureFrame(videoRef.current));
  }

  function onFilesChosen(files: FileList | null) {
    for (const file of Array.from(files ?? [])) {
      if (file.type.startsWith("image/")) addPage(file);
    }
  }

  function updateSelected(change: (page: ScannedPage) => ScannedPage) {
    setPages((prev) => prev.map((p) => (p.id === selectedId ? change(p) : p)));
  }

  function moveSelected(delta: -1 | 1) {
    setPages((prev) => {
      const i = prev.findIndex((p) => p.id === selectedId);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  }

  function removeSelected() {
    const page = pages[selectedIndex];
    if (!page) return;
    URL.revokeObjectURL(page.url);
    const rest = pages.filter((p) => p.id !== page.id);
    setPages(rest);
    setSelectedId(rest[Math.min(selectedIndex, rest.length - 1)]?.id ?? null);
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
            await renderPage(page.blob, page.rotation, mode, attempt.maxSide, attempt.quality),
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
      await uploadAction(formData);

      discardPages();
      dialogRef.current?.close();
      setSavedNotice(true);
      router.refresh();
    } catch (err) {
      console.error(err);
      setError(t("scanFailed"));
    } finally {
      setSaving(false);
    }
  }

  const previewFilter = mode === "document" ? "grayscale(1) contrast(1.35) brightness(1.08)" : "none";
  const selectInput =
    "tap-target w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";
  const iconButton =
    "tap-target flex items-center justify-center rounded-md border border-border bg-surface p-2 text-text-muted transition hover:border-primary-500 hover:text-text disabled:opacity-40";

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
        <p role="status" className="mt-3 text-sm font-medium text-success-fg">
          {t("scanSaved")}
        </p>
      )}

      <dialog
        ref={dialogRef}
        onClose={onDialogClose}
        aria-labelledby="scanner-title"
        className="m-0 h-dvh max-h-none w-full max-w-none bg-surface p-0 text-text backdrop:bg-black/60 sm:m-auto sm:h-[min(92dvh,860px)] sm:max-w-3xl sm:rounded-2xl"
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <ScanLine aria-hidden className="size-5 text-primary-600" />
            <h2 id="scanner-title" className="text-base font-bold">
              {t("scanTitle")}
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

          {/* Camera */}
          <div className="relative min-h-0 flex-1 bg-black">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className={`h-full w-full object-contain ${camera === "live" ? "" : "invisible"}`}
            />
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
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    className="sr-only"
                    onChange={(e) => {
                      onFilesChosen(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            )}

            {camera === "live" && (
              <>
                <div aria-hidden className="pointer-events-none absolute inset-[8%] rounded-lg border-2 border-dashed border-white/50" />
                <p className="absolute inset-x-0 top-3 text-center text-xs text-white/80">
                  {full ? t("maxPagesReached") : t("cameraHint")}
                </p>
                <button
                  type="button"
                  onClick={() => void capture()}
                  disabled={full}
                  aria-label={t("capture")}
                  className="absolute bottom-5 left-1/2 flex size-16 -translate-x-1/2 items-center justify-center rounded-full border-4 border-white/60 bg-white shadow-lg transition active:scale-95 disabled:opacity-40"
                >
                  <span className="size-12 rounded-full border-2 border-text/20" />
                </button>
              </>
            )}
          </div>

          {/* Pages */}
          <div className="border-t border-border px-4 py-3">
            {pages.length === 0 ? (
              <p className="text-sm text-text-muted">{t("noPagesHint")}</p>
            ) : (
              <>
                <ol className="flex gap-2 overflow-x-auto pb-1">
                  {pages.map((page, i) => (
                    <li key={page.id} className="shrink-0">
                      <button
                        type="button"
                        onClick={() => setSelectedId(page.id)}
                        aria-pressed={page.id === selectedId}
                        aria-label={t("pageN", { n: i + 1 })}
                        className={`relative flex size-20 items-center justify-center overflow-hidden rounded-md border-2 bg-surface-muted ${
                          page.id === selectedId ? "border-primary-600" : "border-transparent"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- a local blob: preview, not an optimisable remote image */}
                        <img
                          src={page.url}
                          alt=""
                          className="max-h-full max-w-full object-contain transition-transform"
                          style={{ transform: `rotate(${page.rotation}deg)`, filter: previewFilter }}
                        />
                        <span className="absolute bottom-0.5 start-1 rounded bg-black/60 px-1 text-[10px] font-semibold text-white">
                          {i + 1}
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
                {selectedIndex >= 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="me-1 text-xs font-medium text-text-muted">
                      {t("pageN", { n: selectedIndex + 1 })}
                    </span>
                    <button
                      type="button"
                      className={iconButton}
                      aria-label={t("rotate")}
                      title={t("rotate")}
                      onClick={() =>
                        updateSelected((p) => ({ ...p, rotation: ((p.rotation + 90) % 360) as Rotation }))
                      }
                    >
                      <RotateCw aria-hidden className="size-4" />
                    </button>
                    <button
                      type="button"
                      className={iconButton}
                      aria-label={t("moveEarlier")}
                      title={t("moveEarlier")}
                      disabled={selectedIndex === 0}
                      onClick={() => moveSelected(-1)}
                    >
                      <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" />
                    </button>
                    <button
                      type="button"
                      className={iconButton}
                      aria-label={t("moveLater")}
                      title={t("moveLater")}
                      disabled={selectedIndex === pages.length - 1}
                      onClick={() => moveSelected(1)}
                    >
                      <ArrowRight aria-hidden className="size-4 rtl:rotate-180" />
                    </button>
                    <button
                      type="button"
                      className={`${iconButton} hover:border-danger-fg hover:text-danger-fg`}
                      aria-label={t("removePage")}
                      title={t("removePage")}
                      onClick={removeSelected}
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </button>
                  </div>
                )}
              </>
            )}
            {camera === "live" && (
              <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-primary-700 hover:underline">
                <ImagePlus aria-hidden className="size-3.5" />
                {t("addFromFiles")}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    onFilesChosen(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </div>

          {/* Save */}
          <div className="grid gap-3 border-t border-border px-4 py-3 sm:grid-cols-[auto_1fr_1fr_auto] sm:items-end">
            <fieldset>
              <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                {t("modeLabel")}
              </legend>
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
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                {t("recordTypeLabel")}
              </span>
              <select value={recordType} onChange={(e) => setRecordType(e.target.value)} className={selectInput}>
                <option value="lab_report">{t("types.lab_report")}</option>
                <option value="prescription_photo">{t("types.prescription_photo")}</option>
                <option value="other_document">{t("types.other_document")}</option>
              </select>
            </label>
            {familyMembers.length > 0 ? (
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                  {t("familyMemberLabel")}
                </span>
                <select
                  value={familyMemberId}
                  onChange={(e) => setFamilyMemberId(e.target.value)}
                  className={selectInput}
                >
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
              className="tap-target flex items-center justify-center gap-2 rounded-md bg-primary-700 px-4 py-2.5 text-sm font-semibold text-text-on-primary transition hover:bg-primary-800 disabled:cursor-not-allowed disabled:opacity-50"
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
      </dialog>
    </>
  );
}
