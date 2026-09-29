"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";

interface Toast {
  id: number;
  title: string;
  body: string;
}

const AUTO_DISMISS_MS = 6000;

/**
 * Mounted once in app/[locale]/layout.tsx, so a toast can appear from any
 * page — not just while on /patient/notifications. Fed by public/sw.js's
 * "push" handler, which postMessages every push payload to open tabs
 * alongside (not instead of) the OS notification.
 */
export function ToastProvider() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }
    // Idempotent — components/push-notifications.tsx may also register this
    // same script; the browser returns the existing registration either way.
    // .update() forces an immediate byte-check against the network instead
    // of waiting on the browser's own throttled schedule, so a sw.js change
    // (like this file's postMessage broadcast) takes effect on the very
    // next load rather than however long the browser feels like waiting.
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => registration.update())
      .catch(() => {});

    function handleMessage(event: MessageEvent) {
      if (event.data?.type !== "careconnect-push") {
        return;
      }
      const toast: Toast = {
        id: Date.now() + Math.random(),
        title: String(event.data.title ?? "CareConnect"),
        body: String(event.data.body ?? ""),
      };
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, AUTO_DISMISS_MS);
    }

    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () => navigator.serviceWorker.removeEventListener("message", handleMessage);
  }, []);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed top-4 flex w-full max-w-sm flex-col gap-2 px-4"
      style={{ insetInlineEnd: 0, zIndex: 100 }}
    >
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          className="flex items-start gap-3 rounded-lg border border-border bg-surface p-4 text-start shadow-lg [animation:toast-in_0.25s_ease]"
          onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
        >
          <Bell aria-hidden className="mt-0.5 size-5 shrink-0 text-primary-600" />
          <span>
            <b className="block text-sm font-semibold text-text">{toast.title}</b>
            {toast.body && <p className="mt-0.5 text-sm text-text-muted">{toast.body}</p>}
          </span>
        </button>
      ))}
    </div>
  );
}
