"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/post-login";

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const supabase = createClient();
    const { error: sendError } = await supabase.auth.signInWithOtp({ phone });
    setPending(false);
    if (sendError) {
      setError(t("error"));
      return;
    }
    setStep("otp");
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone,
      token: code,
      type: "sms",
    });
    setPending(false);
    if (verifyError) {
      setError(t("invalidCode"));
      return;
    }
    // A hard navigation, not next-intl's client-side router.push: a soft
    // transition can replay a route segment Next.js prefetched *before*
    // sign-in (e.g. hovering "Book at this clinic" while logged out), which
    // serves the stale unauthenticated/redirect-to-login response instead of
    // re-running proxy.ts with the now-fresh session cookie. A full page
    // load guarantees the browser sends the real cookie jar and proxy.ts
    // re-evaluates from scratch.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/${locale}${next}`;
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10">
      <div className="slip">
        <p className="slip-no mono">CC / AUTH-01</p>
        <h1>{t("heading")}</h1>

        {error && (
          <div className="alert mt-4">
            <div>
              <b>{error}</b>
            </div>
          </div>
        )}

        {step === "phone" ? (
          <form onSubmit={handleSendCode} className="mt-6 flex flex-col gap-4">
            <label>
              <span className="lbl">{t("phoneLabel")}</span>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t("phonePlaceholder")}
                className="field tap-target"
              />
            </label>
            <button type="submit" disabled={pending} className="btn tap-target">
              {t("sendCode")}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="mt-6 flex flex-col gap-4">
            <p className="text-sm" style={{ color: "var(--color-ink-soft)" }}>
              {t("sentCodeTo", { phone })}
            </p>
            <label>
              <span className="lbl">{t("codeLabel")}</span>
              <input
                type="text"
                inputMode="numeric"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={t("codePlaceholder")}
                className="field tap-target mono"
              />
            </label>
            <button type="submit" disabled={pending} className="btn tap-target">
              {t("verify")}
            </button>
            <button
              type="button"
              onClick={() => setStep("phone")}
              className="mono text-xs"
              style={{ color: "var(--color-ink-soft)", letterSpacing: "0.08em" }}
            >
              {t("changeNumber")}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
