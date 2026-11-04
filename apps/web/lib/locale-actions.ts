"use server";

import { cookies } from "next/headers";
import { hasLocale } from "next-intl";
import { LOCALE_COOKIE, routing } from "@/i18n/routing";
import { UnauthenticatedError } from "@/lib/api/authedFetch";
import { getMyProfile, upsertMyProfile } from "@/lib/api/patients";

/**
 * The header's language switch. Two things hold a language: the
 * NEXT_LOCALE cookie (what the site is shown in) and a patient's saved
 * preferredLanguage (what their notifications use, shown in Settings).
 * Changing only the cookie let the two drift apart — the header said
 * Roman Urdu while Settings still said Urdu — so this updates both.
 *
 * The cookie always wins: being signed out, being a doctor or staff
 * member (no patient profile), or the profile save failing never blocks
 * the switch itself.
 */
export async function saveLocaleAction(locale: string): Promise<void> {
  if (!hasLocale(routing.locales, locale)) {
    return;
  }
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  try {
    const profile = await getMyProfile();
    if (profile && profile.preferredLanguage !== locale) {
      await upsertMyProfile({ fullName: profile.fullName, preferredLanguage: locale });
    }
  } catch (err) {
    // Signed out is the normal case for most visitors — nothing to sync.
    // Anything else (e.g. the API rejecting the value) is worth a log
    // line; the site still switches either way.
    if (!(err instanceof UnauthenticatedError)) {
      console.error("saveLocaleAction: profile language not updated", err);
    }
  }
}
