"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { API_URL } from "@/lib/api/config";

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

function initialStatus(): Status {
  if (typeof window === "undefined") {
    return "checking";
  }
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "unsupported";
  }
  return Notification.permission === "denied" ? "denied" : "checking";
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
  const [status, setStatus] = useState<Status>(initialStatus);

  // Mount-only: whether there's already a subscription can only be known
  // asynchronously, so this can't be folded into initialStatus() above.
  // Deliberately excludes `status` from deps — it must not re-run when
  // handleToggle below sets status to "working".
  useEffect(() => {
    if (initialStatus() !== "checking") {
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
    try {
      if (status === "subscribed") {
        await unsubscribe();
      } else {
        await subscribe();
      }
    } catch {
      setStatus(status === "subscribed" ? "subscribed" : "default");
    }
  }

  if (status === "unsupported") {
    return null;
  }

  const isOn = status === "subscribed";
  const isLocked = status === "checking" || status === "working" || status === "denied";

  return (
    <div className="trow">
      <span>
        {t("enableNotifications")}
        {status === "denied" && <small>{t("notificationsBlocked")}</small>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={isOn}
        aria-label={t("enableNotifications")}
        disabled={isLocked}
        onClick={handleToggle}
        className={`tg ${isOn ? "on" : ""} ${isLocked ? "lock" : ""}`}
      />
    </div>
  );
}
