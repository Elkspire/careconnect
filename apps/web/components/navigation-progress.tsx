"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * A thin bar across the top of the page while a navigation is in flight.
 * App Router has no "navigation started" event, and server-rendered pages
 * can take a moment, so a clicked link used to look like nothing happened.
 *
 * Starts on a click of any same-site link (or a GET form submit) that goes
 * somewhere new; finishes when the URL actually changes. A safety timeout
 * hides it if a navigation is abandoned (e.g. the server redirected back
 * to the same URL).
 */
export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <ProgressBar />
    </Suspense>
  );
}

const SAFETY_TIMEOUT_MS = 15_000;

function ProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // The URL changed: the navigation we were showing has landed. Compared
  // during render (React's "adjust state when a prop changes" pattern)
  // rather than in an effect, which would cost an extra render.
  const url = `${pathname}?${searchParams.toString()}`;
  const [seenUrl, setSeenUrl] = useState(url);
  if (seenUrl !== url) {
    setSeenUrl(url);
    if (state === "loading") setState("done");
  }

  useEffect(() => {
    if (state !== "done") return;
    const t = setTimeout(() => setState("idle"), 300);
    return () => clearTimeout(t);
  }, [state]);

  useEffect(() => {
    function start() {
      setState("loading");
      clearTimeout(safetyTimer.current);
      safetyTimer.current = setTimeout(() => setState("idle"), SAFETY_TIMEOUT_MS);
    }

    function isNewSameSiteUrl(url: URL) {
      if (url.origin !== window.location.origin) return false;
      // Same page, or only the #hash differs: no navigation will happen.
      return url.pathname !== window.location.pathname || url.search !== window.location.search;
    }

    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      const anchor = (e.target as Element | null)?.closest("a");
      if (!anchor || !anchor.href || anchor.hasAttribute("download")) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (isNewSameSiteUrl(new URL(anchor.href))) start();
    }

    function onSubmit(e: SubmitEvent) {
      const form = e.target as HTMLFormElement;
      // Server-action forms show their own pending state (SubmitButton).
      if (e.defaultPrevented || form.method.toLowerCase() !== "get") return;
      const url = new URL(form.action || window.location.href);
      url.search = new URLSearchParams(
        new FormData(form, e.submitter) as unknown as Record<string, string>,
      ).toString();
      if (isNewSameSiteUrl(url)) start();
    }

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      clearTimeout(safetyTimer.current);
    };
  }, []);

  useEffect(() => {
    if (state !== "loading") clearTimeout(safetyTimer.current);
  }, [state]);

  if (state === "idle") return null;

  return (
    <div
      role="progressbar"
      aria-label="Loading"
      aria-busy={state === "loading"}
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5"
    >
      <div
        className={`h-full bg-primary-600 shadow-[0_0_8px] shadow-primary-500 ${
          state === "loading"
            ? "animate-[nav-progress_8s_ease-out_forwards] motion-reduce:w-[85%] motion-reduce:animate-none"
            : "w-full opacity-0 transition-opacity duration-300"
        }`}
      />
    </div>
  );
}
