"use client";

import { useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Languages } from "lucide-react";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { LOCALE_LABELS, routing, type AppLocale } from "@/i18n/routing";

/**
 * Header language picker. Swaps only the locale prefix and keeps you on
 * the same page with the same query (e.g. a directory search). next-intl's
 * middleware remembers the choice in its NEXT_LOCALE cookie, so later
 * visits to "/" land in the same language.
 *
 * This only changes what the site is shown in; a patient's saved
 * notification language lives in their profile settings.
 */
export function LanguageSwitcher({ label }: { label: string }) {
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onChange(next: AppLocale) {
    const query = searchParams.toString();
    startTransition(() => {
      router.replace(`${pathname}${query ? `?${query}` : ""}`, { locale: next, scroll: false });
    });
  }

  return (
    <label
      className={`tap-target flex items-center gap-1.5 rounded-md px-2 text-sm text-text-muted transition hover:bg-surface-muted hover:text-text ${
        pending ? "opacity-60" : ""
      }`}
    >
      <Languages aria-hidden className="size-4 shrink-0" />
      <span className="sr-only">{label}</span>
      <select
        value={locale}
        onChange={(e) => onChange(e.target.value as AppLocale)}
        disabled={pending}
        className="cursor-pointer appearance-none bg-transparent py-2 pe-1 text-sm font-medium focus:outline-none"
      >
        {routing.locales.map((l) => (
          <option key={l} value={l} lang={l}>
            {LOCALE_LABELS[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
