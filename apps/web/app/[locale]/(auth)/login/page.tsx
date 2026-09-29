"use client";

import { useState } from "react";
import { Stethoscope } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Alert } from "@/components/ui/alert";

type Method = "phone" | "email";

// Temporarily off: phone OTP delivery has no reliable SMS provider
// configured, so offering it just leads to a code that never arrives.
// Flip back to true once that's sorted — nothing else needs to change,
// the phone flow itself is untouched.
const PHONE_LOGIN_ENABLED = false;

export default function LoginPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/post-login";

  const [method, setMethod] = useState<Method>(PHONE_LOGIN_ENABLED ? "phone" : "email");
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
      // Temporarily showing Supabase's actual message alongside the
      // friendly one — this call started failing right after switching to
      // custom SMTP, and the generic string alone gives no way to tell
      // whether that's a bad host/port/credential, an unverified sender,
      // or something else entirely. Revert to just t("error") once this is
      // sorted.
      setError(`${t("error")} (${sendError.message})`);
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

  const inputClasses =
    "tap-target w-full rounded-md border border-border px-3 py-2 text-sm text-text focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";
  const primaryButtonClasses =
    "tap-target rounded-md bg-primary-700 py-2.5 text-sm font-semibold text-text-on-primary transition hover:bg-primary-800 disabled:opacity-60";

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10">
      <Card padding="lg">
        <div className="mb-5 text-center">
          <Stethoscope aria-hidden className="mx-auto size-9 text-primary-600" />
        </div>
        <h1 className="text-center text-xl font-bold text-text">{t("heading")}</h1>

        {step === "input" && PHONE_LOGIN_ENABLED && (
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => switchMethod("phone")}
              aria-pressed={method === "phone"}
              className={`tap-target rounded-md border px-3 py-1.5 text-sm font-medium transition ${
                method === "phone"
                  ? "border-primary-600 bg-primary-50 text-primary-800"
                  : "border-border text-text-muted hover:border-primary-500"
              }`}
            >
              {t("methodPhone")}
            </button>
            <button
              type="button"
              onClick={() => switchMethod("email")}
              aria-pressed={method === "email"}
              className={`tap-target rounded-md border px-3 py-1.5 text-sm font-medium transition ${
                method === "email"
                  ? "border-primary-600 bg-primary-50 text-primary-800"
                  : "border-border text-text-muted hover:border-primary-500"
              }`}
            >
              {t("methodEmail")}
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4">
            <Alert tone="danger" title={error} />
          </div>
        )}

        {step === "input" ? (
          <form onSubmit={handleSendCode} className="mt-6 flex flex-col gap-4">
            {method === "phone" ? (
              <FormField label={t("phoneLabel")}>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t("phonePlaceholder")}
                  className={inputClasses}
                />
              </FormField>
            ) : (
              <FormField label={t("emailLabel")}>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("emailPlaceholder")}
                  className={inputClasses}
                />
              </FormField>
            )}
            <button type="submit" disabled={pending} className={primaryButtonClasses}>
              {t("sendCode")}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="mt-6 flex flex-col gap-4">
            <p className="text-sm text-text-muted">{t("sentCodeTo", { identifier })}</p>
            <FormField label={t("codeLabel")}>
              <input
                type="text"
                inputMode="numeric"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={t("codePlaceholder")}
                className={inputClasses}
              />
            </FormField>
            <button type="submit" disabled={pending} className={primaryButtonClasses}>
              {t("verify")}
            </button>
            <button
              type="button"
              onClick={() => switchMethod(method)}
              className="text-xs font-medium text-text-muted hover:text-text"
            >
              {method === "phone" ? t("changeNumber") : t("changeEmail")}
            </button>
          </form>
        )}
      </Card>
    </main>
  );
}
