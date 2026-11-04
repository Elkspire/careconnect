import { defineRouting } from "next-intl/routing";

/**
 * en, ur (Urdu script, RTL) and ur-Latn (Roman Urdu: Urdu written in Latin
 * letters, LTR). ur-Latn is the standard BCP 47 tag for it, so it's also
 * the URL prefix (/ur-Latn/...) and the message file name. Only ur is RTL
 * — see app/[locale]/layout.tsx for the dir attribute this drives, and
 * packages/config/tailwind-preset.css for the logical-property convention
 * that makes components flip automatically.
 */
export const routing = defineRouting({
  locales: ["en", "ur", "ur-Latn"],
  defaultLocale: "en",
});

export type AppLocale = (typeof routing.locales)[number];

/** Each language's name written in that language, for the switchers. */
export const LOCALE_LABELS: Record<AppLocale, string> = {
  en: "English",
  ur: "اردو",
  "ur-Latn": "Roman Urdu",
};

/**
 * The locale to hand Intl (dates, numbers). Intl formats "ur-Latn" with
 * Urdu-script month names ("6 نومبر"), which Roman Urdu readers don't
 * expect, so it uses Pakistani English formatting ("06-Nov-2026") instead.
 */
export function intlLocale(locale: string): string {
  return locale === "ur-Latn" ? "en-PK" : locale;
}

/**
 * Specialty names come from the API in English and Urdu script. Roman
 * Urdu readers know them by their English names ("Dermatology"), so only
 * the Urdu-script UI uses nameUr — falling back to English where no Urdu
 * name has been entered.
 */
export function localizedName(
  item: { nameEn: string; nameUr: string | null },
  locale: string,
): string {
  return (locale === "ur" && item.nameUr) || item.nameEn;
}
