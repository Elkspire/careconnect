"use client";

import { useState } from "react";
import { HeartPulse, Stethoscope, UserCog, UserRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { checkRoleEligibility } from "@/lib/api/auth";
import { FormField } from "@/components/ui/form-field";
import { Alert } from "@/components/ui/alert";

type Method = "phone" | "email";
type Role = "patient" | "practitioner" | "staff";

// Temporarily off: phone OTP delivery has no reliable SMS provider
// configured, so offering it just leads to a code that never arrives.
// Flip back to true once that's sorted — nothing else needs to change,
// the phone flow itself is untouched.
const PHONE_LOGIN_ENABLED = false;

export default function LoginPage() {
  const t = useTranslations("auth");
  const tOnboarding = useTranslations("onboarding");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const explicitNext = searchParams.get("next");

  const [method, setMethod] = useState<Method>(PHONE_LOGIN_ENABLED ? "phone" : "email");
  const [step, setStep] = useState<"input" | "otp">("input");
  const [role, setRole] = useState<Role | null>(null);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Only a brand-new account (nothing decided yet) ever looks at this hint
  // — see post-login/page.tsx. An explicit deep-link `next` always wins.
  const effectiveNext = explicitNext ?? (role ? `/post-login?roleHint=${role}` : "/post-login");

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

    if (role && method === "email") {
      const eligible = await checkRoleEligibility(email, role);
      if (!eligible) {
        setPending(false);
        setError(
          role === "patient"
            ? t("roleMismatchPatient")
            : role === "practitioner"
              ? t("roleMismatchPractitioner")
              : t("roleMismatchStaff"),
        );
        return;
      }
    }

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
              emailRedirectTo: `${window.location.origin}/${locale}/auth/callback?next=${encodeURIComponent(effectiveNext)}`,
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
    window.location.href = `/${locale}${effectiveNext}`;
  }

  const inputClasses =
    "tap-target w-full rounded-md border border-border px-3 py-2 text-sm text-text focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";
  const primaryButtonClasses =
    "tap-target w-full rounded-md bg-primary-700 py-2.5 text-sm font-semibold text-text-on-primary transition hover:bg-primary-800 disabled:opacity-60";

  return (
    <main className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center px-4 py-10">
      {/* Matches the demo's .login-screen: a 16px-radius white card with a
          soft shadow, heartbeat mark, centred title/subtitle, then a
          two-column grid of role cards. */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-md sm:p-8">
        <div className="mb-6 text-center">
          <HeartPulse aria-hidden className="mx-auto size-10 text-primary-600" />
        </div>
        <h1 className="text-center text-2xl font-bold text-text">{t("heading")}</h1>
        {step === "input" && (
          <p className="mt-2 text-center text-[0.95rem] text-text-muted">{t("subtitle")}</p>
        )}

        {step === "input" && (
          <div className="mt-7 grid grid-cols-2 gap-4">
            <RoleCard
              selected={role === "patient"}
              onClick={() => setRole(role === "patient" ? null : "patient")}
              icon={<UserRound aria-hidden className="mx-auto size-8 text-primary-600" />}
              title={tOnboarding("patientOption")}
              description={tOnboarding("patientOptionDesc")}
            />
            <RoleCard
              selected={role === "practitioner"}
              onClick={() => setRole(role === "practitioner" ? null : "practitioner")}
              icon={<Stethoscope aria-hidden className="mx-auto size-8 text-primary-600" />}
              title={tOnboarding("practitionerOption")}
              description={tOnboarding("practitionerOptionDesc")}
            />
            {/* Not in the demo (which only has patient/doctor) — kept as a
                full-width row under the pair so the demo's two-column grid
                stays intact instead of squeezing three cards into 420px. */}
            <RoleCard
              wide
              selected={role === "staff"}
              onClick={() => setRole(role === "staff" ? null : "staff")}
              icon={<UserCog aria-hidden className="size-7 shrink-0 text-primary-600" />}
              title={tOnboarding("staffOption")}
              description={tOnboarding("staffOptionDesc")}
            />
          </div>
        )}

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
      </div>
    </main>
  );
}

function RoleCard({
  selected,
  onClick,
  icon,
  title,
  description,
  wide = false,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-xl border-2 p-5 transition ${
        wide ? "col-span-2 flex items-center gap-4 py-4 text-start" : "text-center"
      } ${
        selected
          ? "border-primary-600 bg-primary-100"
          : "border-border hover:border-primary-600 hover:bg-primary-100"
      }`}
    >
      {icon}
      <span className="block">
        <span className={`block text-base font-semibold text-text ${wide ? "" : "mt-2"}`}>
          {title}
        </span>
        <span className="mt-1 block text-xs text-text-muted">{description}</span>
      </span>
    </button>
  );
}
