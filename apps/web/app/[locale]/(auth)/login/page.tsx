"use client";

import { useState } from "react";
import { HeartPulse, LoaderCircle, Stethoscope, UserCog, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { normalizePhone } from "@careconnect/validation";
import { createClient } from "@/lib/supabase/client";
import { checkRoleEligibility, type LoginRole } from "@/lib/api/auth";
import { FormField } from "@/components/ui/form-field";
import { Alert } from "@/components/ui/alert";

type Role = LoginRole;

export default function LoginPage() {
  const t = useTranslations("auth");
  const tOnboarding = useTranslations("onboarding");
  const searchParams = useSearchParams();
  const explicitNext = searchParams.get("next");

  const [step, setStep] = useState<"input" | "otp">("input");
  const [role, setRole] = useState<Role | null>(null);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Only a brand-new account (nothing decided yet) ever looks at this hint
  // — see post-login/page.tsx. An explicit deep-link `next` always wins.
  const effectiveNext = explicitNext ?? (role ? `/post-login?roleHint=${role}` : "/post-login");

  function changeNumber() {
    setStep("input");
    setError(null);
    setCode("");
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // Accept what people actually type ("0300 1234567") and store the
    // E.164 form Supabase needs, so the OTP step and the code we verify
    // against use the exact same number.
    const normalized = normalizePhone(phone);
    setPhone(normalized);
    setPending(true);

    if (role) {
      const { ok, suggestedRole } = await checkRoleEligibility(normalized, role);
      if (!ok) {
        setPending(false);
        setError(
          suggestedRole === "patient"
            ? t("roleUsePatient")
            : suggestedRole === "practitioner"
              ? t("roleUseProvider")
              : suggestedRole === "staff"
                ? t("roleUseStaff")
                : t("roleNotInvitedStaff"),
        );
        return;
      }
    }

    const supabase = createClient();
    const { error: sendError } = await supabase.auth.signInWithOtp({ phone: normalized });
    setPending(false);
    if (sendError) {
      // Supabase's own message is kept alongside the friendly one while
      // phone auth is being set up — "Unsupported phone provider" or
      // "Invalid phone number" tells you exactly which dashboard setting
      // is missing, the generic string alone doesn't.
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
    window.location.href = effectiveNext;
  }

  const inputClasses =
    "tap-target w-full rounded-md border border-border px-3 py-2 text-sm text-text focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";
  const primaryButtonClasses =
    "tap-target w-full rounded-md bg-primary-700 py-2.5 text-sm font-semibold text-text-on-primary transition hover:bg-primary-800 disabled:cursor-wait disabled:opacity-60";

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

        {error && (
          <div className="mt-4">
            <Alert tone="danger" title={error} />
          </div>
        )}

        {step === "input" ? (
          <form onSubmit={handleSendCode} className="mt-6 flex flex-col gap-4">
            <FormField label={t("phoneLabel")} hint={t("phoneHint")}>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t("phonePlaceholder")}
                className={inputClasses}
              />
            </FormField>
            <button
              type="submit"
              disabled={pending}
              aria-busy={pending || undefined}
              className={primaryButtonClasses}
            >
              <span className="inline-flex items-center justify-center gap-2">
                {pending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
                {t("sendCode")}
              </span>
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="mt-6 flex flex-col gap-4">
            <p className="text-sm text-text-muted">{t("sentCodeTo", { identifier: phone })}</p>
            <FormField label={t("codeLabel")}>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={t("codePlaceholder")}
                className={inputClasses}
              />
            </FormField>
            <button
              type="submit"
              disabled={pending}
              aria-busy={pending || undefined}
              className={primaryButtonClasses}
            >
              <span className="inline-flex items-center justify-center gap-2">
                {pending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
                {t("verify")}
              </span>
            </button>
            <button
              type="button"
              onClick={changeNumber}
              className="text-xs font-medium text-text-muted hover:text-text"
            >
              {t("changeNumber")}
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
