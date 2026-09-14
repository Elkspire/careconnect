"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Method = "phone" | "email";

export default function LoginPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/post-login";

  const [method, setMethod] = useState<Method>("phone");
  const [step, setStep] = useState<"input" | "otp">("input");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const identifier = method === "phone" ? phone : email;

  function switchMethod(next: Method) {
    setMethod(next);
    setStep("input");
    setError(null);
    setCode("");
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const supabase = createClient();
    const { error: sendError } =
      method === "phone"
        ? await supabase.auth.signInWithOtp({ phone })
        : await supabase.auth.signInWithOtp({
            email,
            options: {
              // The typed-code flow below never uses this — only a clicked
              // link does, landing on the callback route to exchange its
              // PKCE code for a session server-side.
              emailRedirectTo: `${window.location.origin}/${locale}/auth/callback?next=${encodeURIComponent(next)}`,
            },
          });
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
    const { error: verifyError } =
      method === "phone"
        ? await supabase.auth.verifyOtp({ phone, token: code, type: "sms" })
        : await supabase.auth.verifyOtp({ email, token: code, type: "email" });
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

        {step === "input" && (
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => switchMethod("phone")}
              className="btn gh sm tap-target"
              aria-pressed={method === "phone"}
              style={method === "phone" ? { borderColor: "var(--color-stamp)" } : undefined}
            >
              {t("methodPhone")}
            </button>
            <button
              type="button"
              onClick={() => switchMethod("email")}
              className="btn gh sm tap-target"
              aria-pressed={method === "email"}
              style={method === "email" ? { borderColor: "var(--color-stamp)" } : undefined}
            >
              {t("methodEmail")}
            </button>
          </div>
        )}

        {error && (
          <div className="alert mt-4">
            <div>
              <b>{error}</b>
            </div>
          </div>
        )}

        {step === "input" ? (
          <form onSubmit={handleSendCode} className="mt-6 flex flex-col gap-4">
            {method === "phone" ? (
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
            ) : (
              <label>
                <span className="lbl">{t("emailLabel")}</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("emailPlaceholder")}
                  className="field tap-target"
                />
              </label>
            )}
            <button type="submit" disabled={pending} className="btn tap-target">
              {t("sendCode")}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="mt-6 flex flex-col gap-4">
            <p className="text-sm" style={{ color: "var(--color-ink-soft)" }}>
              {t("sentCodeTo", { identifier })}
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
              onClick={() => switchMethod(method)}
              className="mono text-xs"
              style={{ color: "var(--color-ink-soft)", letterSpacing: "0.08em" }}
            >
              {method === "phone" ? t("changeNumber") : t("changeEmail")}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
