"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { API_URL } from "@/lib/api/config";
import { ToggleSwitch } from "@/components/ui/toggle-switch";

type Status = "unsupported" | "default" | "denied" | "subscribed" | "checking" | "working";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes;
}

/**
 * A toggle row for the account page (see app/[locale]/(patient)/patient/page.tsx).
 * Turning it off unsubscribes from push but can't revoke the OS-level
 * browser permission already granted — that's a browser/site-settings
 * concept, not something a page can do. Unsubscribing is enough: the
 * server has nothing left to send to.
 */
export function PushNotifications() {
  const t = useTranslations("site");
  // Always starts at "checking" on both server and client — feature
  // support and the existing Notification.permission are real browser
  // state, unknowable during SSR. Computing them synchronously here (this
  // used to check `typeof window === "undefined"`) made the client's
  // first render disagree with the server-rendered HTML whenever push
  // wasn't supported or permission was already denied, which is exactly
  // what threw the hydration mismatch on the patient dashboard. Deferring
  // all of it to the effect below keeps the first render identical on
  // both sides; the real status only ever lands after mount.
  const [status, setStatus] = useState<Status>("checking");
  // handleToggle used to swallow every subscribe()/unsubscribe() failure
  // silently and just revert the toggle — from the outside that looks
  // exactly like "the toggle does nothing" with no way to tell why (e.g.
  // a misconfigured VAPID key on the API, or a real network failure).
  const [error, setError] = useState(false);

  // Deliberately excludes `status` from deps — it must not re-run when
  // handleToggle below sets status to "working".
  useEffect(() => {
    // These two setState calls are the intentional exception the comment
    // above describes: the value genuinely cannot be computed during
    // render without reintroducing the hydration mismatch, since it
    // depends on browser globals that don't exist during SSR.
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => registration.pushManager.getSubscription())
      .then((sub) => setStatus(sub ? "subscribed" : "default"))
      .catch(() => setStatus("unsupported"));
  }, []);

  async function subscribe() {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setStatus(permission === "denied" ? "denied" : "default");
      return;
    }

    // This component is a Client Component, so it can't use the
    // server-only lib/api/notifications.ts helpers (they route through
    // authedFetch, which reads the session via next/headers — importing
    // that from client code breaks the build). Talk to the API directly
    // here instead, using the browser Supabase client's own session.
    const supabase = createClient();
    const [registration, keyRes, session] = await Promise.all([
      navigator.serviceWorker.ready,
      fetch(`${API_URL}/notifications/push/vapid-public-key`),
      supabase.auth.getSession().then((r) => r.data.session),
    ]);
    if (!session) {
      setStatus("default");
      return;
    }
    const { publicKey } = (await keyRes.json()) as { publicKey: string };

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    await fetch(`${API_URL}/notifications/push/subscriptions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(subscription.toJSON()),
    });
    setStatus("subscribed");
  }

  async function unsubscribe() {
    const supabase = createClient();
    const [registration, session] = await Promise.all([
      navigator.serviceWorker.ready,
      supabase.auth.getSession().then((r) => r.data.session),
    ]);
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      if (session) {
        await fetch(`${API_URL}/notifications/push/subscriptions`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
      }
      await subscription.unsubscribe();
    }
    setStatus("default");
  }

  async function handleToggle() {
    setStatus("working");
    setError(false);
    try {
      if (status === "subscribed") {
        await unsubscribe();
      } else {
        await subscribe();
      }
    } catch {
      setStatus(status === "subscribed" ? "subscribed" : "default");
      setError(true);
    }
  }

  if (status === "unsupported") {
    return null;
  }

  const isOn = status === "subscribed";
  const isLocked = status === "checking" || status === "working" || status === "denied";

  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-sm text-text">
        {t("enableNotifications")}
        {status === "denied" && (
          <small className="block text-xs text-text-muted">{t("notificationsBlocked")}</small>
        )}
        {error && <small className="block text-xs text-danger-fg">{t("notificationsError")}</small>}
      </span>
      <div className="ms-auto">
        <ToggleSwitch
          checked={isOn}
          onChange={handleToggle}
          label={t("enableNotifications")}
          disabled={isLocked}
        />
      </div>
    </div>
  );
}
